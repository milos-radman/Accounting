# Accounting Service (`oce-accounting`)

The Accounting domain service: receives accounting event messages from other domains
(Contract, Receivables, Payables), applies per-legal-entity booking rules and produces
GLI journals for export to the customer's general ledger.

Built per the platform **Service Architecture Blueprint**: .NET 10, Clean Architecture +
tactical DDD, Mediator (CQRS-lite), FluentValidation, EF Core 10 (code-first), Wolverine +
RabbitMQ, Serilog + OpenTelemetry, multi-tenant (one database per tenant, schema `accounting`).

## Owners

Product OCE / ProFinance5 — Accounting domain team.

## Run locally

```bash
docker compose up -d           # SQL Server, RabbitMQ, Seq
dotnet run --project src/Accounting.Api
```

Open <http://localhost:5000/scalar> for the API reference.
Local development uses `Authentication:Mode=Development` (fixed dev principal; tenant from
the `X-Tenant-Id` header, default `demo`). This mode refuses to start outside the
Development and Demo environments. The `demo` tenant's connection string lives in
`appsettings.Development.json` (`TenantRegistry`).

IIS demo hosting (`Demo` environment, migrate + seed on startup, `deploy-iis.ps1`) is
described in [`../DEMO_DEPLOYMENT.md`](../DEMO_DEPLOYMENT.md).

Apply migrations to the demo tenant database:

```bash
dotnet tool restore
dotnet ef database update --project src/Accounting.Infrastructure --startup-project src/Accounting.Api
```

## Tests

```bash
dotnet test tests/Accounting.UnitTests          # unit + ArchUnitNET architecture rules, no I/O
dotnet test tests/Accounting.AcceptanceTests    # Reqnroll features through the real API
dotnet test tests/Accounting.IntegrationTests   # requires Docker (Testcontainers SQL Server)
```

Acceptance tests use SQL Server via Testcontainers when Docker is available and fall back
to SQLite in-memory otherwise, so the suite runs everywhere; CI always uses SQL Server.

> **SpecFlow note.** SpecFlow was discontinued upstream; this service uses **Reqnroll**,
> its actively maintained drop-in successor. `.feature` files and step-binding syntax are
> unchanged from the blueprint's conventions.

## Layout (blueprint §3)

```
src/Accounting.Contracts        Integration-event contracts + shared kernel enums
src/Accounting.Domain           Aggregates, value objects, BookingEngine domain service
src/Accounting.Application      Commands/queries/handlers/validators, ports (folder-by-feature)
src/Accounting.Infrastructure   EF Core, tenancy, Wolverine consumer/outbox, seeding
src/Accounting.Api              Host: auth, tenant middleware, controllers, OpenAPI/Scalar
tests/…                         Unit (incl. architecture), Integration, Acceptance
```

## Key design points

- **Booking engine** (`Domain/Booking/BookingEngine.cs`) is a pure domain service:
  rules → formulas → condition rows → pseudo accounts. Fully unit-tested with the
  scenarios from the accounting rule workbook.
- **Idempotent consumption**: journals record the `SourceMessageId`; a redelivered
  message returns the existing journal (unique filtered index enforces it).
- **Periods**: bookings into a closed period are rejected (409) by the `LegalEntity` aggregate.
- **Transactional outbox**: enabled when `ConnectionStrings:WolverineDurability` is set
  (production). Without it (local/tests) events are published inline after save.
- **Chart of account**: each legal entity gets its own editable copy of a platform template
  (`CoaTemplateProvider`, generated from the accounting configuration workbook);
  pseudo accounts are placed on nodes via the `PseudoAccountCOA` link owned by the
  `EntityChartOfAccount` aggregate.
- **ShardKey** = TenantId, populated by the audit interceptor (§6/§9). No sharding
  mechanism yet, by design.

## Deviations from the blueprint (with justification)

| Deviation | Why |
|---|---|
| Reqnroll instead of SpecFlow | SpecFlow is discontinued and does not support .NET 10; Reqnroll is the community successor with identical Gherkin/bindings. |
| SQLite fallback in acceptance tests | Machines without Docker can still run the full API suite; CI uses SQL Server via Testcontainers. Requires a rowversion default shim in `AccountingDbContext` (SQLite only). |
| Inline event publish without durable store | Wolverine's DbContext outbox requires message persistence; local dev/tests run without it. Production config enables the real outbox. |
| Config-backed tenant registry | Stand-in for the central tenant-registry service (§6); same `ITenantConnectionStringProvider` port. |
| Wolverine runtime codegen | `WolverineFx.RuntimeCompilation` referenced; switch to pre-generated types (`TypeLoadMode.Static`) as a deploy optimisation later. |

## Documentation

- [docs/domain.md](docs/domain.md) — aggregates, invariants, business rules
- [docs/api.md](docs/api.md) — API notes, auth, error model
- [docs/events.md](docs/events.md) — integration events with payload examples
- [docs/runbook.md](docs/runbook.md) — operations
- `tests/Accounting.AcceptanceTests/Features/*.feature` — living functional specification
