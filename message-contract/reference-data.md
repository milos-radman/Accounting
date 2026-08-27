# Reference data (snapshot)

These values are **configured per legal entity** in the accounting domain (Message attribute codes,
amount types, accounting events). They are *reference data, not fixed enums* — a sender should
discover the current valid set from the accounting domain rather than hard-code them. Snapshot below
is from the prototype seed for illustration.

## Accounting events (`accountingEventId`)
1 Activation · 2 Invoicing · 3 AR Payment · 19 Agreement Change · 28 AR Undo Payment · 29 Accrual · 21 Monthly Booking (internal) — full list in the app.

## Accounting classes (`accountingClassId`)
14 PF-Agreement · 15 AR Invoicing · 16 AR Payment · 17 AP Invoicing · 18 AP Payment

## Accounting Type (`conditionInputs["7"]`)
DL Operational Lease · MG Financial Lease · HP H. Purchase · LO Loan · OPF USGAAP Operating Lease

## Product (`conditionInputs["8"]`)
CVL Consumer Vehicle Leasing · BVL Business Vehicle Leasing · FML Fleet Management Leasing · CVF Commercial Vehicle Finance · CEF Construction Equipment Finance · ITL IT Equipment Leasing · REF Retail Equipment Finance

## Amount Code (`conditionInputs["18"]` / amountCodeLines)
INS Insurance · ADMIN Administration fee · REM Reminder/late fee · FUEL Fuel card cost · IFE Invoice Fee · OPC Operating Cost · SEB Service Agreement – Electric Bicycles · TEB Studded Tire Agreement – Electric Bicycles · TAB Transportation Agreement – Electric Bicycles

## Amount types (`amounts` keys) — selection
30 Fixed Asset Value · 31 Residual Value · 32 Deposit · 33 Total Plan Rent (=34+35) · 34 Total Plan Amortization · 35 Total Plan Interest · 36 Total Amount · 39 Added Cost · 40 Tax · 41 Rounding · 43 Rent - Primary · 44 On'account - Customer · 60 Insurance — full list in the app.

## Recognition categories (`recognitionPlan…schedule[].categoryId`)
1 Rent (= amortization component) · 2 Interest · 3 Depreciation
