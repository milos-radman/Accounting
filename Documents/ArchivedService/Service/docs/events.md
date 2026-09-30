# Integration events

Contracts live in `Accounting.Contracts` and are versioned; breaking changes require a new
event type (§8.4). Consumers must be idempotent (§8.2).

## Consumed

### `AccountingEntryRequested`

Published by any domain that needs accounting (Contract, Receivables, Payables).
Queue: `accounting-entry-requests`. The message is self-contained: amounts are keyed by
**amount-type name**, condition attributes by **attribute name** — these names are the
stable contract between domains.

```json
{
  "messageId": "0195f7a2-7c1e-7a3b-9d1a-2f6e8c4b5a01",
  "tenantId": "demo",
  "legalEntityId": "d2c9…",
  "accountingClassCode": "PF",
  "accountingEventCode": "s",
  "bookingDate": "2024-10-05",
  "currencyCode": "EUR",
  "agreement": "1232",
  "agreementLine": 1,
  "portfolio": "23",
  "invoiceNumber": null,
  "amounts": {
    "Fixed Asset Value": 12500.00,
    "Total Plan Rent": 14640.00,
    "Total Plan Interest": 2140.00
  },
  "attributes": {
    "Accounting Type": "MG"
  }
}
```

Idempotency: `messageId` is recorded on the journal; redelivery returns the existing
journal and does not book twice.

## Published

### `JournalCreated`

Published through the transactional outbox after a journal is created.
Exchange: `accounting-events`.

```json
{
  "journalId": "0195f7a3-…",
  "gliNumber": 7414,
  "legalEntityId": "d2c9…",
  "accountingEventCode": "s",
  "bookingDate": "2024-10-05",
  "lineCount": 3,
  "totalDebit": 14640.00,
  "totalCredit": 14640.00,
  "hasDifference": false
}
```

Intended consumers: GL export integration, reporting, the dashboard difference counter.
