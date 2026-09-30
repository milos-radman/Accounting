using Accounting.Domain.Common;

namespace Accounting.Domain.Accounts;

/// <summary>
/// The internal account used when defining formulas. Owned by a legal entity;
/// maps to an external account in the customer's general ledger.
/// </summary>
public sealed class PseudoAccount : EntityBase
{
    private PseudoAccount() { }

    public Guid LegalEntityId { get; private set; }

    /// <summary>The pseudo account number/code, e.g. "140000" or "4A1544".</summary>
    public string Code { get; private set; } = string.Empty;

    public string Description { get; private set; } = string.Empty;

    /// <summary>Account used when exporting to the external general ledger.</summary>
    public string ExternalCode { get; private set; } = string.Empty;

    public string ExternalDescription { get; private set; } = string.Empty;

    /// <summary>Include the account in the revaluation process (spec §PseudoAccount).</summary>
    public bool Revaluation { get; private set; }

    public static PseudoAccount Register(
        Guid legalEntityId,
        string code,
        string description,
        string? externalCode = null,
        string? externalDescription = null,
        bool revaluation = false
    )
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            throw new DomainRuleException("A pseudo account must have an account code.");
        }

        var trimmed = code.Trim();
        return new PseudoAccount
        {
            LegalEntityId = legalEntityId,
            Code = trimmed,
            Description = description.Trim(),
            ExternalCode = string.IsNullOrWhiteSpace(externalCode) ? trimmed : externalCode.Trim(),
            ExternalDescription = string.IsNullOrWhiteSpace(externalDescription)
                ? description.Trim()
                : externalDescription.Trim(),
            Revaluation = revaluation,
        };
    }
}
