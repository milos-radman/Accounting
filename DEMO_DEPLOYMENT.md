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
| C2 | Deploy App to IIS and verify SQL persistence there | **NOT STARTED** | Configure IIS to host the single App Node process and connect it to SQL Server; then verify seed/edit/reload/reset there. Keep access limited to trusted demo users while the browser-based AI key flow remains enabled. |
| D1 | Make project tracking easier to resume | **PLANNED** | Keep this file as the only tracker; organize it around one active task, a short ordered next list, backlog, decisions, and dated results with verification. |
| D2 | Add contextual in-app help | **PLANNED** | Add offline, screen-aware user help for each major area. Feature work must add or review its help entry; require help metadata for new screens. Keep this separate from the optional AI assistant. |
| D3 | Improve snapshot maintenance when data shapes change | **PLANNED** | Keep the flexible SQL JSON snapshot. When its shape next changes, add an explicit version and ordered migration; consider backup/export and a retry action for save failures. |
| D4 | Clarify unfinished and simulated UI elements | **PLANNED** | Decide whether to implement or remove placeholder search/language controls and label dashboard-generated activity as sample/simulated or connect it to real demo events. |
| D5 | Preserve a path to production business modules | **PLANNED** | Keep one App and process. As workflows change, keep cohesive business behavior separate from screens and capture inputs, rules, outputs, and edge cases before extracting stable modules. |

## Planned work order

1. Complete C1/C2: deploy the App to IIS with SQL Server and verify the persistence workflow.
2. Improve this task log under D1 so new work has a clear outcome, acceptance check, priority, and verification record.
3. Build the contextual help MVP under D2. Help is authored and reviewed with the feature; it is not inferred at runtime from code or generated by the AI assistant.
4. Take D3/D4 as actual needs arise; avoid broad changes to the snapshot or UI before a demo workflow calls for them.
5. Continue D5 incrementally as business workflows evolve and become clear candidates for extraction.

## Help content scope

The first help version should explain each major screen's purpose, how to use it, important accounting terms and fields, what the action changes, and where to see its result. Keep the help available without an API key or network connection. New or materially changed screens and workflows should update their help content in the same feature task. A screen/help registry should make missing help entries visible during development; the written guidance remains reviewed content rather than automatic prose generation.

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
  shell is not elevated. Continue after an elevated IIS session is available. After deployment,
  follow D1-D5 in the planned work order above.
