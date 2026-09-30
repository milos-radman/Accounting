namespace Accounting.Domain.Common;

/// <summary>
/// Base for all domain-rule violations. Mapped to 409/422 by the API's
/// global exception handler (§5.2).
/// </summary>
public class DomainException : Exception
{
    public DomainException(string message)
        : base(message) { }

    public DomainException(string message, Exception innerException)
        : base(message, innerException) { }
}

/// <summary>A requested state transition conflicts with the current state (409).</summary>
public sealed class DomainConflictException : DomainException
{
    public DomainConflictException(string message)
        : base(message) { }
}

/// <summary>Input is well-formed but violates a business invariant (422).</summary>
public sealed class DomainRuleException : DomainException
{
    public DomainRuleException(string message)
        : base(message) { }
}
