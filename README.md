# One Credit Engine — Accounting Domain

> **Current activity:** getting the service demo-ready on IIS + SQL Server.
> Status and next steps live in **[`DEMO_DEPLOYMENT.md`](DEMO_DEPLOYMENT.md)**.

The accounting (ledger) domain of Tieto's One Credit Engine: it receives business-event
messages from other domains (Agreement, Asset, Receivables, Payables), applies each legal
entity's booking rules, and produces GLI journals for export to the customer's general ledger.

This repository holds three things that belong together:

| Folder | What it is | For |
|---|---|---|
| **`App/`** | The **prototype** — a React + Vite single-page app that *runs the real rules* (account resolution, recognition cutoff, accruals, terminations, all the screens). | The executable **specification** of behaviour. |
| **`Service/`** | The **production service** — .NET 10, Clean Architecture + DDD, EF Core, Wolverine + RabbitMQ, multi-tenant. Already scaffolded. | The system being **built**. |
| **`message-contract/`** | The **inbound message contract** — JSON Schema per event, AsyncAPI, reference data, and the dry-run `validate` schemas. | How other domains **integrate**. |

Plus design and handover documents at the root (`*.docx`, `*.pptx`, `*.xlsx`).

## How to read this repo

The **prototype is the source of truth for behaviour** — when a question comes up about how
something should work, the answer is "whatever `App/` does". Build `Service/` against it.
Start with **`OCE-Developer-Handover.docx`** and **`OCE-Data-Model-Outline.docx`**.

## Run the prototype (`App/`)

Node.js required.

```bash
cd App
npm install      # first time only
npm run dev      # serves on http://localhost:5173
```

All data is seeded and kept in the browser; **Settings → Reset data** rebuilds from the seed.
Best first look: **Journals → Message simulator** (a message becoming a journal), then walk one
agreement lifecycle (Activation → Invoicing → AR Payment → Monthly Booking).

## Run the service (`Service/`)

.NET 10 + Docker. See **`Service/README.md`** for details.

```bash
cd Service
docker compose up -d                         # SQL Server, RabbitMQ, Seq
dotnet run --project src/Accounting.Api       # API + Scalar reference at http://localhost:5000/scalar
```

## Key documents

- `OCE-Accounting-Domain-Overview.docx` — what the application does (processes & functionality).
- `OCE-Developer-Handover.docx` — how to take the prototype into production (keep vs discard, invariants, run guide).
- `OCE-Data-Model-Outline.docx` — candidate tables / ER model from the prototype's `types.ts`.
- `OCE-Agreement-to-Accounting-Messages.docx` — worked message examples (Activation, Invoicing, payments, accruals) + the Prepaid-vs-Accrued future change.
- `message-contract/` — the machine-readable contract (schemas + AsyncAPI) and reference data.

## Notes

- Everything is configured **per legal entity** — treat that partition as first-class.
- The engine is deterministic (message in → journal out); the Simulator and a dry-run `validate`
  endpoint are the same logic.
- Prototype figures, account numbers and codes are **illustrative**.
