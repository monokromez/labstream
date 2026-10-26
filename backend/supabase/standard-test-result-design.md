# Standard diagnostic test result design

This document defines the initial result-entry and report presentation for the supplied standard test list. It is a configuration specification, not a clinical practice guide. The laboratory director must select the actual assay/method, specimen requirements, units, locally validated reference intervals, and report wording before making a test available to patients.

## Result entry and display rules

- **Numeric**: medical technologist enters a measured number. Display the value with its unit, the clinic's age/sex/method-specific interval when configured, and an H/L flag only when that interval is valid for the patient. Do not infer a diagnosis from an out-of-range flag.
- **Dropdown**: select from controlled options such as Positive/Negative/Equivocal or a named classification. Include `Not detected`, `Indeterminate`, and `Invalid` only when supported by the assay. Do not use a dropdown to force a result when the kit has a different interpretation.
- **Narrative**: medical technologist enters a concise observation or report. Display with labeled sections and line breaks; avoid converting narrative findings into H/L flags.
- **Panel**: one request item, multiple named analytes. Display a table with one row per analyte. Numeric analytes can have units and ranges; categorical and narrative findings appear as values without numeric flags.
- **Structured worksheet**: a variable-length result (for example, organism + antimicrobial susceptibility or tissue diagnosis sections) needs repeatable rows/sections and a structured database representation. The current schema supports only one scalar value per analyte, so these tests need the additional worksheet support described below before they should be enabled for routine use.

The current result model already supports numeric, text, select, and boolean scalar fields, with one result row per analyte. It can represent fixed panels by configuring multiple analytes, but the current technologist editor renders these as a flat list. It does not yet provide repeatable tables, microscopy grids, culture susceptibility matrices, multi-section pathology templates, or formula-driven derived values. Do not silently flatten these into a single unstructured field when structured worksheet support is required.

## Hematology

| Test | Medical technologist input | Report presentation |
|---|---|---|
| Complete Blood Count (CBC) | Numeric panel: RBC, hemoglobin, hematocrit, MCV, MCH, MCHC, RDW, WBC, platelet count; include differential analytes when ordered. | CBC table grouped as red-cell, white-cell, platelet indices; each row carries unit/range/flag. |
| Hemoglobin (Hgb) | Numeric | Single value, unit, applicable interval and flag. |
| Hematocrit (Hct) | Numeric | Single value, unit, applicable interval and flag. |
| White Blood Cell Count (WBC) | Numeric | Single value, unit, applicable interval and flag. |
| Platelet Count | Numeric | Single value, unit, applicable interval and flag. |
| Differential WBC Count | Numeric panel: neutrophils, lymphocytes, monocytes, eosinophils, basophils; optional immature/absolute counts per analyzer. | Differential table; distinguish percentage from absolute count and show units separately. A future rule should check percentage totals without blocking valid analyzer-specific reports. |
| Erythrocyte Sedimentation Rate (ESR) | Numeric, with method and elapsed time captured in metadata | Single value and unit; range/flag is method-specific. |
| Peripheral Blood Smear | Narrative sections: red-cell morphology, white-cell morphology/differential comment, platelet estimate, parasites/other findings, impression/comment. | Sectioned morphology report, not a numeric graph. |
| Reticulocyte Count | Numeric panel: reticulocyte %, absolute count; optional immature reticulocyte fraction/reticulocyte hemoglobin if the assay reports them. | Small table with each measured component and method-specific interval. |

## Clinical Chemistry

| Test | Medical technologist input | Report presentation |
|---|---|---|
| Fasting Blood Sugar (FBS) | Numeric; capture fasting status/duration as required by the local procedure | Numeric glucose result, unit, local interval; fasting context shown beside result. |
| Random Blood Sugar (RBS) | Numeric; capture collection context if provided | Numeric glucose result and unit. Do not label diabetes from this number alone. |
| Hemoglobin A1c (HbA1c) | Numeric percentage; optional IFCC mmol/mol as a second reported analyte if validated | Numeric result and unit; include method/NGSP traceability note where applicable. |
| Blood Urea Nitrogen (BUN) | Numeric | Numeric result, unit, applicable interval and flag. |
| Creatinine | Numeric | Numeric result and unit; any eGFR calculation must state its equation and applicable patient inputs. |
| Uric Acid | Numeric | Numeric result, unit, applicable interval and flag. |
| Total Protein | Numeric | Numeric result, unit, applicable interval and flag. |
| Albumin | Numeric | Numeric result, unit, applicable interval and flag. |
| Calcium | Numeric; include corrected/ionized form only as a separately named test when performed | Numeric result, unit, method-appropriate interval and flag. |
| Sodium | Numeric | Numeric result, unit, applicable interval and flag. |
| Potassium | Numeric | Numeric result, unit, applicable interval and flag. |
| Chloride | Numeric | Numeric result, unit, applicable interval and flag. |

## Lipid Profile

| Test | Medical technologist input | Report presentation |
|---|---|---|
| Total Cholesterol | Numeric | Numeric result, unit and lab/clinical interpretation context. |
| HDL Cholesterol | Numeric | Numeric result and unit. |
| LDL Cholesterol | Numeric; record whether measured or calculated and calculation method | Numeric result, unit, method note. |
| Triglycerides | Numeric | Numeric result, unit; show fasting status when known. |

Display these as a compact lipid panel when requested together. Do not apply a universal risk target as a “normal range”; targets depend on clinical context and guidance.

## Liver Function and Related Tests

| Test | Medical technologist input | Report presentation |
|---|---|---|
| Alanine Aminotransferase (ALT/SGPT) | Numeric | Numeric result, unit, assay-specific interval and flag. |
| Aspartate Aminotransferase (AST/SGOT) | Numeric | Numeric result, unit, assay-specific interval and flag. |
| Alkaline Phosphatase (ALP) | Numeric | Numeric result, unit; interval may depend on age and other patient factors. |
| Total Bilirubin | Numeric | Numeric result, unit and interval. |
| Direct Bilirubin | Numeric | Numeric result, unit and interval. |
| Albumin | Same canonical analyte as Clinical Chemistry Albumin | Include in a liver panel view when ordered there; avoid creating a second independently maintained test definition. |
| Total Protein | Same canonical analyte as Clinical Chemistry Total Protein | Include in a liver panel view when ordered there; avoid duplicate independent catalog definitions. |

## Renal (Kidney) Function

| Test | Medical technologist input | Report presentation |
|---|---|---|
| Creatinine | Same canonical analyte as Clinical Chemistry Creatinine | Numeric result, unit, interval; retain one catalog definition. |
| Blood Urea Nitrogen (BUN) | Same canonical analyte as Clinical Chemistry BUN | Numeric result, unit, interval; retain one catalog definition. |
| Estimated Glomerular Filtration Rate (eGFR) | Numeric calculated value; system calculation should be added only after the lab chooses and validates an equation and required inputs | Numeric result, unit normalized to the selected equation, equation/version note and limitations. Prefer importing the analyzer/LIS-calculated value until a validated calculation exists. |
| Urine Albumin-to-Creatinine Ratio (UACR) | Numeric panel: urine albumin, urine creatinine, ratio; or a validated ratio result imported from analyzer | Report ratio and unit; optionally show component values. Clinical categories belong in interpretation guidance, not an automatic diagnosis. |
| Urine Total Protein | Numeric when quantitative; dropdown/semiquantitative only when using a validated strip method | State method and unit; distinguish quantitative concentration from dipstick categories. |
| Creatinine Clearance | Numeric calculated value; capture urine collection duration/volume and serum creatinine inputs or imported validated calculation | Report result, unit, calculation method, collection details and any required body-surface-area convention. |

## Clinical Microscopy and Parasitology

| Test | Medical technologist input | Report presentation |
|---|---|---|
| Routine Urinalysis | Fixed panel: color/clarity and strip analytes via dropdowns; specific gravity/pH numeric; microscopy by numeric counts or dropdown category as the lab method allows | Three sections: physical, chemical, microscopic. Each result is labeled; show `/HPF`, `/LPF`, or other unit consistently. Requires a panel-oriented screen. |
| Routine Fecalysis (Stool Examination) | Fixed panel: color/consistency dropdowns; occult blood, mucus, RBC/WBC, and other fields as dropdown/numeric; microscopy observations as narrative or controlled taxonomy | Sections for macroscopic, chemical, and microscopic findings. |
| Fecal Occult Blood Test (FOBT) | Dropdown: Negative/Positive/Invalid, with method/kit recorded | Qualitative result plus method and any kit-specific comment. |
| Urine Pregnancy Test | Dropdown: Negative/Positive/Invalid; optional control validity | Qualitative result, method, and collection/time details when required. |
| Semen Analysis | Panel: numeric volume, pH, concentration, total count, motility and morphology; dropdown/narrative liquefaction, viscosity, appearance, agglutination and comments according to method | Structured table with numeric units plus labeled qualitative observations. Include abstinence interval and collection completeness if captured by procedure. |
| Urine Microscopic Examination | Panel: numeric/categorical RBC, WBC, epithelial cells, casts, crystals, bacteria, yeast and other observed elements; allow narrative morphology | Microscopy table grouped by cell, cast, crystal, and organism findings. |
| Stool Parasite Examination | Structured repeated findings: organism/parasite name, stage, quantity/semiquantitation, and comment; dropdown for none detected only where method supports it | Organism findings table, plus method and specimen number. Needs repeatable rows for multiple findings. |

## Microbiology

| Test | Medical technologist input | Report presentation |
|---|---|---|
| Gram Stain | Structured fields: specimen quality, cells, organisms/Gram reaction, morphology, quantity/semiquantitation, comment | Microscopy report table/sections. Avoid a single unlabelled free-text blob. |
| Bacterial Culture | Dropdown for no growth/growth/pending/contaminated as appropriate, then repeatable organism rows with identification, quantity, and comment | Culture status plus one row per isolate. Needs a repeatable organism worksheet. |
| Culture and Sensitivity | Repeatable isolate rows; for each isolate, antimicrobial and interpretation (S/I/R or method-specific categories), optional MIC/zone numeric values and units | Culture summary followed by susceptibility matrix per organism. Must preserve method/standard/version. Requires structured worksheet and result schema support. |
| Sputum Culture | Same culture worksheet, with sputum specimen quality fields and isolate rows | Specimen quality, culture status, isolates and susceptibility data. |
| Urine Culture | Culture worksheet with colony count numeric and unit, isolate rows and susceptibility when ordered | Colony count and organism/susceptibility sections; separate no-growth from pending. |
| KOH Preparation | Dropdown/narrative: fungal elements detected/not detected/indeterminate plus morphology/comment | Qualitative result and microscopy description. |
| Acid-Fast Bacilli (AFB) Stain | Dropdown for detected/not detected/invalid plus grading dropdown if detected under the adopted standard | Stain result, grading, method and microscopy comment; do not conflate smear with culture or molecular tests. |

## Immunology and Serology

| Test | Medical technologist input | Report presentation |
|---|---|---|
| C-Reactive Protein (CRP) | Numeric with unit; distinguish standard CRP from hs-CRP in catalog | Numeric result, method and applicable interval/decision guidance. |
| Rheumatoid Factor (RF) | Numeric with unit and assay cutoff, or dropdown if the validated method only reports qualitative | State quantitative/qualitative method and cutoff; avoid treating an isolated result as a diagnosis. |
| Dengue NS1 Antigen | Dropdown: Detected/Not detected/Invalid, with kit-specific interpretation | Qualitative result, assay method and collection timing note if lab procedure requires. |
| Dengue IgM/IgG | Two separate dropdown analytes: Reactive/Nonreactive/Equivocal/Invalid, with method | Display IgM and IgG separately and attach assay-specific comments; do not merge into a single “dengue positive” result. |
| Hepatitis B Surface Antigen (HBsAg) | Dropdown or numeric signal/cutoff plus interpretation, depending on assay; supplemental result may be required | Screening result, method, and confirmatory/supplemental status where applicable. |
| HIV Screening Test | Dropdown for initial assay: Reactive/Nonreactive/Invalid; only release final status when the required national/local algorithm is complete | Keep screening result and algorithm-level interpretation distinct. Reactive screening alone must not display as a confirmed diagnosis. |
| Syphilis Screening Test | Assay-dependent dropdown and/or numeric titer; record test type (treponemal/non-treponemal) and reflex result separately | Display assay name, result, titer when applicable, and reflex/confirmatory status. |

## Coagulation

| Test | Medical technologist input | Report presentation |
|---|---|---|
| Prothrombin Time (PT) | Numeric seconds; include control/ method metadata if required | PT seconds plus local interval. |
| International Normalized Ratio (INR) | Numeric; analyzer-calculated value preferred | Numeric result with method context; indication-specific targets must not be represented as a universal reference interval. |
| Activated Partial Thromboplastin Time (aPTT) | Numeric seconds | Numeric result and reagent/instrument-specific interval. |
| Fibrinogen | Numeric with unit; distinguish method where relevant | Numeric result, unit and method-specific interval. |
| D-dimer | Numeric with unit and assay cutoff; preserve FEU vs DDU | Numeric result, unit, cutoff and assay method. Never compare results with a cutoff in a different unit convention. |

## Hormones and Endocrinology

| Test | Medical technologist input | Report presentation |
|---|---|---|
| Thyroid-Stimulating Hormone (TSH) | Numeric | Numeric result, unit, age/pregnancy/method-specific interval as configured. |
| Free T4 (FT4) | Numeric | Numeric result, unit and method-specific interval. |
| Free T3 (FT3) | Numeric | Numeric result, unit and method-specific interval. |
| Total T4 | Numeric | Numeric result, unit and method-specific interval. |
| Total T3 | Numeric | Numeric result, unit and method-specific interval. |
| Cortisol | Numeric; capture collection time and stimulation/suppression context | Numeric result, unit, collection time and protocol-specific interval. |
| Testosterone | Numeric; record total/free assay and relevant patient category | Numeric result, unit, age/sex/time/method-specific interval. |
| Prolactin | Numeric | Numeric result, unit and method-specific interval; collection context can be included when required. |

## Blood Banking and Transfusion Medicine

| Test | Medical technologist input | Report presentation |
|---|---|---|
| ABO Blood Grouping | Dropdown: A/B/AB/O plus discrepancy/indeterminate; record forward/reverse typing results separately where performed | Group result with component reactions and discrepancy status. |
| Rh(D) Typing | Dropdown: Positive/Negative/Weak D/Indeterminate per validated procedure | Rh(D) result and method/comment; weak-D workflow is lab-policy dependent. |
| Crossmatching | Dropdown: Compatible/Incompatible/Invalid; record method, donor unit identifier, component, and reaction details | Unit-by-unit compatibility table with method and testing timestamps. Requires structured rows when multiple units are crossmatched. |
| Direct Antiglobulin Test (DAT) | Dropdown: Negative/Positive/Invalid; if positive, separate IgG/C3 component and strength fields when performed | Result plus reagent/component-specific details and comment. |
| Indirect Antiglobulin Test (IAT) | Dropdown: Negative/Positive/Invalid; if positive, antibody screen/identification and strength as applicable | Result plus antibody identification section; variable antibody panels need structured worksheet support. |

## Histopathology and Cytology

| Test | Medical technologist input | Report presentation |
|---|---|---|
| Pap Smear | Structured sections: specimen adequacy, Bethesda interpretation/category, organisms/other findings, comments; interpretation by authorized pathologist | Sectioned cytology report; do not release as a single positive/negative dropdown. |
| Tissue Biopsy Examination | Structured gross description, microscopic description, diagnosis, margins/ancillary findings as applicable; pathologist-authored | Multi-section signed pathology report with specimen/site and diagnosis prominent. |
| Cytology Examination | Structured specimen adequacy, findings, diagnostic category and comment; pathologist-authored | Multi-section cytology report. |
| Fine-Needle Aspiration Cytology (FNAC) | Structured adequacy, site, microscopic description, diagnostic classification, comment; pathologist-authored | Multi-section report with classification system chosen by the laboratory and specimen/site. |

## Catalog normalization and safe defaults

The supplied list names Albumin, Total Protein, Creatinine and BUN in more than one category. Catalog each once as a canonical billable test and link it to all applicable categories through `test_category_memberships`; do not create duplicate billable catalog entries.

### Research notes for the repeated tests

LOINC distinguishes orderable panels from their individual reported observations. A panel is a defined collection, and some component observations may also be ordered independently. Thus, the category headings in the supplied list should be treated as navigation/classification, not as evidence that each heading defines a separately priced panel. Keep one catalog/orderable record for the same assay and let it belong to multiple categories. Create a distinct record only when the actual analyte, specimen/system, method, or clinical orderable differs. For example, serum Total Protein is not the same catalog item as Urine Total Protein; serum Creatinine is not the same as urine Creatinine used for a urine ratio or clearance. See the [LOINC panel FAQ](https://loinc.org/kb/faq/content), [LOINC panel model](https://loinc.org/kb/users-guide/panels), and [LOINC analyte/component guidance](https://loinc.org/kb/users-guide/major-parts-of-a-loinc-term/component).

For this list, the shared-category memberships should be:

- **Albumin:** Clinical Chemistry and Liver Function and Related Tests; one serum albumin orderable.
- **Total Protein:** Clinical Chemistry and Liver Function and Related Tests; one serum total-protein orderable.
- **BUN:** Clinical Chemistry and Renal Function; one serum BUN orderable.
- **Creatinine:** Clinical Chemistry and Renal Function; one serum creatinine orderable.

These representative Mayo Clinic Laboratories catalog entries show common result patterns and why they must not be copied as universal configuration:

| Canonical orderable | Example specimen and method | Example result and source-laboratory interval |
|---|---|---|
| Albumin, Serum | Serum; photometric bromocresol green (BCG) | Numeric g/dL; Mayo lists 3.5–5.0 g/dL from 12 months onward. Mayo cautions that BCG results may differ from electrophoresis. |
| Protein, Total, Serum | Serum; colorimetric Biuret | Numeric g/dL; Mayo lists 6.3–7.9 g/dL from 1 year onward. |
| Blood Urea Nitrogen (BUN), Serum | Serum; photometric/urease | Numeric mg/dL; Mayo lists age/sex-specific examples: 7–20 mg/dL for ages 1–17, then 8–24 mg/dL for adult males and 6–21 mg/dL for adult females. |
| Creatinine, Serum | Serum; enzymatic method in Mayo's creatinine/eGFR service | Numeric mg/dL with age/sex-specific intervals. Mayo's example for adults is 0.74–1.35 mg/dL for males aged 15+ and 0.59–1.04 mg/dL for females aged 16+; pediatric intervals differ. |

Treat those Mayo methods and intervals as **research examples only**. They are from one performing laboratory and are not defaults for Labstream. Each laboratory must enter its own validated specimen handling, method, units, price, turnaround, and reference intervals before making the catalog items available. No general internet source can establish this laboratory's prices or turnaround time.

The supplied list also names eGFR separately from Creatinine. KDIGO recommends serum creatinine with an estimating equation for initial GFR assessment. Therefore, eGFR is a calculated result associated with serum creatinine, not a second independently measured assay by default. If the laboratory elects to report it, configure it as a separately labeled calculated result with the approved equation/version and applicability rules; do not add another charge or specimen collection merely for the calculation without a local policy decision. KDIGO's adult equation guidance and its warning to consider accuracy limits do not replace local medical-director approval: [KDIGO 2024 CKD guideline](https://kdigo.org/wp-content/uploads/2024/03/KDIGO-2024-CKD-Guideline.pdf).

### Provisional default specimen mappings

The generated starter seed links every canonical test to one or more candidate specimen requirements. Those rows are workflow defaults to review, not validated collection instructions; tests remain unavailable until the laboratory configures the test. The supported specimen labels include Blood, Whole blood, Serum, Plasma, Citrated plasma, Urine, Stool, Sputum, Swab, Saliva, Semen, Cervical specimen, Aspirate, Cerebrospinal fluid, Tissue, and Other. Site-dependent microbiology/cytology tests use `Other` with an instruction to specify the actual source before enabling. Creatinine Clearance has paired timed Urine and Serum requirements; UACR uses Urine. The mappings are maintained in `backend/scripts/generate_standard_catalog_seed.js` and emitted into `backend/supabase/seed_standard_test_catalog.sql` as `test_specimen_requirements` rows.

Do not seed universal reference limits for this international deployment. Intervals depend on method, instrument, units, age, sex, pregnancy, and local validation. Keep each analyte's range empty until the clinic configures a verified interval and unit. The ADA diagnostic criteria for glucose/A1c are clinical decision thresholds, not a substitute for an assay-specific reference interval. The dashboard's H/L flag should be driven only by configured reference-range records.

Before a standard test can be enabled, laboratory setup must provide its price, turnaround time, actual specimen requirements, method, units, analytes/options, and validated ranges where applicable. The starter catalog can be shown as unavailable until those are configured. A future structured-report extension should introduce typed repeatable sections/rows (or JSONB with strict server-side validation and versioned templates), preserve each result revision, and render the same structured report to the pathologist and patient.

## Sources for reporting policy

- MedlinePlus explains that reference intervals vary across laboratories, methods, units, and populations; use the interval reported by the performing laboratory: <https://medlineplus.gov/lab-tests/how-to-understand-your-lab-results/>
- ADA Standards of Care 2025 gives glucose/A1c diagnostic criteria and confirmation requirements; these are clinical criteria, not generic analyzer reference intervals: <https://diabetesjournals.org/care/article/48/Supplement_1/S27/157566>
- KDIGO 2024 CKD guidance uses both eGFR and albuminuria and requires persistence/context for CKD classification: <https://kdigo.org/wp-content/uploads/2024/04/KDIGO-2024-CKD-Guideline.pdf>
- CDC's HIV testing guidance uses a multistep algorithm; a reactive screen is not by itself a final diagnosis: <https://www.cdc.gov/hiv/sti-hiv-training/clinicalguidance/testing-diagnosis/index.html>
- NCI describes cytology classifications including Bethesda categories for cervical cytology: <https://www.cancer.gov/types/cervical/hp/cervical-screening-pdq>
- Mayo Clinic Laboratories' CBC with differential illustrates method-, age-, and component-specific reporting and reference values: <https://www.mayocliniclabs.com/test-catalog/Overview/42120>
- Mayo Clinic Laboratories' example catalogs for [serum albumin](https://www.mayocliniclabs.com/test-catalog/overview/8436), [serum total protein](https://www.mayocliniclabs.com/test-catalog/overview/8520), [serum BUN](https://www.mayocliniclabs.com/test-catalog/overview/81793), and [serum creatinine with eGFR](https://www.mayocliniclabs.com/test-catalog/overview/48216) were reviewed for the research examples above; their intervals and methods are laboratory-specific.
