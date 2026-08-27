using Accounting.Domain.Common;

namespace Accounting.Domain.Configuration;

/// <summary>
/// Accounting class: the segment/domain a booking configuration belongs to
/// (PF-Agreement, AR Invoicing, AR Payment, AP Invoicing, AP Payment).
/// </summary>
public sealed class AccountingClass : EntityBase
{
    private AccountingClass() { }

    public string Code { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public string Description { get; private set; } = string.Empty;

    public static AccountingClass Create(Guid id, string code, string name, string description) =>
        new()
        {
            Id = id,
            Code = code,
            Name = name,
            Description = description,
        };
}

/// <summary>Ledger a rule books into (Local Legal, US GAAP, Common).</summary>
public sealed class Ledger : EntityBase
{
    private Ledger() { }

    public string Code { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public string Description { get; private set; } = string.Empty;

    public static Ledger Create(Guid id, string code, string name, string description) =>
        new()
        {
            Id = id,
            Code = code,
            Name = name,
            Description = description,
        };
}

public enum EventCategory
{
    Normal = 1,
    Reversal = 2,
}

/// <summary>Event that creates bookings (Activation, Invoicing, AR Payment, Termination…).</summary>
public sealed class AccountingEvent : EntityBase
{
    private AccountingEvent() { }

    public string Code { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public string Description { get; private set; } = string.Empty;

    public EventCategory Category { get; private set; }

    /// <summary>For reversal events: the event being reversed.</summary>
    public Guid? OriginalEventId { get; private set; }

    public static AccountingEvent Create(
        Guid id,
        string code,
        string name,
        string description,
        EventCategory category = EventCategory.Normal,
        Guid? originalEventId = null
    ) =>
        new()
        {
            Id = id,
            Code = code,
            Name = name,
            Description = description,
            Category = category,
            OriginalEventId = originalEventId,
        };
}

/// <summary>
/// Base value that can be used in formulas and retrieved from event messages.
/// The name is the stable cross-domain contract (message amounts are keyed by it).
/// </summary>
public sealed class AmountType : EntityBase
{
    private AmountType() { }

    public string Name { get; private set; } = string.Empty;

    public string Description { get; private set; } = string.Empty;

    public static AmountType Create(Guid id, string name, string description) =>
        new()
        {
            Id = id,
            Name = name,
            Description = description,
        };
}

/// <summary>
/// Message attribute usable in formula conditions (Accounting Type, Term Reason, Amount Code…).
/// The name is the stable cross-domain contract (message attributes are keyed by it).
/// </summary>
public sealed class ConditionAttribute : EntityBase
{
    private ConditionAttribute() { }

    public string Name { get; private set; } = string.Empty;

    public static ConditionAttribute Create(Guid id, string name) => new() { Id = id, Name = name };
}
