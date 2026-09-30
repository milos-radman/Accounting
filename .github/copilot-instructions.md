# Copilot instructions — Accounting Demo

Read [`AGENTS.md`](../AGENTS.md) for the project rules, then [`DEMO_DEPLOYMENT.md`](../DEMO_DEPLOYMENT.md)
for the active work and decisions. The root [`README.md`](../README.md) describes the current
demo and setup; keep it updated in the same change whenever those change.

Work in `App/`. `Documents/` preserves the earlier service, integration contracts, and domain
reference material. Do not modify the archived Service as part of demo work.

Keep the App simple and flexible: one Node web process serves the React UI, contains its business
modules, and accesses SQL Server. Do not add a separately deployed API or connect browser code
directly to SQL Server. Preserve existing demo screens and workflows when changing persistence.

`DEMO_DEPLOYMENT.md` is the only planning and work-history file. Update its status and progress
log as work proceeds; do not add separate plan, status, or TODO files.
