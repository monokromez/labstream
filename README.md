# Labstream

Labstream is a web-based diagnostic laboratory and test result portal prototype. The planned workflow supports walk-in registration and queueing, payment recording, specimen processing, result review and release, a patient results portal, and administrative reports.

## Project structure

```text
backend/
  src/                 Express API, auth, and role-scoped route handlers
  supabase/schema.sql   Current end-to-end schema for a fresh Supabase database
  supabase/reset.sql    Destructive reset of named Labstream objects in public
  supabase/002_tenant_accounts.sql  Legacy upgrade for the earlier schema
  drizzle/             Legacy migration files; do not apply to current schema
frontend/
  src/
    pages/              Role-based page folders and page components
      cashier/          Cashier pages and their barrel file
      medical-technologist/
      pathologist/
      administrator/
      patient/
    components/         Reusable layout, form, data, report, and workflow UI
    index.css           Global CSS, Tailwind setup, and shared color variables
```

The frontend uses the role-scoped backend API for authentication and the connected workflow pages. `frontend/src/App.jsx` checks the session and renders the role-based `AppShell` after sign-in. API requests use an HttpOnly session cookie; database credentials remain in the backend environment.

## Prerequisites

- Node.js and npm. Use a Node.js version supported by the installed Vite version.
- A Supabase PostgreSQL database for backend data.

## Run locally

### 1. Prepare the database

Use a disposable Supabase project for practice. In its SQL Editor, run `backend/supabase/schema.sql` once on a fresh database. Do not run `reset.sql` unless you intend to remove the Labstream schema and its data.

To create the first clinic administrator, edit and run `backend/supabase/bootstrap_first_admin.sql`. Copy the returned one-time activation code somewhere private; it is only shown once. Activate the administrator through the app and choose a password.

### 2. Configure the API

In PowerShell from the repository root:

```powershell
Copy-Item backend/.env.example backend/.env
```

Edit `backend/.env` and set `DATABASE_ENABLED=true`, `DATABASE_URL` to the Supabase Postgres connection string, and `AUTH_TOKEN_SECRET` to a random secret of at least 32 bytes. For example, generate a secret with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Keep the connection string and secret private. Never put database credentials in the frontend environment.

Install backend dependencies once:

```powershell
cd backend
npm install
```

Start the API in its own terminal:

```powershell
cd backend
npm run dev
```

The API listens at `http://localhost:3000`. Confirm the database connection by opening `http://localhost:3000/health`; expected response is `{"status":"ok","database":"connected"}`.

### 3. Configure and start the frontend

In a second terminal from the repository root:

```powershell
Copy-Item frontend/.env.example frontend/.env
cd frontend
npm install
npm run dev
```

The example frontend environment points to `http://localhost:3000`. Keep that value for desktop use. Open the Vite URL printed in the terminal, usually `http://localhost:5173`.

The API's `FRONTEND_ORIGIN` must match the browser origin exactly (normally `http://localhost:5173`). If you change ports, update the backend setting and restart the API. Keep both terminals running while using the site.

### 4. Sign in and configure a test clinic

Sign in as the activated administrator. Add accounts for the cashier, medical technologist, and pathologist from Staff Accounts; each person must activate their account with their one-time code and set a password. Add the tests, required specimen types, result fields, prices, and turnaround times in Test Catalog before setting tests available. Add verified clinic-specific reference ranges in Reference Ranges. The application does not seed patients, catalog entries, or requests automatically.

For a phone on the same Wi-Fi network, the frontend and API must both be reachable through the computer's LAN address. Set Vite to listen on the network interface (`npm run dev -- --host 0.0.0.0`), set `VITE_API_URL` to `http://<computer-LAN-IP>:3000`, and set the backend `FRONTEND_ORIGIN` to the phone's exact frontend origin. Restart both servers after changing environment values. This is development access only; do not expose the development server or database to the public internet.

### Database status

The backend is configured for Supabase and exposes `/health` as a read-only connection check. A healthy response reports `database: connected`. The frontend does not seed demo records; empty database tables therefore produce empty role views. Do not run reset SQL to troubleshoot a connection. `backend/supabase/reset.sql` is destructive; review [backend/README.md](backend/README.md) before changing the schema.

If `/health` reports `unavailable`, check the Supabase URL, password encoding, network access, and that `DATABASE_ENABLED=true`. If the browser says “Failed to fetch,” confirm both servers are running, the frontend API URL is reachable from the browser, and the backend `FRONTEND_ORIGIN` matches the page origin.

## System testing instructions

Use a disposable clinic/database for end-to-end practice. The app has no automated end-to-end test suite at this point; the steps below are a manual workflow checklist. Create and activate each role account before starting, and keep a separate browser profile/incognito window signed in as another role when checking cross-role updates.

1. **Startup and authentication:** verify `/health`; sign in and out as Administrator, Cashier, Medical Technologist, and Pathologist. Confirm an inactive account cannot sign in and an activated account can.
2. **Administrator setup:** create a category and test with a specimen requirement and result analyte; configure price/turnaround and make it available. Add a reference range. Verify the catalog and audit log update, and that another signed-in role sees catalog changes without reloading.
3. **Cashier registration/request:** register a patient, create a request with multiple tests, and confirm it appears in Queue as awaiting payment. Check the patient and test details, total, and request number.
4. **Payment and assignment:** process payment and verify an invoice is created, the unpaid queue entry disappears, and the assigned technologist sees the request in Work Queue without refreshing.
5. **Specimen handling:** mark required specimens received, then accept one test specimen and reject another with a reason. Confirm accepted work appears in Results in Progress and rejected work follows the recollection flow with a traceable attempt.
6. **Technologist results:** enter numeric, dropdown, and text results; save a draft, revise it, and submit only when required results are complete. For a multi-test request, check that tests stay grouped under one request and patient.
7. **Pathologist review:** confirm submitted results appear in Pending Validation. Add interpretations and approve one result; return another with a required remark and retest/recollection selection. Confirm the technologist sees the returned item and the request is not fully released prematurely.
8. **Correction and release:** enter corrected/recollected results and resubmit. Approve the remaining tests. Confirm the patient sees the released request in My Results and each individual test in Test History; verify unreleased results do not expose result details.
9. **Audit and tenant scope:** check audit events for staff/catalog/workflow actions. If a second clinic exists, confirm its accounts cannot see the first clinic's patients, requests, catalog, or results.
10. **Responsive/realtime behavior:** repeat key queue transitions with the receiving role open in another browser profile; verify the visible worklist updates automatically. Check mobile-width layout and the phone-on-Wi-Fi setup separately from desktop localhost.

After manual workflow checks, optional frontend static checks can be run from `frontend/`:

```powershell
npm run build
npm run lint
```

These checks do not replace the role-based workflow above. Do not use production patient data for practice.

## Preview a page or component

In normal mode, sign in with an account provisioned for your clinic. The shell selects the role from the authenticated backend session. To preview a page without authentication while doing isolated UI work, temporarily replace the root render with an `AppShell`:

```jsx
import AppShell from './components/layout/AppShell.jsx'

export default function App() {
  return <AppShell role="cashier" />
}
```

Use one of the supported role keys: `cashier`, `medical_technologist`, `pathologist`, `administrator`, or `patient`. Click a Sidebar item to preview its page. The PageHeader title and description come from that item's `label` and `description` in `Sidebar.jsx`. Restore the authenticated `App.jsx` after isolated preview work.

To preview an individual component outside the role-based page flow, import it and render it directly. Components may need props or surrounding layout:

```jsx
import CashierDashboard from './pages/cashier/CashierDashboard.jsx'

export default function App() {
  return <CashierDashboard />
}
```

Use explicit imports while prototyping; a folder cannot be rendered directly as a component. `AppShell` can also receive children, which it displays when the selected role/page has no mapped component. Many page components are placeholders, so add JSX that returns visible markup before expecting a complete screen.

### Role page folders and barrel files

Each role's folder groups its page components and stylesheets. For example:

```text
frontend/src/pages/cashier/
  index.js
  CashierDashboard.jsx
  CashierDashboard.css
  RegisterRequest.jsx
  RegisterRequest.css
  CashierQueue.jsx
  CashierQueue.css
  PaymentsReceipts.jsx
  PaymentsReceipts.css
  CashierPage.css       Shared placeholder styles used by Cashier pages
```

The folder's `index.js` re-exports its page components:

```js
export { default as CashierDashboard } from './CashierDashboard.jsx'
export { default as RegisterRequest } from './RegisterRequest.jsx'
```

`AppShell.jsx` imports that group as a namespace and references components by their exported names, for example `<CashierPages.CashierDashboard />`. The export name after `as` is the public name used by the importer; it does not have to match the function name, but matching names makes the code easier to follow. Each page JSX imports its corresponding CSS file. Placeholder page stylesheets can import the role's shared `RolePage.css` or `CashierPage.css` and add page-specific styles below.

## Sidebar navigation by role

`frontend/src/components/layout/Sidebar.jsx` shows navigation based on the `role` passed to `AppShell`. `AppShell` currently defaults to `administrator`; the Sidebar component defaults to `cashier` when used on its own. To preview a different role, set the prop in `App.jsx`:

```jsx
<AppShell role="medical_technologist" />
```

The current Sidebar content by role is:

| Role | Sidebar Content |
|---|---|---|
| `cashier` | Dashboard · Register Request · Queue · Payments & Invoice |
| `medical_technologist` | Work Queue · Specimens · Results in Progress |
| `pathologist` | Pending Validation · Returned Results · Released Results |
| `administrator` | Dashboard · Staff Accounts · Test Catalog · Reference Ranges · Reports · Audit Log |
| `patient` | My Results · Test History |

The icons are SVG files from `frontend/src/assets/`. Selecting a Sidebar item updates the active item and shows the matching component from that role's page map in `AppShell.jsx`; the app does not use a routing library yet. A Log out button appears at the bottom of the Sidebar. `App.jsx` obtains the role and display name from the authenticated backend session, and its logout action clears the server session. The backend independently enforces role permissions.

### Administrator management pages

- **Staff Accounts:** add a staff member through a modal with personal, address/contact, and role sections. Account activation and deactivation require confirmation. Administrator is not an assignable staff post from this page.
- **Test Catalog:** use **Test/Category** to switch between catalog forms. Changes are sent to the backend and the shared clinic catalog refreshes across roles. New tests require a specimen type and an initial result analyte.
- **Reference Ranges:** add and edit ranges in a modal; confirm before deleting. Its test choices come from the Test Catalog.
- Staff, Test Catalog, and Reference Ranges tables show up to 10 rows per page. These views load persisted clinic data from the API.
- Table header backgrounds across the app use the Sidebar's color token, `--sidebar-background` in `frontend/src/index.css`.

### Shared table layout rules

Use this order for table sections across all roles:

1. Table label
2. Short description of the table's purpose
3. Divider
4. Search bar followed by any filters
5. Table

Keep the table's border on the table itself. A transparent horizontal-scroll wrapper is acceptable for narrow screens, but do not style it as a card or panel around the table. Keep corner rounding modest throughout every role's pages and components.

### Shared interaction and labeling rules

- Every add-entry button uses a plus icon and names the entity being added (for example, **Add Staff Member**, **Add Test/Category**, **Add Reference Range**, or **Add Patient**).
- State-changing positive actions use a green hover background; destructive or cancelling actions use a red hover background. Read-only actions such as **View Results** may use a neutral/brand hover treatment.
- Ask for confirmation before consequential actions, including workflow transitions, not only create/update/delete operations. Examples include registering a patient or request, recording/cancelling payment, accepting/rejecting a specimen, submitting results, and approving/returning results. Viewing, filtering, and navigation do not need confirmation.
- Visible form labels are uppercase. Entered values and placeholders retain normal casing.
- Status tags share the same shape, sizing, typography, and semantic colors across roles: green for completed/positive, amber for pending/review, red for rejected/cancelled, and neutral gray for inactive or awaiting states.

## Styling guidance

- `frontend/src/main.jsx` imports `frontend/src/index.css` once. Global rules, custom properties, and Tailwind utilities from there are available throughout the app.
- Prefer Tailwind utility classes in JSX for ordinary layout and styling. For example: `className="rounded-lg bg-white p-4 shadow"`.
- Keep app-wide styles and design tokens in `index.css`. Keep unusual or reusable custom styling in a CSS file next to the page or component that owns it; import that CSS file from the matching JSX module.
- Avoid repeating a component's styles in both Tailwind classes and custom CSS unless there is a clear reason. Use responsive variants such as `md:grid-cols-2` for layout changes.

### Shared colors

The `:root` section in `frontend/src/index.css` declares the current color variables:

| CSS variable | Current value | Intended use |
|---|---|---|
| `--primary` | `#0F766E` | Main brand actions and emphasis |
| `--secondary` | `#14B8A6` | Secondary brand color |
| `--accent` | `#10B981` | Highlights |
| `--background` | `#F0FDFA` | App background |
| `--surface` | `#FFFFFF` | Cards and panels |
| `--sidebar-background` | `#134E4A` | Sidebar and table header backgrounds |
| `--text-lightbg` | `#134E4A` | Main text on light backgrounds |
| `--text-muted-lightbg` | `#5F7F7A` | Secondary text on light backgrounds |
| `--border` | `#4e8b7f` | Borders |
| `--hover` | `#059669` | Hover emphasis |
| `--success`, `--warning`, `--error` | Status colors | Workflow feedback |

Use the variables in regular CSS with `var(--primary)`, or use Tailwind v4's arbitrary CSS-variable syntax, such as `bg-(--primary)` and `text-(--text-lightbg)`. These `:root` variables are available to CSS, but they are **not yet named Tailwind theme colors** like `bg-primary`. To create named Tailwind utilities, expose them in `index.css` with Tailwind's `@theme` tokens, for example:

```css
@theme inline {
  --color-primary: var(--primary);
  --color-secondary: var(--secondary);
  --color-surface: var(--surface);
}
```

Then classes such as `bg-primary`, `text-primary`, and `bg-surface` can use those tokens. Prefer the shared palette over introducing one-off brand colors in page files. Tailwind v4 documents custom colors using `@theme`: [Tailwind color customization](https://tailwindcss.com/docs/customizing-colors).

## Database, clinics, and account security

- The canonical database schema is `backend/supabase/schema.sql`. `backend/src/db/schema.js` is deprecated legacy reference and must not be used to generate or apply migrations.
- The backend defaults to `DATABASE_ENABLED=false`; the local backend `.env` must explicitly set it to `true` and provide `DATABASE_URL` and `AUTH_TOKEN_SECRET`. The app's `/health` performs a read-only database check. The connection requires SSL.
- Clinics are tenants, and branches belong to clinics. Backend queries must scope by clinic and, where applicable, branch.
- On a new, empty Supabase project, run `backend/supabase/schema.sql`. `backend/supabase/reset.sql` is destructive and only for a disposable database. The legacy `002_tenant_accounts.sql` is not part of the current workflow.
- The SQL enables RLS without policies, so direct Supabase Data API access remains denied. Do not add broad policies just to make prototype UI work. When backend access is implemented, scope every read and write to the authenticated user's clinic and role, then design RLS policies to match that trust model.
- Clinic creation and the first Administrator should be a controlled one-time onboarding operation. Do not expose unrestricted public clinic/admin creation. The Administrator can manage staff and catalog data only inside their own clinic.
- Staff sign in with their clinic code, generated username, and password; patients use their clinic code, PID, and password. Staff usernames use a stable tenant-scoped form such as `CSH-000021`, `MLT-000022`, `PTH-000023`, or `ADM-000024`. The numeric staff number is generated by the database. The name suffix from the original example is omitted because it exposes personal data and becomes stale when a name changes.
- Do not issue a permanent password assembled from predictable character counts. Create a cryptographically random, one-time activation code (and one-time reset codes), store only its SHA-256 digest in `account_tokens`, set an expiry and consume it once. Deliver it privately; activation requires the user to choose a password, which the backend hashes with Argon2id. Do not put codes on public receipts. A patient PID is an identifier, never a password. Apply rate limits, expiry, account disablement, and audit logging in the future auth endpoints.
- Pending accounts may have a null `password_hash`; active accounts must have an Argon2id hash. `must_change_password` supports the activation/forced-change flow, and `last_sign_in_at` supports staff account reporting.
- Keep privileged database credentials on the backend. The frontend uses the role-scoped API, while the backend enforces authentication, clinic isolation, role permissions, assignments, and valid workflow transitions; RLS does not replace those checks.

### Empty database and first Administrator

- The UI no longer starts with sample patients, requests, test catalog entries, staff, reference ranges, results, or audit events. On its next load, it clears the two legacy browser-storage keys used by the old sample catalog and cashier transactions.
- To provision a clinic and its first Administrator on a fresh schema, run `backend/supabase/bootstrap_first_admin.sql` in Supabase SQL Editor. Edit the clinic code/name and administrator email/name first. The query returns the generated username and a one-time activation code; copy the code immediately and keep it private. It is stored in the database only as a hash and expires after 24 hours.
- The administrator account is pending until activated. The login screen supports sign-in and first activation with the one-time code, after which the user chooses a password of at least 12 characters.
- The role pages now use API-backed records; they do not create fallback demo records. With empty tables, lists and charts show their empty states. Populate a disposable clinic through the UI to observe workflow states; no automatic seed data is added.

### Clear workflow data but keep accounts

For a practice reset that preserves clinic accounts, run `backend/supabase/clear_operational_data_keep_accounts.sql` in Supabase SQL Editor. Review the file before execution. It deletes requests, results, specimens, payments/invoices, audit events, test catalog/reference setup, and walk-in patients without portal accounts. It preserves clinic and branch records, user accounts, staff profiles, activation tokens, and patient records linked to patient portal accounts (those patient identities are needed for PID-based login). This reset has not been run by the application and cannot be undone without a backup.

For a more complete implementation handoff, see [SYSTEM_STATE_AND_PROGRESS.md](SYSTEM_STATE_AND_PROGRESS.md). The standard diagnostic result-field specification is in [backend/supabase/standard-test-result-design.md](backend/supabase/standard-test-result-design.md); those tests are not automatically seeded into new clinics yet.

### Clinic and account workflow

1. A clinic completes controlled onboarding. One clinic record is provisioned and the first Administrator account is created in the same clinic. Public, unrestricted clinic creation and a global Administrator role are not part of the proposal.
2. The first Administrator activates their account, sets a password, and manages that clinic's staff, test catalog, and reference ranges. They cannot grant another Administrator role through Staff Accounts.
3. When the Administrator creates staff, the database assigns a staff number and generates a username such as `CSH-000021` (`MLT`, `PTH`, or `ADM` for the other staff roles). The username is unique within that clinic; the name is not embedded. The staff member receives a private one-time activation code, activates their own account, and chooses a password.
4. The Cashier registers a patient, records the ordered tests, and places the request in the payment queue. Confirming cash creates an invoice and assigns one Medical Technologist to the request. Payments and Invoice is a paid-only history.
5. The assigned Medical Technologist receives specimens. Rejection keeps the attempt and reason in history and creates a linked replacement attempt. A result correction reuses its specimen; a retest/recollection creates a new attempt for affected tests. The technologist saves drafts and submits the request only when every required result is complete.
6. The first submission assigns one Pathologist to the request. They interpret and approve or return each test independently. Returned tests retain remarks and earlier revisions; once all requested tests are approved, the request is released together. The Patient sees one row per request in My Results and one row per test in Test History.
7. Patient registration and portal activation are separate. Portal access should use a verified, one-time activation code and a patient-chosen password; PID is an identifier, never a password. Every operation must verify clinic membership and role; the UI's selected role is not authorization.

The database includes `cashier_payment_queue`, a view over unpaid requests. It is the cashier payment worklist, not a physical waiting-room ticket queue. Catalog entries referenced by historical requests must be deactivated or relocated, not hard-deleted. Request item snapshots preserve the test, category, and price used at the time of payment.

RLS is enabled without client policies, so direct Supabase Data API access is denied until policies are deliberately added. Keep privileged credentials server-side. The backend enforces clinic/branch scope, roles, assignments, and valid workflow transitions. Browser requests go through the API and do not access Supabase directly.

## Useful commands

Run these from `frontend/`:

```powershell
npm run build
npm run lint
```

For API configuration, routes, and database notes, see [backend/README.md](backend/README.md).
