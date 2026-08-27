using Accounting.Domain.Common;

namespace Accounting.Domain.Formulas;

/// <summary>
/// The main building block for accounting (spec §Formula). A formula reads one amount type
/// from the event message and resolves the pseudo account either directly or through its
/// condition rows.
/// </summary>
public sealed class Formula : EntityBase
{
    private readonly List<FormulaCondition> _conditions = [];

    private Formula() { }

    /// <summary>Short formula code shown in journals, e.g. "014" or "USG400".</summary>
    public string Code { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public string Description { get; private set; } = string.Empty;

    public Guid AmountTypeId { get; private set; }

    /// <summary>Amount-type name snapshot; the key used to read the amount from messages.</summary>
    public string AmountTypeName { get; private set; } = string.Empty;

    /// <summary>Default debit account when no condition matches; null when conditions decide.</summary>
    public string? DebitAccountCode { get; private set; }

    /// <summary>Default credit account when no condition matches; null when conditions decide.</summary>
    public string? CreditAccountCode { get; private set; }

    public IReadOnlyList<FormulaCondition> Conditions => _conditions.AsReadOnly();

    public static Formula Create(
        string code,
        string name,
        string description,
        Guid amountTypeId,
        string amountTypeName,
        string? debitAccountCode = null,
        string? creditAccountCode = null
    )
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            throw new DomainRuleException("A formula must have a code.");
        }

        if (string.IsNullOrWhiteSpace(amountTypeName))
        {
            throw new DomainRuleException("A formula must reference an amount type.");
        }

        return new Formula
        {
            Code = code.Trim(),
            Name = name.Trim(),
            Description = description.Trim(),
            AmountTypeId = amountTypeId,
            AmountTypeName = amountTypeName.Trim(),
            DebitAccountCode = Normalize(debitAccountCode),
            CreditAccountCode = Normalize(creditAccountCode),
        };
    }

    public FormulaCondition AddCondition(
        int level,
        string attributeName,
        string value,
        string? debitAccountCode,
        string? creditAccountCode,
        ConditionOperator? @operator
    )
    {
        if (level < 1)
        {
            throw new DomainRuleException("Condition levels start at 1.");
        }

        if (string.IsNullOrWhiteSpace(attributeName))
        {
            throw new DomainRuleException("A condition row must reference a condition attribute.");
        }

        var row = new FormulaCondition(
            Id,
            _conditions.Count + 1,
            level,
            attributeName.Trim(),
            value.Trim(),
            Normalize(debitAccountCode),
            Normalize(creditAccountCode),
            @operator
        );
        _conditions.Add(row);
        return row;
    }

    public void RemoveCondition(Guid conditionId)
    {
        var row =
            _conditions.Find(c => c.Id == conditionId)
            ?? throw new DomainRuleException("The condition row does not exist on this formula.");
        _conditions.Remove(row);
    }

    private static string? Normalize(string? account) =>
        string.IsNullOrWhiteSpace(account) ? null : account.Trim();
}

public enum ConditionOperator
{
    And = 1,
    Or = 2,
}

/// <summary>
/// One IF/THEN row of a formula condition. Level-1 rows start a branch; rows without
/// accounts act as guards for the account-bearing rows that follow in the branch.
/// </summary>
public sealed class FormulaCondition : EntityBase
{
    private FormulaCondition() { }

    internal FormulaCondition(
        Guid formulaId,
        int sequence,
        int level,
        string attributeName,
        string value,
        string? debitAccountCode,
        string? creditAccountCode,
        ConditionOperator? @operator
    )
    {
        FormulaId = formulaId;
        Sequence = sequence;
        Level = level;
        AttributeName = attributeName;
        Value = value;
        DebitAccountCode = debitAccountCode;
        CreditAccountCode = creditAccountCode;
        Operator = @operator;
    }

    public Guid FormulaId { get; private set; }

    /// <summary>Evaluation order within the formula.</summary>
    public int Sequence { get; private set; }

    public int Level { get; private set; }

    /// <summary>Condition attribute name, e.g. "Accounting Type".</summary>
    public string AttributeName { get; private set; } = string.Empty;

    /// <summary>Comparison value, e.g. "MG" or "911".</summary>
    public string Value { get; private set; } = string.Empty;

    public string? DebitAccountCode { get; private set; }

    public string? CreditAccountCode { get; private set; }

    public ConditionOperator? Operator { get; private set; }

    public bool HasAccounts => DebitAccountCode is not null || CreditAccountCode is not null;
}
