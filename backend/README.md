# Backend

The frontend is connected to this Express API. The API uses Drizzle ORM with the Postgres.js driver, and the workflow routes execute parameterized SQL through Drizzle. Set `DATABASE_ENABLED=true` only when `DATABASE_URL` and `AUTH_TOKEN_SECRET` are configured in this private backend environment.

## Run locally

```sh
cd backend
npm install
npm run dev
```

`GET /health` performs a read-only `SELECT 1` and returns `database: "connected"` when Postgres is reachable. It returns HTTP 503 with a generic unavailable state when the connection fails. No API route falls back to browser prototype data.

## Implemented API surface

- Authentication: staff username or patient PID, Argon2id password verification, one-time account activation codes, forced password change, current-user lookup, and logout. Sessions use an HttpOnly cookie. The deployment has one laboratory; users do not select a clinic at sign-in.
- Shared reads: laboratory-scoped test catalog and patient search.
- Cashier: patient registration and portal activation, patient password-reset codes, request creation, persistent queue tickets and call state, searchable server-paginated queues, cash or zero-fee waiver processing, invoice creation, auditable full-refund records for eligible paid-request cancellations, invoice correction/reissue history, receipt email re-send, and searchable invoice history.
- Administrator: dashboard summaries and test-volume series, role-filtered audit-log reads, staff provisioning, profile viewing/editing, guarded role changes and status changes, direct active-work reassignment, reversible category/test availability, versioned test workflows for future requests, and reference-range management.
- Medical technologist: assigned work queue, specimen receipt/accept/reject, typed result drafts, and request result submission.
- Pathologist: assigned pending/returned/released request lists and per-test review, interpretation, return, retest, and release workflow.
- Patient: request-level released-result access and per-test history.
- Realtime: authenticated Socket.IO sessions join the single laboratory room. Catalog and successful API changes emit scoped events; subscribing screens re-fetch on events and also poll every 10 seconds while visible as a fallback. Socket.IO's automatic reconnect retains the subscriptions. Frontend helpers are `subscribeToCatalogChanges` and `subscribeToClinicChanges` in `frontend/src/api/client.js`.

The role pages use these APIs for sign-in, server-backed lists, and workflow mutations. The schema permits one laboratory per database and has no branch model. Laboratory setup is a controlled SQL/bootstrap operation. SMTP email is used for account activation, patient password resets, payment receipts, and result-release notices; email delivery failures are reported without rolling back completed workflow actions. Activation and reset codes expire after 24 hours and can be used once. The Test Catalog supports numeric, text, dropdown, yes/no, and repeatable table result inputs. Each test edit creates a new configuration version for future requests, while existing requests retain their original analyte and specimen configuration. Refund records are accounting/audit entries only; actual cash or bank transfers must be completed outside Labstream. The current implementation still needs end-to-end workflow validation against a disposable database before production use.

Authentication throttles count unsuccessful attempts only; successful sign-ins, activations, and resets do not consume the limit. Each endpoint has its own 2-minute counter. In production the API trusts one reverse proxy hop when determining client IPs, so deployments must place the API behind exactly one trusted proxy that sets the forwarded client address.

Administrator staff, catalog, reference-range, and audit-log lists use server-side pagination and filtering. Dashboard summaries, category-volume charts, and native XLSX/PDF exports share weekly, monthly, and annual reporting periods; released-test category totals use the request-item category snapshots so historical results remain grouped even after catalog changes. Patient result views/downloads and technologist/pathologist result access are audit logged. Administrator write routes validate staff, catalog, and reference-range input on the server as well as in the browser. Staff role changes are limited to activated, inactive accounts without active work assigned; the role update regenerates the username. Focused validation and staff-route tests run with `npm test` from `backend/`.

The backend now constructs a Drizzle ORM instance over Postgres.js. Existing workflow-heavy statements still use parameterized SQL, but are executed with Drizzle's `execute` API; transactions use Drizzle's transaction API. `src/db/schema.js` describes the database columns and enums for Drizzle. It is not yet the source for applying migrations.

## Database source of truth

`supabase/schema.sql` is the canonical schema; `supabase/reset.sql` is destructive and only for a disposable development database. Do not run either file against a database with data you need. The Drizzle model mirrors its tables and enums, while the SQL remains authoritative for constraints, indexes, triggers, functions, row-level security, and the payment-queue view. Existing installations must apply `supabase/migrations/20261027_catalog_versions_and_payment_corrections.sql` after the preceding migration chain, followed by `supabase/migrations/20261027_patient_archive.sql`, `supabase/migrations/20261027_staff_account_deletion.sql`, `supabase/migrations/20261027_patient_account_deletion.sql`, `supabase/migrations/20261027_reference_ranges_required_for_available_tests.sql`, and `supabase/migrations/20261027_request_result_completion_workflow.sql`. The reference-range migration sets the new-test default to unavailable, disables existing available tests with no active range, and adds database guards for availability and range removal. The completion migration adds the per-test `completed` state for request-level submission. Do not use the legacy migration files in `drizzle/`.

To add the standard starter catalog to the single laboratory, replace `REPLACE_WITH_CLINIC_CODE` in both locations in `supabase/seed_standard_test_catalog.sql` with that laboratory record's internal code and run the entire script in Supabase SQL Editor. On an existing database, run `supabase/migrations/20261024_standard_catalog_category_memberships.sql` after the single-laboratory migration first. The seed creates 12 categories, 77 canonical tests, their 81 category memberships, and provisional per-test specimen requirements. Tests remain unavailable with zero placeholder prices. Review and configure the local specimen procedure, analytes, price, turnaround, method, and reference ranges before enabling a test. Every newly added test is unavailable until it has at least one active reference range; removing its last active range requires archiving it first. Reruns do not overwrite existing catalog records or add candidate specimen rows when a test already has specimen setup. Regenerate the SQL with `node scripts/generate_standard_catalog_seed.js` after changing the test list or default specimen mapping in that script.

The schema uses laboratory-scoped foreign keys, a singleton constraint, assignment and result validation, workflow history, and RLS enabled without browser-access policies. The existing `clinic_id` column is an internal key for the one laboratory record, not a multi-clinic feature. Keep privileged credentials on the backend. Server-side authentication, laboratory scope, role permissions, assignments, and state-transition checks remain required; RLS does not replace them.

## Database configuration

Set `DATABASE_ENABLED=true`, `DATABASE_URL`, and a random `AUTH_TOKEN_SECRET` of at least 32 bytes in `backend/.env`. Configure `MAIL_HOST`, `MAIL_PORT`, `MAIL_SCHEME`, `MAIL_USERNAME`, `MAIL_PASSWORD`, and `MAIL_FROM_ADDRESS` for the SMTP provider; `MAIL_FROM_NAME` is optional. Render free web services cannot open outbound connections on ports 25, 465, or 587, so use `MAIL_PORT=2525` there (Brevo and most relays support it). The mail service also retries once on `MAIL_FALLBACK_PORT` (default 2525) when the configured port is blocked, and startup logs warn when the configured port is one of the blocked SMTP ports. Never place the database URL or privileged keys in frontend environment variables. The backend requires SSL and has `prepare: false` for compatibility with Supabase pooling. The current API uses multi-statement transactions; validate the chosen pooler and schema against a disposable database before production deployment.

## Backup, migration, and recovery checks

Before changing an existing database, identify its current schema and migration history using read-only catalog queries. Do not infer applied migrations from filenames or rerun the fresh-schema or reset scripts. The SQL Editor may not maintain the migration ledger used by a CLI deployment, so verify the actual schema objects and migration records where available.

Before applying a migration:

1. Use the provider-supported backup/export method for the database's current plan and connection type. Store the backup securely; it contains patient and account data.
2. Record the backup time and verify that it can be restored to a separate disposable database. A backup that has not been restore-checked is not a verified recovery point.
3. Apply only the migrations confirmed to be missing, in the order described above. Apply `20261026_add_structured_result_type.sql` as a separate completed transaction before `20261026_structured_results_and_expiring_tokens.sql`, then apply `20261027_catalog_versions_and_payment_corrections.sql` and `20261027_patient_archive.sql`.
4. Run schema checks and representative read-only application checks after migration. Keep the pre-migration backup until the upgraded system has been validated.
5. For recovery, restore the backup to a separate database first, verify the restored schema and representative records, then coordinate any production endpoint switch with the database owner. Never use `reset.sql` or `clear_operational_data_keep_accounts.sql` as a recovery mechanism.

Do not apply migrations to a shared or production database without the database owner's approval and a verified backup. If the provider plan does not include managed backups, arrange and restore-test an encrypted export before proceeding.
