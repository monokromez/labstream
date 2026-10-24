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
