namespace Accounting.Contracts.IntegrationEvents;

/// <summary>
/// Published by the Accounting service after a GLI journal has been created from an
/// accounting event message. Downstream consumers (GL export, reporting) subscribe to this.
/// </summary>
public sealed record JournalCreated
{
    public required Guid JournalId { get; init; }

    public required long GliNumber { get; init; }

    public required Guid LegalEntityId { get; init; }

    public required string AccountingEventCode { get; init; }

    public required DateOnly BookingDate { get; init; }

    public required int LineCount { get; init; }

    public required decimal TotalDebit { get; init; }

    public required decimal TotalCredit { get; init; }

    /// <summary>True when the journal does not balance and needs manual correction.</summary>
    public required bool HasDifference { get; init; }
}
