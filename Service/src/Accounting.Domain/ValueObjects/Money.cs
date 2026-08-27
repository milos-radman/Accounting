using Accounting.Domain.Common;

namespace Accounting.Domain.ValueObjects;

/// <summary>An amount in a specific currency. Arithmetic across currencies is rejected.</summary>
public readonly record struct Money(decimal Amount, string Currency)
{
    public static Money Zero(string currency) => new(0m, currency);

    public Money Add(Money other)
    {
        EnsureSameCurrency(other);
        return this with { Amount = Amount + other.Amount };
    }

    public Money Subtract(Money other)
    {
        EnsureSameCurrency(other);
        return this with { Amount = Amount - other.Amount };
    }

    public bool IsZero => Amount == 0m;

    private void EnsureSameCurrency(Money other)
    {
        if (!string.Equals(Currency, other.Currency, StringComparison.OrdinalIgnoreCase))
        {
            throw new DomainRuleException(
                $"Cannot combine amounts in {Currency} and {other.Currency}."
            );
        }
    }

    public override string ToString() => $"{Amount:0.00} {Currency}";
}
