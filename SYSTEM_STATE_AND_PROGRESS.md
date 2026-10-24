# Labstream system state and progress handoff

Prepared 2026-10-24 for a follow-up agent to analyze the repository and identify workflow gaps. Treat this file as context, not as permission to change Supabase or deploy anything. The user has authorized routine project file edits, but destructive database execution still requires their explicit intent for the target database.

## Product and workflow

Labstream is a diagnostic laboratory workflow system for one laboratory. Branch and multi-laboratory workflows are excluded by the proposal. The intended role workflow is:

1. **Administrator** manages laboratory staff, test categories/catalog, reference ranges, reports, and audit review.
2. **Cashier** registers a walk-in patient and requested tests; the request waits in Queue until cash payment is processed and an invoice is created.
3. **Medical Technologist** sees assigned paid requests, receives and accepts/rejects specimens, records each requested test's results, saves drafts, and submits the complete request to pathology. Recollection/retest attempts must retain a traceable history.
4. **Pathologist** is assigned for the request, reviews each test, supplies a required interpretation, and approves or returns tests with a required remark and any retest/recollection selection. The request releases only when all requested tests are approved.
5. **Patient** sees request-level released results in My Results and individual test entries in Test History. Unreleased result details must remain hidden.

The database and API enforce the single-laboratory boundary, roles, assignments, and legal status transitions. The browser's selected role is not authorization.

## Scope ruling: proposal baseline and later expansion

The supplied proposal explicitly limits the initial system to **one diagnostic laboratory** and excludes multi-branch management. A prior request for clinic/branch onboarding and multi-clinic deployment conflicts with that limitation. This implementation now follows the proposal: one laboratory record is permitted per database; branch assignments and branch tables are removed; user sign-in does not request a clinic code. `clinic_id` remains as the internal foreign-key identity of that one laboratory. Multi-laboratory or branch support would require a formal proposal amendment and a separate architecture change.

The canonical schema contains a singleton guard on the laboratory record and no branch entities. The upgrade migration deliberately stops before dropping anything when it detects multiple laboratories or branch data, so those records can be reviewed and consolidated explicitly. The migration has not been run against Supabase.

## Repository map and run configuration

- `frontend/`: React + Vite frontend, role pages and components, calls backend via `frontend/src/api/client.js`.
- `backend/`: Express API, Socket.IO, Drizzle ORM with Postgres.js.
- `backend/supabase/schema.sql`: canonical current database schema. It is the source of truth for enums, constraints, triggers, RLS, and views. Legacy `backend/drizzle/` and `backend/supabase/002_tenant_accounts.sql` are not the current schema workflow.
- `backend/supabase/bootstrap_first_admin.sql`: one-time single-laboratory + first admin bootstrap for a fresh schema.
- `backend/supabase/migrations/20261024_single_laboratory_scope.sql`: guarded upgrade from the previous clinic/branch schema to one laboratory; it stops on data requiring manual review.
- `backend/supabase/migrations/20261024_standard_catalog_category_memberships.sql`: additive upgrade for the many-to-many test/category relation; run after single-laboratory scope migration on existing databases.
- `backend/supabase/reset.sql`: destructive full schema reset; do not run casually.
- `backend/supabase/clear_operational_data_keep_accounts.sql`: transaction to clear workflow/catalog data while preserving the laboratory/accounts and patient identities linked to portal accounts. This SQL has been created but not executed.
- `backend/supabase/standard-test-result-design.md`: recommended entry/display model for the 12 supplied categories and 77 unique test names.
- `backend/supabase/seed_standard_test_catalog.sql`: generated, repeatable starter catalog query for the single laboratory. It creates the 12 categories, 77 canonical test rows, all category memberships, and provisional specimen requirements. It has not been run against the user's Supabase database.
- `backend/scripts/generate_standard_catalog_seed.js`: regenerates the SQL from the standard test design guide and checks for 12 categories, 81 category mentions, and 77 canonical test names.
- `README.md`: local setup and manual test instructions.
- `backend/README.md`: API and schema notes.

Run backend and frontend in separate terminals. Backend uses `backend/.env`, `DATABASE_ENABLED=true`, Supabase `DATABASE_URL`, `AUTH_TOKEN_SECRET` (32+ bytes), and `FRONTEND_ORIGIN=http://localhost:5173`. Frontend defaults to `VITE_API_URL=http://localhost:3000`. Health check is `GET http://localhost:3000/health`. Do not expose privileged DB credentials to frontend. Phone access needs both dev servers reachable by LAN IP and matching CORS/API settings; localhost-only API URLs will not work from a phone.

## Implemented areas visible in the current workspace

- API-backed login, activation, and authenticated role pages; auth uses an HttpOnly cookie and Argon2id password handling.
- API-backed single-laboratory workflows for cashier, administrator, technologist, pathologist, and patient pages.
- Socket.IO laboratory notifications after writes and periodic client refresh as a fallback for cross-window updates.
- Cashier patient/request registration, payment queue, payment/invoice handling.
- Staff and test catalog management, category/filter handling, reference ranges, and audit log access.
- Specimen accept/reject/recollection and per-test result draft/submit/revision/review workflow.
- Patient request-level results and per-test history.
- Country/city dropdown component and responsive role pages.
- Recent UI decisions include compact labels, consistent status tags/table styling, no table card wrapper, and up to ten table rows before pagination.

The active worktree contains a large number of modified and untracked files from accumulated implementation. Do not revert, reset, or overwrite unrelated work. Inspect `git status --short` and diffs before editing.

## Known limitations and issues requiring analysis

1. **No complete end-to-end validation has been recorded.** The README now has a manual workflow checklist and optional frontend build/lint commands. A future agent should first inspect the current diff and then walk the full role handoffs against a disposable single-laboratory database, recording exact failing requests and server errors.
2. **Real-time behavior should be verified.** Socket notifications are restricted to authenticated sessions for the single laboratory; a 10-second refetch fallback exists. Confirm every screen refreshes for relevant writes and reconnects correctly.
3. **Catalog seed has not been applied to the database.** The repeatable SQL seed creates 12 categories, 77 canonical tests, 81 category memberships, and provisional specimen requirements. It does not seed analyte forms, prices, turnaround times, methods, or reference ranges; configure and validate those before enabling a test. Do not seed unvalidated reference intervals.
4. **Result model is scalar.** Current `result_value_type` supports numeric, text, select, boolean, one scalar per analyte. Static panels can be represented by multiple analytes, but dynamic worksheets (urinalysis grids, variable stool/parasite findings, culture isolates/susceptibility matrix, multiple transfusion units/antibodies, pathology report sections) need a structured, versioned result template and renderer. Avoid flattening these into a single free-text field for routine production use.
5. **Category membership is normalized.** Albumin, Total Protein, Creatinine, and BUN each have one canonical test record linked to both of their listed categories through `test_category_memberships`.
6. **Activation-code delivery is manual.** Initial laboratory/admin bootstrap is a controlled SQL operation and the one-time code is manually delivered. Automated email/SMS delivery and password recovery are not implemented; a patient can change their password after signing in.
7. **Do not treat demo/test data as clinical truth.** No universal ranges should be filled automatically for international deployment. Ranges and clinical cutoffs are different concepts and must be method/population aware.

## Specific scenarios the current system cannot fully handle

This list comes from static code/schema review against the agreed proposal. It is not a substitute for running the scenarios against a disposable database. Some entries are definite implementation gaps; those involving timing, network behavior, or a full role handoff still need runtime confirmation.

### Small and common cases

1. **Boolean analyte entry:** Test Catalog allows Yes/No, but the technologist editor renders the field as text. The save mapper treats only the exact text `true` as true; a value such as `Yes` can be stored incorrectly. See `frontend/src/pages/administrator/TestCatalog.jsx`, `frontend/src/pages/medical-technologist/ResultsInProgress.jsx`, and `frontend/src/pages/medical-technologist/TechnologistContext.jsx`.
2. **More than 100 records in a view:** Cashier Queue and Pathologist worklists fetch up to 100 rows and paginate locally. Rows beyond the fetched page cannot be reached or searched there. Staff and other local-pagination screens need the same page-through check. See `frontend/src/pages/cashier/CashierQueue.jsx` and `frontend/src/pages/pathologist/PendingValidation.jsx`.
3. **Catalog setup correction:** The Add Test form now supports multiple specimen requirements and analytes, and editing loads and saves both. Existing workflow configuration is kept intact when a test has request history or reference ranges; changing those fields is blocked to preserve result references. A versioned configuration workflow is still needed to safely change a used test. See `frontend/src/pages/administrator/TestCatalog.jsx` and `backend/src/routes/administrator.js`.
4. **Unchanged/unsubmitted result entry on connection loss:** Draft persistence is explicit. Values typed since the last save are lost if the tab closes or a network failure occurs before saving; there is no autosave/offline queue.
5. **Country/city service unavailable:** Patient/staff address selection depends on an external geography API. Verify the form's behavior when that API is unreachable or its country/city dataset changes; registration may be blocked or partial.

### Workflow and laboratory operations

6. **Changing used test workflow definitions:** Catalog edits can revise specimen/analyte configuration only before the test has request history or ranges. There is no versioned definition mechanism yet, so historically used configurations are locked to preserve result interpretation.
7. **Waiver policy and HMO/mixed payment:** Zero-total requests are now explicitly recorded as waivers, but the workflow has no waiver reason/approval policy, HMO authorization, copay, partial settlement, or insurer billing.
8. **Paid request cancellation, refund, or invoice correction:** Cashier cancellation is for unpaid requests. Payment void fields exist in the schema, but there is no corresponding cashier API/UI workflow. See `backend/src/routes/cashier.js` and `backend/supabase/schema.sql`.
9. **HMO or mixed payment:** The payment method enum currently contains only Cash. The system cannot record HMO coverage, authorization, copay, partial settlement, or insurer billing. See `backend/supabase/schema.sql`.
10. **Unavailable pathologist while still active:** Initial submission fails if no eligible active pathologist is available. Deactivation can auto-reassign active work, but the Administrator has no direct action to transfer a specific request from an active but unavailable pathologist. See `backend/src/routes/technologist.js` and `backend/src/routes/staff.js`.
11. **Password forgotten or activation code lost:** Activation and authenticated password change exist, but password reset/recovery is outside the proposal baseline and is not implemented. Activation codes are manually handed to the account holder. See `backend/src/routes/auth.js` and `backend/src/routes/cashier.js`.

### Clinical reporting and data history

12. **Variable-length clinical results:** Scalar analytes work for fixed fields, but not repeatable organism/isolate rows, antimicrobial susceptibility matrices, multiple crossmatched units, parasite findings, or sectioned pathology reports. A structured/versioned result template and matching editor/renderer are needed before these are routine workflows. See `backend/supabase/schema.sql` and `backend/supabase/standard-test-result-design.md`.
13. **Standard test list expected in this laboratory:** The idempotent seed query is available but has not been applied to the user's database. It includes provisional specimen requirements. After it is run, the laboratory must verify each unavailable test's specimen, configure result fields, price, turnaround, method, and local ranges before ordering.
14. **Shared category tests:** The schema and API now support multiple category memberships while preserving one canonical test and price for each repeated item.
15. **Historical category volume after catalog changes:** Dashboard volume groups historical requests using the test's current catalog category. Relocating a test can move old volume; deactivating its category can remove historical volume from the active graph. The request item stores a category snapshot, but the chart query uses the current catalog relation. See `backend/src/routes/administrator.js` and `backend/supabase/schema.sql`.
16. **Laboratory-specific ranges and result interpretation:** The system does not provide universal reference ranges for the supplied standard list. The laboratory must configure verified intervals, units, methods, and appropriate demographic distinctions. Until then numeric abnormal flags and meaningful interpretation may be unavailable; decision thresholds must not be substituted for reference intervals.

### Larger scale and availability

17. **Instrument/LIS workflow:** Results are manually entered. Analyzer import, barcode scanning, laboratory information system exchange, and automated result matching are not implemented.
18. **Socket connection loss:** Laboratory updates use Socket.IO plus a 10-second refresh fallback. If the socket is unavailable, another role's view can remain stale until the fallback refresh; test this behavior on desktop, mobile, and reconnect. See `frontend/src/api/client.js` and `backend/src/realtime.js`.
19. **Authorization under load:** Role-scoped API queries and assignment checks exist, but authorization should be checked against every endpoint, especially patient search/result access, catalog changes, and staff reassignment.
20. **Production recovery and compliance operations:** Automated backups/restore drills, retention/deletion policy, jurisdiction-specific privacy controls, electronic signatures, and external reporting requirements are not established by this prototype. These need deployment-specific decisions before real patient use.

Priority to analyze first: structured result templates and test setup; payment void/refund and policy; activation-code delivery; staff reassignment administration; then history-preserving analytics and pagination beyond 100 rows. Online payment gateways, HMO claims, and branch/multi-laboratory workflows remain outside the proposal scope.

## Proposal exclusions and implementation boundary

The current implementation is constrained to walk-in requests, in-person cashier payment, manual text/numeric result entry, pathologist review, and patient access to released results. It does not implement online booking, online payment gateways, insurance/HMO claims, analyzer/LIS integration, X-ray/ultrasound image handling, certified digital signatures, predictive analytics, enterprise BI, or multi-branch administration. Reports remain descriptive operational summaries with PDF/spreadsheet export. These are proposal limitations, not unfinished requirements for this release.

## Standard test list and implementation instructions

The standard diagnostic test list is in [`backend/supabase/standard-test-result-design.md`](backend/supabase/standard-test-result-design.md). It covers 12 categories, 81 category mentions, and 77 unique test names, with a proposed technologist input method and report display form for each. The generated SQL seed stores those recommendations in starter test descriptions, but the guide remains a design specification, not an approved clinical protocol.

### Current implementation boundary

- The canonical schema has single-laboratory `test_categories`, `test_catalog`, `test_category_memberships`, `test_specimen_requirements`, `test_analytes`, and `reference_ranges` tables. Canonical tests can appear under multiple categories, and each test can require multiple specimen types.
- The schema has category `is_active` and test `is_available` flags, and cashier test selection already requires both to be true. Individual test availability can be changed through its edit form. A reversible category availability toggle is not yet available; category deactivation is currently tied to the category removal flow.
- The Administrator catalog form supports multiple specimen requirements and analytes and edits them before operational history exists. The API protects existing request/result and reference-range links by rejecting changed configurations after use. It supports scalar `numeric`, `text`, `select`, and `boolean` analytes; the technologist UI currently lays these out as a flat list.
- Fixed panels can be modeled as one test with multiple analytes in the data model, but the normal UI cannot configure them fully yet. Repeatable culture isolates/susceptibility rows, variable parasite findings, multiple transfusion units, and sectioned pathology reports require a structured, versioned result template, editor, persistence model, and renderer before routine use.
- Categories/tests are not automatically seeded. Use `backend/supabase/seed_standard_test_catalog.sql` for the single laboratory; replace the internal laboratory code placeholder in both occurrences and run the full script in Supabase SQL Editor. For existing databases, apply `backend/supabase/migrations/20261024_standard_catalog_category_memberships.sql` after the single-laboratory migration. The generated seed creates provisional per-test specimen requirements but no analyte forms or reference intervals. Starter tests remain unavailable until laboratory-specific workflow configuration is reviewed and completed. The generator is `backend/scripts/generate_standard_catalog_seed.js`.

### Recommended implementation sequence

1. **Apply and verify the single-laboratory catalog import.** The idempotent seed SQL inserts 12 categories, 77 canonical tests, 81 category memberships, and provisional specimen requirements for the configured laboratory. For an existing database, apply the category-membership migration after the single-laboratory migration; then run the seed after replacing the laboratory-code placeholder. Review specimen mappings and configure local procedures before enabling any test.
3. **Version Administrator catalog configuration.** The form and API now capture multiple specimen and analyte rows and support edits for unused configurations. Add immutable/versioned configuration revisions so a used test can be updated for future requests without changing historical result meaning. Capture stable analyte keys, labels, input types (`numeric`, `text`, `select`, `boolean`), units, select options, requiredness, ordering, and relevant method/collection metadata.
4. **Implement the result editors and report renderers.** Generate the technologist form from the saved test/analyte definitions. Render fixed panels as labeled tables and narrative tests as clearly labeled sections; render the same submitted values and units in pathologist review and the patient report. Add a versioned structured template/editor for variable-length results before enabling those tests. Preserve revisions and the test/request history when configuration changes.
5. **Configure laboratory-specific reference ranges.** Add ranges per numeric analyte, including applicable age/sex groups, unit, and any required method context. Use ranges only after laboratory validation. Keep ranges empty when unverified; do not substitute diagnostic decision thresholds or a value copied from another laboratory.
6. **Connect every role to the live catalog.** Ensure cashier request selection and every other test dropdown use active tests/categories from the API, updating after catalog changes. A category filter must reflect current categories; category removal must require resolving its tests through relocation or removal, preserving historical request/result records.
7. **Validate incrementally before bulk enablement.** Start with one single-value numeric test, one qualitative dropdown test, one fixed multi-analyte panel, and one structured test template. Walk each through request/payment, specimen receipt, technologist entry, pathologist review/return/release, and patient result/history. Verify units, options, reference-range flags, required fields, audit trail, laboratory authorization, and historical rendering before importing/enabling the rest.
8. **Add reversible availability controls.** Let an administrator mark a category or an individual test unavailable without deleting it. A test is effectively orderable only when `test.is_available` is true and at least one of its assigned categories is active. Turning a category back on restores only tests that are individually available and belong to an active category. Show this effective state in the catalog, confirm and audit each change, publish the catalog update for real-time refresh, and preserve existing requests, results, and snapshots.

The contents of the design document are recommendations for configuring and implementing the catalog. Clinical leadership must confirm assay methods, specimen requirements, result wording, units, reference intervals, and release rules for the target laboratory before those settings are used with patient results.

## Database data clearing contract

`backend/supabase/clear_operational_data_keep_accounts.sql` intentionally keeps the single laboratory record, `users`, `staff_profiles`, and `account_tokens`. It removes requests, results/reviews, specimens, payments/invoices, audit history, catalog/reference configuration, and unlinked walk-in patient rows. Patient rows linked to portal users are retained because the auth route resolves patient PID and display name through that row; removing those rows would make retained patient accounts unusable. The SQL clears audit history too. It is provided for the user to run against the intended database, not executed by an agent.

## Medical sources / caution

The standard test result design doc links to MedlinePlus on method-specific reference intervals, ADA 2025 glucose/A1c diagnostic criteria, KDIGO 2024 CKD guidance, CDC HIV testing algorithms, NCI cervical cytology reporting, and Mayo CBC reporting examples. Keep citations current if revisiting ranges or clinical interpretation. Medical claims should be checked against official, current guidance and local policy.

## Implementation updates from the Antigravity review (2026-10-24)

- Patient released-result payloads now include the patient's name, PID, date of birth, sex, laboratory name, result units, and stored lower/upper reference-limit snapshots. The report UI shows these values and uses neutral release wording; it does not invent an electronic signature.
- Test Catalog edit now loads/saves multi-analyte and multi-specimen settings as well as the test metadata. To protect historical rows and configured ranges, the API blocks changing workflow configuration after requests or reference ranges exist; metadata edits remain possible if the configuration is unchanged. A future versioned configuration model is still needed for safe changes to used tests.
- Cashier queue numbers and the currently called patient are now persisted on each request, with authenticated call/call-next/dismiss endpoints and audit events. Queue ticket numbers are stable instead of being regenerated from the current page order.
- A zero-fee transaction is represented as a `waiver` payment method and is labeled as a waiver in the invoice. Positive amounts remain cash; HMO and partial payment support are still outside the implemented payment model.
- For an existing Supabase database, apply `backend/supabase/migrations/20261024_cashier_queue_and_zero_fee_waiver.sql` once before using these changes. A fresh database created from `backend/supabase/schema.sql` already includes the new enum and queue columns. The migration was not run against the user's database.
- Backend source syntax checks and the frontend Vite production build succeeded. Full workflow/API checks against the user's Supabase database were not performed.

## Suggested analysis sequence for the next agent

1. Read `README.md`, `backend/README.md`, this handoff, the canonical schema, and current `git status`/diffs.
2. Trace a single request through the API and schema for one normal case, one multi-test request, one rejected specimen/recollection, one returned result, and one final release.
3. Compare frontend state refresh paths with backend events and status transitions; identify stale or unreachable screens.
4. Assess missing constraints, indexes, audit events, privacy protections, and role-based authorization within the single laboratory. Keep SQL recommendations distinct from schema mutations.
5. Report findings with file/API/schema references and severity before changing workflow assumptions. The user has granted routine edit approval, but ask before executing destructive SQL against their live Supabase database or publishing/deploying externally.
