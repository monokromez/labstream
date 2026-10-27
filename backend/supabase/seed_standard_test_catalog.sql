-- Standard Labstream catalog starter seed (12 categories, 81 category mentions, 77 canonical tests).
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
    ('Hematology', 'Standard diagnostic test category. Starter tests remain unavailable until this clinic reviews their setup.'),
    ('Clinical Chemistry', 'Standard diagnostic test category. Starter tests remain unavailable until this clinic reviews their setup.'),
    ('Lipid Profile', 'Standard diagnostic test category. Starter tests remain unavailable until this clinic reviews their setup.'),
    ('Liver Function and Related Tests', 'Standard diagnostic test category. Starter tests remain unavailable until this clinic reviews their setup.'),
    ('Renal (Kidney) Function', 'Standard diagnostic test category. Starter tests remain unavailable until this clinic reviews their setup.'),
    ('Clinical Microscopy and Parasitology', 'Standard diagnostic test category. Starter tests remain unavailable until this clinic reviews their setup.'),
    ('Microbiology', 'Standard diagnostic test category. Starter tests remain unavailable until this clinic reviews their setup.'),
    ('Immunology and Serology', 'Standard diagnostic test category. Starter tests remain unavailable until this clinic reviews their setup.'),
    ('Coagulation', 'Standard diagnostic test category. Starter tests remain unavailable until this clinic reviews their setup.'),
    ('Hormones and Endocrinology', 'Standard diagnostic test category. Starter tests remain unavailable until this clinic reviews their setup.'),
    ('Blood Banking and Transfusion Medicine', 'Standard diagnostic test category. Starter tests remain unavailable until this clinic reviews their setup.'),
    ('Histopathology and Cytology', 'Standard diagnostic test category. Starter tests remain unavailable until this clinic reviews their setup.')
    ) as seed(name, description)
  on conflict (clinic_id, name) do nothing;

  with seed_tests(category_name, test_name, test_code, description) as (
    values
    ('Hematology', 'Complete Blood Count (CBC)', 'STD-COMPLETE-BLOOD-COUNT-CBC-0E4334', 'Suggested technologist input: Numeric panel: RBC, hemoglobin, hematocrit, MCV, MCH, MCHC, RDW, WBC, platelet count; include differential analytes when ordered. Suggested report presentation: CBC table grouped as red-cell, white-cell, platelet indices; each row carries unit/range/flag. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Hematology', 'Hemoglobin (Hgb)', 'STD-HEMOGLOBIN-HGB-7DCBB6', 'Suggested technologist input: Numeric Suggested report presentation: Single value, unit, applicable interval and flag. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Hematology', 'Hematocrit (Hct)', 'STD-HEMATOCRIT-HCT-CCBBA6', 'Suggested technologist input: Numeric Suggested report presentation: Single value, unit, applicable interval and flag. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Hematology', 'White Blood Cell Count (WBC)', 'STD-WHITE-BLOOD-CELL-COUNT-WBC-1028F4', 'Suggested technologist input: Numeric Suggested report presentation: Single value, unit, applicable interval and flag. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Hematology', 'Platelet Count', 'STD-PLATELET-COUNT-25310C', 'Suggested technologist input: Numeric Suggested report presentation: Single value, unit, applicable interval and flag. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Hematology', 'Differential WBC Count', 'STD-DIFFERENTIAL-WBC-COUNT-65A034', 'Suggested technologist input: Numeric panel: neutrophils, lymphocytes, monocytes, eosinophils, basophils; optional immature/absolute counts per analyzer. Suggested report presentation: Differential table; distinguish percentage from absolute count and show units separately. A future rule should check percentage totals without blocking valid analyzer-specific reports. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Hematology', 'Erythrocyte Sedimentation Rate (ESR)', 'STD-ERYTHROCYTE-SEDIMENTATION-RAT-3C1037', 'Suggested technologist input: Numeric, with method and elapsed time captured in metadata Suggested report presentation: Single value and unit; range/flag is method-specific. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Hematology', 'Peripheral Blood Smear', 'STD-PERIPHERAL-BLOOD-SMEAR-3F729B', 'Suggested technologist input: Narrative sections: red-cell morphology, white-cell morphology/differential comment, platelet estimate, parasites/other findings, impression/comment. Suggested report presentation: Sectioned morphology report, not a numeric graph. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Hematology', 'Reticulocyte Count', 'STD-RETICULOCYTE-COUNT-2FE3A1', 'Suggested technologist input: Numeric panel: reticulocyte %, absolute count; optional immature reticulocyte fraction/reticulocyte hemoglobin if the assay reports them. Suggested report presentation: Small table with each measured component and method-specific interval. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Clinical Chemistry', 'Fasting Blood Sugar (FBS)', 'STD-FASTING-BLOOD-SUGAR-FBS-107A6F', 'Suggested technologist input: Numeric; capture fasting status/duration as required by the local procedure Suggested report presentation: Numeric glucose result, unit, local interval; fasting context shown beside result. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Clinical Chemistry', 'Random Blood Sugar (RBS)', 'STD-RANDOM-BLOOD-SUGAR-RBS-6BB6AB', 'Suggested technologist input: Numeric; capture collection context if provided Suggested report presentation: Numeric glucose result and unit. Do not label diabetes from this number alone. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Clinical Chemistry', 'Hemoglobin A1c (HbA1c)', 'STD-HEMOGLOBIN-A1C-HBA1C-6F9E14', 'Suggested technologist input: Numeric percentage; optional IFCC mmol/mol as a second reported analyte if validated Suggested report presentation: Numeric result and unit; include method/NGSP traceability note where applicable. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Clinical Chemistry', 'Blood Urea Nitrogen (BUN)', 'STD-BLOOD-UREA-NITROGEN-BUN-180810', 'Suggested technologist input: Numeric Suggested report presentation: Numeric result, unit, applicable interval and flag. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Clinical Chemistry', 'Creatinine', 'STD-CREATININE-7DA319', 'Suggested technologist input: Numeric Suggested report presentation: Numeric result and unit; any eGFR calculation must state its equation and applicable patient inputs. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Clinical Chemistry', 'Uric Acid', 'STD-URIC-ACID-31DC96', 'Suggested technologist input: Numeric Suggested report presentation: Numeric result, unit, applicable interval and flag. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Clinical Chemistry', 'Total Protein', 'STD-TOTAL-PROTEIN-65EF68', 'Suggested technologist input: Numeric Suggested report presentation: Numeric result, unit, applicable interval and flag. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Clinical Chemistry', 'Albumin', 'STD-ALBUMIN-515C88', 'Suggested technologist input: Numeric Suggested report presentation: Numeric result, unit, applicable interval and flag. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Clinical Chemistry', 'Calcium', 'STD-CALCIUM-636F0D', 'Suggested technologist input: Numeric; include corrected/ionized form only as a separately named test when performed Suggested report presentation: Numeric result, unit, method-appropriate interval and flag. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Clinical Chemistry', 'Sodium', 'STD-SODIUM-CBD06D', 'Suggested technologist input: Numeric Suggested report presentation: Numeric result, unit, applicable interval and flag. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Clinical Chemistry', 'Potassium', 'STD-POTASSIUM-0BF539', 'Suggested technologist input: Numeric Suggested report presentation: Numeric result, unit, applicable interval and flag. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Clinical Chemistry', 'Chloride', 'STD-CHLORIDE-68CF13', 'Suggested technologist input: Numeric Suggested report presentation: Numeric result, unit, applicable interval and flag. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Lipid Profile', 'Total Cholesterol', 'STD-TOTAL-CHOLESTEROL-5117E4', 'Suggested technologist input: Numeric Suggested report presentation: Numeric result, unit and lab/clinical interpretation context. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Lipid Profile', 'HDL Cholesterol', 'STD-HDL-CHOLESTEROL-3635C6', 'Suggested technologist input: Numeric Suggested report presentation: Numeric result and unit. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Lipid Profile', 'LDL Cholesterol', 'STD-LDL-CHOLESTEROL-CC4244', 'Suggested technologist input: Numeric; record whether measured or calculated and calculation method Suggested report presentation: Numeric result, unit, method note. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Lipid Profile', 'Triglycerides', 'STD-TRIGLYCERIDES-E8B942', 'Suggested technologist input: Numeric Suggested report presentation: Numeric result, unit; show fasting status when known. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Liver Function and Related Tests', 'Alanine Aminotransferase (ALT/SGPT)', 'STD-ALANINE-AMINOTRANSFERASE-ALT--B5659B', 'Suggested technologist input: Numeric Suggested report presentation: Numeric result, unit, assay-specific interval and flag. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Liver Function and Related Tests', 'Aspartate Aminotransferase (AST/SGOT)', 'STD-ASPARTATE-AMINOTRANSFERASE-AS-357AF8', 'Suggested technologist input: Numeric Suggested report presentation: Numeric result, unit, assay-specific interval and flag. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Liver Function and Related Tests', 'Alkaline Phosphatase (ALP)', 'STD-ALKALINE-PHOSPHATASE-ALP-059638', 'Suggested technologist input: Numeric Suggested report presentation: Numeric result, unit; interval may depend on age and other patient factors. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Liver Function and Related Tests', 'Total Bilirubin', 'STD-TOTAL-BILIRUBIN-859557', 'Suggested technologist input: Numeric Suggested report presentation: Numeric result, unit and interval. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Liver Function and Related Tests', 'Direct Bilirubin', 'STD-DIRECT-BILIRUBIN-402EE6', 'Suggested technologist input: Numeric Suggested report presentation: Numeric result, unit and interval. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Renal (Kidney) Function', 'Estimated Glomerular Filtration Rate (eGFR)', 'STD-ESTIMATED-GLOMERULAR-FILTRATI-BA3B47', 'Suggested technologist input: Numeric calculated value; system calculation should be added only after the lab chooses and validates an equation and required inputs Suggested report presentation: Numeric result, unit normalized to the selected equation, equation/version note and limitations. Prefer importing the analyzer/LIS-calculated value until a validated calculation exists. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Renal (Kidney) Function', 'Urine Albumin-to-Creatinine Ratio (UACR)', 'STD-URINE-ALBUMIN-TO-CREATININE-R-95824B', 'Suggested technologist input: Numeric panel: urine albumin, urine creatinine, ratio; or a validated ratio result imported from analyzer Suggested report presentation: Report ratio and unit; optionally show component values. Clinical categories belong in interpretation guidance, not an automatic diagnosis. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Renal (Kidney) Function', 'Urine Total Protein', 'STD-URINE-TOTAL-PROTEIN-43E737', 'Suggested technologist input: Numeric when quantitative; dropdown/semiquantitative only when using a validated strip method Suggested report presentation: State method and unit; distinguish quantitative concentration from dipstick categories. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Renal (Kidney) Function', 'Creatinine Clearance', 'STD-CREATININE-CLEARANCE-DB4C56', 'Suggested technologist input: Numeric calculated value; capture urine collection duration/volume and serum creatinine inputs or imported validated calculation Suggested report presentation: Report result, unit, calculation method, collection details and any required body-surface-area convention. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Clinical Microscopy and Parasitology', 'Routine Urinalysis', 'STD-ROUTINE-URINALYSIS-B12717', 'Suggested technologist input: Fixed panel: color/clarity and strip analytes via dropdowns; specific gravity/pH numeric; microscopy by numeric counts or dropdown category as the lab method allows Suggested report presentation: Three sections: physical, chemical, microscopic. Each result is labeled; show `/HPF`, `/LPF`, or other unit consistently. Requires a panel-oriented screen. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Clinical Microscopy and Parasitology', 'Routine Fecalysis (Stool Examination)', 'STD-ROUTINE-FECALYSIS-STOOL-EXAMI-C31A24', 'Suggested technologist input: Fixed panel: color/consistency dropdowns; occult blood, mucus, RBC/WBC, and other fields as dropdown/numeric; microscopy observations as narrative or controlled taxonomy Suggested report presentation: Sections for macroscopic, chemical, and microscopic findings. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Clinical Microscopy and Parasitology', 'Fecal Occult Blood Test (FOBT)', 'STD-FECAL-OCCULT-BLOOD-TEST-FOBT-565629', 'Suggested technologist input: Dropdown: Negative/Positive/Invalid, with method/kit recorded Suggested report presentation: Qualitative result plus method and any kit-specific comment. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Clinical Microscopy and Parasitology', 'Urine Pregnancy Test', 'STD-URINE-PREGNANCY-TEST-829148', 'Suggested technologist input: Dropdown: Negative/Positive/Invalid; optional control validity Suggested report presentation: Qualitative result, method, and collection/time details when required. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Clinical Microscopy and Parasitology', 'Semen Analysis', 'STD-SEMEN-ANALYSIS-2919E3', 'Suggested technologist input: Panel: numeric volume, pH, concentration, total count, motility and morphology; dropdown/narrative liquefaction, viscosity, appearance, agglutination and comments according to method Suggested report presentation: Structured table with numeric units plus labeled qualitative observations. Include abstinence interval and collection completeness if captured by procedure. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Clinical Microscopy and Parasitology', 'Urine Microscopic Examination', 'STD-URINE-MICROSCOPIC-EXAMINATION-36C20F', 'Suggested technologist input: Panel: numeric/categorical RBC, WBC, epithelial cells, casts, crystals, bacteria, yeast and other observed elements; allow narrative morphology Suggested report presentation: Microscopy table grouped by cell, cast, crystal, and organism findings. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Clinical Microscopy and Parasitology', 'Stool Parasite Examination', 'STD-STOOL-PARASITE-EXAMINATION-AE1894', 'Suggested technologist input: Structured repeated findings: organism/parasite name, stage, quantity/semiquantitation, and comment; dropdown for none detected only where method supports it Suggested report presentation: Organism findings table, plus method and specimen number. Needs repeatable rows for multiple findings. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Microbiology', 'Gram Stain', 'STD-GRAM-STAIN-A3D6D8', 'Suggested technologist input: Structured fields: specimen quality, cells, organisms/Gram reaction, morphology, quantity/semiquantitation, comment Suggested report presentation: Microscopy report table/sections. Avoid a single unlabelled free-text blob. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Microbiology', 'Bacterial Culture', 'STD-BACTERIAL-CULTURE-95D750', 'Suggested technologist input: Dropdown for no growth/growth/pending/contaminated as appropriate, then repeatable organism rows with identification, quantity, and comment Suggested report presentation: Culture status plus one row per isolate. Needs a repeatable organism worksheet. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Microbiology', 'Culture and Sensitivity', 'STD-CULTURE-AND-SENSITIVITY-B2C4E9', 'Suggested technologist input: Repeatable isolate rows; for each isolate, antimicrobial and interpretation (S/I/R or method-specific categories), optional MIC/zone numeric values and units Suggested report presentation: Culture summary followed by susceptibility matrix per organism. Must preserve method/standard/version. Requires structured worksheet and result schema support. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Microbiology', 'Sputum Culture', 'STD-SPUTUM-CULTURE-5408E2', 'Suggested technologist input: Same culture worksheet, with sputum specimen quality fields and isolate rows Suggested report presentation: Specimen quality, culture status, isolates and susceptibility data. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Microbiology', 'Urine Culture', 'STD-URINE-CULTURE-042D5D', 'Suggested technologist input: Culture worksheet with colony count numeric and unit, isolate rows and susceptibility when ordered Suggested report presentation: Colony count and organism/susceptibility sections; separate no-growth from pending. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Microbiology', 'KOH Preparation', 'STD-KOH-PREPARATION-F77696', 'Suggested technologist input: Dropdown/narrative: fungal elements detected/not detected/indeterminate plus morphology/comment Suggested report presentation: Qualitative result and microscopy description. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Microbiology', 'Acid-Fast Bacilli (AFB) Stain', 'STD-ACID-FAST-BACILLI-AFB-STAIN-83A05C', 'Suggested technologist input: Dropdown for detected/not detected/invalid plus grading dropdown if detected under the adopted standard Suggested report presentation: Stain result, grading, method and microscopy comment; do not conflate smear with culture or molecular tests. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Immunology and Serology', 'C-Reactive Protein (CRP)', 'STD-C-REACTIVE-PROTEIN-CRP-4302F4', 'Suggested technologist input: Numeric with unit; distinguish standard CRP from hs-CRP in catalog Suggested report presentation: Numeric result, method and applicable interval/decision guidance. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Immunology and Serology', 'Rheumatoid Factor (RF)', 'STD-RHEUMATOID-FACTOR-RF-5B27EA', 'Suggested technologist input: Numeric with unit and assay cutoff, or dropdown if the validated method only reports qualitative Suggested report presentation: State quantitative/qualitative method and cutoff; avoid treating an isolated result as a diagnosis. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Immunology and Serology', 'Dengue NS1 Antigen', 'STD-DENGUE-NS1-ANTIGEN-7580B2', 'Suggested technologist input: Dropdown: Detected/Not detected/Invalid, with kit-specific interpretation Suggested report presentation: Qualitative result, assay method and collection timing note if lab procedure requires. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Immunology and Serology', 'Dengue IgM/IgG', 'STD-DENGUE-IGM-IGG-639567', 'Suggested technologist input: Two separate dropdown analytes: Reactive/Nonreactive/Equivocal/Invalid, with method Suggested report presentation: Display IgM and IgG separately and attach assay-specific comments; do not merge into a single “dengue positive” result. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Immunology and Serology', 'Hepatitis B Surface Antigen (HBsAg)', 'STD-HEPATITIS-B-SURFACE-ANTIGEN-H-897C01', 'Suggested technologist input: Dropdown or numeric signal/cutoff plus interpretation, depending on assay; supplemental result may be required Suggested report presentation: Screening result, method, and confirmatory/supplemental status where applicable. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Immunology and Serology', 'HIV Screening Test', 'STD-HIV-SCREENING-TEST-771D05', 'Suggested technologist input: Dropdown for initial assay: Reactive/Nonreactive/Invalid; only release final status when the required national/local algorithm is complete Suggested report presentation: Keep screening result and algorithm-level interpretation distinct. Reactive screening alone must not display as a confirmed diagnosis. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Immunology and Serology', 'Syphilis Screening Test', 'STD-SYPHILIS-SCREENING-TEST-DD2972', 'Suggested technologist input: Assay-dependent dropdown and/or numeric titer; record test type (treponemal/non-treponemal) and reflex result separately Suggested report presentation: Display assay name, result, titer when applicable, and reflex/confirmatory status. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Coagulation', 'Prothrombin Time (PT)', 'STD-PROTHROMBIN-TIME-PT-C78BC5', 'Suggested technologist input: Numeric seconds; include control/ method metadata if required Suggested report presentation: PT seconds plus local interval. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Coagulation', 'International Normalized Ratio (INR)', 'STD-INTERNATIONAL-NORMALIZED-RATI-568048', 'Suggested technologist input: Numeric; analyzer-calculated value preferred Suggested report presentation: Numeric result with method context; indication-specific targets must not be represented as a universal reference interval. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Coagulation', 'Activated Partial Thromboplastin Time (aPTT)', 'STD-ACTIVATED-PARTIAL-THROMBOPLAS-258E9B', 'Suggested technologist input: Numeric seconds Suggested report presentation: Numeric result and reagent/instrument-specific interval. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Coagulation', 'Fibrinogen', 'STD-FIBRINOGEN-492188', 'Suggested technologist input: Numeric with unit; distinguish method where relevant Suggested report presentation: Numeric result, unit and method-specific interval. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Coagulation', 'D-dimer', 'STD-D-DIMER-EAB7F1', 'Suggested technologist input: Numeric with unit and assay cutoff; preserve FEU vs DDU Suggested report presentation: Numeric result, unit, cutoff and assay method. Never compare results with a cutoff in a different unit convention. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Hormones and Endocrinology', 'Thyroid-Stimulating Hormone (TSH)', 'STD-THYROID-STIMULATING-HORMONE-T-2CAA54', 'Suggested technologist input: Numeric Suggested report presentation: Numeric result, unit, age/pregnancy/method-specific interval as configured. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Hormones and Endocrinology', 'Free T4 (FT4)', 'STD-FREE-T4-FT4-1F9002', 'Suggested technologist input: Numeric Suggested report presentation: Numeric result, unit and method-specific interval. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Hormones and Endocrinology', 'Free T3 (FT3)', 'STD-FREE-T3-FT3-BFAC07', 'Suggested technologist input: Numeric Suggested report presentation: Numeric result, unit and method-specific interval. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Hormones and Endocrinology', 'Total T4', 'STD-TOTAL-T4-785A47', 'Suggested technologist input: Numeric Suggested report presentation: Numeric result, unit and method-specific interval. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Hormones and Endocrinology', 'Total T3', 'STD-TOTAL-T3-65E0C2', 'Suggested technologist input: Numeric Suggested report presentation: Numeric result, unit and method-specific interval. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Hormones and Endocrinology', 'Cortisol', 'STD-CORTISOL-9B6DFF', 'Suggested technologist input: Numeric; capture collection time and stimulation/suppression context Suggested report presentation: Numeric result, unit, collection time and protocol-specific interval. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Hormones and Endocrinology', 'Testosterone', 'STD-TESTOSTERONE-BFE8F2', 'Suggested technologist input: Numeric; record total/free assay and relevant patient category Suggested report presentation: Numeric result, unit, age/sex/time/method-specific interval. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Hormones and Endocrinology', 'Prolactin', 'STD-PROLACTIN-8EA3D7', 'Suggested technologist input: Numeric Suggested report presentation: Numeric result, unit and method-specific interval; collection context can be included when required. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Blood Banking and Transfusion Medicine', 'ABO Blood Grouping', 'STD-ABO-BLOOD-GROUPING-8097FF', 'Suggested technologist input: Dropdown: A/B/AB/O plus discrepancy/indeterminate; record forward/reverse typing results separately where performed Suggested report presentation: Group result with component reactions and discrepancy status. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Blood Banking and Transfusion Medicine', 'Rh(D) Typing', 'STD-RH-D-TYPING-61CAAF', 'Suggested technologist input: Dropdown: Positive/Negative/Weak D/Indeterminate per validated procedure Suggested report presentation: Rh(D) result and method/comment; weak-D workflow is lab-policy dependent. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Blood Banking and Transfusion Medicine', 'Crossmatching', 'STD-CROSSMATCHING-AA2B3C', 'Suggested technologist input: Dropdown: Compatible/Incompatible/Invalid; record method, donor unit identifier, component, and reaction details Suggested report presentation: Unit-by-unit compatibility table with method and testing timestamps. Requires structured rows when multiple units are crossmatched. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Blood Banking and Transfusion Medicine', 'Direct Antiglobulin Test (DAT)', 'STD-DIRECT-ANTIGLOBULIN-TEST-DAT-AC327A', 'Suggested technologist input: Dropdown: Negative/Positive/Invalid; if positive, separate IgG/C3 component and strength fields when performed Suggested report presentation: Result plus reagent/component-specific details and comment. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Blood Banking and Transfusion Medicine', 'Indirect Antiglobulin Test (IAT)', 'STD-INDIRECT-ANTIGLOBULIN-TEST-IA-B02347', 'Suggested technologist input: Dropdown: Negative/Positive/Invalid; if positive, antibody screen/identification and strength as applicable Suggested report presentation: Result plus antibody identification section; variable antibody panels need structured worksheet support. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Histopathology and Cytology', 'Pap Smear', 'STD-PAP-SMEAR-24BFB6', 'Suggested technologist input: Structured sections: specimen adequacy, Bethesda interpretation/category, organisms/other findings, comments; interpretation by authorized pathologist Suggested report presentation: Sectioned cytology report; do not release as a single positive/negative dropdown. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Histopathology and Cytology', 'Tissue Biopsy Examination', 'STD-TISSUE-BIOPSY-EXAMINATION-C7A34C', 'Suggested technologist input: Structured gross description, microscopic description, diagnosis, margins/ancillary findings as applicable; pathologist-authored Suggested report presentation: Multi-section signed pathology report with specimen/site and diagnosis prominent. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Histopathology and Cytology', 'Cytology Examination', 'STD-CYTOLOGY-EXAMINATION-0D0D66', 'Suggested technologist input: Structured specimen adequacy, findings, diagnostic category and comment; pathologist-authored Suggested report presentation: Multi-section cytology report. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.'),
    ('Histopathology and Cytology', 'Fine-Needle Aspiration Cytology (FNAC)', 'STD-FINE-NEEDLE-ASPIRATION-CYTOLO-B711FC', 'Suggested technologist input: Structured adequacy, site, microscopic description, diagnostic classification, comment; pathologist-authored Suggested report presentation: Multi-section report with classification system chosen by the laboratory and specimen/site. Review the local assay, specimen, method, price, turnaround, units, options, and reference ranges before enabling this test. See standard-test-result-design.md.')
  )
  insert into public.test_catalog (clinic_id, category_id, code, name, description, price, turnaround_minutes, is_available)
  select target_clinic_id, category.id, seed.test_code, seed.test_name, seed.description, 0, null, false
    from seed_tests seed
    join public.test_categories category
      on category.clinic_id = target_clinic_id and category.name = seed.category_name
  on conflict (clinic_id, code) do nothing;

  insert into public.test_configuration_versions (clinic_id, test_id, version_number)
  select target_clinic_id, t.id, t.current_configuration_version
    from public.test_catalog t
   where t.clinic_id = target_clinic_id and t.code like 'STD-%'
  on conflict (test_id, version_number) do nothing;

  with seed_memberships(test_code, category_name) as (
    values
    ('STD-COMPLETE-BLOOD-COUNT-CBC-0E4334', 'Hematology'),
    ('STD-HEMOGLOBIN-HGB-7DCBB6', 'Hematology'),
    ('STD-HEMATOCRIT-HCT-CCBBA6', 'Hematology'),
    ('STD-WHITE-BLOOD-CELL-COUNT-WBC-1028F4', 'Hematology'),
    ('STD-PLATELET-COUNT-25310C', 'Hematology'),
    ('STD-DIFFERENTIAL-WBC-COUNT-65A034', 'Hematology'),
    ('STD-ERYTHROCYTE-SEDIMENTATION-RAT-3C1037', 'Hematology'),
    ('STD-PERIPHERAL-BLOOD-SMEAR-3F729B', 'Hematology'),
    ('STD-RETICULOCYTE-COUNT-2FE3A1', 'Hematology'),
    ('STD-FASTING-BLOOD-SUGAR-FBS-107A6F', 'Clinical Chemistry'),
    ('STD-RANDOM-BLOOD-SUGAR-RBS-6BB6AB', 'Clinical Chemistry'),
    ('STD-HEMOGLOBIN-A1C-HBA1C-6F9E14', 'Clinical Chemistry'),
    ('STD-BLOOD-UREA-NITROGEN-BUN-180810', 'Clinical Chemistry'),
    ('STD-BLOOD-UREA-NITROGEN-BUN-180810', 'Renal (Kidney) Function'),
    ('STD-CREATININE-7DA319', 'Clinical Chemistry'),
    ('STD-CREATININE-7DA319', 'Renal (Kidney) Function'),
    ('STD-URIC-ACID-31DC96', 'Clinical Chemistry'),
    ('STD-TOTAL-PROTEIN-65EF68', 'Clinical Chemistry'),
    ('STD-TOTAL-PROTEIN-65EF68', 'Liver Function and Related Tests'),
    ('STD-ALBUMIN-515C88', 'Clinical Chemistry'),
    ('STD-ALBUMIN-515C88', 'Liver Function and Related Tests'),
    ('STD-CALCIUM-636F0D', 'Clinical Chemistry'),
    ('STD-SODIUM-CBD06D', 'Clinical Chemistry'),
    ('STD-POTASSIUM-0BF539', 'Clinical Chemistry'),
    ('STD-CHLORIDE-68CF13', 'Clinical Chemistry'),
    ('STD-TOTAL-CHOLESTEROL-5117E4', 'Lipid Profile'),
    ('STD-HDL-CHOLESTEROL-3635C6', 'Lipid Profile'),
    ('STD-LDL-CHOLESTEROL-CC4244', 'Lipid Profile'),
    ('STD-TRIGLYCERIDES-E8B942', 'Lipid Profile'),
    ('STD-ALANINE-AMINOTRANSFERASE-ALT--B5659B', 'Liver Function and Related Tests'),
    ('STD-ASPARTATE-AMINOTRANSFERASE-AS-357AF8', 'Liver Function and Related Tests'),
    ('STD-ALKALINE-PHOSPHATASE-ALP-059638', 'Liver Function and Related Tests'),
    ('STD-TOTAL-BILIRUBIN-859557', 'Liver Function and Related Tests'),
    ('STD-DIRECT-BILIRUBIN-402EE6', 'Liver Function and Related Tests'),
    ('STD-ESTIMATED-GLOMERULAR-FILTRATI-BA3B47', 'Renal (Kidney) Function'),
    ('STD-URINE-ALBUMIN-TO-CREATININE-R-95824B', 'Renal (Kidney) Function'),
    ('STD-URINE-TOTAL-PROTEIN-43E737', 'Renal (Kidney) Function'),
    ('STD-CREATININE-CLEARANCE-DB4C56', 'Renal (Kidney) Function'),
    ('STD-ROUTINE-URINALYSIS-B12717', 'Clinical Microscopy and Parasitology'),
    ('STD-ROUTINE-FECALYSIS-STOOL-EXAMI-C31A24', 'Clinical Microscopy and Parasitology'),
    ('STD-FECAL-OCCULT-BLOOD-TEST-FOBT-565629', 'Clinical Microscopy and Parasitology'),
    ('STD-URINE-PREGNANCY-TEST-829148', 'Clinical Microscopy and Parasitology'),
    ('STD-SEMEN-ANALYSIS-2919E3', 'Clinical Microscopy and Parasitology'),
    ('STD-URINE-MICROSCOPIC-EXAMINATION-36C20F', 'Clinical Microscopy and Parasitology'),
    ('STD-STOOL-PARASITE-EXAMINATION-AE1894', 'Clinical Microscopy and Parasitology'),
    ('STD-GRAM-STAIN-A3D6D8', 'Microbiology'),
    ('STD-BACTERIAL-CULTURE-95D750', 'Microbiology'),
    ('STD-CULTURE-AND-SENSITIVITY-B2C4E9', 'Microbiology'),
    ('STD-SPUTUM-CULTURE-5408E2', 'Microbiology'),
    ('STD-URINE-CULTURE-042D5D', 'Microbiology'),
    ('STD-KOH-PREPARATION-F77696', 'Microbiology'),
    ('STD-ACID-FAST-BACILLI-AFB-STAIN-83A05C', 'Microbiology'),
    ('STD-C-REACTIVE-PROTEIN-CRP-4302F4', 'Immunology and Serology'),
    ('STD-RHEUMATOID-FACTOR-RF-5B27EA', 'Immunology and Serology'),
    ('STD-DENGUE-NS1-ANTIGEN-7580B2', 'Immunology and Serology'),
    ('STD-DENGUE-IGM-IGG-639567', 'Immunology and Serology'),
    ('STD-HEPATITIS-B-SURFACE-ANTIGEN-H-897C01', 'Immunology and Serology'),
    ('STD-HIV-SCREENING-TEST-771D05', 'Immunology and Serology'),
    ('STD-SYPHILIS-SCREENING-TEST-DD2972', 'Immunology and Serology'),
    ('STD-PROTHROMBIN-TIME-PT-C78BC5', 'Coagulation'),
    ('STD-INTERNATIONAL-NORMALIZED-RATI-568048', 'Coagulation'),
    ('STD-ACTIVATED-PARTIAL-THROMBOPLAS-258E9B', 'Coagulation'),
    ('STD-FIBRINOGEN-492188', 'Coagulation'),
    ('STD-D-DIMER-EAB7F1', 'Coagulation'),
    ('STD-THYROID-STIMULATING-HORMONE-T-2CAA54', 'Hormones and Endocrinology'),
    ('STD-FREE-T4-FT4-1F9002', 'Hormones and Endocrinology'),
    ('STD-FREE-T3-FT3-BFAC07', 'Hormones and Endocrinology'),
    ('STD-TOTAL-T4-785A47', 'Hormones and Endocrinology'),
    ('STD-TOTAL-T3-65E0C2', 'Hormones and Endocrinology'),
    ('STD-CORTISOL-9B6DFF', 'Hormones and Endocrinology'),
    ('STD-TESTOSTERONE-BFE8F2', 'Hormones and Endocrinology'),
    ('STD-PROLACTIN-8EA3D7', 'Hormones and Endocrinology'),
    ('STD-ABO-BLOOD-GROUPING-8097FF', 'Blood Banking and Transfusion Medicine'),
    ('STD-RH-D-TYPING-61CAAF', 'Blood Banking and Transfusion Medicine'),
    ('STD-CROSSMATCHING-AA2B3C', 'Blood Banking and Transfusion Medicine'),
    ('STD-DIRECT-ANTIGLOBULIN-TEST-DAT-AC327A', 'Blood Banking and Transfusion Medicine'),
    ('STD-INDIRECT-ANTIGLOBULIN-TEST-IA-B02347', 'Blood Banking and Transfusion Medicine'),
    ('STD-PAP-SMEAR-24BFB6', 'Histopathology and Cytology'),
    ('STD-TISSUE-BIOPSY-EXAMINATION-C7A34C', 'Histopathology and Cytology'),
    ('STD-CYTOLOGY-EXAMINATION-0D0D66', 'Histopathology and Cytology'),
    ('STD-FINE-NEEDLE-ASPIRATION-CYTOLO-B711FC', 'Histopathology and Cytology')
  )
  insert into public.test_category_memberships (clinic_id, test_id, category_id)
  select target_clinic_id, t.id, c.id
    from seed_memberships seed
    join public.test_catalog t on t.clinic_id = target_clinic_id and t.code = seed.test_code
    join public.test_categories c on c.clinic_id = target_clinic_id and c.name = seed.category_name
  on conflict (test_id, category_id) do nothing;

  with seed_specimens(test_code, specimen_type, collection_instructions) as (
    values
    ('STD-COMPLETE-BLOOD-COUNT-CBC-0E4334', 'Whole blood', 'Use the tube, anticoagulant, and handling procedure validated for the selected assay.'),
    ('STD-HEMOGLOBIN-HGB-7DCBB6', 'Whole blood', 'Use the tube, anticoagulant, and handling procedure validated for the selected assay.'),
    ('STD-HEMATOCRIT-HCT-CCBBA6', 'Whole blood', 'Use the tube, anticoagulant, and handling procedure validated for the selected assay.'),
    ('STD-WHITE-BLOOD-CELL-COUNT-WBC-1028F4', 'Whole blood', 'Use the tube, anticoagulant, and handling procedure validated for the selected assay.'),
    ('STD-PLATELET-COUNT-25310C', 'Whole blood', 'Use the tube, anticoagulant, and handling procedure validated for the selected assay.'),
    ('STD-DIFFERENTIAL-WBC-COUNT-65A034', 'Whole blood', 'Use the tube, anticoagulant, and handling procedure validated for the selected assay.'),
    ('STD-ERYTHROCYTE-SEDIMENTATION-RAT-3C1037', 'Whole blood', 'Use the tube, anticoagulant, and handling procedure validated for the selected assay.'),
    ('STD-PERIPHERAL-BLOOD-SMEAR-3F729B', 'Whole blood', 'Use the tube, anticoagulant, and handling procedure validated for the selected assay.'),
    ('STD-RETICULOCYTE-COUNT-2FE3A1', 'Whole blood', 'Use the tube, anticoagulant, and handling procedure validated for the selected assay.'),
    ('STD-FASTING-BLOOD-SUGAR-FBS-107A6F', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-RANDOM-BLOOD-SUGAR-RBS-6BB6AB', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-HEMOGLOBIN-A1C-HBA1C-6F9E14', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-BLOOD-UREA-NITROGEN-BUN-180810', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-CREATININE-7DA319', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-URIC-ACID-31DC96', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-TOTAL-PROTEIN-65EF68', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-ALBUMIN-515C88', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-CALCIUM-636F0D', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-SODIUM-CBD06D', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-POTASSIUM-0BF539', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-CHLORIDE-68CF13', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-TOTAL-CHOLESTEROL-5117E4', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-HDL-CHOLESTEROL-3635C6', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-LDL-CHOLESTEROL-CC4244', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-TRIGLYCERIDES-E8B942', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-ALANINE-AMINOTRANSFERASE-ALT--B5659B', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-ASPARTATE-AMINOTRANSFERASE-AS-357AF8', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-ALKALINE-PHOSPHATASE-ALP-059638', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-TOTAL-BILIRUBIN-859557', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-DIRECT-BILIRUBIN-402EE6', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-ESTIMATED-GLOMERULAR-FILTRATI-BA3B47', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-URINE-ALBUMIN-TO-CREATININE-R-95824B', 'Urine', 'Use the collection type and handling procedure validated by the laboratory.'),
    ('STD-URINE-TOTAL-PROTEIN-43E737', 'Urine', 'Use the collection type and handling procedure validated by the laboratory.'),
    ('STD-CREATININE-CLEARANCE-DB4C56', 'Urine', 'Timed collection; enter duration and volume according to the laboratory procedure.'),
    ('STD-CREATININE-CLEARANCE-DB4C56', 'Serum', 'Paired serum creatinine collected according to the laboratory procedure.'),
    ('STD-ROUTINE-URINALYSIS-B12717', 'Urine', 'Collect and transport according to the laboratory''s validated procedure.'),
    ('STD-ROUTINE-FECALYSIS-STOOL-EXAMI-C31A24', 'Stool', 'Collect and transport according to the laboratory''s validated procedure.'),
    ('STD-FECAL-OCCULT-BLOOD-TEST-FOBT-565629', 'Stool', 'Collect and transport according to the laboratory''s validated procedure.'),
    ('STD-URINE-PREGNANCY-TEST-829148', 'Urine', 'Collect and transport according to the laboratory''s validated procedure.'),
    ('STD-SEMEN-ANALYSIS-2919E3', 'Semen', 'Collect and transport according to the laboratory''s validated procedure.'),
    ('STD-URINE-MICROSCOPIC-EXAMINATION-36C20F', 'Urine', 'Collect and transport according to the laboratory''s validated procedure.'),
    ('STD-STOOL-PARASITE-EXAMINATION-AE1894', 'Stool', 'Collect and transport according to the laboratory''s validated procedure.'),
    ('STD-GRAM-STAIN-A3D6D8', 'Other', 'Specimen source is test/site dependent; specify and validate collection before enabling this test.'),
    ('STD-BACTERIAL-CULTURE-95D750', 'Other', 'Specimen source is test/site dependent; specify and validate collection before enabling this test.'),
    ('STD-CULTURE-AND-SENSITIVITY-B2C4E9', 'Other', 'Specimen source is test/site dependent; specify and validate collection before enabling this test.'),
    ('STD-SPUTUM-CULTURE-5408E2', 'Sputum', 'Collect and transport according to the laboratory''s validated procedure.'),
    ('STD-URINE-CULTURE-042D5D', 'Urine', 'Collect and transport according to the laboratory''s validated procedure.'),
    ('STD-KOH-PREPARATION-F77696', 'Other', 'Specimen source is test/site dependent; specify and validate collection before enabling this test.'),
    ('STD-ACID-FAST-BACILLI-AFB-STAIN-83A05C', 'Sputum', 'Collect and transport according to the laboratory''s validated procedure.'),
    ('STD-C-REACTIVE-PROTEIN-CRP-4302F4', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-RHEUMATOID-FACTOR-RF-5B27EA', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-DENGUE-NS1-ANTIGEN-7580B2', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-DENGUE-IGM-IGG-639567', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-HEPATITIS-B-SURFACE-ANTIGEN-H-897C01', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-HIV-SCREENING-TEST-771D05', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-SYPHILIS-SCREENING-TEST-DD2972', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-PROTHROMBIN-TIME-PT-C78BC5', 'Citrated plasma', 'Use the citrate tube, fill ratio, and processing procedure validated by the laboratory.'),
    ('STD-INTERNATIONAL-NORMALIZED-RATI-568048', 'Citrated plasma', 'Use the citrate tube, fill ratio, and processing procedure validated by the laboratory.'),
    ('STD-ACTIVATED-PARTIAL-THROMBOPLAS-258E9B', 'Citrated plasma', 'Use the citrate tube, fill ratio, and processing procedure validated by the laboratory.'),
    ('STD-FIBRINOGEN-492188', 'Citrated plasma', 'Use the citrate tube, fill ratio, and processing procedure validated by the laboratory.'),
    ('STD-D-DIMER-EAB7F1', 'Citrated plasma', 'Use the citrate tube, fill ratio, and processing procedure validated by the laboratory.'),
    ('STD-THYROID-STIMULATING-HORMONE-T-2CAA54', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-FREE-T4-FT4-1F9002', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-FREE-T3-FT3-BFAC07', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-TOTAL-T4-785A47', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-TOTAL-T3-65E0C2', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-CORTISOL-9B6DFF', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-TESTOSTERONE-BFE8F2', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-PROLACTIN-8EA3D7', 'Serum', 'Use the specimen type and processing procedure validated for the selected assay.'),
    ('STD-ABO-BLOOD-GROUPING-8097FF', 'Whole blood', 'Use the patient sample and identification procedure validated by the laboratory.'),
    ('STD-RH-D-TYPING-61CAAF', 'Whole blood', 'Use the patient sample and identification procedure validated by the laboratory.'),
    ('STD-CROSSMATCHING-AA2B3C', 'Whole blood', 'Use the patient sample and identification procedure validated by the laboratory.'),
    ('STD-DIRECT-ANTIGLOBULIN-TEST-DAT-AC327A', 'Whole blood', 'Use the patient sample and identification procedure validated by the laboratory.'),
    ('STD-INDIRECT-ANTIGLOBULIN-TEST-IA-B02347', 'Whole blood', 'Use the patient sample and identification procedure validated by the laboratory.'),
    ('STD-PAP-SMEAR-24BFB6', 'Cervical specimen', 'Collect and preserve using the laboratory''s validated cytology procedure.'),
    ('STD-TISSUE-BIOPSY-EXAMINATION-C7A34C', 'Tissue', 'Specify the anatomical site and transport/fixation method according to the laboratory procedure.'),
    ('STD-CYTOLOGY-EXAMINATION-0D0D66', 'Other', 'Specimen source is site dependent; specify and validate collection before enabling this test.'),
    ('STD-FINE-NEEDLE-ASPIRATION-CYTOLO-B711FC', 'Aspirate', 'Specify anatomical site and prepare/transport according to the laboratory procedure.')
  )
  insert into public.test_specimen_requirements
    (clinic_id, test_id, configuration_version, specimen_type, collection_instructions, is_required)
  select target_clinic_id, t.id, t.current_configuration_version, seed.specimen_type, seed.collection_instructions, true
    from seed_specimens seed
    join public.test_catalog t on t.clinic_id = target_clinic_id and t.code = seed.test_code
   where not exists (select 1 from public.test_specimen_requirements existing
                      where existing.test_id = t.id and existing.clinic_id = t.clinic_id
                        and existing.configuration_version = t.current_configuration_version)
  on conflict (test_id, configuration_version, specimen_type) do nothing;
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
