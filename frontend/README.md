# React + Vite

This frontend contains the Labstream diagnostic laboratory and patient results portal UI. See the repository-root `README.md` for setup, shared theme tokens, role navigation, and backend security requirements.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Patient login UI

`src/pages/PatientLogin.jsx` is a standalone patient-only login flow, separate from the staff `AppShell`. Its adjacent `PatientLogin.css` uses the Labstream palette in `src/index.css` and includes responsive layouts for smaller screens. `src/App.jsx` currently renders this page so it appears when you start Vite.

The component displays login, retrieve-account, register, and set-password views. Preview it directly by rendering `<PatientLogin />` from `src/App.jsx`. `initialView` can select a view for prototyping; `passwordPurpose` identifies registration or password reset. Optional `onLogin`, `onRetrieve`, `onRegister`, and `onSetPassword` callbacks provide the integration boundary for API work. No backend authentication or email delivery is included in this UI. Follow the supplied patient login guide and the root README for complete flow and security requirements.

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
