# API notes

The OpenAPI document is generated at runtime by `Microsoft.AspNetCore.OpenApi`:

- Spec: `GET /openapi/v1.json`
- Browser UI (Development only): `GET /scalar`

## Authentication

All endpoints require a bearer token (fallback policy). The IdP is deployment-dependent
(§7 of the blueprint): Entra ID on SaaS, Keycloak self-hosted — only
`Authentication:Authority` differs. Required claims: `sub`, `tenant_id`, `scope`.

Policies (`Api/Auth/AuthorizationPolicies.cs`):

| Policy | Used by |
|---|---|
| `accounting:read` | All GET endpoints |
| `accounting:configure` | Legal entity / pseudo account / chart-of-account maintenance |
| `accounting:book` | `POST /api/v1/accounting-events` |

Local development: `Authentication:Mode=Development` authenticates every request as a dev
user; tenant comes from the `X-Tenant-Id` header (default `demo`). Refused outside the
Development environment.

## Multi-tenancy

The `tenant_id` claim selects the tenant database. Requests without a resolvable tenant are
rejected with `400` before reaching any handler. `/health/*`, `/openapi`, `/scalar` are exempt.

## Endpoints (v1)

| Method & path | Purpose |
|---|---|
| `GET/POST /api/v1/legal-entities` | List / create (creates the entity's chart-of-account copy) |
| `GET /api/v1/legal-entities/{id}` | Entity detail incl. periods and next GLI |
| `POST /api/v1/legal-entities/{id}/close-period` | Close the open period |
| `GET/POST /…/{id}/pseudo-accounts` | List / register |
| `POST /…/{id}/pseudo-accounts/import` | Bulk import from a GL export |
| `DELETE /…/{id}/pseudo-accounts/{accountId}` | Remove (blocked while placed on the chart) |
| `GET /…/{id}/chart-of-account` | Node tree with placed accounts |
| `POST/PUT/DELETE /…/chart-of-account/nodes…` | Maintain nodes |
| `POST/DELETE /…/chart-of-account/nodes/{nodeId}/accounts…` | Place / remove placements |
| `GET /api/v1/journals` | Search (entity, difference-only, dates, GLI, paging) |
| `GET /api/v1/journals/{gli}?legalEntityId=` | Journal detail. GLI numbers are unique per entity — pass `legalEntityId` when series overlap; ambiguous lookups return 409 |
| `POST /api/v1/accounting-events` | Synchronous booking entry point (same use case as the bus consumer) |

## Error model

RFC 7807 `ProblemDetails` everywhere (§5.2):

| Condition | Status |
|---|---|
| Validation failure (FluentValidation) | 400 |
| Missing/unknown tenant | 400 |
| Resource not found | 404 |
| State conflict (closed period, node has children, duplicate placement, ambiguous GLI) | 409 |
| Business rule violated (no rules configured, no lines produced, invalid period) | 422 |
| Unexpected | 500 — correlation id in the body, full exception only in logs |
