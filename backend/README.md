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
- Cashier: patient registration and portal activation, request creation, persistent queue tickets and call state, cash or zero-fee waiver processing, invoice creation, cancellation of unpaid requests, and invoice listing.
- Administrator: dashboard summaries and test-volume series, role-filtered audit-log reads, staff provisioning and status changes, test/category catalog management, and reference-range management.
- Medical technologist: assigned work queue, specimen receipt/accept/reject, typed result drafts, and request result submission.
- Pathologist: assigned pending/returned/released request lists and per-test review, interpretation, return, retest, and release workflow.
- Patient: request-level released-result access and per-test history.
- Realtime: authenticated Socket.IO sessions join the single laboratory room. Catalog changes emit `catalog:changed`; subscribing screens should re-fetch the catalog. Frontend helper is `subscribeToCatalogChanges` in `frontend/src/api/client.js`.

The role pages use these APIs for sign-in, server-backed lists, and workflow mutations. The schema permits one laboratory per database and has no branch model. Laboratory setup is a controlled SQL/bootstrap operation. SMTP email is used for account activation, payment receipts, and result-release notices; email delivery failures are reported without rolling back completed workflow actions. Activation codes are one-time and do not expire. The Test Catalog supports multiple specimens and analytes; workflow configuration cannot be changed after request history or reference ranges exist until versioned configuration is implemented. The current implementation still needs end-to-end workflow validation against a disposable database before production use.

The backend now constructs a Drizzle ORM instance over Postgres.js. Existing workflow-heavy statements still use parameterized SQL, but are executed with Drizzle's `execute` API; transactions use Drizzle's transaction API. `src/db/schema.js` describes the database columns and enums for Drizzle. It is not yet the source for applying migrations.

## Database source of truth

`supabase/schema.sql` is the canonical schema; `supabase/reset.sql` is destructive and only for a disposable development database. Do not run either file against a database with data you need. The Drizzle model mirrors its tables and enums, while the SQL remains authoritative for constraints, indexes, triggers, functions, row-level security, and the payment-queue view. Do not use the legacy migration files in `drizzle/`.

To add the standard starter catalog to the single laboratory, replace `REPLACE_WITH_CLINIC_CODE` in both locations in `supabase/seed_standard_test_catalog.sql` with that laboratory record's internal code and run the entire script in Supabase SQL Editor. On an existing database, run `supabase/migrations/20261024_standard_catalog_category_memberships.sql` after the single-laboratory migration first. The seed creates 12 categories, 77 canonical tests, their 81 category memberships, and provisional per-test specimen requirements. Tests remain unavailable with zero placeholder prices. Review and configure the local specimen procedure, analytes, price, turnaround, method, and reference ranges before enabling a test. Reruns do not overwrite existing catalog records or add candidate specimen rows when a test already has specimen setup. Regenerate the SQL with `node scripts/generate_standard_catalog_seed.js` after changing the test list or default specimen mapping in that script.

The schema uses laboratory-scoped foreign keys, a singleton constraint, assignment and result validation, workflow history, and RLS enabled without browser-access policies. The existing `clinic_id` column is an internal key for the one laboratory record, not a multi-clinic feature. Keep privileged credentials on the backend. Server-side authentication, laboratory scope, role permissions, assignments, and state-transition checks remain required; RLS does not replace them.

## Database configuration

Set `DATABASE_ENABLED=true`, `DATABASE_URL`, and a random `AUTH_TOKEN_SECRET` of at least 32 bytes in `backend/.env`. Configure `MAIL_HOST`, `MAIL_PORT`, `MAIL_SCHEME`, `MAIL_USERNAME`, `MAIL_PASSWORD`, and `MAIL_FROM_ADDRESS` for the SMTP provider; `MAIL_FROM_NAME` is optional. Never place the database URL or privileged keys in frontend environment variables. The backend requires SSL and has `prepare: false` for compatibility with Supabase pooling. The current API uses multi-statement transactions; validate the chosen pooler and schema against a disposable database before production deployment.
