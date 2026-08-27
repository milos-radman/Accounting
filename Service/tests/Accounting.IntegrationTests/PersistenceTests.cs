using Accounting.Domain.Accounts;
using Accounting.Domain.LegalEntities;
using Accounting.Domain.ValueObjects;
using Accounting.Infrastructure.Persistence;
using Accounting.Infrastructure.Seeding;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Testcontainers.MsSql;
using Xunit;

namespace Accounting.IntegrationTests;

/// <summary>
/// Infrastructure tests against real SQL Server via Testcontainers (§11).
/// Requires Docker — run with `dotnet test --filter Category=RequiresDocker` in CI;
/// exclude the category on machines without Docker.
/// </summary>
[Trait("Category", "RequiresDocker")]
public sealed class PersistenceTests : IAsyncLifetime
{
    private readonly MsSqlContainer _sql = new MsSqlBuilder(
        "mcr.microsoft.com/mssql/server:2022-latest"
    ).Build();

    public Task InitializeAsync() => _sql.StartAsync();

    public Task DisposeAsync() => _sql.DisposeAsync().AsTask();

    private AccountingDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AccountingDbContext>()
            .UseSqlServer(_sql.GetConnectionString())
            .Options;
        return new AccountingDbContext(options);
    }

    [Fact]
    public async Task Migrations_apply_and_reference_data_seeds_idempotently()
    {
        await using var context = CreateContext();
        await context.Database.MigrateAsync();

        await ReferenceDataSeeder.SeedAsync(context);
        await ReferenceDataSeeder.SeedAsync(context); // idempotent

        (await context.AccountingClasses.CountAsync()).Should().Be(5);
        (await context.Ledgers.CountAsync()).Should().Be(3);
        (await context.AccountingEvents.CountAsync()).Should().Be(12);
        (await context.AmountTypes.CountAsync()).Should().Be(28);
    }

    [Fact]
    public async Task Legal_entity_roundtrips_with_period_conversion_and_rowversion()
    {
        await using (var context = CreateContext())
        {
            await context.Database.MigrateAsync();
            var entity = LegalEntity.Create(
                "Alliance Laundry (Netherlands) B.V.",
                "NLD",
                "ALS NLD",
                "Alliance Laundry Systems",
                "EUR",
                7414,
                Period.Parse("202410"),
                "Pierre Willard"
            );
            entity.SetCreated(DateTimeOffset.UtcNow, "test", "demo");
            context.LegalEntities.Add(entity);
            await context.SaveChangesAsync();
        }

        await using (var context = CreateContext())
        {
            var loaded = await context.LegalEntities.SingleAsync(e => e.OwnerCode == "ALS NLD");
            loaded.OpenPeriod.Should().Be(Period.Parse("202410"));
            loaded.ClosedPeriod.Should().Be(Period.Parse("202409"));
            loaded.RowVersion.Should().NotBeEmpty("SQL Server generates the rowversion");
        }
    }

    [Fact]
    public async Task Duplicate_pseudo_account_codes_per_entity_are_rejected_by_the_unique_index()
    {
        await using var context = CreateContext();
        await context.Database.MigrateAsync();

        var entityId = Guid.NewGuid();
        var first = PseudoAccount.Register(entityId, "140000", "Equipment Purchases");
        first.SetCreated(DateTimeOffset.UtcNow, "test", "demo");
        context.PseudoAccounts.Add(first);
        await context.SaveChangesAsync();

        var duplicate = PseudoAccount.Register(entityId, "140000", "Duplicate");
        duplicate.SetCreated(DateTimeOffset.UtcNow, "test", "demo");
        context.PseudoAccounts.Add(duplicate);
        var act = () => context.SaveChangesAsync();
        await act.Should().ThrowAsync<DbUpdateException>();
    }
}
