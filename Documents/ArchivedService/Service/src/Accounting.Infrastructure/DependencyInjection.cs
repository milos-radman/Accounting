using Accounting.Application.Common;
using Accounting.Application.Features.LegalEntities;
using Accounting.Infrastructure.Persistence;
using Accounting.Infrastructure.Seeding;
using Accounting.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Wolverine.EntityFrameworkCore;

namespace Accounting.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration
    )
    {
        // Tenancy (§6): scoped context + configuration-backed connection registry.
        services.AddScoped<RequestContext>();
        services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<RequestContext>());
        services.AddScoped<ICurrentUser>(sp => sp.GetRequiredService<RequestContext>());
        services.Configure<TenantRegistryOptions>(configuration.GetSection("TenantRegistry"));
        services.AddSingleton<
            ITenantConnectionStringProvider,
            ConfigurationTenantConnectionStringProvider
        >();
        services.AddSingleton(TimeProvider.System);
        services.AddScoped<AuditSaveChangesInterceptor>();

        // EF Core (§9): per-request DbContext resolving the tenant's connection string.
        void ConfigureDb(IServiceProvider sp, DbContextOptionsBuilder options)
        {
            var tenant = sp.GetRequiredService<ITenantContext>();
            var connectionStrings = sp.GetRequiredService<ITenantConnectionStringProvider>();
            options.UseSqlServer(connectionStrings.GetConnectionString(tenant.TenantId));
            options.AddInterceptors(sp.GetRequiredService<AuditSaveChangesInterceptor>());
        }

        // Transactional outbox (§8.2) needs Wolverine's durable message store. When it is
        // not configured (local dev / demo / tests) use a plain DbContext and publish inline
        // after save — Wolverine's EF integration cannot build the model without that store.
        var durabilityConfigured = !string.IsNullOrEmpty(
            configuration.GetConnectionString("WolverineDurability")
        );
        if (durabilityConfigured)
        {
            // ponytail: unverified path. Wolverine registers DbContextOptions as a singleton,
            // which likely freezes the first-resolved tenant; verify before enabling the outbox.
            services.AddDbContextWithWolverineIntegration<AccountingDbContext>(ConfigureDb);
        }
        else
        {
            services.AddDbContext<AccountingDbContext>(ConfigureDb);
        }

        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));

        if (durabilityConfigured)
        {
            services.AddScoped<WolverineOutboxUnitOfWork>();
            services.AddScoped<IUnitOfWork>(sp =>
                sp.GetRequiredService<WolverineOutboxUnitOfWork>()
            );
            services.AddScoped<IIntegrationEventPublisher>(sp =>
                sp.GetRequiredService<WolverineOutboxUnitOfWork>()
            );
        }
        else
        {
            services.AddScoped<DirectUnitOfWork>();
            services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<DirectUnitOfWork>());
            services.AddScoped<IIntegrationEventPublisher>(sp =>
                sp.GetRequiredService<DirectUnitOfWork>()
            );
        }

        services.AddSingleton<ICoaTemplateProvider, CoaTemplateProvider>();

        return services;
    }
}

/// <summary>
/// Design-time factory for `dotnet ef migrations`. Uses a local connection string only;
/// at runtime the connection always comes from the tenant registry.
/// </summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AccountingDbContext>
{
    public AccountingDbContext CreateDbContext(string[] args)
    {
        // Override via ACCOUNTING_DESIGN_CONNECTION when the local SQL setup differs.
        var connectionString =
            Environment.GetEnvironmentVariable("ACCOUNTING_DESIGN_CONNECTION")
            ?? "Server=localhost,1433;Database=accounting_design;Integrated Security=true;TrustServerCertificate=true";
        var options = new DbContextOptionsBuilder<AccountingDbContext>()
            .UseSqlServer(connectionString)
            .Options;
        return new AccountingDbContext(options);
    }
}
