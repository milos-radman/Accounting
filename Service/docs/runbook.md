# Runbook — Accounting service

## Health & observability

- Liveness: `GET /health/live` · Readiness: `GET /health/ready`
- Logs: structured JSON on stdout (Serilog) → OTLP. Locally: Seq at <http://localhost:5341>.
- Traces/metrics: OpenTelemetry OTLP exporter (`accounting-api` resource). Azure Monitor in
  production, Seq/console locally.
- Every 500 response carries a `correlationId`; search logs on it.

## Common operations

### Apply database migrations (per tenant database)
Migrations run as a separate step before the new version takes traffic (§15.3):

```bash
dotnet ef database update --project src/Accounting.Infrastructure --startup-project src/Accounting.Api
```

For each tenant database, set `ACCOUNTING_DESIGN_CONNECTION` to that tenant's connection
string before running (design-time factory reads it).

### Add a tenant
Register the tenant's connection string under `TenantRegistry:Tenants:<tenantId>`
(configuration / Key Vault), create the database, apply migrations. Reference data
(classes, ledgers, events, amount types) seeds idempotently on first use.

### A journal shows a difference
Expected behaviour, not an incident: the source message did not balance. The journal is
flagged (`hasDifference`) and excluded from export. Resolution: business adds a correcting
line; the journal must balance before `MarkExported`.

### Duplicate message suspicion
Check the journal's `SourceMessageId` — redeliveries return the existing GLI and log
"Duplicate delivery … ignored". No action needed.

## Common alerts

| Symptom | First checks |
|---|---|
| 400 "Missing tenant" spike | Caller's token lacks `tenant_id` claim — IdP claim mapping |
| 409 on `POST /accounting-events` | Booking date in a closed period — check the entity's open period |
| 422 "No accounting rules are configured" | Rule setup missing for that entity/class/event |
| Broker init failure at startup | RabbitMQ unreachable — `ConnectionStrings:RabbitMq` |
| Messages piling up unprocessed | Wolverine durability DB (`ConnectionStrings:WolverineDurability`) reachable? Dead-letter queue depth? |

## Rollback

Images are immutable; roll back by redeploying the previous tag. Migrations are additive —
verify the previous version tolerates the current schema before rolling back past a
migration boundary.
