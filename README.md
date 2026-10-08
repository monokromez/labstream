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
    pages/              Full screens, such as Cashier and Patient Portal
    components/         Reusable layout, form, data, report, and workflow UI
    index.css           Global CSS, Tailwind setup, and shared color variables
```

The UI is still under development. `frontend/src/App.jsx` renders the shared `AppShell`, which contains the Topbar, role-based Sidebar, and current page area. Page and component screens are being built incrementally.

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

`frontend/src/App.jsx` controls what appears in the browser. To preview a page, import it and render it from `App`:

```jsx
import CashierPage from './pages/CashierPage.jsx'

export default function App() {
  return <CashierPage />
}
```

To preview a component, import and render it in the same way. Components may need props or surrounding layout:

```jsx
import AppShell from './components/layout/AppShell.jsx'
import CashierPage from './pages/CashierPage.jsx'

export default function App() {
  return (
    <AppShell>
      <CashierPage />
    </AppShell>
  )
}
```

React passes the content between `<AppShell>` and `</AppShell>` to the shell as its `children` prop. Use explicit imports while prototyping; a folder cannot be rendered directly as a component. The current page/component files are placeholders, so add JSX that returns visible markup before expecting a full screen to appear.

## Sidebar navigation by role

`frontend/src/components/layout/Sidebar.jsx` shows navigation based on the `role` passed to `AppShell`. The default role is `cashier`. To preview a different role, set the prop in `App.jsx`:

```jsx
<AppShell role="medical_technologist">
  <TechnologistPage />
</AppShell>
```

The current Sidebar items are:

| Role | Sidebar items | Intended function |
|---|---|---|
| `cashier` | Dashboard; Register New Request; Queue; Payments & Receipts | Start walk-in requests, manage the patient queue, and review recorded payments/receipts. |
| `medical_technologist` | Work Queue; Specimens; Results in Progress | Find paid requests, record received specimens, and continue result processing. |
| `pathologist` | Pending Validation; Returned Results; Released Results | Review results, revisit returned work, and inspect released results. |
| `administrator` | Dashboard; Staff Accounts; Test Catalog; Reference Ranges; Reports; Audit Log | Manage staff and test setup, review reports, and inspect recorded system activity. |
| `patient` | My Results; Test History | View the signed-in patient's released results and previous tests. |

The icons are SVG files from `frontend/src/assets/`. Sidebar entries currently update the selected appearance and use placeholder hash links; they do not yet navigate to real routes. Sidebar visibility is only a UI convenience—backend endpoints must still enforce each role's permissions.

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
| `--text` | `#134E4A` | Main text |
| `--text-muted` | `#5F7F7A` | Secondary text |
| `--border` | `#CCFBF1` | Borders |
| `--hover` | `#059669` | Hover emphasis |
| `--success`, `--warning`, `--error` | Status colors | Workflow feedback |

Use the variables in regular CSS with `var(--primary)`, or use Tailwind v4's arbitrary CSS-variable syntax, such as `bg-(--primary)` and `text-(--text)`. These `:root` variables are available to CSS, but they are **not yet named Tailwind theme colors** like `bg-primary`. To create named Tailwind utilities, expose them in `index.css` with Tailwind's `@theme` tokens, for example:

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
