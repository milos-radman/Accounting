using Accounting.Contracts;
using Accounting.Domain.Common;

namespace Accounting.Domain.Rules;

/// <summary>
/// Controls how a booking is created: for a legal entity, accounting class, ledger and
/// accounting event, apply a formula on the given side (spec §Accounting Rules).
/// </summary>
public sealed class AccountingRule : EntityBase
{
    private AccountingRule() { }

    public Guid LegalEntityId { get; private set; }

    public Guid AccountingClassId { get; private set; }

    public Guid LedgerId { get; private set; }

    /// <summary>Ledger name snapshot used on journal lines, e.g. "Local Legal".</summary>
    public string LedgerName { get; private set; } = string.Empty;

    public Guid AccountingEventId { get; private set; }

    public Guid FormulaId { get; private set; }

    public DebitCredit Side { get; private set; }

    public static AccountingRule Create(
        Guid legalEntityId,
        Guid accountingClassId,
        Guid ledgerId,
        string ledgerName,
        Guid accountingEventId,
        Guid formulaId,
        DebitCredit side
    )
    {
        if (
            legalEntityId == Guid.Empty
            || accountingClassId == Guid.Empty
            || ledgerId == Guid.Empty
            || accountingEventId == Guid.Empty
            || formulaId == Guid.Empty
        )
        {
            throw new DomainRuleException(
                "An accounting rule must reference entity, class, ledger, event and formula."
            );
        }

        return new AccountingRule
        {
            LegalEntityId = legalEntityId,
            AccountingClassId = accountingClassId,
            LedgerId = ledgerId,
            LedgerName = ledgerName,
            AccountingEventId = accountingEventId,
            FormulaId = formulaId,
            Side = side,
        };
    }
}
