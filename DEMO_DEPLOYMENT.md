# Demo deployment — IIS + SQL Server

**This is the living status file for getting the Accounting service running on IIS against a
real SQL Server database.** It is updated as work progresses.

> **If you are an AI assistant starting in this repo: read this file first, then
> `CLAUDE.md`.** The status table below is the single source of truth for what is done and
> what comes next. When you finish a task, update its **Status** and the **Progress log** at
> the bottom in the same commit as the code change. Do not create additional planning,
> status, or TODO files — this one file is it.

---

## Goal (and explicit non-goal)

**Goal:** a running, demonstrable instance of the Accounting service on Windows/IIS, backed by
a real SQL Server database, good enough to **present, test, and investigate the concept**.

**Non-goal: this is NOT production hardening.** Do not add production concerns unless a demo
scenario actually fails without them. Specifically **out of scope**:

- Real OIDC / Entra ID identity — a fixed demo principal is fine.
- RabbitMQ, durable outbox, retries, dead-letter handling.
- HTTPS certificates, WAF, secret vaults, firewall rules.
- CI/CD pipelines, blue-green deploys, monitoring/alerting stacks.
- Performance, scale, load testing, multi-tenant isolation proof.

When in doubt, pick the option that is **fewer steps and less code**, and note the shortcut
with a `ponytail:` comment naming its ceiling. The demo box is single-user and trusted.

**What must still be correct** (a demo that lies is worthless): the booking engine's rules,
the data actually persisting to SQL Server, and GLI journal numbering.

---

## Environment facts (verified 2026-09-29 on the dev machine)

| Thing | State |
|---|---|
| IIS (`W3SVC`) | Running |
| ASP.NET Core Hosting Bundle | **.NET 6 only** — .NET 10 bundle needed |
| SQL Server | **Express 2008** (`MSSQL10.SQLEXPRESS`) — **too old**, EF Core 10 needs 2012+ |
| .NET SDK | 10.0.401 (runtimes 10.0.11 / 10.0.12 present) |
| Node.js | 24.15.0 / npm 11.16.0 |
| Docker | Not required for any demo task below |

Tasks marked **(admin)** need an elevated shell / installer rights.

---

## Current technology state

| Layer | Technology | Version |
|---|---|---|
| Service | .NET / ASP.NET Core | 10.0 (`net10.0`) |
| ORM | EF Core SqlServer | 10.0.9 — code-first, 1 migration `20260703150712_InitialCreate` |
| CQRS / validation | Mediator (source-gen) 3.0.2 / FluentValidation 12.1.1 | |
| Messaging | Wolverine + RabbitMQ 6.16.0 | **optional** — skipped when connection strings are empty |
| API docs | OpenAPI + Scalar 2.16.9 | Scalar mapped only in Development |
| Auth | JWT Bearer (OIDC) 10.0.9 | prod mode needs an IdP; `Development` mode refuses to start outside Development |
| Observability | Serilog 10 + OpenTelemetry 1.16.0 | OTLP exporter defaults to `localhost:4317` |
| Tenancy | Config-backed registry, DB-per-tenant, schema `accounting` | |
| Tests | 34 unit + 3 acceptance passing | Integration tests need Docker |
| `App/` | React 19.2 + Vite 8.1 + TS 6.0 | **standalone prototype — makes no API calls** |

---

## Blockers found

1. ~~Build broken — SonarAnalyzer `S8949` under `TreatWarningsAsErrors`.~~ **Fixed** (`c89be16`).
2. SQL Server 2008 is unsupported by EF Core 10 (needs 2012+).
3. IIS has the .NET 6 Hosting Bundle; .NET 10 apps need the .NET 10 bundle.
4. **A fresh database stays empty** — `Database.Migrate()` and `ReferenceDataSeeder` are
   called *only in tests*, never by the running app.
5. No production login path — `Oidc` mode has an empty `Authority`; `Development` mode throws
   outside the Development environment.
6. No `web.config` / IIS publish profile.
7. OTLP exporter logs connection errors with no collector running.

---

## Plan & status

Status values: `TODO` · `IN PROGRESS` · `DONE` · `BLOCKED` · `SKIPPED`

### Phase 0 — Repo baseline

| # | Task | Status | Notes |
|---|---|---|---|
| 0.1 | Push repo to GitHub | **DONE** | `milos-radman/Accounting`, branch `master` |
| 0.2 | Commits authored as Milos Radman | **DONE** | local + global git identity set |
| 0.3 | Fix the failing build (`S8949`) | **DONE** | `c89be16`; build clean, 34+3 tests green |

### Phase 1 — Server prep **(admin)**

| # | Task | Status | Notes |
|---|---|---|---|
| 1.1 | Install SQL Server 2022 Express (side-by-side with 2008) | TODO | + SSMS. Enable TCP/IP, Mixed Mode auth |
| 1.2 | Install .NET 10 Hosting Bundle, then `iisreset` | TODO | ANCM v2 must be the .NET 10 build |
| 1.3 | Create DB `tenant_demo` + login | TODO | or grant `IIS AppPool\Accounting` → `db_owner` |

### Phase 2 — Code changes (small, demo-grade)

| # | Task | Status | Notes |
|---|---|---|---|
| 2.1 | Migrate + seed on startup behind `Database:MigrateOnStartup` | TODO | ~10 lines; `ReferenceDataSeeder` is already idempotent |
| 2.2 | Demo auth that works outside Development | TODO | fixed principal w/ `tenant_id` claim. **Simplest alternative:** run IIS with `ASPNETCORE_ENVIRONMENT=Development` (zero code, also enables Scalar) |
| 2.3 | Make the OTLP exporter opt-in | TODO | silence errors when no collector runs |
| 2.4 | Add `web.config` + `appsettings.Production.json` | TODO | ANCM v2, `hostingModel="inprocess"`; tenant conn string + CORS |

### Phase 3 — Deploy to IIS

| # | Task | Status | Notes |
|---|---|---|---|
| 3.1 | `dotnet publish src/Accounting.Api -c Release -o C:\inetpub\Accounting` | TODO | |
| 3.2 | Create AppPool (**No Managed Code**, `LoadUserProfile=true`) + site binding | TODO | **(admin)** |
| 3.3 | Smoke test | TODO | `/health/ready`, `/scalar`, `POST /api/v1/accounting-events` → journal in SQL |

### Phase 4 — Demo surface (optional)

| # | Task | Status | Notes |
|---|---|---|---|
| 4.1 | Decide how the demo is shown | TODO | **Zero-work path: Scalar + SSMS.** `App/` is localStorage-only and will NOT show SQL data without new API wiring |
| 4.2 | Publish `App/` as a second IIS site | TODO | only if a UI is required for the presentation |

### Phase 5 — Deferred (explicitly out of scope)

Real OIDC · RabbitMQ + durable outbox · HTTPS certs · file/Seq log sinks · CI/CD.
Add only if a specific demo scenario fails without it.

---

## Decisions

| Date | Decision | Why |
|---|---|---|
| 2026-09-29 | Target the **Service**, not `App/`, for SQL+IIS | `App/` is a localStorage prototype with no API calls |
| 2026-09-29 | RabbitMQ/outbox stay off | empty connection strings already disable them cleanly |
| 2026-09-29 | Keep SQL 2008 installed, add 2022 side-by-side | avoids breaking whatever else uses the old instance |

---

## Progress log

- **2026-09-29** — Repo pushed to GitHub; git identity fixed. Surveyed the solution and the
  machine. Found and fixed the failing build (`S8949`, commit `c89be16`); `dotnet build`
  clean, csharpier clean, 34 unit + 3 acceptance tests passing. Wrote this plan.
  **Next up: Phase 1 (admin install of SQL Server 2022 Express + .NET 10 Hosting Bundle),
  which can run in parallel with Phase 2 code changes.**
