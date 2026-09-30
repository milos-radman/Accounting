# OCE Accounting — inbound message contract

How other domains (Agreement, Asset, Receivables, Payables) send messages to the accounting domain.

## What's here
- `schemas/common.schema.json` — shared envelope + payload fragments (recognition plan, accrual line, dimension bag).
- `schemas/*.schema.json` — one JSON Schema (draft 2020-12) per event: Activation, Invoicing, AR Payment, AR Undo Payment, Agreement Change, Accrual. Each pins `accountingEventId` and carries a worked `examples` entry.
- `asyncapi.yaml` — AsyncAPI 3.0 description of the inbound channel and its messages, referencing the schemas above (open in an AsyncAPI viewer / Studio).
- `schemas/validate-request.schema.json` / `schemas/validate-response.schema.json` — the contract for the dry-run **validate** endpoint (see "Message validation" below).
- `reference-data.md` — the current valid codes (products, accounting types, amount codes, amount types, events). These are configured per entity — treat as reference data, not fixed enums.

## How a sender uses it
1. Pick the event → validate the payload against `schemas/<event>.schema.json` before sending.
2. Fill `conditionInputs` (by ConditionValue id) and `amounts` (by AmountType id) using the codes/ids from `reference-data.md` for the target entity.
3. Stamp `messageId` (correlation) and `schemaVersion`.
4. The accounting domain validates on receipt, books the journal, and publishes a Journal-posted event echoing `messageId`.

## Message validation — will it be rejected?
Validity has **two levels**; only the first is answerable by the sender alone.

**Level 1 — structural (local, no round-trip).** Validate the message against `schemas/<event>.schema.json` before sending (any JSON Schema validator, e.g. ajv). This catches malformed messages: missing fields, wrong types, wrong `accountingEventId`, bad recognition plan. A pass here means the *shape* is correct.

**Level 2 — semantic (needs the accounting domain).** A schema cannot know whether the message will actually book, because that depends on the accounting domain's current configuration:
- is the product / accounting type / amount code one this entity has configured?
- is there an accounting rule / formula for this event + entity that produces lines?
- will the resulting journal balance?

So a schema pass does **not** guarantee "won't be rejected." To be sure, use the **dry-run validate endpoint**:

```
POST /messages/validate      body: any event message   (schemas/validate-request.schema.json)
        → 200                 body: validate-response   (schemas/validate-response.schema.json)
```

The accounting domain runs the **same** resolution it would book (rules → formulas → conditions → accounts, plus balancing) **without persisting**, and returns whether it is `valid`, the journal lines it *would* book, whether it `balanced`, and an `issues` list. Any issue of severity `error` (e.g. `UNBALANCED`, `NO_RULE_MATCHED`, `UNKNOWN_PRODUCT`) means it would be rejected; `warning` (e.g. `DEFAULT_ACCOUNT_USED`) means it books but not as intended. This is the **Message Simulator engine exposed as an API** — the same preview the simulator shows before "Create journal".

Example rejected response:
```json
{
  "messageId": "AGR-ACT-700500-1-…",
  "valid": false, "status": "Rejected", "balanced": false,
  "totalDebit": 100.0, "totalCredit": 0.0, "difference": 100.0,
  "lines": [ /* … */ ],
  "issues": [
    { "severity": "error",   "code": "UNBALANCED",           "message": "Journal would not balance (difference 100.00)." },
    { "severity": "warning", "code": "DEFAULT_ACCOUNT_USED", "message": "No condition matched Accounting Type; used the formula default account." }
  ]
}
```

**Recommended flow:** schema-validate locally → dry-run `/messages/validate` for anything config-sensitive → send for real.

## Notes
- **Reference data is dynamic.** The codes and amount-type ids are configurable per legal entity; discover the current set from the accounting domain rather than hard-coding.
- **Versioning.** `schemaVersion` on the payload lets senders and accounting evolve independently; this contract is 1.0.
- Values are illustrative (prototype seed). Field shapes mirror the accounting domain's `EventMessage`.
