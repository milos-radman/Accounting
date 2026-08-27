namespace Accounting.Contracts;

/// <summary>Booking side. Shared kernel enum — stable across service boundaries.</summary>
public enum DebitCredit
{
    Debit = 0,
    Credit = 1,
}
