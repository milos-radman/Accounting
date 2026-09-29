using Accounting.Application.Features.LegalEntities;
using Accounting.Application.Features.PseudoAccounts;
using Accounting.Contracts;
using Accounting.Domain.Formulas;
using Accounting.Domain.Rules;
using Accounting.Infrastructure.Persistence;
using Accounting.Infrastructure.Tenancy;
using Mediator;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Accounting.Infrastructure.Seeding;

/// <summary>
/// Applies migrations and seeds reference data for every registered tenant at startup.
/// Enabled by `Database:MigrateOnStartup`; `Database:SeedDemoData` additionally creates a
/// bookable sample legal entity (demo / single-instance hosting only).
/// </summary>
public static class DatabaseInitializer
{
    // ponytail: runs inline at startup, sequentially per tenant. Fine for one demo instance;
    // with multiple instances or many tenants, move to a deploy-time migration step.
    public static async Task MigrateAndSeedAllTenantsAsync(
        IServiceProvider services,
        bool seedDemoData,
        CancellationToken cancellationToken = default
    )
    {
        var tenants = services
            .GetRequiredService<IOptions<TenantRegistryOptions>>()
            .Value.Tenants.Keys;
        foreach (var tenantId in tenants)
        {
            using var scope = services.CreateScope();
            scope.ServiceProvider.GetRequiredService<RequestContext>().Set(tenantId, "startup");
            var context = scope.ServiceProvider.GetRequiredService<AccountingDbContext>();
            await context.Database.MigrateAsync(cancellationToken);
            await ReferenceDataSeeder.SeedAsync(context, cancellationToken);
            if (seedDemoData && !await context.LegalEntities.AnyAsync(cancellationToken))
            {
                await SeedDemoDataAsync(scope.ServiceProvider, context, cancellationToken);
            }
        }
    }

    /// <summary>
    /// The "Activation" scenario from PostAccountingEvent.feature, so a fresh demo database
    /// can book a journal straight away. Rules are inserted directly because there is no
    /// rule-maintenance API yet (same approach as the acceptance tests).
    /// </summary>
    private static async Task SeedDemoDataAsync(
        IServiceProvider scoped,
        AccountingDbContext context,
        CancellationToken cancellationToken
    )
    {
        var sender = scoped.GetRequiredService<ISender>();
        var legalEntityId = await sender.Send(
            new CreateLegalEntityCommand(
                "ALS NLD",
                "Demo legal entity",
                "ALS NLD",
                "Alliance Laundry Systems",
                "EUR",
                7414,
                "202410",
                "Demo",
                "US GAAP Chart Of Account"
            ),
            cancellationToken
        );

        foreach (
            var (code, description) in new[]
            {
                ("140000", "Equipment Purchases"),
                ("192101", "Lease Rec - Curr Year Volume"),
                ("192401", "Unearn Inc - Curr Year"),
            }
        )
        {
            await sender.Send(
                new RegisterPseudoAccountCommand(legalEntityId, code, description, null, null),
                cancellationToken
            );
        }

        var accountingClass = await context.AccountingClasses.SingleAsync(
            c => c.Code == "PF",
            cancellationToken
        );
        var ledger = await context.Ledgers.SingleAsync(l => l.Code == "LL", cancellationToken);
        var activation = await context.AccountingEvents.SingleAsync(
            e => e.Code == "s",
            cancellationToken
        );

        async Task AddRule(string amountTypeName, DebitCredit side, string account, string? mg)
        {
            var amountType = await context.AmountTypes.SingleAsync(
                a => a.Name == amountTypeName,
                cancellationToken
            );
            var debit = side == DebitCredit.Debit ? account : null;
            var credit = side == DebitCredit.Credit ? account : null;
            var formula = mg is null
                ? Formula.Create(
                    $"F{account}",
                    $"Formula {amountTypeName}",
                    amountTypeName,
                    amountType.Id,
                    amountTypeName,
                    debit,
                    credit
                )
                : Formula.Create(
                    $"F{account}",
                    $"Formula {amountTypeName}",
                    amountTypeName,
                    amountType.Id,
                    amountTypeName
                );
            if (mg is not null)
            {
                formula.AddCondition(1, "Accounting Type", mg, debit, credit, null);
            }

            context.Formulas.Add(formula);
            context.AccountingRules.Add(
                AccountingRule.Create(
                    legalEntityId,
                    accountingClass.Id,
                    ledger.Id,
                    "Local Legal",
                    activation.Id,
                    formula.Id,
                    side
                )
            );
        }

        await AddRule("Fixed Asset Value", DebitCredit.Credit, "140000", "MG");
        await AddRule("Total Plan Rent", DebitCredit.Debit, "192101", null);
        await AddRule("Total Plan Interest", DebitCredit.Credit, "192401", null);
        await context.SaveChangesAsync(cancellationToken);
    }
}
