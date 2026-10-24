import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(here, "../supabase/standard-test-result-design.md");
const outputPath = resolve(here, "../supabase/seed_standard_test_catalog.sql");
const markdown = await readFile(sourcePath, "utf8");
const categories = [];
const canonicalTests = new Map();
let categoryEntries = 0;
let section = "";

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function defaultSpecimens(test, category) {
  if (test === "Creatinine Clearance") return [
    { type: "Urine", instructions: "Timed collection; enter duration and volume according to the laboratory procedure." },
    { type: "Serum", instructions: "Paired serum creatinine collected according to the laboratory procedure." },
  ];
  if (test === "Urine Albumin-to-Creatinine Ratio (UACR)" || test === "Urine Total Protein") return [{ type: "Urine", instructions: "Use the collection type and handling procedure validated by the laboratory." }];
  if (category === "Hematology") return [{ type: "Whole blood", instructions: "Use the tube, anticoagulant, and handling procedure validated for the selected assay." }];
  if (["Clinical Chemistry", "Lipid Profile", "Liver Function and Related Tests", "Hormones and Endocrinology", "Immunology and Serology"].includes(category)) return [{ type: "Serum", instructions: "Use the specimen type and processing procedure validated for the selected assay." }];
  if (category === "Renal (Kidney) Function") return [{ type: "Serum", instructions: "Use the specimen type and processing procedure validated for the selected assay." }];
  if (category === "Coagulation") return [{ type: "Citrated plasma", instructions: "Use the citrate tube, fill ratio, and processing procedure validated by the laboratory." }];
  if (category === "Clinical Microscopy and Parasitology") {
    if (/fecal|stool parasite|occult blood/i.test(test)) return [{ type: "Stool", instructions: "Collect and transport according to the laboratory's validated procedure." }];
    if (/semen/i.test(test)) return [{ type: "Semen", instructions: "Collect and transport according to the laboratory's validated procedure." }];
    return [{ type: "Urine", instructions: "Collect and transport according to the laboratory's validated procedure." }];
  }
  if (category === "Microbiology") {
    if (/sputum|acid-fast/i.test(test)) return [{ type: "Sputum", instructions: "Collect and transport according to the laboratory's validated procedure." }];
    if (/urine culture/i.test(test)) return [{ type: "Urine", instructions: "Collect and transport according to the laboratory's validated procedure." }];
    return [{ type: "Other", instructions: "Specimen source is test/site dependent; specify and validate collection before enabling this test." }];
  }
  if (category === "Blood Banking and Transfusion Medicine") return [{ type: "Whole blood", instructions: "Use the patient sample and identification procedure validated by the laboratory." }];
  if (category === "Histopathology and Cytology") {
    if (/pap smear/i.test(test)) return [{ type: "Cervical specimen", instructions: "Collect and preserve using the laboratory's validated cytology procedure." }];
    if (/biopsy/i.test(test)) return [{ type: "Tissue", instructions: "Specify the anatomical site and transport/fixation method according to the laboratory procedure." }];
    if (/fine-needle/i.test(test)) return [{ type: "Aspirate", instructions: "Specify anatomical site and prepare/transport according to the laboratory procedure." }];
    return [{ type: "Other", instructions: "Specimen source is site dependent; specify and validate collection before enabling this test." }];
  }
  return [{ type: "Other", instructions: "Confirm specimen type and handling with the laboratory before enabling this test." }];
}

for (const line of markdown.split(/\r?\n/)) {
  if (line.startsWith("## ")) {
    section = line.slice(3).trim();
    if (section !== "Catalog normalization and safe defaults" && !categories.includes(section)
      && line.match(/^## (Hematology|Clinical Chemistry|Lipid Profile|Liver Function and Related Tests|Renal \(Kidney\) Function|Clinical Microscopy and Parasitology|Microbiology|Immunology and Serology|Coagulation|Hormones and Endocrinology|Blood Banking and Transfusion Medicine|Histopathology and Cytology)$/)) {
      categories.push(section);
    }
    continue;
  }
  if (!line.startsWith("| ") || line.startsWith("| Test |") || line.startsWith("|---")) continue;
  if (!categories.includes(section)) continue;

  const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
  if (cells.length !== 3) throw new Error(`Expected 3 table cells in ${section}: ${line}`);
  categoryEntries += 1;
  const [name, input, display] = cells;
  const existing = canonicalTests.get(name);
  if (existing) {
    if (!existing.alsoIn.includes(section)) existing.alsoIn.push(section);
    continue;
  }
  canonicalTests.set(name, { name, category: section, input, display, alsoIn: [] });
}

if (categories.length !== 12) throw new Error(`Expected 12 standard categories; found ${categories.length}.`);
if (categoryEntries !== 81) throw new Error(`Expected 81 category mentions; found ${categoryEntries}.`);
if (canonicalTests.size !== 77) throw new Error(`Expected 77 unique standard tests; found ${canonicalTests.size}.`);
if ([...canonicalTests.values()].some((test) => defaultSpecimens(test.name, test.category).length === 0)) {
  throw new Error("Every canonical test must have at least one provisional specimen requirement.");
}

const codes = new Set();
const testRows = [...canonicalTests.values()].map((test) => {
  const slug = test.name.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase();
  const suffix = createHash("sha256").update(test.name).digest("hex").slice(0, 6).toUpperCase();
  const code = `STD-${slug.slice(0, 29)}-${suffix}`.slice(0, 40);
  if (codes.has(code)) throw new Error(`Generated duplicate standard test code: ${code}`);
  codes.add(code);
  const description = [
    `Suggested technologist input: ${test.input}`,
    `Suggested report presentation: ${test.display}`,
    `Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.`,
  ].join(" ");
  return `    (${sqlLiteral(test.category)}, ${sqlLiteral(test.name)}, ${sqlLiteral(code)}, ${sqlLiteral(description)})`;
});

function testCode(name) {
  const slug = name.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase();
  const suffix = createHash("sha256").update(name).digest("hex").slice(0, 6).toUpperCase();
  return `STD-${slug.slice(0, 29)}-${suffix}`.slice(0, 40);
}
const membershipRows = [...canonicalTests.values()].flatMap((test) =>
  [test.category, ...test.alsoIn].map((category) => `    (${sqlLiteral(testCode(test.name))}, ${sqlLiteral(category)})`));
const specimenRows = [...canonicalTests.values()].flatMap((test) =>
  defaultSpecimens(test.name, test.category).map((specimen) => `    (${sqlLiteral(testCode(test.name))}, ${sqlLiteral(specimen.type)}, ${sqlLiteral(specimen.instructions)})`));

const categoryRows = categories.map((name) => `    (${sqlLiteral(name)}, ${sqlLiteral(`Standard diagnostic test category. Starter tests remain unavailable until this clinic reviews their setup.`)})`);
const sql = `-- Standard Labstream catalog starter seed (12 categories, 81 category mentions, 77 canonical tests).
-- Replace the clinic code below, then run this entire file once in Supabase SQL Editor.
-- Safe to re-run: existing clinic categories and STD-* tests are not overwritten.
-- Starter tests have price 0, no turnaround, and are unavailable until configured.
-- Candidate specimen requirements are included for all starter tests and require lab review.
-- No analytes or reference ranges are guessed or inserted.
--
-- Shared tests (Albumin, Total Protein, Creatinine, BUN) are seeded once and
-- linked to all categories. Do not create duplicate billable catalog rows.

begin;

do $seed$
declare
  target_clinic_code text := 'REPLACE_WITH_CLINIC_CODE';
  target_clinic_id uuid;
begin
  select id into target_clinic_id
    from public.clinics
   where code = target_clinic_code and is_active = true;

  if target_clinic_id is null then
    raise exception 'Active clinic code % was not found. Replace the placeholder with the clinic code.', target_clinic_code;
  end if;

  insert into public.test_categories (clinic_id, name, description)
  select target_clinic_id, seed.name, seed.description
    from (values
${categoryRows.join(",\n")}\n    ) as seed(name, description)
  on conflict (clinic_id, name) do nothing;

  with seed_tests(category_name, test_name, test_code, description) as (
    values
${testRows.join(",\n")}
  )
  insert into public.test_catalog (clinic_id, category_id, code, name, description, price, turnaround_minutes, is_available)
  select target_clinic_id, category.id, seed.test_code, seed.test_name, seed.description, 0, null, false
    from seed_tests seed
    join public.test_categories category
      on category.clinic_id = target_clinic_id and category.name = seed.category_name
  on conflict (clinic_id, code) do nothing;

  with seed_memberships(test_code, category_name) as (
    values
${membershipRows.join(",\n")}\n  )
  insert into public.test_category_memberships (clinic_id, test_id, category_id)
  select target_clinic_id, t.id, c.id
    from seed_memberships seed
    join public.test_catalog t on t.clinic_id = target_clinic_id and t.code = seed.test_code
    join public.test_categories c on c.clinic_id = target_clinic_id and c.name = seed.category_name
  on conflict (test_id, category_id) do nothing;

  with seed_specimens(test_code, specimen_type, collection_instructions) as (
    values
${specimenRows.join(",\n")}\n  )
  insert into public.test_specimen_requirements
    (clinic_id, test_id, specimen_type, collection_instructions, is_required)
  select target_clinic_id, t.id, seed.specimen_type, seed.collection_instructions, true
    from seed_specimens seed
    join public.test_catalog t on t.clinic_id = target_clinic_id and t.code = seed.test_code
   where not exists (select 1 from public.test_specimen_requirements existing
                      where existing.test_id = t.id and existing.clinic_id = t.clinic_id)
  on conflict (test_id, specimen_type) do nothing;
end
$seed$;

commit;

-- Review the seeded rows for the selected clinic.
select c.name as category, count(t.id)::integer as canonical_tests
  from public.test_categories c
  left join public.test_category_memberships m on m.category_id = c.id and m.clinic_id = c.clinic_id
  left join public.test_catalog t on t.id = m.test_id and t.clinic_id = m.clinic_id and t.code like 'STD-%'
 where c.clinic_id = (select id from public.clinics where code = 'REPLACE_WITH_CLINIC_CODE')
 group by c.id, c.name
 order by c.name;
`;

await writeFile(outputPath, sql, "utf8");
console.log(`Wrote ${outputPath} with ${categories.length} categories, ${categoryEntries} category memberships, ${canonicalTests.size} canonical tests, and ${specimenRows.length} provisional specimen requirements.`);
