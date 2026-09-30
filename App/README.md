# Accounting Demo App

The App is a React + Vite + TypeScript demo hosted by a small Node process. It keeps UI,
business logic, and SQL Server data access together in one deployable project.

## Source layout

- `src/` — React UI, shared types, and seed/reference data.
- `src/business/` — event booking, accrual, recognition, and revaluation behavior.
- `src/data/` — demo-state client and reference data.
- `server/` — same-origin web host and SQL Server persistence.

The Node host serves `dist/` and stores the complete `AppData` object as a JSON snapshot in
SQL Server. This avoids turning the evolving prototype into a fixed relational schema. The
snapshot is intended for one demo user at a time.

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
