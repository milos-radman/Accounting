using Accounting.Domain.Common;

namespace Accounting.Domain.ValueObjects;

/// <summary>Accounting period in YYYYMM form, e.g. 202410.</summary>
public readonly record struct Period : IComparable<Period>
{
    public int Year { get; }

    public int Month { get; }

    public Period(int year, int month)
    {
        if (year is < 1900 or > 2200)
        {
            throw new DomainRuleException($"Period year {year} is out of range.");
        }

        if (month is < 1 or > 12)
        {
            throw new DomainRuleException($"Period month {month} is out of range.");
        }

        Year = year;
        Month = month;
    }

    public static Period Parse(string value)
    {
        if (value is not { Length: 6 } || !int.TryParse(value, out var packed))
        {
            throw new DomainRuleException($"'{value}' is not a valid YYYYMM period.");
        }

        return new Period(packed / 100, packed % 100);
    }

    public static Period FromDate(DateOnly date) => new(date.Year, date.Month);

    public Period Next() => Month == 12 ? new Period(Year + 1, 1) : new Period(Year, Month + 1);

    public Period Previous() => Month == 1 ? new Period(Year - 1, 12) : new Period(Year, Month - 1);

    public DateOnly FirstDay => new(Year, Month, 1);

    public DateOnly LastDay => new(Year, Month, DateTime.DaysInMonth(Year, Month));

    public int CompareTo(Period other) =>
        (Year * 100 + Month).CompareTo(other.Year * 100 + other.Month);

    public static bool operator <(Period left, Period right) => left.CompareTo(right) < 0;

    public static bool operator >(Period left, Period right) => left.CompareTo(right) > 0;

    public static bool operator <=(Period left, Period right) => left.CompareTo(right) <= 0;

    public static bool operator >=(Period left, Period right) => left.CompareTo(right) >= 0;

    public override string ToString() => $"{Year:D4}{Month:D2}";
}
