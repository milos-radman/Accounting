using Accounting.Application.Common;
using Accounting.Domain.Accounts;
using Accounting.Domain.ChartOfAccounts;
using Accounting.Domain.Common;
using Accounting.Domain.Configuration;
using Accounting.Domain.Formulas;
using Accounting.Domain.Journals;
using Accounting.Domain.LegalEntities;
using Accounting.Domain.Rules;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Accounting.Infrastructure.Persistence;

public sealed class AccountingDbContext : DbContext
{
    public const string Schema = "accounting";

    public AccountingDbContext(DbContextOptions<AccountingDbContext> options)
        : base(options) { }

    public DbSet<LegalEntity> LegalEntities => Set<LegalEntity>();

    public DbSet<PseudoAccount> PseudoAccounts => Set<PseudoAccount>();

    public DbSet<EntityChartOfAccount> ChartsOfAccount => Set<EntityChartOfAccount>();

    public DbSet<Formula> Formulas => Set<Formula>();

    public DbSet<AccountingRule> AccountingRules => Set<AccountingRule>();

    public DbSet<Journal> Journals => Set<Journal>();

    public DbSet<AccountingClass> AccountingClasses => Set<AccountingClass>();

    public DbSet<Ledger> Ledgers => Set<Ledger>();

    public DbSet<AccountingEvent> AccountingEvents => Set<AccountingEvent>();

    public DbSet<AmountType> AmountTypes => Set<AmountType>();

    public DbSet<ConditionAttribute> ConditionAttributes => Set<ConditionAttribute>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AccountingDbContext).Assembly);

        // Provider portability: SQLite (used by tests on machines without Docker) has no
        // rowversion generation, so give the column a database default. Optimistic
        // concurrency is exercised against real SQL Server in integration/CI runs.
        if (Database.ProviderName?.Contains("Sqlite", StringComparison.Ordinal) == true)
        {
            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            {
                var rowVersion = entityType.FindProperty(nameof(EntityBase.RowVersion));
                rowVersion?.SetDefaultValue(new byte[] { 0 });
            }
        }
    }
}

/// <summary>
/// Fills audit columns and the shard key on every write (§9). The shard key is the
/// TenantId — present from day one so future sharding needs no data migration (§6).
/// </summary>
public sealed class AuditSaveChangesInterceptor : SaveChangesInterceptor
{
    private readonly ITenantContext _tenant;
    private readonly ICurrentUser _user;
    private readonly TimeProvider _clock;

    public AuditSaveChangesInterceptor(ITenantContext tenant, ICurrentUser user, TimeProvider clock)
    {
        _tenant = tenant;
        _user = user;
        _clock = clock;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default
    )
    {
        ApplyAudit(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result
    )
    {
        ApplyAudit(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    private void ApplyAudit(DbContext? context)
    {
        if (context is null)
        {
            return;
        }

        var now = _clock.GetUtcNow();
        foreach (var entry in context.ChangeTracker.Entries<EntityBase>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.SetCreated(now, _user.UserId, _tenant.TenantId);
                    break;
                case EntityState.Modified:
                    entry.Entity.SetUpdated(now, _user.UserId);
                    break;
                default:
                    break;
            }
        }
    }
}
