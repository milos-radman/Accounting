# Accounting Demo — work plan and log

This is the repository's only planning and work-history file. It records past decisions,
current tasks, and what comes next. Update its status and progress log as work proceeds.

## Goal and scope

Build a flexible, presentable accounting demo that preserves the existing React screens and
workflows, separates business behavior from UI code where practical, and saves its working
state in Microsoft SQL Server.

Keep it simple: the React UI, TypeScript business modules, web host, and SQL data access belong to
the **App project** and deploy as one web app. Node hosts local/Docker use; ASP.NET Core hosts the
IIS package. Browser code cannot connect safely to SQL Server, so the same-origin data requests
stay inside the app process. Do not create or deploy a separate API/service. `Service/` is archived
and out of active development scope.

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
| C1 | Prepare IIS deployment for the single App host | **DONE** | Self-contained ASP.NET Core 8 out-of-process host targets the existing `No Managed Code` IIS pool and avoids server runtime dependencies. Hosted URL is `https://azs-pfwdev-02.credit-dev.com/DEMO_Accounting`; database `DEMO_Accounting` is on SQL Server `AZS-PFSDEV-07.credit-dev.com`. The ASP.NET Core Module is still required. |
| C2 | Deploy App to IIS and verify SQL persistence there | **DONE** | User verified the hosted app at `https://azs-pfwdev-02.credit-dev.com/DEMO_Accounting` and confirmed app changes are stored in database `DEMO_Accounting` on `AZS-PFSDEV-07.credit-dev.com`. |
| C3 | Show friendly startup and database diagnostics | **DONE** | SQL connectivity is checked on the first data request so an unavailable database no longer prevents the UI from loading. Database and React startup errors show a friendly retry screen with expandable, copyable diagnostics; IIS process-start errors map to a static fallback that points to Event Viewer. Server passwords are redacted. |
| D1 | Make project tracking easier to resume | **PLANNED** | Keep this file as the only tracker; organize it around one active task, a short ordered next list, backlog, decisions, and dated results with verification. |
| D2 | Add contextual in-app help | **PLANNED** | Add offline, screen-aware user help for each major area. Feature work must add or review its help entry; require help metadata for new screens. Keep this separate from the optional AI assistant. |
| D3 | Replace JSON snapshot persistence with relational SQL tables | **IN PROGRESS** | Source inventory is underway. Store every persisted `AppData` collection in typed tables, with child tables for nested/repeated values. Keep the browser-facing state model during the first migration so UI workflows stay intact. |
| D4 | Clarify unfinished and simulated UI elements | **PLANNED** | Decide whether to implement or remove placeholder search/language controls and label dashboard-generated activity as sample/simulated or connect it to real demo events. |
| D5 | Preserve a path to production business modules | **PLANNED** | Keep one App and process. As workflows change, keep cohesive business behavior separate from screens and capture inputs, rules, outputs, and edge cases before extracting stable modules. |

## Planned work order

1. Complete D3's collection/key inventory and relational schema, then implement the migration.
2. Improve this task log under D1 so new work has a clear outcome, acceptance check, priority, and verification record.
3. Build the contextual help MVP under D2. Help is authored and reviewed with the feature; it is not inferred at runtime from code or generated by the AI assistant.
4. Take D4 as actual needs arise; avoid broad UI changes before a demo workflow calls for them.
5. Continue D5 incrementally as business workflows evolve and become clear candidates for extraction.

## D3 analysis and implementation plan

The current persistence boundary is `AppData`: the browser loads one JSON object from
`/demo/state`, mutates it in the React store, and sends the complete object back after edits. The
Node and IIS hosts each implement this same contract and currently save it to
`dbo.DemoAppState.StateJson`. `AppData` extends `SeedData` and includes reference/setup data as well
as journals, journal lines, accruals, recognition, pending messages, revaluation, GL export, and
opening balances. Some records contain repeated child values (journal lines, recognition plan
lines/schedules, posted-event references, and dimension selections); these need child tables rather
than JSON columns if the goal is fully relational storage.

### Target and acceptance

- SQL Server stores every persisted `AppData` collection in typed, relational columns; nested
  repeated values use child tables. No full-state JSON remains as the active persistence format.
- Preserve the current React `AppData` shape and workflows during the first cutover. The hosts may
  continue returning/accepting the state object while translating it to/from relational rows.
- Define primary keys, foreign keys, unique constraints, nullability, and decimal precision from
  the existing TypeScript types and real seed/saved data. Preserve existing IDs where the UI uses
  them; use composite keys where IDs are only unique within an entity or parent.
- Preserve seed initialization, reset-to-seed, import of the existing SQL snapshot, and both Node
  and IIS host behavior. Use SQL transactions so a failed save cannot leave a partial state.
- Retain the old snapshot as a rollback source until row counts, key relationships, and manual
  workflows are verified; remove it only after successful cutover and an agreed rollback window.

### Phases

1. Inventory every top-level `AppData` collection, nested array/object, seed source, ID scope,
   and mutation path. Classify data as shared reference/setup, entity configuration, or workflow
   records; confirm which seeded collections users can edit.
2. Define the relational model and SQL types, including child tables for journal lines and other
   repeated values. Document the key and relationship map before writing migrations.
3. Add an ordered, rerunnable SQL migration and a one-time importer from `DemoAppState`. Validate
   the source snapshot before importing and record migration completion transactionally.
4. Implement matching Node and ASP.NET Core persistence adapters. Read relational rows into the
   existing `AppData` response; save changes atomically. Keep the one-process deployment model.
5. Verify migrated data against the snapshot (collection counts, IDs, key references, and selected
   totals), then exercise load/edit/reload/reset and representative journal, accrual, recognition,
   revaluation, and export flows on IIS and Node.
6. After cutover is accepted, stop writing the snapshot and remove it in a later guarded migration
   after the rollback window. Do not add a separately deployed API or multi-user infrastructure.

Implementation choice to settle in phase 1: the current UI posts full-state replacements. For the
single-user demo, the first relational adapter can apply a full state inside one SQL transaction;
measure save time and write volume before adding incremental CRUD endpoints. If whole-state writes
are too slow, move persistence to changed-collection/record operations.

### Phase 1 source inventory (first pass)

`AppData` contains 40 top-level collections. The proposed table groups are:

- **Reference and accounting setup (20):** `currencies`, `parties`, `organizationUnits`,
  `legalEntities`, `accountingClasses`, `legalAccountingClasses`, `ledgers`,
  `legalAccountingLedgers`, `amountTypes`, `conditionValues`, `conditionValueOptions`,
  `eventCategories`, `accountingEvents`, `formulas`, `formulaConditions`, `conditions`,
  `accountingRules`, `pseudoAccounts`, `chartOfAccounts`, `coaNodes`.
- **Dimensions and entity setup (7):** `extAccountValues`, `extAccountParts`, `integrations`,
  `pseudoAccountCoaLinks`, `entityCoaNodes`, `pseudoAccountExtParts`, `ledgerSeries`.
- **Accounting activity (13):** `journals`, `accrualCodes`, `accrualItems`,
  `accrualScheduleLines`, `pendingMessages`, `revalueAccounts`, `revalueTransactions`,
  `exportBatches`, `journalEvents`, `recognitionCategories`, `recognitionPlans`,
  `recognitionStates`, `openingBalances`.

Repeated/nested data that needs relational child rows includes journal lines; recognition plan
lines, recognition schedules, and imported schedules; export batch journal lists and lines; posted
event agreement lines/invoices/references; formula event applicability; integration/pseudo-account
dimension selections; and pending-message/accrual condition inputs, amounts, and account values.
`LegalEntity` embeds three party reference snapshots, and accrual items embed message context; these
must become typed columns or related rows. Dynamic message attributes should use narrow value tables
with explicit parent and attribute keys, not a catch-all JSON column.

The seed is assembled from `seed.json` plus `extras.ts`, recognition/opening-balance modules, and
imported plans; `buildInitialData()` also derives and adjusts values, while `loadData()` applies
backward-compatible additions. Therefore the existing browser-built `AppData` is the migration
shape and seed source of truth for first cutover, not `seed.json` alone. On an empty database the
browser currently builds this state and posts it, so a relational adapter can preserve that path.

ID scope is not uniform: pseudo-account IDs are allocated per entity; journal GLI numbers are
allocated per legal entity; most UI-created row IDs use the maximum ID across their collection.
Keep scoped composite keys for the first cutover rather than changing the browser's ID allocation.
Child IDs such as journal line numbers and recognition agreement lines are parent-scoped. Validate
these scopes against the live snapshot before finalizing constraints. The current Node host creates
the snapshot table inline, while IIS relies on `Deploy/DEMO_Accounting.sql`; schema migration must
give both hosts one consistent, ordered database version path.

## Help content scope

The first help version should explain each major screen's purpose, how to use it, important accounting terms and fields, what the action changes, and where to see its result. Keep the help available without an API key or network connection. New or materially changed screens and workflows should update their help content in the same feature task. A screen/help registry should make missing help entries visible during development; the written guidance remains reviewed content rather than automatic prose generation.

## App layers

| Layer | Location | Responsibility |
|---|---|---|
| UI | `App/src/` | React screens and user interaction |
| Business | `App/src/business/` | Booking engine and accounting demo workflows |
| Data | `App/server/data/`, `App/src/data/` | SQL snapshot persistence and UI data client/reference data |
| Host | `App/server/`, `App/Host/` | Node/Express host for local/Docker; self-contained C# ASP.NET Core 8 out-of-process host for IIS. Each serves the built UI and same-origin SQL requests in one process. |

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
| 2026-09-30 | Use self-contained ASP.NET Core out-of-process hosting in the IIS package while retaining Node for local/Docker workflows | The IIS server cannot receive machine-level changes. Bundle the app runtime and avoid the unavailable in-process handler; IIS's ASP.NET Core Module remains required. |

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
- **2026-09-30** — Prepared deployment for SQL database `DEMO_Accounting` and IIS site
  `DEMO_Accounting`. Added a rerunnable SQL migration script and a ZIP with the target connection
  settings. The package is ignored by Git because it contains credentials. `DB_AUTO_CREATE=false`
  avoids database/schema permissions at app runtime. Ran the migration script twice against
  `AZS-PFSDEV-07.credit-dev.com`; both runs succeeded and the migration ledger contains one
  initial migration. The supplied SQL login is a sysadmin. IIS hosting mode/path and authenticated
  remote deployment access still need discovery.
- **2026-09-30** — User supplied IIS folder `F:\_WebSites\DEMO_Apps\Accounting` on
  `azs-pfwdev-02.credit-dev.com`. The F$ share is not accessible with the current Windows session;
  WinRM is reachable but unauthenticated. The root URL returns IIS 404, so the app is not yet
  serving from the site.
- **2026-09-30** — Retried the user's `file://AZS-PFWDEV-02/_WebSites/DEMO_Apps/Accounting` path.
  The short hostname doesn't resolve from this session, and the `_WebSites` share is unavailable
  through the server FQDN/IP; no server files were changed.
- **2026-09-30** — Rebuilt `Deploy/accounting-demo-deploy.zip` with Windows' ZIP creator after
  the user reported an extraction error. Windows `Expand-Archive` extracted the prior archive;
  the replacement opens with 12,722 entries and every entry stream reads successfully.
- **2026-09-30** — The user confirmed IIS app `DEMO_Accounting`, app pool `DEMO_Accounting`,
  `No Managed Code`, no URL Rewrite/web.config/Node/npm. The server already hosts .NET 10 apps and
  cannot be changed, so the deployable host is being moved to ASP.NET Core 10 within the App.
- **2026-09-30** — Built the ASP.NET Core 10 host and package. The user reported that the server's
  runtime list contains .NET 8 but not .NET 10 and that IIS cannot load the in-process handler.
- **2026-09-30** — Retargeted the IIS host to self-contained .NET 8 out-of-process to avoid both
  the unavailable .NET 10 runtime and failing in-process handler. The refreshed 48 MB ZIP passes
  integrity checks and includes the app-local runtime; IIS's ASP.NET Core Module is still required.
- **2026-09-30** — The user reported startup failure from a literal `\n` suffix in the generated
  `appsettings.Production.json`. Regenerated the file without the suffix, validated the JSON in
  the published folder and ZIP, and rechecked the 367-entry archive.
- **2026-09-30** — The user initially reported the app at
  `http://azs-pfsdev-07.credit-dev.com/DEMO_Accounting`; this URL was later corrected on
  2026-10-01. The app and SQL Server are on different hosts.
- **2026-09-30** — Added friendly app startup and database error handling. IIS and Node hosts no
  longer require a successful SQL connection before serving the UI. The error page offers retry,
  expandable/copyable browser and server diagnostics, and reports are scrubbed for passwords.
  React render/start errors use the same page. The IIS package maps ASP.NET Core 500.30 and 502.5
  process-start failures to a static friendly page; the server exception itself still has to be
  retrieved from the matching Windows Application event log entry.
- **2026-10-01** — User corrected the hosted URL to
  `https://azs-pfwdev-02.credit-dev.com/DEMO_Accounting` and confirmed that app changes are
  correctly stored in database `DEMO_Accounting` on `AZS-PFSDEV-07.credit-dev.com`. Updated the
  deployment status and source README; regenerate the root README from `App/README.md`.
- **2026-10-01** — Rebuilt `Deploy/accounting-demo-deploy.zip` from the current React production
  build and self-contained .NET 8 IIS host. Confirmed the packaged settings target
  `AZS-PFSDEV-07.credit-dev.com` / `DEMO_Accounting`; all 373 ZIP entries opened and read
  successfully. ZIP is ignored by Git because it contains credentials.
- **2026-10-01** — Traced current persistence through `AppData`, the browser state store, and both
  hosts. Replaced the former snapshot-maintenance task with a phased plan for fully relational SQL
  persistence while preserving the UI state contract through initial cutover.
- **Next** — Finish D3 phase 1 by checking collection/key assumptions against the live snapshot and
  mapping current mutation paths; then define and review the target relational schema.
