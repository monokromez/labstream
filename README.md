# Labstream

## 1. Run locally

Use Node.js and npm. The frontend and backend run in separate terminals.

1. Create `backend/.env` from `backend/.env.example`. Set `DATABASE_ENABLED=true`, `DATABASE_URL` to the Supabase PostgreSQL connection string, `AUTH_TOKEN_SECRET` to a random secret of at least 32 bytes, and `FRONTEND_ORIGIN=http://localhost:5173`.
2. Create `frontend/.env` from `frontend/.env.example`. For desktop use, set `VITE_API_URL=http://localhost:3000`.
3. In the first terminal, run `cd backend`, `npm install`, and `npm run dev`.
4. In the second terminal, run `cd frontend`, `npm install`, and `npm run dev`; open the Vite URL, usually `http://localhost:5173`.
5. Confirm the API at `http://localhost:3000/health` returns `{"status":"ok","database":"connected"}`. Keep both terminals running. Never put database credentials in the frontend environment or commit either `.env` file.

## 2. Test the standard workflow

Use the single laboratory configured in the database and activate separate accounts for each role. The Administrator creates available tests with specimen requirements, result fields, price, and turnaround time before testing requests. Multi-laboratory and branch workflows are outside the supplied proposal.

1. Sign in as Cashier, register a patient, and create a request with multiple tests. Confirm it appears in Queue as awaiting payment.
   Patient registration validates names, date of birth, country-specific phone numbers, and ID details as they are entered. Passport and government-issued identity documents are available for every country; configured local ID options vary by country.
2. Process payment. Confirm the invoice appears and the assigned Medical Technologist sees the request.
3. As Medical Technologist, receive and accept the specimens. Also reject a specimen with a reason and confirm the replacement/recollection path is visible.
4. Enter numeric, dropdown, and text results. Save a draft, then submit the request only after every required test and field is complete.
5. As Pathologist, add an interpretation for each test. Approve one and return another with a remark; confirm returned work goes back to the technologist.
6. Correct or recollect the returned test, resubmit, and approve all remaining work. Confirm the request releases only when all tests are approved.
7. As Patient, confirm released results appear in My Results and individual tests appear in Test History. Confirm unreleased results do not expose result details.
8. Repeat important transitions with the receiving role signed in from another browser profile. Check that its view updates without manual reload. Review the Administrator's audit log.

Optional frontend checks, from `frontend/`: `npm run build` and `npm run lint`. They do not replace workflow testing.

## 3. Use the included SQL files

Run SQL in Supabase SQL Editor, in the stated order, and only against the intended database.

- **Fresh database:** run `backend/supabase/schema.sql` once to create the current single-laboratory schema. Then edit and run `backend/supabase/bootstrap_first_admin.sql` once to create the laboratory record and its first Administrator; save the returned one-time activation code privately and use it within 24 hours. Sign-in uses the account username or patient PID, without a clinic code.
- **Existing database upgrade:** back up first. If the cashier queue migration is not already applied, run `backend/supabase/migrations/20261024_cashier_queue_and_zero_fee_waiver.sql`. Then run `backend/supabase/migrations/20261024_single_laboratory_scope.sql`; it stops if it finds multiple laboratories or branch data that needs review. Next run `backend/supabase/migrations/20261024_standard_catalog_category_memberships.sql`, and run the legacy `backend/supabase/migrations/20261026_activation_tokens_no_expiry.sql` only if it has not already been applied. To support structured repeatable results and 24-hour token expiry, first run `backend/supabase/migrations/20261026_add_structured_result_type.sql` by itself and wait for it to finish; then run `backend/supabase/migrations/20261026_structured_results_and_expiring_tokens.sql`. Fresh databases created from `schema.sql` already include these changes.
- **Clear workflow data but retain accounts:** run `backend/supabase/clear_operational_data_keep_accounts.sql`. It removes requests, results, specimens, payments/invoices, audit history, and catalog/reference configuration. It preserves the single laboratory record and account records, plus patient identities linked to portal accounts so those accounts can still sign in.
- **Drop the Labstream schema:** `backend/supabase/reset.sql` is destructive and removes Labstream tables and types. Use only when intentionally restarting a disposable database; afterward run `schema.sql`, then bootstrap again. It is not a data-cleaning query.
- **Seed the standard catalog:** replace `REPLACE_WITH_CLINIC_CODE` in both locations in `backend/supabase/seed_standard_test_catalog.sql` with the internal code of the single laboratory, then run the entire file in Supabase SQL Editor. It seeds 12 categories, 77 canonical tests, all 81 category memberships, and provisional specimen requirements. Tests remain unavailable with placeholder zero prices. Review and configure each test's local collection requirements, result analytes, price, turnaround, method, and reference ranges before enabling it. Rerunning does not overwrite configured specimens or catalog records. Regenerate the SQL from the design guide with `node backend/scripts/generate_standard_catalog_seed.js`.
- `backend/supabase/002_tenant_accounts.sql` is a legacy upgrade script, not part of the current fresh-install workflow. The standard diagnostic result design is the source for the suggested input/display guidance embedded in the starter test descriptions.

Back up data first. Do not run reset or clearing SQL against a database containing records you need. The application does not run these files automatically.

## 4. Frontend and backend READMEs

- [Frontend README](frontend/README.md) contains the React/Vite template notes for the frontend package.
- [Backend README](backend/README.md) summarizes API capabilities, local API startup, database configuration, and the canonical schema/migration guidance.

## 5. System progress handoff

[System State and Progress](SYSTEM_STATE_AND_PROGRESS.md) summarizes the intended workflow, architecture, implemented areas, known limitations, data-clearing contract, and recommended analysis sequence. Read that file for the detailed state and the specific scenarios the current system cannot fully handle.
