using Accounting.Domain.Common;
using Accounting.Domain.ValueObjects;

namespace Accounting.Domain.Journals;

public enum JournalOrigin
{
    EventMessage = 1,
    Manual = 2,
}

/// <summary>
/// A GLI journal: the set of transaction lines produced for one accounting event.
/// Journals are append-only; a difference (unbalanced journal) is allowed but flagged,
/// and can only be corrected by adding lines — never by mutating existing ones.
/// </summary>
public sealed class Journal : EntityBase
{
    private readonly List<JournalLine> _lines = [];

    private Journal() { }

    public long GliNumber { get; private set; }

    public Guid LegalEntityId { get; private set; }

    public Guid AccountingEventId { get; private set; }

    /// <summary>Event code snapshot for export/search, e.g. "s" (Activation).</summary>
    public string AccountingEventCode { get; private set; } = string.Empty;

    public string AccountingEventName { get; private set; } = string.Empty;

    public DateOnly BookingDate { get; private set; }

    public string Currency { get; private set; } = "EUR";

    public JournalOrigin Origin { get; private set; }

    /// <summary>
    /// MessageId of the integration event this journal was created from.
    /// Enforces consumer idempotency: one message produces at most one journal.
    /// </summary>
    public Guid? SourceMessageId { get; private set; }

    public DateTimeOffset? ExportedAt { get; private set; }

    public IReadOnlyList<JournalLine> Lines => _lines.AsReadOnly();

    public decimal TotalDebit => _lines.Sum(l => l.Debit);

    public decimal TotalCredit => _lines.Sum(l => l.Credit);

    public Money Difference => new(TotalDebit - TotalCredit, Currency);

    public bool HasDifference => TotalDebit != TotalCredit;

    public static Journal Create(
        long gliNumber,
        Guid legalEntityId,
        Guid accountingEventId,
        string accountingEventCode,
        string accountingEventName,
        DateOnly bookingDate,
        string currency,
        JournalOrigin origin,
        IEnumerable<JournalLineDraft> lines,
        Guid? sourceMessageId = null
    )
    {
        var journal = new Journal
        {
            GliNumber = gliNumber,
            LegalEntityId = legalEntityId,
            AccountingEventId = accountingEventId,
            AccountingEventCode = accountingEventCode,
            AccountingEventName = accountingEventName,
            BookingDate = bookingDate,
            Currency = currency,
            Origin = origin,
            SourceMessageId = sourceMessageId,
        };

        foreach (var draft in lines)
        {
            journal.AddLine(draft);
        }

        if (journal._lines.Count == 0)
        {
            throw new DomainRuleException("A journal must contain at least one line.");
        }

        return journal;
    }

    /// <summary>Adds a line; used at creation and for manual difference corrections.</summary>
    public JournalLine AddLine(JournalLineDraft draft)
    {
        if (ExportedAt is not null)
        {
            throw new DomainConflictException(
                $"GLI {GliNumber} has been exported to the general ledger and can no longer be changed."
            );
        }

        if (draft.Debit < 0 || draft.Credit < 0)
        {
            throw new DomainRuleException("Journal line amounts cannot be negative.");
        }

        if (draft.Debit > 0 == draft.Credit > 0)
        {
            throw new DomainRuleException(
                "A journal line must carry an amount on exactly one side (debit or credit)."
            );
        }

        if (string.IsNullOrWhiteSpace(draft.PseudoAccountCode))
        {
            throw new DomainRuleException("A journal line must reference a pseudo account.");
        }

        var line = new JournalLine(Id, _lines.Count + 1, draft);
        _lines.Add(line);
        return line;
    }

    public void MarkExported(DateTimeOffset at)
    {
        if (HasDifference)
        {
            throw new DomainConflictException(
                $"GLI {GliNumber} has a difference of {Difference} and cannot be exported."
            );
        }

        ExportedAt = at;
    }
}

/// <summary>Input for creating a journal line; the aggregate assigns line numbers.</summary>
public sealed record JournalLineDraft(
    string PseudoAccountCode,
    string Description,
    string LedgerName,
    decimal Debit,
    decimal Credit,
    string? Agreement = null,
    int? AgreementLine = null,
    string? InvoiceNumber = null,
    string? FormulaCode = null,
    string? AmountTypeName = null,
    string? ResolutionTrace = null,
    string? ExternalAccount = null
);

/// <summary>One transaction line of a GLI journal. Immutable once created.</summary>
public sealed class JournalLine : EntityBase
{
    private JournalLine() { }

    internal JournalLine(Guid journalId, int lineNumber, JournalLineDraft draft)
    {
        JournalId = journalId;
        LineNumber = lineNumber;
        PseudoAccountCode = draft.PseudoAccountCode;
        Description = draft.Description;
        LedgerName = draft.LedgerName;
        Debit = draft.Debit;
        Credit = draft.Credit;
        Agreement = draft.Agreement;
        AgreementLine = draft.AgreementLine;
        InvoiceNumber = draft.InvoiceNumber;
        FormulaCode = draft.FormulaCode;
        AmountTypeName = draft.AmountTypeName;
        ResolutionTrace = draft.ResolutionTrace;
        ExternalAccount = draft.ExternalAccount;
    }

    public Guid JournalId { get; private set; }

    public int LineNumber { get; private set; }

    public string PseudoAccountCode { get; private set; } = string.Empty;

    public string Description { get; private set; } = string.Empty;

    public string LedgerName { get; private set; } = string.Empty;

    public decimal Debit { get; private set; }

    public decimal Credit { get; private set; }

    public string? Agreement { get; private set; }

    public int? AgreementLine { get; private set; }

    public string? InvoiceNumber { get; private set; }

    public string? FormulaCode { get; private set; }

    public string? AmountTypeName { get; private set; }

    /// <summary>How the account was resolved (condition trace) — kept for auditability.</summary>
    public string? ResolutionTrace { get; private set; }

    /// <summary>External account string sent to the general ledger.</summary>
    public string? ExternalAccount { get; private set; }
}
