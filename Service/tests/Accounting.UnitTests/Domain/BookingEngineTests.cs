using Accounting.Contracts;
using Accounting.Domain.Accounts;
using Accounting.Domain.Booking;
using Accounting.Domain.Formulas;
using Accounting.Domain.Rules;
using FluentAssertions;
using Xunit;

namespace Accounting.UnitTests.Domain;

/// <summary>
/// Booking-engine scenarios ported from the verified accounting configuration:
/// formula 014 (Fixed Asset Value) routes to 140000 for Accounting Type MG and to
/// 5K2060/4A1544 for DL, exactly as configured in the rule workbook.
/// </summary>
public sealed class BookingEngineTests
{
    private static readonly Guid EntityId = Guid.NewGuid();
    private static readonly Guid ClassId = Guid.NewGuid();
    private static readonly Guid LedgerId = Guid.NewGuid();
    private static readonly Guid EventId = Guid.NewGuid();

    private static Formula FixedAssetFormula()
    {
        // 014 - Fixed Asset: IF Accounting Type = MG THEN credit 140000
        //                    IF Accounting Type = DL THEN debit 4A1544 / credit 5K2060
        var formula = Formula.Create(
            "014",
            "014 - Fixed Asset",
            "Fixed asset value from the line",
            Guid.NewGuid(),
            "Fixed Asset Value"
        );
        formula.AddCondition(1, "Accounting Type", "MG", null, "140000", ConditionOperator.Or);
        formula.AddCondition(1, "Accounting Type", "DL", "4A1544", "5K2060", null);
        return formula;
    }

    private static AccountingRule Rule(Formula formula, DebitCredit side) =>
        AccountingRule.Create(
            EntityId,
            ClassId,
            LedgerId,
            "Local Legal",
            EventId,
            formula.Id,
            side
        );

    private static Dictionary<string, PseudoAccount> Accounts() =>
        new()
        {
            ["140000"] = PseudoAccount.Register(EntityId, "140000", "Equipment Purchases"),
            ["5K2060"] = PseudoAccount.Register(EntityId, "5K2060", "Inventory"),
            ["4A1544"] = PseudoAccount.Register(EntityId, "4A1544", "Fixed asset"),
            ["192101"] = PseudoAccount.Register(EntityId, "192101", "Lease Rec - Curr Year Volume"),
        };

    private static BookingRequest Request(
        decimal fixedAssetValue,
        string accountingType,
        string? portfolio = null
    ) =>
        new(
            new Dictionary<string, decimal> { ["Fixed Asset Value"] = fixedAssetValue },
            new Dictionary<string, string> { ["Accounting Type"] = accountingType },
            Agreement: "1232",
            AgreementLine: 1,
            InvoiceNumber: null,
            Portfolio: portfolio
        );

    [Fact]
    public void Books_credit_140000_when_accounting_type_is_MG()
    {
        var formula = FixedAssetFormula();
        var lines = BookingEngine.Produce(
            [Rule(formula, DebitCredit.Credit)],
            new Dictionary<Guid, Formula> { [formula.Id] = formula },
            Accounts(),
            Request(12500m, "MG")
        );

        var line = lines.Should().ContainSingle().Subject;
        line.PseudoAccountCode.Should().Be("140000");
        line.Credit.Should().Be(12500m);
        line.Debit.Should().Be(0m);
        line.ResolutionTrace.Should().Contain("Accounting Type=MG");
    }

    [Fact]
    public void Books_credit_5K2060_when_accounting_type_is_DL()
    {
        var formula = FixedAssetFormula();
        var lines = BookingEngine.Produce(
            [Rule(formula, DebitCredit.Credit)],
            new Dictionary<Guid, Formula> { [formula.Id] = formula },
            Accounts(),
            Request(12500m, "DL")
        );

        lines.Should().ContainSingle().Which.PseudoAccountCode.Should().Be("5K2060");
    }

    [Fact]
    public void Books_debit_4A1544_when_accounting_type_is_DL_and_rule_side_is_debit()
    {
        var formula = FixedAssetFormula();
        var lines = BookingEngine.Produce(
            [Rule(formula, DebitCredit.Debit)],
            new Dictionary<Guid, Formula> { [formula.Id] = formula },
            Accounts(),
            Request(12500m, "DL")
        );

        var line = lines.Should().ContainSingle().Subject;
        line.PseudoAccountCode.Should().Be("4A1544");
        line.Debit.Should().Be(12500m);
    }

    [Fact]
    public void Produces_no_line_when_the_amount_is_zero()
    {
        var formula = FixedAssetFormula();
        var lines = BookingEngine.Produce(
            [Rule(formula, DebitCredit.Credit)],
            new Dictionary<Guid, Formula> { [formula.Id] = formula },
            Accounts(),
            Request(0m, "MG")
        );

        lines.Should().BeEmpty();
    }

    [Fact]
    public void Produces_no_line_when_no_condition_matches_and_no_default_exists()
    {
        var formula = FixedAssetFormula();
        var lines = BookingEngine.Produce(
            [Rule(formula, DebitCredit.Credit)],
            new Dictionary<Guid, Formula> { [formula.Id] = formula },
            Accounts(),
            Request(12500m, "UNKNOWN")
        );

        lines.Should().BeEmpty();
    }

    [Fact]
    public void Falls_back_to_the_formula_account_when_no_condition_matches()
    {
        var formula = Formula.Create(
            "610",
            "610 - On Account",
            "On account payment",
            Guid.NewGuid(),
            "Fixed Asset Value",
            debitAccountCode: "192030",
            creditAccountCode: "192020"
        );
        formula.AddCondition(1, "Accounting Type", "XX", null, "140000", null);

        var lines = BookingEngine.Produce(
            [Rule(formula, DebitCredit.Credit)],
            new Dictionary<Guid, Formula> { [formula.Id] = formula },
            Accounts(),
            Request(500m, "MG")
        );

        var line = lines.Should().ContainSingle().Subject;
        line.PseudoAccountCode.Should().Be("192020");
        line.ResolutionTrace.Should().Be("default account (no condition matched)");
    }

    [Fact]
    public void Multi_level_guard_requires_all_levels_to_match()
    {
        // IF Accounting Type = MG (guard) AND Amount Code = 907 THEN credit 192101
        var formula = Formula.Create(
            "603",
            "603 - Paid Added cost",
            "Paid charges",
            Guid.NewGuid(),
            "Fixed Asset Value"
        );
        formula.AddCondition(1, "Accounting Type", "MG", null, null, ConditionOperator.And);
        formula.AddCondition(2, "Amount Code", "907", null, "192101", null);

        var matching = BookingEngine.Produce(
            [Rule(formula, DebitCredit.Credit)],
            new Dictionary<Guid, Formula> { [formula.Id] = formula },
            Accounts(),
            new BookingRequest(
                new Dictionary<string, decimal> { ["Fixed Asset Value"] = 100m },
                new Dictionary<string, string>
                {
                    ["Accounting Type"] = "MG",
                    ["Amount Code"] = "907",
                },
                null,
                null,
                null,
                null
            )
        );
        matching.Should().ContainSingle().Which.PseudoAccountCode.Should().Be("192101");

        var guardFails = BookingEngine.Produce(
            [Rule(formula, DebitCredit.Credit)],
            new Dictionary<Guid, Formula> { [formula.Id] = formula },
            Accounts(),
            new BookingRequest(
                new Dictionary<string, decimal> { ["Fixed Asset Value"] = 100m },
                new Dictionary<string, string>
                {
                    ["Accounting Type"] = "DL",
                    ["Amount Code"] = "907",
                },
                null,
                null,
                null,
                null
            )
        );
        guardFails.Should().BeEmpty();
    }

    [Fact]
    public void External_account_combines_external_code_and_portfolio()
    {
        var formula = FixedAssetFormula();
        var lines = BookingEngine.Produce(
            [Rule(formula, DebitCredit.Credit)],
            new Dictionary<Guid, Formula> { [formula.Id] = formula },
            Accounts(),
            Request(12500m, "MG", portfolio: "23")
        );

        lines.Should().ContainSingle().Which.ExternalAccount.Should().Be("140000 23");
    }

    [Fact]
    public void Condition_value_matching_is_case_insensitive()
    {
        var formula = FixedAssetFormula();
        var lines = BookingEngine.Produce(
            [Rule(formula, DebitCredit.Credit)],
            new Dictionary<Guid, Formula> { [formula.Id] = formula },
            Accounts(),
            Request(100m, "mg")
        );

        lines.Should().ContainSingle().Which.PseudoAccountCode.Should().Be("140000");
    }
}
