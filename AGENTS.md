# Project instructions

This repository is the Accounting demo app. Work in `App/`; `Documents/` is an archive of
reference material and earlier implementations. Do not change the archived Service as part
of demo work.

## Start here

1. Read [`DEMO_DEPLOYMENT.md`](DEMO_DEPLOYMENT.md) for current work, decisions, scope, and history.
2. Read [`README.md`](README.md) for the current demo capabilities and setup.
3. Read [`App/README.md`](App/README.md) and the relevant code before changing behavior.

`DEMO_DEPLOYMENT.md` is the only planning and work-log file. Keep its task statuses and
progress log current as work proceeds. Do not add another plan, status, or TODO file.

## Project shape

- `App/src/` — React and TypeScript UI.
- `App/src/business/` — accounting rules and demo business workflows.
- `App/src/data/` — seed/reference data and the browser-to-app data client.
- `App/server/data/` — SQL Server persistence for the Node development host.
- `App/server/` — the Node web host used by local development and Docker.
- `App/Host/` — the ASP.NET Core host used by the IIS deployment package.

The UI and its host are one App project and one deployable process in each environment: Node for
local development/Docker and ASP.NET Core for IIS. Keep SQL credentials on the server. Do not
connect browser code directly to SQL Server or add a separately deployed API/service.

## Working rules

- This is a flexible, presentable demo for prototyping and investigating business behavior,
  not a production system. Prefer the smallest change that preserves the demo's workflows.
- Keep the current UI capabilities and business behavior when replacing storage or reorganizing
  code. The SQL snapshot is single-user demo storage; do not add multi-user infrastructure
  unless the demo needs it.
- Update `App/README.md` in the same change whenever setup, capabilities, or user-visible
  behavior changes. `npm run dev`, `npm run build`, `npm run lint`, and `npm start` regenerate
  the GitHub root `README.md` from it automatically.
- Preserve useful historical/reference files under `Documents/`; do not delete archived work.
- Do not add or run automated tests unless the user requests testing. Build/lint checks may be
  used to verify a code change when appropriate.
