using Accounting.Domain.Accounts;
using Accounting.Domain.ChartOfAccounts;
using Accounting.Domain.Common;
using Accounting.Domain.Configuration;
using Accounting.Domain.Formulas;
using Accounting.Domain.Journals;
using Accounting.Domain.LegalEntities;
using Accounting.Domain.Rules;
using Accounting.Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Accounting.Infrastructure.Persistence.Configurations;

internal static class ConfigurationExtensions
{
    public static readonly ValueConverter<Period, int> PeriodConverter = new(
        p => p.Year * 100 + p.Month,
        v => new Period(v / 100, v % 100)
    );

    /// <summary>Base columns (§9): audit, shard key, concurrency token, soft-delete filter.</summary>
    public static void ConfigureBase<T>(this EntityTypeBuilder<T> builder)
        where T : EntityBase
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.CreatedBy).HasMaxLength(100);
        builder.Property(e => e.UpdatedBy).HasMaxLength(100);
        builder.Property(e => e.ShardKey).HasMaxLength(64);
        builder.HasIndex(e => e.ShardKey);
        builder.Property(e => e.RowVersion).IsRowVersion();
        builder.HasQueryFilter(e => !e.IsDeleted);
    }
}

internal sealed class LegalEntityConfiguration : IEntityTypeConfiguration<LegalEntity>
{
    public void Configure(EntityTypeBuilder<LegalEntity> builder)
    {
        builder.ToTable("LegalEntities");
        builder.ConfigureBase();
        builder.Property(e => e.Name).HasMaxLength(200);
        builder.Property(e => e.Description).HasMaxLength(500);
        builder.Property(e => e.OwnerCode).HasMaxLength(20);
        builder.Property(e => e.OwnerName).HasMaxLength(200);
        builder.Property(e => e.BaseCurrency).HasMaxLength(3);
        builder.Property(e => e.Responsible).HasMaxLength(200);
        builder.Property(e => e.OpenPeriod).HasConversion(ConfigurationExtensions.PeriodConverter);
        builder
            .Property(e => e.ClosedPeriod)
            .HasConversion(ConfigurationExtensions.PeriodConverter);
        builder
            .Property(e => e.EndOfMonthPeriod)
            .HasConversion(
                new ValueConverter<Period?, int?>(
                    p => p == null ? null : p.Value.Year * 100 + p.Value.Month,
                    v => v == null ? null : new Period(v.Value / 100, v.Value % 100)
                )
            );
        builder.HasIndex(e => e.OwnerCode);
    }
}

internal sealed class PseudoAccountConfiguration : IEntityTypeConfiguration<PseudoAccount>
{
    public void Configure(EntityTypeBuilder<PseudoAccount> builder)
    {
        builder.ToTable("PseudoAccounts");
        builder.ConfigureBase();
        builder.Property(a => a.Code).HasMaxLength(50);
        builder.Property(a => a.Description).HasMaxLength(200);
        builder.Property(a => a.ExternalCode).HasMaxLength(100);
        builder.Property(a => a.ExternalDescription).HasMaxLength(200);
        builder.HasIndex(a => new { a.LegalEntityId, a.Code }).IsUnique();
    }
}

internal sealed class EntityChartOfAccountConfiguration
    : IEntityTypeConfiguration<EntityChartOfAccount>
{
    public void Configure(EntityTypeBuilder<EntityChartOfAccount> builder)
    {
        builder.ToTable("ChartsOfAccount");
        builder.ConfigureBase();
        builder.Property(c => c.TemplateName).HasMaxLength(200);
        builder.HasIndex(c => c.LegalEntityId).IsUnique();
        builder
            .HasMany(c => c.Nodes)
            .WithOne()
            .HasForeignKey(n => n.ChartId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(c => c.Nodes).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder
            .HasMany(c => c.Placements)
            .WithOne()
            .HasForeignKey(p => p.ChartId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(c => c.Placements).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class CoaNodeConfiguration : IEntityTypeConfiguration<CoaNode>
{
    public void Configure(EntityTypeBuilder<CoaNode> builder)
    {
        builder.ToTable("CoaNodes");
        builder.ConfigureBase();
        builder.Property(n => n.Name).HasMaxLength(200);
        builder.Property(n => n.Description).HasMaxLength(500);
        builder.Property(n => n.Order).HasMaxLength(50);
        builder.HasIndex(n => new { n.ChartId, n.Order });
    }
}

internal sealed class PseudoAccountPlacementConfiguration
    : IEntityTypeConfiguration<PseudoAccountPlacement>
{
    public void Configure(EntityTypeBuilder<PseudoAccountPlacement> builder)
    {
        builder.ToTable("PseudoAccountPlacements");
        builder.ConfigureBase();
        builder.HasIndex(p => new { p.ChartId, p.PseudoAccountId }).IsUnique();
    }
}

internal sealed class FormulaConfiguration : IEntityTypeConfiguration<Formula>
{
    public void Configure(EntityTypeBuilder<Formula> builder)
    {
        builder.ToTable("Formulas");
        builder.ConfigureBase();
        builder.Property(f => f.Code).HasMaxLength(20);
        builder.Property(f => f.Name).HasMaxLength(200);
        builder.Property(f => f.Description).HasMaxLength(500);
        builder.Property(f => f.AmountTypeName).HasMaxLength(100);
        builder.Property(f => f.DebitAccountCode).HasMaxLength(50);
        builder.Property(f => f.CreditAccountCode).HasMaxLength(50);
        builder
            .HasMany(f => f.Conditions)
            .WithOne()
            .HasForeignKey(c => c.FormulaId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(f => f.Conditions).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class FormulaConditionConfiguration : IEntityTypeConfiguration<FormulaCondition>
{
    public void Configure(EntityTypeBuilder<FormulaCondition> builder)
    {
        builder.ToTable("FormulaConditions");
        builder.ConfigureBase();
        builder.Property(c => c.AttributeName).HasMaxLength(100);
        builder.Property(c => c.Value).HasMaxLength(100);
        builder.Property(c => c.DebitAccountCode).HasMaxLength(50);
        builder.Property(c => c.CreditAccountCode).HasMaxLength(50);
        builder.HasIndex(c => new { c.FormulaId, c.Sequence });
    }
}

internal sealed class AccountingRuleConfiguration : IEntityTypeConfiguration<AccountingRule>
{
    public void Configure(EntityTypeBuilder<AccountingRule> builder)
    {
        builder.ToTable("AccountingRules");
        builder.ConfigureBase();
        builder.Property(r => r.LedgerName).HasMaxLength(100);
        builder.HasIndex(r => new
        {
            r.LegalEntityId,
            r.AccountingClassId,
            r.AccountingEventId,
        });
    }
}

internal sealed class JournalConfiguration : IEntityTypeConfiguration<Journal>
{
    public void Configure(EntityTypeBuilder<Journal> builder)
    {
        builder.ToTable("Journals");
        builder.ConfigureBase();
        builder.Property(j => j.AccountingEventCode).HasMaxLength(20);
        builder.Property(j => j.AccountingEventName).HasMaxLength(100);
        builder.Property(j => j.Currency).HasMaxLength(3);
        builder.HasIndex(j => new { j.LegalEntityId, j.GliNumber }).IsUnique();
        builder
            .HasIndex(j => j.SourceMessageId)
            .IsUnique()
            .HasFilter("[SourceMessageId] IS NOT NULL");
        builder
            .HasMany(j => j.Lines)
            .WithOne()
            .HasForeignKey(l => l.JournalId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(j => j.Lines).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Ignore(j => j.Difference);
    }
}

internal sealed class JournalLineConfiguration : IEntityTypeConfiguration<JournalLine>
{
    public void Configure(EntityTypeBuilder<JournalLine> builder)
    {
        builder.ToTable("JournalLines");
        builder.ConfigureBase();
        builder.Property(l => l.PseudoAccountCode).HasMaxLength(50);
        builder.Property(l => l.Description).HasMaxLength(200);
        builder.Property(l => l.LedgerName).HasMaxLength(100);
        builder.Property(l => l.Debit).HasPrecision(18, 2);
        builder.Property(l => l.Credit).HasPrecision(18, 2);
        builder.Property(l => l.Agreement).HasMaxLength(50);
        builder.Property(l => l.InvoiceNumber).HasMaxLength(50);
        builder.Property(l => l.FormulaCode).HasMaxLength(20);
        builder.Property(l => l.AmountTypeName).HasMaxLength(100);
        builder.Property(l => l.ResolutionTrace).HasMaxLength(500);
        builder.Property(l => l.ExternalAccount).HasMaxLength(200);
        builder.HasIndex(l => new { l.JournalId, l.LineNumber }).IsUnique();
    }
}

internal sealed class AccountingClassConfiguration : IEntityTypeConfiguration<AccountingClass>
{
    public void Configure(EntityTypeBuilder<AccountingClass> builder)
    {
        builder.ToTable("AccountingClasses");
        builder.ConfigureBase();
        builder.Property(c => c.Code).HasMaxLength(20);
        builder.Property(c => c.Name).HasMaxLength(100);
        builder.Property(c => c.Description).HasMaxLength(200);
        builder.HasIndex(c => c.Code).IsUnique();
    }
}

internal sealed class LedgerConfiguration : IEntityTypeConfiguration<Ledger>
{
    public void Configure(EntityTypeBuilder<Ledger> builder)
    {
        builder.ToTable("Ledgers");
        builder.ConfigureBase();
        builder.Property(l => l.Code).HasMaxLength(20);
        builder.Property(l => l.Name).HasMaxLength(100);
        builder.Property(l => l.Description).HasMaxLength(200);
        builder.HasIndex(l => l.Code).IsUnique();
    }
}

internal sealed class AccountingEventConfiguration : IEntityTypeConfiguration<AccountingEvent>
{
    public void Configure(EntityTypeBuilder<AccountingEvent> builder)
    {
        builder.ToTable("AccountingEvents");
        builder.ConfigureBase();
        builder.Property(e => e.Code).HasMaxLength(20);
        builder.Property(e => e.Name).HasMaxLength(100);
        builder.Property(e => e.Description).HasMaxLength(500);
        builder.HasIndex(e => e.Code).IsUnique();
    }
}

internal sealed class AmountTypeConfiguration : IEntityTypeConfiguration<AmountType>
{
    public void Configure(EntityTypeBuilder<AmountType> builder)
    {
        builder.ToTable("AmountTypes");
        builder.ConfigureBase();
        builder.Property(a => a.Name).HasMaxLength(100);
        builder.Property(a => a.Description).HasMaxLength(500);
        builder.HasIndex(a => a.Name).IsUnique();
    }
}

internal sealed class ConditionAttributeConfiguration : IEntityTypeConfiguration<ConditionAttribute>
{
    public void Configure(EntityTypeBuilder<ConditionAttribute> builder)
    {
        builder.ToTable("ConditionAttributes");
        builder.ConfigureBase();
        builder.Property(a => a.Name).HasMaxLength(100);
        builder.HasIndex(a => a.Name).IsUnique();
    }
}
