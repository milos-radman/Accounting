# Copilot instructions — Accounting Domain

**Start with [`DEMO_DEPLOYMENT.md`](../DEMO_DEPLOYMENT.md)** in the repository root. It is the
living status file for the active work (demo deployment to IIS + SQL Server) and holds the
current progress, the next steps and the scope rules. Update its status table and progress
log in the same commit as any change you make. It is the **only** planning file — do not
create additional plan, status or TODO documents.

Supporting context:

- [`CLAUDE.md`](../CLAUDE.md) — repo layout, build/test commands, conventions.
- [`README.md`](../README.md) — domain background and how to read the repo.
- [`Service/README.md`](../Service/README.md) — service architecture and documented deviations.

## Scope rule

The goal is a **presentable demo** for testing and concept investigation — **not** a
production system. Real OIDC, RabbitMQ/outbox, HTTPS certs, CI/CD and hardening are
explicitly out of scope unless a demo scenario fails without them. Prefer the fewest steps
and the least code that genuinely works.

Do not simplify away correctness that the demo depends on: the booking engine rules, data
actually persisting to SQL Server, and GLI journal numbering.

## Working in `Service/`

- .NET 10. `dotnet build` runs analyzers as errors — keep it clean.
- `dotnet test tests/Accounting.UnitTests` and `tests/Accounting.AcceptanceTests` need no Docker.
- Run `dotnet csharpier format .` before finishing.
- Architecture rules are executable tests; if one fails, fix the dependency, never the test.
