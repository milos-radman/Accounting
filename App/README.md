# Accounting Demo App

The App is a React + Vite + TypeScript demo. Local development and Docker use the Node host;
the IIS deployment package uses a self-contained ASP.NET Core 8 out-of-process host, so the server
does not need Node.js or an installed .NET runtime.
Both hosts serve the same UI and SQL snapshot endpoints within this App project.

## Technology

- **UI:** React 19, TypeScript, and Vite; the deployable UI is a static single-page app.
- **Local development and Docker host:** Node.js 24+, Express 5, and the `mssql` SQL Server
  driver.
- **IIS deployment host:** C# and ASP.NET Core 8, published self-contained and out-of-process
  behind IIS's ASP.NET Core Module. IIS serves the app under its `No Managed Code` pool.
- **Persistence:** Microsoft SQL Server stores the complete app state as JSON in
  `dbo.DemoAppState`.

## Source layout

- `src/` — React UI, shared types, and seed/reference data.
- `src/business/` — event booking, accrual, recognition, and revaluation behavior.
- `src/data/` — demo-state client and reference data.
- `server/` — Node host for local development and Docker.
- `Host/` — ASP.NET Core host used by the IIS package.

The hosts serve `dist/` and store the complete `AppData` object as a JSON snapshot in SQL Server.
This avoids turning the evolving prototype into a fixed relational schema. The snapshot is
intended for one demo user at a time.

## Run the full demo

From this folder, run `docker compose up --build` and open
[http://localhost:5173](http://localhost:5173). Docker starts SQL Server 2022 and the App.
The App creates the `AccountingDemo` database and `dbo.DemoAppState` table if needed.

## Develop locally

Use Node.js 24+, npm, and Docker Desktop or SQL Server 2022. The SQL login needs permission
to create the demo database and its state table.

1. Copy `.env.example` to `.env` and set the database host, port, name, user, and password.
   For the included SQL container, use host `localhost`, port `14333`, and the compose demo
   password.
2. Start the included database with `docker compose up -d sql`, unless using another SQL Server.
3. Run `npm ci` once, then `npm run dev`. This starts Vite and the Node host together.
4. Open [http://localhost:5173](http://localhost:5173).

Run `npm run build` to create the production UI. `npm start` serves that build and requires the
same database environment variables.

## IIS deployment package

The current hosted app URL, as reported by the user, is
[http://azs-pfsdev-07.credit-dev.com/DEMO_Accounting](http://azs-pfsdev-07.credit-dev.com/DEMO_Accounting).
It uses SQL Server at `AZS-PFSDEV-07.credit-dev.com`, database `DEMO_Accounting` (TCP port 1433).
The hosted URL and database currently share the same server name.

The package and repeatable database script are in the repository's root `Deploy/` folder.
`DEMO_Accounting.sql` creates the `DEMO_Accounting` database and state table and tracks applied
schema migrations so it can be rerun safely. Add future schema changes as new guarded migrations
in that script. The ZIP contains the built UI, ASP.NET Core 8 host, IIS `web.config`, and target
SQL connection settings; extract it to the IIS application's physical folder.

The IIS application pool is `DEMO_Accounting` and can remain `No Managed Code`. The package runs
out-of-process through IIS's ASP.NET Core Module. That module must already be installed; the package
does not need a .NET runtime, Node.js, URL Rewrite, or ARR. The SQL create script runs separately;
the web app only reads and writes `dbo.DemoAppState`. The ZIP contains credentials and is ignored
by Git; treat it as a secret. The supplied SQL login currently has `sysadmin` rights, so replace
it with an app-only login before exposing the demo beyond its trusted internal audience.

## Data and reset

Seed data and illustrative examples live under `src/data/`. Existing browser storage is imported
once when the SQL snapshot is first created; after that, SQL Server is the durable source. The
**Settings → Reset data** page restores seeded defaults and saves them to SQL Server.

The app saves the full state after edits. A status indicator shows whether the latest snapshot
was saved. If the database is unavailable at startup, the UI waits for a successful connection
and offers a retry.

## Main workflows

- Dashboard and legal entity setup.
- Chart of accounts, dimensions, pseudo accounts, formulas, and accounting rules.
- Accounting-event simulator, accruals, recognition, and revaluation.
- Manual journals, journal and transaction searches, pending messages, and posted events.
- GL integrations and export configuration, reports, and reset-to-seed settings.
