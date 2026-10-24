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

- Authentication: clinic code plus staff username or patient PID, Argon2id password verification, one-time account activation codes, forced password change, current-user lookup, and logout. Sessions use an HttpOnly cookie.
- Shared reads: clinic-scoped test catalog and patient search.
- Cashier: patient registration and portal activation, request creation, unpaid queue, cash processing/payment/invoice creation, cancellation of unpaid requests, and invoice listing.
- Administrator: dashboard summaries and test-volume series, role-filtered audit-log reads, staff provisioning and status changes, test/category catalog management, and reference-range management.
- Medical technologist: assigned work queue, specimen receipt/accept/reject, typed result drafts, and request result submission.
- Pathologist: assigned pending/returned/released request lists and per-test review, interpretation, return, retest, and release workflow.
- Patient: request-level released-result access and per-test history.
- Realtime: authenticated Socket.IO sessions join only their clinic room. Catalog changes emit `catalog:changed`; subscribing screens should re-fetch the catalog. Frontend helper is `subscribeToCatalogChanges` in `frontend/src/api/client.js`.

The role pages now use these APIs for sign-in, server-backed lists, and the available workflow mutations. Clinic/branch onboarding and outbound delivery of activation codes are not implemented. Reports currently use available summary and test-volume endpoints; revenue-specific reporting is not yet exposed. The test-create form configures one initial specimen requirement and one analyte; richer multi-specimen and multi-analyte catalog editing remains to be built. The current implementation still needs end-to-end workflow validation against a disposable database before production use.

The backend now constructs a Drizzle ORM instance over Postgres.js. Existing workflow-heavy statements still use parameterized SQL, but are executed with Drizzle's `execute` API; transactions use Drizzle's transaction API. `src/db/schema.js` describes the database columns and enums for Drizzle. It is not yet the source for applying migrations.

## Database source of truth

`supabase/schema.sql` is the canonical schema; `supabase/reset.sql` is destructive and only for a disposable development database. Do not run either file against a database with data you need. The Drizzle model mirrors its tables and enums, while the SQL remains authoritative for constraints, indexes, triggers, functions, row-level security, and the payment-queue view. Do not use the legacy migration files in `drizzle/`.

The schema uses tenant-aware foreign keys, assignment and result validation, workflow history, and RLS enabled without browser-access policies. Keep privileged credentials on the backend. Server-side authentication, clinic scope, role permissions, assignments, and state-transition checks remain required; RLS does not replace them.

## Database configuration

Set `DATABASE_ENABLED=true`, `DATABASE_URL`, and a random `AUTH_TOKEN_SECRET` of at least 32 bytes in `backend/.env`. Never place the database URL or privileged keys in frontend environment variables. The backend requires SSL and has `prepare: false` for compatibility with Supabase pooling. The current API uses multi-statement transactions; validate the chosen pooler and schema against a disposable database before production deployment.
