namespace Accounting.Contracts.IntegrationEvents;

/// <summary>
/// Integration event consumed by the Accounting service. Other domains (Contract, Receivables,
/// Payables) publish this when a business event needs accounting. Per the specification the
/// message is self-contained: it carries every value the accounting domain may need to apply
/// its booking rules.
/// </summary>
public sealed record AccountingEntryRequested
{
    /// <summary>Idempotency key set by the publisher; consumers must deduplicate on it.</summary>
    public required Guid MessageId { get; init; }

    public required string TenantId { get; init; }

    /// <summary>Legal entity the booking belongs to.</summary>
    public required Guid LegalEntityId { get; init; }

    /// <summary>Accounting class code, e.g. "PF", "AR-Inv", "AR-Pay".</summary>
    public required string AccountingClassCode { get; init; }

    /// <summary>Accounting event code, e.g. "s" (Activation), "i" (Invoicing).</summary>
    public required string AccountingEventCode { get; init; }

    public required DateOnly BookingDate { get; init; }

    public string CurrencyCode { get; init; } = "EUR";

    public string? Agreement { get; init; }

    public int? AgreementLine { get; init; }

    public string? Portfolio { get; init; }

    public string? InvoiceNumber { get; init; }

    /// <summary>
    /// Amounts keyed by amount-type name (e.g. "Fixed Asset Value", "Total Plan Rent").
    /// The names are the stable contract between domains.
    /// </summary>
    public IReadOnlyDictionary<string, decimal> Amounts { get; init; } =
        new Dictionary<string, decimal>();

    /// <summary>
    /// Condition attributes keyed by attribute name (e.g. "Accounting Type" = "MG",
    /// "Term Reason" = "911"). Used by formula conditions to route accounts.
    /// </summary>
    public IReadOnlyDictionary<string, string> Attributes { get; init; } =
        new Dictionary<string, string>();
}
