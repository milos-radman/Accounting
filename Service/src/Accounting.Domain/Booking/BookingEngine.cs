using Accounting.Contracts;
using Accounting.Domain.Accounts;
using Accounting.Domain.Formulas;
using Accounting.Domain.Journals;
using Accounting.Domain.Rules;

namespace Accounting.Domain.Booking;

/// <summary>
/// The values of one accounting event message, as far as the engine is concerned.
/// Amounts are keyed by amount-type name, attributes by condition-attribute name —
/// both are the stable cross-domain contract.
/// </summary>
public sealed record BookingRequest(
    IReadOnlyDictionary<string, decimal> Amounts,
    IReadOnlyDictionary<string, string> Attributes,
    string? Agreement,
    int? AgreementLine,
    string? InvoiceNumber,
    string? Portfolio
);

/// <summary>
/// Pure domain service that applies accounting rules to an event message and produces
/// journal line drafts. No I/O: the caller loads the configuration, the engine only decides.
/// </summary>
public static class BookingEngine
{
    public static IReadOnlyList<JournalLineDraft> Produce(
        IEnumerable<AccountingRule> rules,
        IReadOnlyDictionary<Guid, Formula> formulasById,
        IReadOnlyDictionary<string, PseudoAccount> accountsByCode,
        BookingRequest request
    )
    {
        var lines = new List<JournalLineDraft>();

        foreach (var rule in rules)
        {
            if (!formulasById.TryGetValue(rule.FormulaId, out var formula))
            {
                continue;
            }

            if (
                !request.Amounts.TryGetValue(formula.AmountTypeName, out var amount)
                || amount == 0m
            )
            {
                continue; // nothing to book for this formula
            }

            var resolution = ResolveAccount(formula, rule.Side, request.Attributes);
            if (resolution is not { } resolved)
            {
                continue; // no account resolvable for this side — the rule does not book
            }

            accountsByCode.TryGetValue(resolved.AccountCode, out var account);
            var externalAccount = BuildExternalAccount(account, request.Portfolio);

            lines.Add(
                new JournalLineDraft(
                    PseudoAccountCode: resolved.AccountCode,
                    Description: account?.Description ?? formula.Description,
                    LedgerName: rule.LedgerName,
                    Debit: rule.Side == DebitCredit.Debit ? amount : 0m,
                    Credit: rule.Side == DebitCredit.Credit ? amount : 0m,
                    Agreement: request.Agreement,
                    AgreementLine: request.AgreementLine,
                    InvoiceNumber: request.InvoiceNumber,
                    FormulaCode: formula.Code,
                    AmountTypeName: formula.AmountTypeName,
                    ResolutionTrace: resolved.Trace,
                    ExternalAccount: externalAccount
                )
            );
        }

        return lines;
    }

    private static (string AccountCode, string Trace)? ResolveAccount(
        Formula formula,
        DebitCredit side,
        IReadOnlyDictionary<string, string> attributes
    )
    {
        if (
            formula.Conditions.Count > 0
            && ResolveConditionAccount(formula.Conditions, side, attributes) is { } hit
        )
        {
            return hit;
        }

        var direct =
            side == DebitCredit.Debit ? formula.DebitAccountCode : formula.CreditAccountCode;
        if (direct is not null)
        {
            var trace =
                formula.Conditions.Count > 0
                    ? "default account (no condition matched)"
                    : "formula account";
            return (direct, trace);
        }

        return null;
    }

    /// <summary>
    /// Walks condition rows in sequence: a level-1 row starts a new branch; rows without
    /// accounts act as guards for the account-bearing rows that follow within the branch.
    /// </summary>
    private static (string AccountCode, string Trace)? ResolveConditionAccount(
        IReadOnlyList<FormulaCondition> rows,
        DebitCredit side,
        IReadOnlyDictionary<string, string> attributes
    )
    {
        var guards = new List<(bool Ok, string Label)>();

        foreach (var row in rows.OrderBy(r => r.Sequence))
        {
            if (row.Level == 1)
            {
                guards.Clear();
            }

            var rowMatches = Matches(row, attributes);
            if (!row.HasAccounts)
            {
                guards.Add((rowMatches, $"{row.AttributeName}={row.Value}"));
                continue;
            }

            var accountCode =
                side == DebitCredit.Debit ? row.DebitAccountCode : row.CreditAccountCode;
            if (accountCode is null)
            {
                continue;
            }

            if (rowMatches && guards.TrueForAll(g => g.Ok))
            {
                var guardText =
                    guards.Count > 0
                        ? string.Join(" & ", guards.Select(g => g.Label)) + " & "
                        : string.Empty;
                return (accountCode, $"condition {guardText}{row.AttributeName}={row.Value}");
            }
        }

        return null;
    }

    private static bool Matches(
        FormulaCondition row,
        IReadOnlyDictionary<string, string> attributes
    ) =>
        attributes.TryGetValue(row.AttributeName, out var input)
        && string.Equals(input.Trim(), row.Value.Trim(), StringComparison.OrdinalIgnoreCase);

    private static string? BuildExternalAccount(PseudoAccount? account, string? portfolio)
    {
        if (account is null)
        {
            return null;
        }

        return string.IsNullOrWhiteSpace(portfolio)
            ? account.ExternalCode
            : $"{account.ExternalCode} {portfolio}";
    }
}
