# Labstream

Labstream is a web-based diagnostic laboratory and test result portal prototype. The planned workflow supports walk-in registration and queueing, payment recording, specimen processing, result review and release, a patient results portal, and administrative reports.

## Project structure

```text
backend/
  src/                 Express API and Drizzle database schema
  supabase/schema.sql   SQL setup for a new, empty Supabase database
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

The UI is still under development. `frontend/src/App.jsx` renders the shared `AppShell`, which contains the role-based Sidebar, PageHeader, and selected page area. Each role has a page folder with an `index.js` barrel file; pages are being built incrementally. The Administrator role includes an operations dashboard, staff accounts, test catalog, reference ranges, reports, and an audit log. Its forms and confirmation dialogs are prototype UI: the test catalog is stored in browser local storage, while staff and reference-range changes are held in page state. None of these changes are saved to the backend yet.

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

For a **new, empty Supabase database**, you can open `backend/supabase/schema.sql` in Supabase SQL Editor and run it once. This creates the tables and enables Row Level Security, with no client policies yet.

Alternatively, manage schema changes through Drizzle from the backend folder:

```powershell
npm run db:generate
npm run db:migrate
```

Choose one setup path for a database. Do not run the fresh-database SQL script and the existing Drizzle migrations against the same database; the repo's initial Drizzle migration describes an earlier starter schema. For an existing database, create and review an upgrade migration instead of running the fresh setup script.

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
| `cashier` | Dashboard · Register Request · Queue · Payments & Receipts |
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

## Database and security notes

- The Drizzle schema is in `backend/src/db/schema.js`.
- The backend connects to Postgres using `DATABASE_URL` and currently requires SSL.
- The SQL setup enables RLS without policies, so direct Supabase Data API access is denied until policies are deliberately added.
- Keep privileged database credentials on the backend. The backend must enforce authentication, role permissions, and valid workflow transitions; RLS does not replace those checks.
- Never store plaintext passwords. The backend includes Argon2 for password hashing.

## Useful commands

Run these from `frontend/`:

```powershell
npm run build
npm run lint
```

Run these from `backend/`:

```powershell
npm run db:generate
npm run db:migrate
```
