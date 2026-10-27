# Labstream system state and progress handoff

Updated 2026-10-27 for a follow-up agent to analyze the repository and identify workflow gaps. Treat this file as context, not as permission to change Supabase or deploy anything. The user has authorized routine project file edits, but destructive database execution still requires their explicit intent for the target database.

## Product and workflow

Labstream is a diagnostic laboratory workflow system for one laboratory. Branch and multi-laboratory workflows are excluded by the proposal. The intended role workflow is:

1. **Administrator** manages laboratory staff, test categories/catalog, reference ranges, reports, and audit review.
2. **Cashier** registers a walk-in patient and requested tests; the request waits in Queue until cash payment is processed and an invoice is created.
3. **Medical Technologist** sees assigned paid requests, receives and accepts/rejects specimens, records each requested test's results, and reviews drafts. The technologist marks each test Complete; Submit appears at the request level only when every non-cancelled test is complete. Recollection/retest attempts must retain a traceable history.
4. **Pathologist** is assigned for the request and reviews every test with a required interpretation. The pathologist approves each test or marks it for re-analysis with a required remark and optional retest/recollection selection. If any test is marked for re-analysis, the entire request returns to the technologist; previous approvals and result revisions remain in history, and no results are released. The technologist reviews all tests together, completes each, and resubmits the full request for another complete pathologist review.
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
- Test Catalog availability defaults to unavailable and is blocked until a test has an active reference range. API and database guards enforce the rule, including protection against removing a test's last active range.
- Specimen accept/reject/recollection and per-test result draft/revision/review workflow. A single pathologist re-analysis decision returns the whole request and leaves prior results/reviews in history.
- Medical Technologists review every result in a returned request, mark tests Complete with confirmation, may withdraw completion with confirmation, and submit the request as a whole only when every test is complete. Pathologists review the complete resubmission.
- Existing-database migrations are provided for reference-range gating and the per-test `completed` state. The completion migration also puts approved/drafted sibling items in in-flight correction requests back into the re-analysis cycle.
- A patient/catalog/workflow clearing SQL file preserves staff accounts and the single laboratory record. It is for the user to run; it has not been executed.
- Patient request-level results and per-test history.
- Country/city dropdown component and responsive role pages.
- Recent UI decisions include compact labels, consistent status tags/table styling, no table card wrapper, and up to ten table rows before pagination.

The active worktree contains a large number of modified and untracked files from accumulated implementation. Do not revert, reset, or overwrite unrelated work. Inspect `git status --short` and diffs before editing.

## Known limitations and issues requiring analysis

1. **No complete end-to-end validation has been recorded.** The README now has a manual workflow checklist and optional frontend build/lint commands. A future agent should first inspect the current diff and then walk the full role handoffs against a disposable single-laboratory database, recording exact failing requests and server errors.
2. **Real-time behavior should be verified.** Socket notifications are restricted to authenticated sessions for the single laboratory; a 10-second refetch fallback exists. Confirm every screen refreshes for relevant writes and reconnects correctly.
3. **Catalog seed has not been applied to the database.** The repeatable SQL seed creates 12 categories, 77 canonical tests, 81 category memberships, and provisional specimen requirements. It does not seed analyte forms, prices, turnaround times, methods, or reference ranges; configure and validate those before enabling a test. Do not seed unvalidated reference intervals.
4. **Result model supports scalar and generic structured entries.** Numeric, text, select, boolean, and structured/table values are supported. Specialized clinical layouts and interpretation rules still need laboratory-specific configuration and validation; the generic structured table does not replace validated culture, transfusion, or pathology reporting protocols.
5. **Category membership is normalized.** Albumin, Total Protein, Creatinine, and BUN each have one canonical test record linked to both of their listed categories through `test_category_memberships`.
6. **Activation-code delivery is manual.** Initial laboratory/admin bootstrap is a controlled SQL operation and the one-time code is manually delivered. Automated email/SMS delivery and password recovery are not implemented; a patient can change their password after signing in.
7. **Do not treat demo/test data as clinical truth.** No universal ranges should be filled automatically for international deployment. Ranges and clinical cutoffs are different concepts and must be method/population aware.

## Specific scenarios the current system cannot fully handle

This list comes from static code/schema review against the agreed proposal. It is not a substitute for running the scenarios against a disposable database. Some entries are definite implementation gaps; those involving timing, network behavior, or a full role handoff still need runtime confirmation.

### Small and common cases

1. **More than 100 records in a view:** Cashier Queue and Pathologist worklists fetch up to 100 rows and paginate locally. Rows beyond the fetched page cannot be reached or searched there. Staff and other local-pagination screens need the same page-through check. See `frontend/src/pages/cashier/CashierQueue.jsx` and `frontend/src/pages/pathologist/PendingValidation.jsx`.
2. **Result draft save during connection loss:** Results autosave, but there is no offline queue. Values entered during a network outage may not persist until the connection returns and the user resumes editing.
3. **Country/city service unavailable:** Patient/staff address selection depends on an external geography API. Verify the form's behavior when that API is unreachable or its country/city dataset changes; registration may be blocked or partial.

### Workflow and laboratory operations

4. **Waiver and HMO/mixed payment policy:** Zero-total requests are recorded as waivers, but the workflow has no waiver reason/approval policy, HMO authorization, copay, partial settlement, or insurer billing.
5. **Paid request cancellation, refund, or invoice correction:** Paid requests can be cancelled with a full refund recorded, and an invoice can be corrected in place without creating a second invoice row. The old and new invoice numbers, reason, date, and cashier are kept in the audit history shown in View Invoice. Refunds are recorded in Labstream; moving cash or completing a bank refund remains a manual step. See `backend/src/routes/cashier.js` and `backend/supabase/schema.sql`.
6. **Unavailable pathologist while still active:** Initial submission fails if no eligible active pathologist is available. Deactivation can auto-reassign active work, but the Administrator has no direct action to transfer a specific request from an active but unavailable pathologist. See `backend/src/routes/technologist.js` and `backend/src/routes/staff.js`.
7. **Password forgotten or activation code lost:** Activation and authenticated password change exist, but password reset/recovery is outside the proposal baseline and is not implemented. Activation codes are manually handed to the account holder. See `backend/src/routes/auth.js` and `backend/src/routes/cashier.js`.

### Clinical reporting and data history

8. **Specialized clinical reporting:** Generic structured/table results are supported, but validated layouts and workflows for variable culture isolates and susceptibility panels, multiple transfusion units, variable parasite findings, and sectioned pathology reports still require laboratory-specific design and approval. See `backend/supabase/schema.sql` and `backend/supabase/standard-test-result-design.md`.
9. **Standard test list expected in this laboratory:** The idempotent seed query is available but has not been applied to the user's database. It includes provisional specimen requirements. After it is run, the laboratory must verify each unavailable test's specimen, configure result fields, price, turnaround, method, and local ranges before ordering.
10. **Historical category volume after catalog changes:** Dashboard volume groups historical requests using the test's current catalog category. Relocating a test can move old volume; deactivating its category can remove historical volume from the active graph. The request item stores a category snapshot, but the chart query uses the current catalog relation. See `backend/src/routes/administrator.js` and `backend/supabase/schema.sql`.
11. **Laboratory-specific ranges and result interpretation:** The system does not provide universal reference ranges for the supplied standard list. The laboratory must configure verified intervals, units, methods, and appropriate demographic distinctions. Until then numeric abnormal flags and meaningful interpretation may be unavailable; decision thresholds must not be substituted for reference intervals.

### Larger scale and availability

12. **Instrument/LIS workflow:** Results are manually entered. Analyzer import, barcode scanning, laboratory information system exchange, and automated result matching are not implemented.
13. **Socket connection loss:** Laboratory updates use Socket.IO plus a 10-second refresh fallback. If the socket is unavailable, another role's view can remain stale until the fallback refresh; test this behavior on desktop, mobile, and reconnect. See `frontend/src/api/client.js` and `backend/src/realtime.js`.
14. **Authorization under load:** Role-scoped API queries and assignment checks exist, but authorization should be checked against every endpoint, especially patient search/result access, catalog changes, and staff reassignment.
15. **Production recovery and compliance operations:** Automated backups/restore drills, retention/deletion policy, jurisdiction-specific privacy controls, electronic signatures, and external reporting requirements are not established by this prototype. These need deployment-specific decisions before real patient use.

Priority to analyze first: validate full-request re-analysis and completion against the database; payment void/refund and policy; activation-code delivery; staff reassignment administration; then history-preserving analytics and pagination beyond 100 rows. Online payment gateways, HMO claims, and branch/multi-laboratory workflows remain outside the proposal scope.

## Proposal exclusions and implementation boundary

The current implementation is constrained to walk-in requests, in-person cashier payment, manual numeric/text/select/boolean/structured result entry, pathologist review, and patient access to released results. It does not implement online booking, online payment gateways, insurance/HMO claims, analyzer/LIS integration, X-ray/ultrasound image handling, certified digital signatures, predictive analytics, enterprise BI, or multi-branch administration. Reports remain descriptive operational summaries with PDF/spreadsheet export. These are proposal limitations, not unfinished requirements for this release.

## Standard test list and implementation instructions

The standard diagnostic test list is in [`backend/supabase/standard-test-result-design.md`](backend/supabase/standard-test-result-design.md). It covers 12 categories, 81 category mentions, and 77 unique test names, with a proposed technologist input method and report display form for each. The generated SQL seed stores those recommendations in starter test descriptions, but the guide remains a design specification, not an approved clinical protocol.

### Current implementation boundary

- The canonical schema has single-laboratory `test_categories`, `test_catalog`, `test_category_memberships`, `test_specimen_requirements`, `test_analytes`, and `reference_ranges` tables. Canonical tests can appear under multiple categories, and each test can require multiple specimen types.
- The schema has category `is_active` and test `is_available` flags, and cashier test selection already requires both to be true. Individual test availability can be changed through its edit form. A reversible category availability toggle is not yet available; category deactivation is currently tied to the category removal flow.
- Test configuration is versioned so each request item retains the version used when it was created. New tests default to unavailable, and availability requires an active reference range.
- Technologist result entry supports numeric, text, select, boolean, and generic structured/table values. Specialized layouts and clinical interpretations still require local configuration and validation before use.
- Categories/tests are not automatically seeded. Use `backend/supabase/seed_standard_test_catalog.sql` for the single laboratory; replace the internal laboratory code placeholder in both occurrences and run the full script in Supabase SQL Editor. For existing databases, apply `backend/supabase/migrations/20261024_standard_catalog_category_memberships.sql` after the single-laboratory migration. The generated seed creates provisional per-test specimen requirements but no analyte forms or reference intervals. Starter tests remain unavailable until laboratory-specific workflow configuration is reviewed and completed. The generator is `backend/scripts/generate_standard_catalog_seed.js`.

### Recommended implementation sequence

1. **Apply and verify the single-laboratory catalog import.** The idempotent seed SQL inserts 12 categories, 77 canonical tests, 81 category memberships, and provisional specimen requirements for the configured laboratory. For an existing database, apply the category-membership migration after the single-laboratory migration; then run the seed after replacing the laboratory-code placeholder. Review specimen mappings and configure local procedures before enabling any test.
2. **Validate versioned Administrator catalog configuration.** Verify future configuration edits preserve the meaning of in-progress and historical requests, including the rendered result and reference-range snapshots.
3. **Validate clinical result editors and report renderers.** Confirm technologist entry, pathologist review, and patient reports show identical values, units, interpretations, and historical revisions. Add specialized versioned templates where generic structured/table entry is insufficient.
4. **Configure laboratory-specific reference ranges.** Add ranges per numeric analyte, including applicable age/sex groups, unit, and any required method context. Use ranges only after laboratory validation. Keep ranges empty when unverified; do not substitute diagnostic decision thresholds or a value copied from another laboratory.
5. **Connect every role to the live catalog.** Ensure cashier request selection and every other test dropdown use active tests/categories from the API, updating after catalog changes. A category filter must reflect current categories; category removal must require resolving its tests through relocation or removal, preserving historical request/result records.
6. **Validate incrementally before bulk enablement.** Start with one single-value numeric test, one qualitative dropdown test, one fixed multi-analyte panel, and one structured test template. Walk each through request/payment, specimen receipt, technologist entry, pathologist review/return/release, and patient result/history. Verify units, options, reference-range flags, required fields, audit trail, laboratory authorization, and historical rendering before importing/enabling the rest.
7. **Add reversible category availability controls.** Individual test availability is gated by active reference ranges. A reversible category availability toggle remains to be completed. Preserve existing requests, results, and snapshots when category/test availability changes.

The contents of the design document are recommendations for configuring and implementing the catalog. Clinical leadership must confirm assay methods, specimen requirements, result wording, units, reference intervals, and release rules for the target laboratory before those settings are used with patient results.

## Database data clearing contract

`backend/supabase/clear_operational_data_keep_accounts.sql` keeps the single laboratory record, all accounts, and patient identities linked to portal accounts while clearing operational data. `backend/supabase/clear_patients_and_catalog_keep_staff_accounts.sql` also removes patient portal accounts/tokens and retains non-patient staff accounts. Both clear audit history and are user-run scripts; neither has been executed by an agent.

## Medical sources / caution

The standard test result design doc links to MedlinePlus on method-specific reference intervals, ADA 2025 glucose/A1c diagnostic criteria, KDIGO 2024 CKD guidance, CDC HIV testing algorithms, NCI cervical cytology reporting, and Mayo CBC reporting examples. Keep citations current if revisiting ranges or clinical interpretation. Medical claims should be checked against official, current guidance and local policy.

## Implementation updates from the Antigravity review and current work (2026-10-27)

- Patient released-result payloads now include the patient's name, PID, date of birth, sex, laboratory name, result units, and stored lower/upper reference-limit snapshots. The report UI shows these values and uses neutral release wording; it does not invent an electronic signature.
- Test Catalog edit now loads/saves multi-analyte and multi-specimen settings as well as test metadata. Configuration revisions preserve the version used by existing requests. New tests default to unavailable and cannot be enabled without an active reference range.
- Cashier queue numbers and the currently called patient are now persisted on each request, with authenticated call/call-next/dismiss endpoints and audit events. Queue ticket numbers are stable instead of being regenerated from the current page order.
- A zero-fee transaction is represented as a `waiver` payment method and is labeled as a waiver in the invoice. Positive amounts remain cash; HMO and partial payment support are still outside the implemented payment model.
- For an existing Supabase database, apply `backend/supabase/migrations/20261024_cashier_queue_and_zero_fee_waiver.sql` once before using these changes. A fresh database created from `backend/supabase/schema.sql` already includes the new enum and queue columns. The migration was not run against the user's database.
- Backend source syntax checks and the frontend Vite production build succeeded. Full workflow/API checks against the user's Supabase database were not performed.
- One pathologist re-analysis decision returns the entire request, retaining each prior submission and review. Previously approved sibling tests enter the same correction cycle, and patient results remain hidden until the complete request is released.
- Technologists mark tests Complete, can withdraw completion with confirmation, and submit the full request only when all tests are complete. The pathologist reviews every test in the resubmission.
- Existing databases need `backend/supabase/migrations/20261027_request_result_completion_workflow.sql` after the reference-range availability migration. The completion migration adds the `completed` status and repairs in-flight correction requests. The agent did not run SQL against Supabase.
- `backend/supabase/clear_patients_and_catalog_keep_staff_accounts.sql` removes patient-linked workflow and catalog data while preserving non-patient accounts and the laboratory record. It has not been run.

## Suggested analysis sequence for the next agent

1. Read `README.md`, `backend/README.md`, this handoff, the canonical schema, and current `git status`/diffs.
2. Trace a single request through the API and schema for one normal case, one multi-test request, one rejected specimen/recollection, one returned result, and one final release.
3. Compare frontend state refresh paths with backend events and status transitions; identify stale or unreachable screens.
4. Assess missing constraints, indexes, audit events, privacy protections, and role-based authorization within the single laboratory. Keep SQL recommendations distinct from schema mutations.
5. Report findings with file/API/schema references and severity before changing workflow assumptions. The user has granted routine edit approval, but ask before executing destructive SQL against their live Supabase database or publishing/deploying externally.
