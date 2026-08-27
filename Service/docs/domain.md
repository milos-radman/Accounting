# Accounting domain model

Source: *Accounting Domain specification v0.9* and the accounting rule configuration
workbook (`Accounting_Claude/Accounting Rule Config.xlsx`).

## Aggregates

### LegalEntity
The top level for accounting; controls all accounting actions for events received from
other domains. Holds the GLI number serie, base currency and period state.

**Invariants**
- Must have a name; the GLI number serie is positive.
- `ReserveGliNumber()` hands out strictly increasing GLI numbers.
- `CloseCurrentPeriod()` advances open/closed atomically.
- A booking whose date falls in a closed period is rejected (`EnsureBookingAllowed`).
- End of month cannot run for a period at or before the last processed one.

### Journal (GLI)
The set of transaction lines produced for one accounting event. Append-only.

**Invariants**
- At least one line; every line books a non-negative amount on exactly one side.
- An unbalanced journal is allowed but flagged (`HasDifference`) — the dashboard surfaces it;
  correction happens by adding lines, never by mutating existing ones.
- An exported journal is immutable; a journal with a difference cannot be exported.
- `SourceMessageId` is unique: one integration message creates at most one journal (idempotency).

### EntityChartOfAccount
A legal entity's own chart of account, copied from a platform template when the entity is
created. Owns the node tree and the pseudo-account placements (**PseudoAccountCOA**).

**Invariants**
- A node can only be removed when it has no sub-nodes and no placed accounts.
- A pseudo account is placed on at most one node.
- New node order numbers are derived from the parent (e.g. next child of `1.5` is `1.5.4`).

### Formula
The main building block for accounting: reads one amount type from the message and resolves
the pseudo account, either directly or through condition rows
(IF *attribute* = *value* THEN account, with multi-level AND guards and OR branches).

## Entities / supporting types

- **PseudoAccount** — entity-owned account register; unique code per entity; maps to the
  external GL account. Imported in bulk from the customer's general ledger.
- **AccountingRule** — (legal entity, accounting class, ledger, accounting event) → formula + side.
- Reference data: **AccountingClass** (PF, AR-Inv, AR-Pay, AP-Inv, AP-Pay), **Ledger**
  (Local Legal, US GAAP, Common), **AccountingEvent** (activation `s`, invoicing `i`, … incl.
  reversal events), **AmountType** and **ConditionAttribute** — the *names* of the last two are
  the stable cross-domain message contract.

## Value objects

- **Period** — YYYYMM with next/previous and ordering; used for open/closed period control.
- **Money** — amount + currency; cross-currency arithmetic is rejected.

## Domain service: BookingEngine

Pure function from (rules, formulas, pseudo accounts, message values) → journal line drafts:

1. For each rule of the entity/class/event: look up the formula's amount type in the message;
   zero/absent → the rule does not book.
2. Resolve the account: walk the formula's condition rows in sequence — a level-1 row starts a
   branch, rows without accounts are guards (all must match), the first matching account row on
   the rule's side wins. Fall back to the formula's default account. No account → no line.
3. Emit the line with ledger name, formula code, amount type and a human-readable resolution
   trace (kept on the journal line for auditability).

## Key business rules in plain English

- Booking configuration is defined per legal entity; the same event can book differently into
  different ledgers (e.g. Local Legal vs US GAAP).
- Messages are self-contained: they carry every amount and attribute the rules may need.
- A message for a closed period is a conflict, not a silent skip.
- Journal numbering follows the entity's GLI number serie.
