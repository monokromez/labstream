# Labstream system state and progress handoff

Prepared 2026-10-24 for a follow-up agent to analyze the repository and identify workflow gaps. Treat this file as context, not as permission to change Supabase or deploy anything. The user has authorized routine project file edits, but destructive database execution still requires their explicit intent for the target database.

## Product and workflow

Labstream is a multi-clinic diagnostic laboratory workflow prototype. The intended flow is:

1. **Administrator** manages clinic staff, test categories/catalog, reference ranges, reports, and audit review.
2. **Cashier** registers a walk-in patient and requested tests; the request waits in Queue until cash payment is processed and an invoice is created.
3. **Medical Technologist** sees assigned paid requests, receives and accepts/rejects specimens, records each requested test's results, saves drafts, and submits the complete request to pathology. Recollection/retest attempts must retain a traceable history.
4. **Pathologist** is assigned for the request, reviews each test, supplies a required interpretation, and approves or returns tests with a required remark and any retest/recollection selection. The request releases only when all requested tests are approved.
5. **Patient** sees request-level released results in My Results and individual test entries in Test History. Unreleased result details must remain hidden.

The database and API are intended to enforce clinic/branch scoping, roles, assignments, and legal status transitions. The browser's selected role is not authorization.

## Repository map and run configuration

- `frontend/`: React + Vite frontend, role pages and components, calls backend via `frontend/src/api/client.js`.
- `backend/`: Express API, Socket.IO, Drizzle ORM with Postgres.js.
- `backend/supabase/schema.sql`: canonical current database schema. It is the source of truth for enums, constraints, triggers, RLS, and views. Legacy `backend/drizzle/` and `backend/supabase/002_tenant_accounts.sql` are not the current schema workflow.
- `backend/supabase/bootstrap_first_admin.sql`: one-time clinic + first admin bootstrap for a fresh schema.
- `backend/supabase/reset.sql`: destructive full schema reset; do not run casually.
- `backend/supabase/clear_operational_data_keep_accounts.sql`: transaction to clear workflow/catalog data while preserving clinic/accounts and patient identities linked to portal accounts. This SQL has been created but not executed.
- `backend/supabase/standard-test-result-design.md`: recommended entry/display model for the 12 supplied categories and 77 unique test names. It is a design specification, not seeded catalog data.
- `README.md`: local setup and manual test instructions.
- `backend/README.md`: API and schema notes.

Run backend and frontend in separate terminals. Backend uses `backend/.env`, `DATABASE_ENABLED=true`, Supabase `DATABASE_URL`, `AUTH_TOKEN_SECRET` (32+ bytes), and `FRONTEND_ORIGIN=http://localhost:5173`. Frontend defaults to `VITE_API_URL=http://localhost:3000`. Health check is `GET http://localhost:3000/health`. Do not expose privileged DB credentials to frontend. Phone access needs both dev servers reachable by LAN IP and matching CORS/API settings; localhost-only API URLs will not work from a phone.

## Implemented areas visible in the current workspace

- API-backed login, activation, and authenticated role pages; auth uses an HttpOnly cookie and Argon2id password handling.
- API-backed clinic-scoped workflows for cashier, administrator, technologist, pathologist, and patient pages.
- Socket.IO clinic notifications after writes and periodic client refresh as a fallback for cross-window updates.
- Cashier patient/request registration, payment queue, payment/invoice handling.
- Staff and test catalog management, category/filter handling, reference ranges, and audit log access.
- Specimen accept/reject/recollection and per-test result draft/submit/revision/review workflow.
- Patient request-level results and per-test history.
- Country/city dropdown component and responsive role pages.
- Recent UI decisions include compact labels, consistent status tags/table styling, no table card wrapper, and up to ten table rows before pagination.

The active worktree contains a large number of modified and untracked files from accumulated implementation. Do not revert, reset, or overwrite unrelated work. Inspect `git status --short` and diffs before editing.

## Known limitations and issues requiring analysis

1. **No complete end-to-end validation has been recorded.** The README now has a manual workflow checklist and optional frontend build/lint commands. A future agent should first inspect the current diff and then walk the full role handoffs against a disposable clinic/database, recording exact failing requests and server errors.
2. **Real-time behavior should be verified.** Socket notifications are clinic-scoped; a 10-second refetch fallback exists. Confirm every screen subscribes/refetches for all state-changing writes and that cross-clinic messages are not possible.
3. **Catalog seed data is not implemented.** The supplied 12-category standard test list has been analyzed in `backend/supabase/standard-test-result-design.md`, but no default category/test/analyte records are inserted. Do not seed unvalidated international reference intervals. Test price, turnaround, specimen, method, units, result options, and local ranges require clinic setup.
4. **Result model is scalar.** Current `result_value_type` supports numeric, text, select, boolean, one scalar per analyte. Static panels can be represented by multiple analytes, but dynamic worksheets (urinalysis grids, variable stool/parasite findings, culture isolates/susceptibility matrix, multiple transfusion units/antibodies, pathology report sections) need a structured, versioned result template and renderer. Avoid flattening these into a single free-text field for routine production use.
5. **Duplicate listed test names need catalog normalization.** Albumin, Total Protein, Creatinine, and BUN occur across multiple supplied categories. Current test catalog assigns one category per test; canonical tests or a many-to-many category relation should be used rather than separate billable duplicates.
6. **Clinic/branch onboarding and activation-code delivery are not production-ready.** Bootstrap is a controlled SQL operation and the code is manually delivered. No public clinic creation or automated email/SMS delivery should be assumed.
7. **Do not treat demo/test data as clinical truth.** No universal ranges should be filled automatically for international deployment. Ranges and clinical cutoffs are different concepts and must be method/population aware.

## Specific scenarios the current system cannot fully handle

This list comes from static code/schema review against the agreed proposal. It is not a substitute for running the scenarios against a disposable database. Some entries are definite implementation gaps; those involving timing, network behavior, or a full role handoff still need runtime confirmation.

### Small and common cases

1. **Boolean analyte entry:** Test Catalog allows Yes/No, but the technologist editor renders the field as text. The save mapper treats only the exact text `true` as true; a value such as `Yes` can be stored incorrectly. See `frontend/src/pages/administrator/TestCatalog.jsx`, `frontend/src/pages/medical-technologist/ResultsInProgress.jsx`, and `frontend/src/pages/medical-technologist/TechnologistContext.jsx`.
2. **More than 100 records in a view:** Cashier Queue and Pathologist worklists fetch up to 100 rows and paginate locally. Rows beyond the fetched page cannot be reached or searched there. Staff and other local-pagination screens need the same page-through check. See `frontend/src/pages/cashier/CashierQueue.jsx` and `frontend/src/pages/pathologist/PendingValidation.jsx`.
3. **Catalog setup correction:** The Add Test form creates one specimen requirement and one analyte; the edit endpoint changes catalog metadata but not analyte or specimen configuration. A bad result type, unit, option list, or specimen requirement has no normal repair workflow. See `frontend/src/pages/administrator/TestCatalog.jsx` and `backend/src/routes/administrator.js`.
4. **Unchanged/unsubmitted result entry on connection loss:** Draft persistence is explicit. Values typed since the last save are lost if the tab closes or a network failure occurs before saving; there is no autosave/offline queue.
5. **Clinic country/city service unavailable:** Patient/staff address selection depends on an external geography API. Verify the form's behavior when that API is unreachable or its country/city dataset changes; registration may be blocked or partial.

### Workflow and clinic operations

6. **Multiple specimen requirements created by an administrator:** The schema and backend can represent multiple requirements, but the catalog UI creates only one. Such a test cannot be fully configured through the normal UI.
7. **All-zero-fee request:** Test/request amounts may be zero, but `payments.amount` must be greater than zero. A free screening/waiver or fully discounted request may fail at payment instead of recording a zero-balance disposition. See `backend/supabase/schema.sql` and `backend/src/routes/cashier.js`.
8. **Paid request cancellation, refund, or invoice correction:** Cashier cancellation is for unpaid requests. Payment void fields exist in the schema, but there is no corresponding cashier API/UI workflow. See `backend/src/routes/cashier.js` and `backend/supabase/schema.sql`.
9. **HMO or mixed payment:** The payment method enum currently contains only Cash. The system cannot record HMO coverage, authorization, copay, partial settlement, or insurer billing. See `backend/supabase/schema.sql`.
10. **Unavailable pathologist while still active:** Initial submission fails if no eligible active pathologist is available. Deactivation can auto-reassign active work, but the Administrator has no direct action to transfer a specific request from an active but unavailable pathologist. See `backend/src/routes/technologist.js` and `backend/src/routes/staff.js`.
11. **Branch creation/management:** Branch identifiers and tenant-aware constraints exist, but clinic/branch onboarding and branch management are SQL/bootstrap operations rather than administrator screens. This prevents a clinic administrator from completing the proposed branch setup in-app. See `backend/supabase/schema.sql` and `backend/README.md`.
12. **Password forgotten or activation code lost:** Activation and authenticated password change exist, but there is no password reset/reissue flow or automated email/SMS delivery. Codes are manually handed to staff/patients. See `backend/src/routes/auth.js` and `backend/src/routes/cashier.js`.

### Clinical reporting and data history

13. **Variable-length clinical results:** Scalar analytes work for fixed fields, but not repeatable organism/isolate rows, antimicrobial susceptibility matrices, multiple crossmatched units, parasite findings, or sectioned pathology reports. A structured/versioned result template and matching editor/renderer are needed before these are routine workflows. See `backend/supabase/schema.sql` and `backend/supabase/standard-test-result-design.md`.
14. **Standard test list expected in a new clinic:** The 12 categories and their 77 unique names are specified but are not seeded. A clinic starts without them and must configure each test, specimen, result field, price, turnaround, method, and local ranges.
15. **Duplicate test headings:** Albumin, Total Protein, Creatinine, and BUN appear in more than one supplied category. A test belongs to one category in the current schema. Duplicating them risks separate prices/configurations; a many-to-many category or panel design is needed if they should appear in multiple category views.
16. **Historical category volume after catalog changes:** Dashboard volume groups historical requests using the test's current catalog category. Relocating a test can move old volume; deactivating its category can remove historical volume from the active graph. The request item stores a category snapshot, but the chart query uses the current catalog relation. See `backend/src/routes/administrator.js` and `backend/supabase/schema.sql`.
17. **Clinic-specific ranges and result interpretation:** The system does not provide universal reference ranges for the supplied standard list. A clinic must configure verified intervals, units, methods, and appropriate demographic distinctions. Until then numeric abnormal flags and meaningful interpretation may be unavailable; decision thresholds must not be substituted for reference intervals.

### Larger scale and availability

18. **Instrument/LIS workflow:** Results are manually entered. Analyzer import, barcode scanning, laboratory information system exchange, and automated result matching are not implemented.
19. **Socket connection loss:** Clinic updates use Socket.IO plus a 10-second refresh fallback. If the socket is unavailable, another role's view can remain stale until the fallback refresh; test this behavior on desktop, mobile, reconnect, and multiple clinics. See `frontend/src/api/client.js` and `backend/src/realtime.js`.
20. **Clinic isolation and branch isolation under load:** Tenant-aware constraints and role-scoped API queries exist, but full adversarial tests across two clinics/branches are still needed for every endpoint, especially patient search, result access, catalog changes, and staff reassignment.
21. **Production recovery and compliance operations:** Automated backups/restore drills, retention/deletion policy, jurisdiction-specific privacy controls, electronic signatures, and external reporting requirements are not established by this prototype. These need deployment-specific decisions before real patient use.

Priority to analyze first: structured result templates and test setup; payment/refund/HMO behavior; account recovery/delivery; branch and staff reassignment administration; then history-preserving analytics and pagination beyond 100 rows.

## Database data clearing contract

`backend/supabase/clear_operational_data_keep_accounts.sql` intentionally keeps `clinics`, `clinic_branches`, `users`, `staff_profiles`, and `account_tokens`. It removes requests, results/reviews, specimens, payments/invoices, audit history, catalog/reference configuration, and unlinked walk-in patient rows. Patient rows linked to portal users are retained because the auth route resolves patient PID and display name through that row; removing those rows would make retained patient accounts unusable. The SQL clears audit history too. It is provided for the user to run against the intended database, not executed by an agent.

## Medical sources / caution

The standard test result design doc links to MedlinePlus on method-specific reference intervals, ADA 2025 glucose/A1c diagnostic criteria, KDIGO 2024 CKD guidance, CDC HIV testing algorithms, NCI cervical cytology reporting, and Mayo CBC reporting examples. Keep citations current if revisiting ranges or clinical interpretation. Medical claims should be checked against official, current guidance and local policy.

## Suggested analysis sequence for the next agent

1. Read `README.md`, `backend/README.md`, this handoff, the canonical schema, and current `git status`/diffs.
2. Trace a single request through the API and schema for one normal case, one multi-test request, one rejected specimen/recollection, one returned result, and one final release.
3. Compare frontend state refresh paths with backend events and status transitions; identify stale or unreachable screens.
4. Assess missing constraints, indexes, audit events, privacy protections, and branch/clinic isolation. Keep SQL recommendations distinct from schema mutations.
5. Report findings with file/API/schema references and severity before changing workflow assumptions. The user has granted routine edit approval, but ask before executing destructive SQL against their live Supabase database or publishing/deploying externally.
