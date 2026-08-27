using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Accounting.AcceptanceTests.Support;
using Accounting.Contracts;
using Accounting.Domain.Formulas;
using Accounting.Domain.Rules;
using Accounting.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Reqnroll;

namespace Accounting.AcceptanceTests.Steps;

[Binding]
public sealed class PostAccountingEventSteps
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private static AcceptanceTestFactory _factory = null!;
    private static HttpClient _client = null!;

    private Guid _legalEntityId;
    private Guid _messageId;
    private HttpResponseMessage? _firstResponse;
    private HttpResponseMessage? _secondResponse;
    private BookingResult? _firstResult;

    private sealed record BookingResult(
        Guid JournalId,
        long GliNumber,
        int LineCount,
        decimal TotalDebit,
        decimal TotalCredit,
        bool HasDifference,
        bool WasAlreadyProcessed
    );

    private sealed record JournalLine(
        int LineNumber,
        string PseudoAccountCode,
        decimal Debit,
        decimal Credit
    );

    private sealed record JournalView(
        long GliNumber,
        decimal TotalDebit,
        decimal TotalCredit,
        bool HasDifference,
        List<JournalLine> Lines
    );

    [BeforeTestRun]
    public static async Task StartApplication()
    {
        _factory = new AcceptanceTestFactory();
        await _factory.InitializeAsync();
        _client = _factory.CreateClient();
        _client.DefaultRequestHeaders.Add("X-Tenant-Id", "demo");
    }

    [AfterTestRun]
    public static async Task StopApplication()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
    }

    [Given(@"a legal entity ""(.*)"" with open period ""(.*)"" and GLI serie (\d+)")]
    public async Task GivenALegalEntity(string ownerCode, string openPeriod, long gliSerie)
    {
        var response = await _client.PostAsJsonAsync(
            "/api/v1/legal-entities",
            new
            {
                // unique name per scenario keeps scenarios independent within one database
                name = $"{ownerCode} {Guid.NewGuid():N}",
                description = ownerCode,
                ownerCode,
                ownerName = "Alliance Laundry Systems",
                baseCurrency = "EUR",
                gliNumberSerie = gliSerie,
                openPeriod,
                responsible = "Pierre Willard",
                coaTemplateName = "US GAAP Chart Of Account",
            }
        );
        var body = await response.Content.ReadAsStringAsync();
        response
            .StatusCode.Should()
            .Be(HttpStatusCode.Created, "creating the legal entity should succeed: {0}", body);
        _legalEntityId = await response.Content.ReadFromJsonAsync<Guid>(Json);
    }

    [Given("the pseudo accounts")]
    public async Task GivenThePseudoAccounts(DataTable table)
    {
        foreach (var row in table.Rows)
        {
            var response = await _client.PostAsJsonAsync(
                $"/api/v1/legal-entities/{_legalEntityId}/pseudo-accounts",
                new { code = row["Code"], description = row["Description"] }
            );
            response.StatusCode.Should().Be(HttpStatusCode.Created);
        }
    }

    [Given(@"an Activation rule set booking ""(.*)"" credit to (\S+) for accounting type ""(.*)""")]
    public Task GivenAConditionalCreditRule(
        string amountType,
        string account,
        string accountingType
    ) => SeedRule(amountType, DebitCredit.Credit, account, accountingType);

    [Given(@"an Activation rule set booking ""(.*)"" debit to (\S+)")]
    public Task GivenADebitRule(string amountType, string account) =>
        SeedRule(amountType, DebitCredit.Debit, account, conditionValue: null);

    [Given(@"an Activation rule set booking ""(.*)"" credit to (\S+)")]
    public Task GivenACreditRule(string amountType, string account) =>
        SeedRule(amountType, DebitCredit.Credit, account, conditionValue: null);

    private async Task SeedRule(
        string amountTypeName,
        DebitCredit side,
        string account,
        string? conditionValue
    )
    {
        // Formula/rule maintenance endpoints are a later increment; seed configuration
        // through the persistence layer, which is legitimate test arrangement.
        using var scope = _factory.Services.CreateScope();
        AcceptanceTestFactory.SetTenant(scope.ServiceProvider);
        var context = scope.ServiceProvider.GetRequiredService<AccountingDbContext>();

        var amountType = await context.AmountTypes.SingleAsync(a => a.Name == amountTypeName);
        var accountingClass = await context.AccountingClasses.SingleAsync(c => c.Code == "PF");
        var ledger = await context.Ledgers.SingleAsync(l => l.Code == "LL");
        var activation = await context.AccountingEvents.SingleAsync(e => e.Code == "s");

        var debitAccount = side == DebitCredit.Debit ? account : null;
        var creditAccount = side == DebitCredit.Credit ? account : null;
        Formula formula;
        if (conditionValue is null)
        {
            formula = Formula.Create(
                $"F{account}",
                $"Formula {amountTypeName}",
                amountTypeName,
                amountType.Id,
                amountTypeName,
                debitAccount,
                creditAccount
            );
        }
        else
        {
            formula = Formula.Create(
                $"F{account}",
                $"Formula {amountTypeName}",
                amountTypeName,
                amountType.Id,
                amountTypeName
            );
            formula.AddCondition(
                1,
                "Accounting Type",
                conditionValue,
                debitAccount,
                creditAccount,
                null
            );
        }

        context.Formulas.Add(formula);
        context.AccountingRules.Add(
            AccountingRule.Create(
                _legalEntityId,
                accountingClass.Id,
                ledger.Id,
                "Local Legal",
                activation.Id,
                formula.Id,
                side
            )
        );
        await context.SaveChangesAsync();
    }

    [When(@"an Activation message arrives with accounting type ""(.*)"" and amounts")]
    public async Task WhenAnActivationMessageArrives(string accountingType, DataTable table)
    {
        var amounts = table.Rows.ToDictionary(
            r => r["AmountType"],
            r => decimal.Parse(r["Amount"], System.Globalization.CultureInfo.InvariantCulture)
        );
        _messageId = Guid.CreateVersion7();
        _firstResponse = await PostEvent("2024-10-05", amounts, accountingType);
        if (_firstResponse.IsSuccessStatusCode)
        {
            _firstResult = await _firstResponse.Content.ReadFromJsonAsync<BookingResult>(Json);
        }
    }

    [When(@"an Activation message arrives booked on ""(.*)""")]
    public async Task WhenAnActivationMessageArrivesBookedOn(string bookingDate)
    {
        _messageId = Guid.CreateVersion7();
        _firstResponse = await PostEvent(
            bookingDate,
            new Dictionary<string, decimal> { ["Fixed Asset Value"] = 100m },
            "MG"
        );
    }

    [When("the same message is delivered again")]
    public async Task WhenTheSameMessageIsDeliveredAgain() =>
        _secondResponse = await PostEvent(
            "2024-10-05",
            new Dictionary<string, decimal> { ["Fixed Asset Value"] = 12500m },
            "MG"
        );

    private async Task<HttpResponseMessage> PostEvent(
        string bookingDate,
        Dictionary<string, decimal> amounts,
        string accountingType
    ) =>
        await _client.PostAsJsonAsync(
            "/api/v1/accounting-events",
            new
            {
                messageId = _messageId,
                legalEntityId = _legalEntityId,
                accountingClassCode = "PF",
                accountingEventCode = "s",
                bookingDate,
                currencyCode = "EUR",
                agreement = "1232",
                agreementLine = 1,
                portfolio = "23",
                amounts,
                attributes = new Dictionary<string, string>
                {
                    ["Accounting Type"] = accountingType,
                },
            }
        );

    [Then(@"a journal is created with GLI number (\d+)")]
    public void ThenAJournalIsCreated(long gliNumber)
    {
        _firstResponse!.StatusCode.Should().Be(HttpStatusCode.Created);
        _firstResult!.GliNumber.Should().Be(gliNumber);
        _firstResult.WasAlreadyProcessed.Should().BeFalse();
    }

    [Then(@"the journal has (\d+) lines")]
    public async Task ThenTheJournalHasLines(int lineCount)
    {
        var journal = await GetJournal(_firstResult!.GliNumber);
        journal.Lines.Should().HaveCount(lineCount);
    }

    [Then(@"the journal total debit is (\S+) and total credit is (\S+)")]
    public async Task ThenTheJournalTotals(decimal totalDebit, decimal totalCredit)
    {
        var journal = await GetJournal(_firstResult!.GliNumber);
        journal.TotalDebit.Should().Be(totalDebit);
        journal.TotalCredit.Should().Be(totalCredit);
    }

    [Then("the journal has no difference")]
    public async Task ThenTheJournalHasNoDifference()
    {
        var journal = await GetJournal(_firstResult!.GliNumber);
        journal.HasDifference.Should().BeFalse();
    }

    [Then(@"a line books credit (\S+) on account ""(.*)""")]
    public async Task ThenALineBooksCredit(decimal credit, string account)
    {
        var journal = await GetJournal(_firstResult!.GliNumber);
        journal.Lines.Should().Contain(l => l.PseudoAccountCode == account && l.Credit == credit);
    }

    [Then("the second delivery reports it was already processed")]
    public async Task ThenTheSecondDeliveryWasAlreadyProcessed()
    {
        _secondResponse!.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await _secondResponse.Content.ReadFromJsonAsync<BookingResult>(Json);
        result!.WasAlreadyProcessed.Should().BeTrue();
        result.GliNumber.Should().Be(_firstResult!.GliNumber);
    }

    [Then("only one journal exists for the legal entity")]
    public async Task ThenOnlyOneJournalExists()
    {
        var journals = await _client.GetFromJsonAsync<List<JsonElement>>(
            $"/api/v1/journals?legalEntityId={_legalEntityId}",
            Json
        );
        journals!.Should().HaveCount(1);
    }

    [Then(@"the message is rejected with status (\d+)")]
    public void ThenTheMessageIsRejected(int statusCode) =>
        ((int)_firstResponse!.StatusCode).Should().Be(statusCode);

    private async Task<JournalView> GetJournal(long gliNumber) =>
        (
            await _client.GetFromJsonAsync<JournalView>(
                $"/api/v1/journals/{gliNumber}?legalEntityId={_legalEntityId}",
                Json
            )
        )!;
}
