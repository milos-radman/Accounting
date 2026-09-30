using Accounting.Domain.ChartOfAccounts;
using Accounting.Domain.Common;
using Accounting.Domain.Journals;
using Accounting.Domain.LegalEntities;
using Accounting.Domain.ValueObjects;
using FluentAssertions;
using Xunit;

namespace Accounting.UnitTests.Domain;

public sealed class PeriodTests
{
    [Fact]
    public void Parses_yyyymm_and_computes_neighbours()
    {
        var period = Period.Parse("202412");
        period.Year.Should().Be(2024);
        period.Month.Should().Be(12);
        period.Next().Should().Be(new Period(2025, 1));
        period.Previous().Should().Be(new Period(2024, 11));
    }

    [Theory]
    [InlineData("2024")]
    [InlineData("202413")]
    [InlineData("abc123")]
    public void Rejects_invalid_periods(string value)
    {
        var act = () => Period.Parse(value);
        act.Should().Throw<DomainRuleException>();
    }
}

public sealed class LegalEntityTests
{
    private static LegalEntity Entity() =>
        LegalEntity.Create(
            "Alliance Laundry (Netherlands) B.V.",
            "ALS NLD entity",
            "ALS NLD",
            "Alliance Laundry Systems",
            "EUR",
            7414,
            new Period(2024, 10),
            "Pierre Willard"
        );

    [Fact]
    public void Requires_a_name()
    {
        var act = () => LegalEntity.Create(" ", "d", "X", "X", "EUR", 1, new Period(2024, 1), "r");
        act.Should().Throw<DomainRuleException>();
    }

    [Fact]
    public void Reserves_monotonically_increasing_gli_numbers()
    {
        var entity = Entity();
        entity.ReserveGliNumber().Should().Be(7414);
        entity.ReserveGliNumber().Should().Be(7415);
        entity.NextGliNumber.Should().Be(7416);
    }

    [Fact]
    public void Closing_the_period_advances_open_and_closed()
    {
        var entity = Entity();
        entity.CloseCurrentPeriod();
        entity.ClosedPeriod.Should().Be(new Period(2024, 10));
        entity.OpenPeriod.Should().Be(new Period(2024, 11));
    }

    [Fact]
    public void Rejects_bookings_into_a_closed_period()
    {
        var entity = Entity();
        entity.CloseCurrentPeriod(); // closed = 2024-10
        var act = () => entity.EnsureBookingAllowed(new DateOnly(2024, 10, 15));
        act.Should().Throw<DomainConflictException>().WithMessage("*closed period*");
        entity.EnsureBookingAllowed(new DateOnly(2024, 11, 1)); // open period is fine
    }

    [Fact]
    public void End_of_month_cannot_run_backwards()
    {
        var entity = Entity();
        entity.RegisterEndOfMonth(new Period(2024, 9));
        var act = () => entity.RegisterEndOfMonth(new Period(2024, 9));
        act.Should().Throw<DomainConflictException>();
    }
}

public sealed class JournalTests
{
    private static Journal Balanced() =>
        Journal.Create(
            7414,
            Guid.NewGuid(),
            Guid.NewGuid(),
            "s",
            "Activation",
            new DateOnly(2024, 10, 5),
            "EUR",
            JournalOrigin.EventMessage,
            [
                new JournalLineDraft("192101", "Lease Rec", "Local Legal", 14640m, 0m),
                new JournalLineDraft("140000", "Equipment", "Local Legal", 0m, 12500m),
                new JournalLineDraft("192401", "Unearned", "Local Legal", 0m, 2140m),
            ]
        );

    [Fact]
    public void Computes_totals_and_difference()
    {
        var journal = Balanced();
        journal.TotalDebit.Should().Be(14640m);
        journal.TotalCredit.Should().Be(14640m);
        journal.HasDifference.Should().BeFalse();
        journal.Difference.IsZero.Should().BeTrue();
    }

    [Fact]
    public void Requires_at_least_one_line()
    {
        var act = () =>
            Journal.Create(
                1,
                Guid.NewGuid(),
                Guid.NewGuid(),
                "s",
                "Activation",
                new DateOnly(2024, 10, 5),
                "EUR",
                JournalOrigin.Manual,
                []
            );
        act.Should().Throw<DomainRuleException>();
    }

    [Fact]
    public void A_line_must_book_on_exactly_one_side()
    {
        var journal = Balanced();
        var both = () => journal.AddLine(new JournalLineDraft("x", "d", "LL", 10m, 10m));
        both.Should().Throw<DomainRuleException>();
        var neither = () => journal.AddLine(new JournalLineDraft("x", "d", "LL", 0m, 0m));
        neither.Should().Throw<DomainRuleException>();
        var negative = () => journal.AddLine(new JournalLineDraft("x", "d", "LL", -5m, 0m));
        negative.Should().Throw<DomainRuleException>();
    }

    [Fact]
    public void An_exported_journal_is_immutable()
    {
        var journal = Balanced();
        journal.MarkExported(DateTimeOffset.UtcNow);
        var act = () => journal.AddLine(new JournalLineDraft("x", "d", "LL", 10m, 0m));
        act.Should().Throw<DomainConflictException>().WithMessage("*exported*");
    }

    [Fact]
    public void A_journal_with_a_difference_cannot_be_exported()
    {
        var journal = Balanced();
        journal.AddLine(new JournalLineDraft("192500", "Fees", "Local Legal", 25m, 0m));
        journal.HasDifference.Should().BeTrue();
        var act = () => journal.MarkExported(DateTimeOffset.UtcNow);
        act.Should().Throw<DomainConflictException>();
    }
}

public sealed class EntityChartOfAccountTests
{
    private static EntityChartOfAccount Chart() =>
        EntityChartOfAccount.CreateFromTemplate(
            Guid.NewGuid(),
            "US GAAP Chart Of Account",
            [
                ("1000 Assets", "Account 1000-1999", "1", 0, null),
                ("Receivables And Contracts", "Account 1200-1299", "1.2", 1, "1"),
                ("Contracts", "", "1.2.1", 2, "1.2"),
            ]
        );

    [Fact]
    public void Creates_the_node_tree_from_a_template()
    {
        var chart = Chart();
        chart.Nodes.Should().HaveCount(3);
        var contracts = chart.Nodes.Single(n => n.Order == "1.2.1");
        var parent = chart.Nodes.Single(n => n.Order == "1.2");
        contracts.ParentId.Should().Be(parent.Id);
    }

    [Fact]
    public void Adds_root_and_child_nodes_with_computed_order()
    {
        var chart = Chart();
        var root = chart.AddNode(null, "8000 - Other", "Other accounts");
        root.Order.Should().Be("2");
        root.Depth.Should().Be(0);

        var parent = chart.Nodes.Single(n => n.Order == "1.2");
        var child = chart.AddNode(parent.Id, "Nontrade", "");
        child.Order.Should().Be("1.2.2"); // next free sibling number under 1.2
        child.Depth.Should().Be(2);
    }

    [Fact]
    public void A_node_with_children_cannot_be_removed()
    {
        var chart = Chart();
        var parent = chart.Nodes.Single(n => n.Order == "1.2");
        var act = () => chart.RemoveNode(parent.Id);
        act.Should().Throw<DomainConflictException>().WithMessage("*sub-nodes*");
    }

    [Fact]
    public void A_node_with_placed_accounts_cannot_be_removed()
    {
        var chart = Chart();
        var leaf = chart.Nodes.Single(n => n.Order == "1.2.1");
        chart.PlaceAccount(Guid.NewGuid(), leaf.Id);
        var act = () => chart.RemoveNode(leaf.Id);
        act.Should().Throw<DomainConflictException>().WithMessage("*placed*");
    }

    [Fact]
    public void A_pseudo_account_can_only_be_placed_once()
    {
        var chart = Chart();
        var leaf = chart.Nodes.Single(n => n.Order == "1.2.1");
        var accountId = Guid.NewGuid();
        chart.PlaceAccount(accountId, leaf.Id);
        var act = () => chart.PlaceAccount(accountId, leaf.Id);
        act.Should().Throw<DomainConflictException>().WithMessage("*already placed*");
    }

    [Fact]
    public void Removing_a_placement_frees_the_account_and_the_node()
    {
        var chart = Chart();
        var leaf = chart.Nodes.Single(n => n.Order == "1.2.1");
        var accountId = Guid.NewGuid();
        chart.PlaceAccount(accountId, leaf.Id);
        chart.RemovePlacement(accountId);
        chart.IsPlaced(accountId).Should().BeFalse();
        chart.RemoveNode(leaf.Id); // now allowed
        chart.Nodes.Should().HaveCount(2);
    }
}
