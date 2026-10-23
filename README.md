# Labstream

Labstream is a web-based diagnostic laboratory and test result portal prototype. The planned workflow supports walk-in registration and queueing, payment recording, specimen processing, result review and release, a patient results portal, and administrative reports.

## Project structure

```text
backend/
  src/                 Express API and Drizzle database schema
  supabase/schema.sql   Current end-to-end schema for a fresh Supabase database
  supabase/reset.sql    Destructive reset of named Labstream objects in public
  supabase/002_tenant_accounts.sql  Legacy upgrade for the earlier schema
  drizzle/             Drizzle migration files
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

The UI is still under development. `frontend/src/App.jsx` renders the shared `AppShell`, which contains the role-based Sidebar, PageHeader, and selected page area. Each role has a page folder with an `index.js` barrel file; pages are being built incrementally. The Medical Technologist role includes Work Queue, Specimens, and Results in Progress prototype flows with sample data held in page-level state; changes are not saved to the backend. The Administrator role includes an operations dashboard, staff accounts, test catalog, reference ranges, reports, and an audit log. Its forms and confirmation dialogs are prototype UI: the test catalog is stored in browser local storage, while staff and reference-range changes are held in page state. None of these changes are saved to the backend yet.

## Prerequisites

- Node.js and npm. Use a Node.js version supported by the installed Vite version.
- A Supabase PostgreSQL database for backend data.

## Run locally

Install dependencies once in each app folder:

```powershell
cd backend
npm install
```

```powershell
cd frontend
npm install
```

Create `backend/.env` from the example and fill in your Supabase PostgreSQL connection string:

```powershell
cd backend
Copy-Item .env.example .env
```

Set these values in `backend/.env`:

```env
DATABASE_URL=postgresql://...
PORT=3000
FRONTEND_ORIGIN=http://localhost:5173
```

Keep `.env` and database credentials private. Never put the database connection string in frontend code.

### Set up the database

For a **new, empty Supabase database**, run only `backend/supabase/schema.sql` in Supabase SQL Editor. It includes clinics and branches, roles, test/analyte catalog, requests, payment queue, invoices, specimen attempts, revisioned per-test results and review history.

To intentionally discard current Labstream data, review and run `backend/supabase/reset.sql`, then run `backend/supabase/schema.sql`. The reset drops named Labstream objects in `public` and does not drop Supabase auth/storage schemas. It uses `RESTRICT`, so an unlisted dependent object causes an error instead of being silently removed. It permanently deletes Labstream records. Export anything you need first. Do not run the legacy `002_tenant_accounts.sql` or checked-in legacy Drizzle migrations with this fresh schema. Backend/database wiring and `backend/src/db/schema.js` have not yet been reconciled with this SQL design.

### Start the API

In a terminal opened at `backend/`:

```powershell
npm run dev
```

The API listens at `http://localhost:3000`. Its health endpoint is `http://localhost:3000/health`.

### Start the frontend

In a second terminal opened at `frontend/`:

```powershell
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`. Vite updates the page as you save files.

## Preview a page or component

`frontend/src/App.jsx` renders `AppShell`. The shell selects the page component using the current role and selected Sidebar item. To preview a role, temporarily pass its role key:

```jsx
import AppShell from './components/layout/AppShell.jsx'

export default function App() {
  return <AppShell role="cashier" />
}
```

Use one of the supported role keys: `cashier`, `medical_technologist`, `pathologist`, `administrator`, or `patient`. `App.jsx` currently selects the Administrator view; `AppShell` defaults to `administrator` if no role is passed. To preview a particular page within that role, click its Sidebar item. The PageHeader title and description come from that item's `label` and `description` in `Sidebar.jsx`.

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

The icons are SVG files from `frontend/src/assets/`. Selecting a Sidebar item updates the active item and shows the matching component from that role's page map in `AppShell.jsx`; the app does not use a routing library yet. A Log out button appears at the bottom of the Sidebar. `AppShell` forwards its optional `onLogout` callback to that button; authentication is not wired yet, so `App.jsx` currently supplies no sign-out handler. Sidebar visibility is only a UI convenience—backend endpoints must still enforce each role's permissions. The role passed to `AppShell` is currently a development preview value; authentication should supply it after login, and the backend must still enforce role permissions.

### Administrator management pages

- **Staff Accounts:** add a staff member through a modal with personal, address/contact, and role sections. Account activation and deactivation require confirmation. Administrator is not an assignable staff post from this page.
- **Test Catalog:** use **Add Test/Category** to switch between test and category forms. Additions keep the modal open and clear the form for another entry; test edits and deletions use dialogs. The Test Catalog is shared with the Reference Ranges test dropdown and saved in browser local storage for prototyping.
- **Reference Ranges:** add and edit ranges in a modal; confirm before deleting. Its test choices come from the Test Catalog.
- Staff, Test Catalog, and Reference Ranges tables show up to 10 rows per page. Search and filters operate on sample data.
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

- The Drizzle schema is in `backend/src/db/schema.js`.
- The backend connects to Postgres using `DATABASE_URL` and currently requires SSL.
- Each clinic or clinic branch is one isolated tenant/site. This supports separate online deployments while retaining the proposal's single-laboratory scope; it does not add multi-branch administration within one clinic account.
- On a new, empty Supabase project, run `backend/supabase/schema.sql`. To reset the app database, review and run `backend/supabase/reset.sql`, then rerun the schema. The legacy `002_tenant_accounts.sql` is not part of this workflow.
- The SQL enables RLS without policies, so direct Supabase Data API access remains denied. Do not add broad policies just to make prototype UI work. When backend access is implemented, scope every read and write to the authenticated user's clinic and role, then design RLS policies to match that trust model.
- Clinic creation and the first Administrator should be a controlled one-time onboarding operation. Do not expose unrestricted public clinic/admin creation. The Administrator can manage staff and catalog data only inside their own clinic.
- Staff sign in with their clinic code, generated username, and password; patients use their clinic code, PID, and password. Staff usernames use a stable tenant-scoped form such as `CSH-000021`, `MLT-000022`, `PTH-000023`, or `ADM-000024`. The numeric staff number is generated by the database. The name suffix from the original example is omitted because it exposes personal data and becomes stale when a name changes.
- Do not issue a permanent password assembled from predictable character counts. Create a cryptographically random, one-time activation code (and one-time reset codes), store only its SHA-256 digest in `account_tokens`, set an expiry and consume it once. Deliver it privately; activation requires the user to choose a password, which the backend hashes with Argon2id. Do not put codes on public receipts. A patient PID is an identifier, never a password. Apply rate limits, expiry, account disablement, and audit logging in the future auth endpoints.
- Pending accounts may have a null `password_hash`; active accounts must have an Argon2id hash. `must_change_password` supports the activation/forced-change flow, and `last_sign_in_at` supports staff account reporting.
- Keep privileged database credentials on the backend. The backend must enforce authentication, clinic isolation, role permissions, and valid workflow transitions; RLS does not replace those checks. The current API/UI is still a prototype and these authentication and tenant controls are not wired yet.

### Clinic and account workflow

1. A clinic completes controlled onboarding. One clinic record is provisioned and the first Administrator account is created in the same clinic. Public, unrestricted clinic creation and a global Administrator role are not part of the proposal.
2. The first Administrator activates their account, sets a password, and manages that clinic's staff, test catalog, and reference ranges. They cannot grant another Administrator role through Staff Accounts.
3. When the Administrator creates staff, the database assigns a staff number and generates a username such as `CSH-000021` (`MLT`, `PTH`, or `ADM` for the other staff roles). The username is unique within that clinic; the name is not embedded. The staff member receives a private one-time activation code, activates their own account, and chooses a password.
4. The Cashier registers a patient, records the ordered tests, and places the request in the payment queue. Confirming cash creates an invoice and assigns one Medical Technologist to the request. Payments and Invoice is a paid-only history.
5. The assigned Medical Technologist receives specimens. Rejection keeps the attempt and reason in history and creates a linked replacement attempt. A result correction reuses its specimen; a retest/recollection creates a new attempt for affected tests. The technologist saves drafts and submits the request only when every required result is complete.
6. The first submission assigns one Pathologist to the request. They interpret and approve or return each test independently. Returned tests retain remarks and earlier revisions; once all requested tests are approved, the request is released together. The Patient sees one row per request in My Results and one row per test in Test History.
7. Patient registration and portal activation are separate. Portal access should use a verified, one-time activation code and a patient-chosen password; PID is an identifier, never a password. Every operation must verify clinic membership and role; the UI's selected role is not authorization.

The database includes `cashier_payment_queue`, a view over unpaid requests. It is the cashier payment worklist, not a physical waiting-room ticket queue. Catalog entries referenced by historical requests must be deactivated or relocated, not hard-deleted. Request item snapshots preserve the test, category, and price used at the time of payment.

RLS is enabled without client policies, so direct Supabase Data API access is denied until policies are deliberately added. Keep privileged credentials server-side. The backend must enforce clinic/branch scope, roles, assignments, and valid workflow transitions. The SQL describes the target schema; the current UI remains prototype data and is not connected to it.

## Useful commands

Run these from `frontend/`:

```powershell
npm run build
npm run lint
```

Generate a Drizzle migration for review from `backend/` (do not apply it to Supabase until it is reconciled with the SQL setup path):

```powershell
npm run db:generate
```
