# Accounting Demo — work plan and log

This is the repository's only planning and work-history file. It records past decisions,
current tasks, and what comes next. Update its status and progress log as work proceeds.

## Goal and scope

Build a flexible, presentable accounting demo that preserves the existing React screens and
workflows, separates business behavior from UI code where practical, and saves its working
state in Microsoft SQL Server.

Keep it simple: the React UI, TypeScript business modules, Node web host, and SQL data access
belong to the **App project** and deploy as one web app. Browser code cannot connect safely to
SQL Server, so the same Node process handles the small same-origin data requests. Do not create
or deploy a separate API/service. `Service/` is archived and out of active development scope.

The demo is for one trusted user at a time. A single JSON state snapshot is an intentional
shortcut that preserves flexibility while the prototype changes. Do not add multi-user,
production security, concurrency/versioning, or normalized storage unless a demo workflow
requires it. Keep SQL persistence real and preserve the demo's business behavior.

## Current plan and status

| # | Task | Status | Notes |
|---|---|---|---|
| A1 | Archive non-demo repo material under `Documents/` | **DONE** | Service, message contract, compose/deployment files, domain references, and legacy orientation are preserved. Root now contains App and files needed to build, guide, and document it. |
| A2 | Keep `AGENTS.md` and one work log | **DONE** | Root `AGENTS.md` gives AI working rules; this file tracks past/current/future work. |
| A3 | Document the single App project and keep README current | **DONE** | `App/README.md` is the source; the npm dev/build/lint/start lifecycle syncs the GitHub root README. AGENTS.md and Copilot instructions require updating the source README with behavior/setup changes. |
| B1 | Build the App-owned SQL persistence layer | **DONE** | Node host serves the React build; SQL data module creates a demo database/table and loads/saves a JSON snapshot. Runtime smoke confirmed API round-trip and persistence after restarting the App container. |
| B2 | Separate the main business modules from UI files | **DONE** | Booking, accrual, recognition, and revaluation modules are grouped under `App/src/business/`; the App TypeScript build passes. |
| B3 | Load, save, and reset state through SQL | **DONE** | First browser load created one valid 646 KB SQL snapshot from seeded state. A browser edit changed Accounting Class `PF-Agreement` to `PF-Agreement 1` in SQL; reset restored `PF-Agreement`. API round-trip and persistence after App restart also pass. |
| B4 | Keep the App setup and container path simple | **DONE** | One App compose setup starts SQL Server and the web app; compose configuration resolves. |
| B5 | Verify the App build and a manual persistence workflow | **DONE** | Build/lint and Node syntax checks pass; Docker App + SQL Server are healthy. Browser seed, edit-to-SQL, and reset-to-seed are verified. API save/load and persistence after App restart also pass. |
| B6 | Review archive boundaries and links | **DONE** | Root is focused on App, GitHub/agent guidance, the work log, and Documents; App build has no dependency on the archive. |
| C1 | Prepare IIS deployment for the single App host | **IN PROGRESS** | IIS and WAS are running and the ASP.NET Core Module V2 binary is installed. The current shell is not elevated, so IIS configuration cannot be read or changed yet. |
| C2 | Deploy App to IIS and verify SQL persistence there | **NOT STARTED** | After IIS access is available, configure IIS to host the App Node process and point it at the target SQL Server; then repeat seed/edit/reload/reset smoke checks. |

## App layers

| Layer | Location | Responsibility |
|---|---|---|
| UI | `App/src/` | React screens and user interaction |
| Business | `App/src/business/` | Booking engine and accounting demo workflows |
| Data | `App/server/data/`, `App/src/data/` | SQL snapshot persistence and UI data client/reference data |
| Host | `App/server/` | Serves the built UI and its same-origin data requests in one process |

## Repository layout

- `App/` — active demo application and its setup.
- `Documents/ArchivedService/Service/` — previous .NET service and deployment implementation.
- `Documents/Reference/` — domain specifications, message contract, sample files, and model references.
- `Documents/Legacy/` — prior orientation material.
- `Documents/Deployment/` — prior root-level compose setup.
- `README.md`, `AGENTS.md`, `.github/copilot-instructions.md` — current user and agent guidance.

## Decisions

| Date | Decision | Why |
|---|---|---|
| 2026-09-29 | The React prototype behavior is the demo reference | It already contains the workflows and screens to preserve. |
| 2026-09-29 | Persist the prototype's complete state as one SQL JSON snapshot | Fewest changes to retain its flexible data shape and existing UI behavior. Single-user demo only. |
| 2026-09-30 | Work in `App/`; archive the former Service and non-demo materials in `Documents/` | Keep the active repository structure focused on the demo app while preserving prior work. |
| 2026-09-30 | Keep UI, business, and data access in one App project and one deployable process | Keep setup and evolution simple. The browser uses same-origin requests handled by the App's own Node host; no separately deployed API/service. |
| 2026-09-30 | Keep `DEMO_DEPLOYMENT.md` as the sole planning and work-history file | Preserve current status and decision history without parallel TODO documents. |
| 2026-09-30 | Update the root README in the same development change when setup, capabilities, or behavior changes | Keep the GitHub landing page aligned with the working demo. AI instructions make this part of every development task. |

## Earlier work (before the App-only direction)

- **2026-09-29** — The .NET Service was built and verified against SQL Server 2022 in Docker.
  Its startup migration, seed data, demo authentication, API, and IIS publish script remain
  preserved under `Documents/ArchivedService/Service/`. IIS deployment itself was not completed.
- **2026-09-30** — The user approved a six-part modernization plan, then clarified that active
  work must be on `App/`, with UI, business logic, and data access together in one solution.
  The .NET Service path was superseded and archived before further implementation there.
- **2026-09-30** — Archived the previous Service, integration contracts, root deployment files,
  domain documents, sample spreadsheets/images, and legacy `CLAUDE.md` under `Documents/`.
  Kept the root README, AGENTS.md, GitHub guidance, and this work log.
- **2026-09-30** — Added the App-owned Express/MSSQL host, SQL JSON snapshot storage, browser-state
  import, save/reset feedback, and Docker setup. Moved the booking, accrual, recognition, and
  revaluation modules into `App/src/business/`. Root README now regenerates from `App/README.md`
  on the normal npm dev/build/lint/start commands. `npm run build`, Node syntax checks, Docker
  compose config, `npm run lint`, and `git diff --check` pass. The build/lint report existing
  chunk-size and hook/fast-refresh warnings. The initial compose healthcheck quoting prevented
  SQL login; corrected it to expand the container password safely. Docker App + SQL containers
  now run healthy. API smoke checks confirmed an empty-state response, snapshot round-trip, and
  snapshot persistence after restarting the App container; removed the probe row afterward.
- **2026-09-30** — Verified the user's Accounting Class edit in SQL: record `PF-Agreement` changed
  to `PF-Agreement 1`; the user triggered reset and SQL returned it to `PF-Agreement`. The valid
  seeded snapshot remains in place. This completes the App SQL persistence workflow.
- **Next** — Prepare and deploy the single App host on IIS with SQL Server. IIS and WAS are running
  and the ASP.NET Core Module V2 binary exists, but IIS configuration access failed because this
  shell is not elevated. Continue after an elevated IIS session is available.
