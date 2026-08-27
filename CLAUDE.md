# Accounting Domain — orientation for Claude Code sessions

Two codebases live here, built from the specification material in this folder
(spec docx v0.9, `Accounting_Example.pptx` UI guidance, `Accounting Rule Config.xlsx`,
entity model PNGs):

## App/ — React UI prototype
- Vite + React + TypeScript, run with `npm run dev` (port 5173/5174).
- Seed data generated from the Excel into `src/data/seed.json`; edits persist in
  localStorage key `accounting-domain-data-v1` (delete it to reset).
- Includes a booking-engine simulator (`src/engine.ts`) — the reference implementation
  later ported to the .NET service.
- It is a guidance prototype: keep it working, but the Service is the production target.

## Service/ — production .NET 10 service
- Follows the platform Service Architecture Blueprint (`SERVICE_ARCHITECTURE.md`, copy in
  the user's Downloads; treat it as binding). Clean Architecture:
  Contracts / Domain / Application / Infrastructure / Api + Unit/Integration/Acceptance tests.
- Read `Service/README.md` first — it lists the documented deviations
  (Reqnroll not SpecFlow, SQLite acceptance fallback, inline publish without durable outbox).
- Build/test (requires .NET 10 SDK, installed on this machine):
  - `dotnet build` — analyzers run as errors; keep it clean.
  - `dotnet test tests/Accounting.UnitTests` and `tests/Accounting.AcceptanceTests` run
    without Docker; `tests/Accounting.IntegrationTests` needs Docker (Testcontainers).
  - `dotnet csharpier format .` before finishing — CI rejects unformatted code.
- Architecture rules are executable (`tests/Accounting.UnitTests/Architecture`); if one
  fails, fix the dependency, never the test.
- The booking engine (`Domain/Booking/BookingEngine.cs`) is pure and fully unit-tested;
  its scenarios come from the Excel rule workbook — change behavior only with a test.

## Conventions
- OneDrive locks files that are open in Office — copy pptx/xlsx to a temp dir before
  parsing them programmatically.
- Amount-type and condition-attribute *names* are the cross-domain message contract;
  renaming them is a breaking change.
- GLI numbers are unique per legal entity, not per tenant.
