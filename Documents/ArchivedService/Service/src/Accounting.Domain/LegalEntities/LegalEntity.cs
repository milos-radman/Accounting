using Accounting.Domain.Common;
using Accounting.Domain.ValueObjects;

namespace Accounting.Domain.LegalEntities;

/// <summary>
/// The top level for accounting. Controls all accounting actions for accounting events
/// received from the domains that use the accounting service (specification §Legal Entity).
/// </summary>
public sealed class LegalEntity : EntityBase
{
    private LegalEntity() { }

    public string Name { get; private set; } = string.Empty;

    public string Description { get; private set; } = string.Empty;

    /// <summary>Short owner code shown on dashboards, e.g. "ALS NLD".</summary>
    public string OwnerCode { get; private set; } = string.Empty;

    public string OwnerName { get; private set; } = string.Empty;

    public string BaseCurrency { get; private set; } = "EUR";

    public bool Revaluation { get; private set; }

    /// <summary>First number of the entity's GLI number serie.</summary>
    public long GliNumberSerie { get; private set; }

    /// <summary>Next GLI number to hand out; monotonically increasing.</summary>
    public long NextGliNumber { get; private set; }

    public string Responsible { get; private set; } = string.Empty;

    public Period OpenPeriod { get; private set; }

    public Period ClosedPeriod { get; private set; }

    public Period? EndOfMonthPeriod { get; private set; }

    public static LegalEntity Create(
        string name,
        string description,
        string ownerCode,
        string ownerName,
        string baseCurrency,
        long gliNumberSerie,
        Period openPeriod,
        string responsible,
        bool revaluation = false
    )
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainRuleException("A legal entity must have a name.");
        }

        if (gliNumberSerie <= 0)
        {
            throw new DomainRuleException("The GLI number serie must be positive.");
        }

        return new LegalEntity
        {
            Name = name.Trim(),
            Description = string.IsNullOrWhiteSpace(description) ? name.Trim() : description.Trim(),
            OwnerCode = ownerCode.Trim(),
            OwnerName = ownerName.Trim(),
            BaseCurrency = string.IsNullOrWhiteSpace(baseCurrency)
                ? "EUR"
                : baseCurrency.Trim().ToUpperInvariant(),
            GliNumberSerie = gliNumberSerie,
            NextGliNumber = gliNumberSerie,
            OpenPeriod = openPeriod,
            ClosedPeriod = openPeriod.Previous(),
            Responsible = responsible.Trim(),
            Revaluation = revaluation,
        };
    }

    /// <summary>Reserves and returns the next GLI number for a new journal.</summary>
    public long ReserveGliNumber() => NextGliNumber++;

    /// <summary>
    /// Closes the currently open period and opens the next one.
    /// Bookings into a closed period are rejected by <see cref="EnsureBookingAllowed"/>.
    /// </summary>
    public void CloseCurrentPeriod()
    {
        ClosedPeriod = OpenPeriod;
        OpenPeriod = OpenPeriod.Next();
    }

    /// <summary>Registers a completed end-of-month run for the given period.</summary>
    public void RegisterEndOfMonth(Period period)
    {
        if (EndOfMonthPeriod is { } previous && period <= previous)
        {
            throw new DomainConflictException(
                $"End of month for {period} cannot run: {previous} has already been processed."
            );
        }

        EndOfMonthPeriod = period;
    }

    /// <summary>Guards that a booking date falls in an open (not closed) period.</summary>
    public void EnsureBookingAllowed(DateOnly bookingDate)
    {
        var bookingPeriod = Period.FromDate(bookingDate);
        if (bookingPeriod <= ClosedPeriod)
        {
            throw new DomainConflictException(
                $"Booking date {bookingDate:yyyy-MM-dd} falls in closed period {bookingPeriod}. "
                    + $"Open period is {OpenPeriod}."
            );
        }
    }
}
