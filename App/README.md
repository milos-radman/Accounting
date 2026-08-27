# Accounting Domain — clickable application

A React + Vite + TypeScript implementation of the Accounting domain, built from:

- **Accounting Domain specification.docx** (v0.9) — domain description and entity semantics
- **Accounting entity model.png** / **Legal Entity_connection Flow.png** — the entity model
- **Accounting Rule Config.xlsx** — full configuration for the 3 legal entities (seed data)
- **Accounting_Example.pptx** — UI guidance (dashboard, legal entity workspace, journals, dialogs)

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173 (or the port Vite prints).

## What is included

| Area | Content |
|------|---------|
| **Dashboard** | One tile per legal entity (ALS NLD / SFB / ITA) with End of month, GL-interface, Open period and Journal Differences. All parts are clickable. |
| **Legal entity** | List with expandable owner details and Add dialog. Entity workspace with side menu: entity info (+ Action → End of month / Close period dialogs), Integration (GL04 export + schedule), Chart of account (US GAAP template tree, 136 nodes), Pseudo accounts (32 per entity), Ext. account parts, Formulas (57) with IF/THEN condition editor, Accounting rules (136) with filtering, grouping and expandable conditions. |
| **Journals** | GLI search with filters (incl. Difference only), GLI detail with transaction lines, expandable line info, difference indication and Add transaction line; Manual journal (balanced entry creates a new GLI); Transaction search. |
| **Settings** | Accounting classes, Amount types (30), Ledgers + assignment matrix, Chart of account templates, External account values (26), Accounting events (25 incl. reversals). |
| **Reports** | Transaction list and Total reconciliation per pseudo account. |

## Data

- Seed data is generated from the Excel into `src/data/seed.json`.
- Journals/integrations/external account parts are illustrative examples in `src/data/extras.ts`
  (the Excel has no journal data).
- Edits (add legal entity, formulas, conditions, rules, pseudo accounts, journal lines,
  end of month / close period) persist in browser **localStorage**.
  Clear the `accounting-domain-data-v1` key to reset to seed data.
