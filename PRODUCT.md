# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Cashiers register patients and tests and record payment. Medical technologists process paid requests, assess specimens, and encode results. Pathologists validate results. Patients use the portal to view released results. Administrators manage staff, tests, reference ranges, reports, and audit records.

## Product Purpose

Labstream is a web-based diagnostic laboratory and test result portal. Its workflow supports patient registration and queueing, payment recording, specimen processing, result review and release, a patient results portal, and administrative reports.

## Operating Context

The workflow proceeds from cashier registration and payment, to medical-technologist specimen processing and result entry, to pathologist review and release or return. The medical-technologist workflow is Work Queue, Specimens, then Results in Progress. Processing starts only after payment; workflow steps cannot be skipped.

## Capabilities and Constraints

The existing application is a React and Vite frontend with an Express, Drizzle, and Supabase backend. The UI is under development and uses prototype data where backend behavior is not connected. The medical-technologist UI is a frontend prototype; do not change the backend for this work. Results are entered manually and support text and numeric values, not images. Backend authentication, role permissions, and workflow validation remain required; hiding UI actions is not authorization.

The repository README is authoritative for project structure and existing component conventions. The medical-technologist UI contents guide supplies role-specific screens, behavior, and dummy data.

## Brand Commitments

The product name is Labstream. Preserve the existing shared application shell, role-based navigation, logo asset, and color tokens.

## Evidence on Hand

- `README.md` documents the product workflow, repository structure, role navigation, shared components, and styling tokens.
- `frontend/README.md` documents the Vite starter setup.
- The provided medical-technologist UI contents guide specifies the role workflow and prototype dummy data.
- `frontend/src/` contains the existing role pages, shared layout, and components.
