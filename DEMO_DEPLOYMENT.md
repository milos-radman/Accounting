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
| LocalDB | 2012 + 2025 installed, **both fail to start** — disk sector-size issue (see blocker 8) |
| .NET SDK | 10.0.401 (runtimes 10.0.11 / 10.0.12 present) |
| Node.js | 24.15.0 / npm 11.16.0 |
| Docker Desktop | 29.6.2 — installed, starts without admin. Runs a SQL Server 2022 container fine |
| Shell elevation | Agent sessions are **not** elevated — admin tasks are handed to the user |

Tasks marked **(admin)** need an elevated shell / installer rights.

---

## Current technology state

| Layer | Technology | Version |
|---|---|---|
| Service | .NET / ASP.NET Core | 10.0 (`net10.0`) |
| ORM | EF Core SqlServer | 10.0.9 — code-first, 1 migration `20260703150712_InitialCreate` |
| CQRS / validation | Mediator (source-gen) 3.0.2 / FluentValidation 12.1.1 | |
| Messaging | Wolverine + RabbitMQ 6.16.0 | **optional** — skipped when connection strings are empty |
| API docs | OpenAPI + Scalar 2.16.9 | Scalar mapped in Development **and Demo** |
| Auth | JWT Bearer (OIDC) 10.0.9 | prod mode needs an IdP; `Development` mode refuses to start outside Development |
| Observability | Serilog 10 + OpenTelemetry 1.16.0 | OTLP exporter defaults to `localhost:4317` |
| Tenancy | Config-backed registry, DB-per-tenant, schema `accounting` | |
| Tests | 34 unit + 3 acceptance + 3 integration passing | Integration tests need Docker running |
| `App/` | React 19.2 + Vite 8.1 + TS 6.0 | **standalone prototype — makes no API calls** |

---

## Blockers found

1. ~~Build broken — SonarAnalyzer `S8949` under `TreatWarningsAsErrors`.~~ **Fixed** (`c89be16`).
2. SQL Server 2008 is unsupported by EF Core 10 (needs 2012+).
3. IIS has the .NET 6 Hosting Bundle; .NET 10 apps need the .NET 10 bundle.
4. ~~**A fresh database stays empty** — migrations/seed only ran in tests.~~ **Fixed** (2.1).
5. ~~No login path outside Development.~~ **Fixed** via `Demo` environment (2.2).
6. ~~No `web.config`.~~ **Not needed** — `dotnet publish -p:EnvironmentName=Demo` generates it.
7. ~~OTLP exporter noise.~~ **Not a problem** — verified: no console output without a collector.
8. **Disk sector size.** This machine's NVMe reports 16 KB sectors; SQL Server/LocalDB refuse
   to start (`error 5178`). Installing SQL Server *on this machine* needs the documented
   registry fix first (**admin + reboot**):
   `reg add HKLM\SYSTEM\CurrentControlSet\Services\stornvme\Parameters\Device /v ForcedPhysicalSectorSizeInBytes /t REG_MULTI_SZ /d "* 4095" /f`
   Not an issue for a SQL Server on another machine, or in Docker.
9. ~~**Service never worked against a real DB outside tests.**~~ **Fixed** (2.1): Wolverine's EF
   integration (a) registers `DbContextOptions` as a singleton resolved without a tenant and
   (b) requires the durable message store. Tests hid this by replacing the registration. Now a
   plain `AddDbContext` is used unless `ConnectionStrings:WolverineDurability` is set.
10. **No API to maintain booking rules/formulas** — only legal entities, pseudo accounts and
    COA have endpoints. Worked around for the demo by seeding sample rules (2.5).

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

Pick **one** SQL Server option for 1.1 (any SQL Server **2012+** works):

- **A. A SQL Server on another machine** (matches the goal best). Needs a DB + SQL login.
- **B. SQL Server 2022 Express on this machine.** Apply the sector-size registry fix
  (blocker 8) and reboot *first*, then install as named instance `SQL2022`.
- **C. SQL Server 2022 in Docker** (already verified working here, zero install):
  `docker run -d --name acct-demo-sql --restart unless-stopped -e ACCEPT_EULA=Y -e "MSSQL_SA_PASSWORD=<pwd>" -p 14333:1433 mcr.microsoft.com/mssql/server:2022-latest`
  Docker Desktop must be running for the site to work.

| # | Task | Status | Notes |
|---|---|---|---|
| 1.1 | Provide a SQL Server 2012+ (option A, B or C above) | TODO | keep SQL 2008 as is |
| 1.2 | Install .NET 10 Hosting Bundle, then `iisreset` | TODO | https://dotnet.microsoft.com/download/dotnet/10.0 → "Hosting Bundle" |
| 1.3 | Login with rights to create DB `tenant_demo` | TODO | the app creates the DB + schema itself on first start. SQL auth is simplest; for Windows auth grant `IIS AppPool\AccountingDemo` (`dbcreator`, or `db_owner` on a pre-created DB) |

### Phase 2 — Code changes (small, demo-grade)

| # | Task | Status | Notes |
|---|---|---|---|
| 2.1 | Migrate + seed on startup behind `Database:MigrateOnStartup` | **DONE** | `Infrastructure/Seeding/DatabaseInitializer.cs`. Also fixed blocker 9 in `DependencyInjection.cs` |
| 2.2 | Demo auth that works outside Development | **DONE** | new `Demo` environment reuses the fixed dev principal (`X-Tenant-Id` header, default `demo`) + Scalar. Config: `appsettings.Demo.json` |
| 2.3 | Make the OTLP exporter opt-in | SKIPPED | verified unnecessary — no errors/noise without a collector |
| 2.4 | `web.config` + Demo settings | **DONE** | `web.config` is generated by publish; only `appsettings.Demo.json` added. CORS skipped — Scalar is same-origin |
| 2.5 | Seed a bookable sample legal entity (`Database:SeedDemoData`) | **DONE** | "ALS NLD", GLI serie 7414, 3 pseudo accounts, 3 Activation rules — the `PostAccountingEvent.feature` scenario. Only when the DB has no legal entities |
| 2.6 | IIS deploy script | **DONE** | `Service/deploy-iis.ps1` — **untested** (needs admin); parses, JSON rewrite verified |

**Verified 2026-09-29** by running the API with `ASPNETCORE_ENVIRONMENT=Demo` against a SQL
Server 2022 container: migration + seed on first start, `/health/ready` 200, `/scalar` 200,
Activation message → journal GLI 7414 with 3 lines, debit = credit = 14 640, redelivery returns
`wasAlreadyProcessed: true`, restart does not duplicate seed data. 34 unit + 3 acceptance +
3 integration tests pass.

### Phase 3 — Deploy to IIS **(admin)**

| # | Task | Status | Notes |
|---|---|---|---|
| 3.1 | Run `Service\deploy-iis.ps1` elevated | TODO | publishes, creates AppPool (No Managed Code) + site on port 8080; re-run to redeploy. Example below |
| 3.2 | Smoke test | TODO | see "Demo script" below |

```powershell
# elevated PowerShell, from the Service folder
.\deploy-iis.ps1 -ConnectionString "Server=<host>[,port];Database=tenant_demo;User Id=<login>;Password=<pwd>;TrustServerCertificate=true"
```

If the site returns HTTP 500.x: set `stdoutLogEnabled="true"` in
`C:\inetpub\AccountingDemo\web.config`, create a `logs` folder there, recycle the pool and read
`logs\stdout_*.log`. 500.31/500.19 almost always means task 1.2 is not done.

### Demo script (smoke test = presentation)

1. `http://<host>:8080/scalar` — API reference, try requests live (no login needed).
2. `GET /api/v1/legal-entities` → the seeded "ALS NLD" (copy its `id`).
3. `POST /api/v1/accounting-events` with a **new** `messageId`:
   `{"messageId":"<new guid>","legalEntityId":"<id>","accountingClassCode":"PF","accountingEventCode":"s","bookingDate":"2024-10-05","currencyCode":"EUR","agreement":"1232","agreementLine":1,"portfolio":"23","amounts":{"Fixed Asset Value":12500,"Total Plan Rent":14640,"Total Plan Interest":2140},"attributes":{"Accounting Type":"MG"}}`
   → 201, balanced journal.
4. Same request again → 200 `wasAlreadyProcessed: true` (idempotency).
5. `GET /api/v1/journals/{gliNumber}?legalEntityId=<id>` → lines on 140000 / 192101 / 192401.
6. `bookingDate` `2024-09-15` → 409 (closed period). Show the rows in SSMS: schema `accounting`.

### Phase 4 — Demo surface (optional)

| # | Task | Status | Notes |
|---|---|---|---|
| 4.1 | Decide how the demo is shown | TODO | **Zero-work path: Scalar + SSMS** (the demo script above). `App/` is localStorage-only and will NOT show SQL data without new API wiring |
| 4.2 | Publish `App/` as a second IIS site | TODO | only if a UI is required for the presentation |
| 4.3 | Rule/formula maintenance API | TODO | only if the demo must show *configuring* rules; today they come from the seed (blocker 10) |

### Phase 5 — Deferred (explicitly out of scope)

Real OIDC · RabbitMQ + durable outbox (fix Wolverine singleton `DbContextOptions` first, see
blocker 9) · HTTPS certs · file/Seq log sinks · CI/CD (note: `Service/.github/workflows/ci.yml`
is not in the repo-root `.github/`, so GitHub never runs it).
Add only if a specific demo scenario fails without it.

---

## Decisions

| Date | Decision | Why |
|---|---|---|
| 2026-09-29 | Target the **Service**, not `App/`, for SQL+IIS | `App/` is a localStorage prototype with no API calls |
| 2026-09-29 | RabbitMQ/outbox stay off | empty connection strings already disable them cleanly |
| 2026-09-29 | Keep SQL 2008 installed; any SQL Server 2012+ is fine (A/B/C in Phase 1) | avoids breaking whatever else uses the old instance |
| 2026-09-29 | `Demo` environment instead of running IIS as `Development` | Development would load `appsettings.Development.json` (RabbitMQ on localhost) and dev-only behaviour |
| 2026-09-29 | Demo rules seeded in code, no rule API | the only way to get a bookable DB without building a new feature |

---

## Progress log

- **2026-09-29** — Repo pushed to GitHub; git identity fixed. Surveyed the solution and the
  machine. Found and fixed the failing build (`S8949`, commit `c89be16`); `dotnet build`
  clean, csharpier clean, 34 unit + 3 acceptance tests passing. Wrote this plan.
- **2026-09-29** — Phase 2 done (2.1, 2.2, 2.4, 2.5, 2.6; 2.3 skipped). Found and fixed
  blocker 9 (the service could not use a real DB outside tests) and documented blockers 8
  and 10. Verified end-to-end against SQL Server 2022 in Docker (see Phase 2 "Verified").
  **Next up (user, elevated): Phase 1 — choose SQL option A/B/C, install the .NET 10 Hosting
  Bundle — then Phase 3: run `Service\deploy-iis.ps1` and walk the demo script.**
