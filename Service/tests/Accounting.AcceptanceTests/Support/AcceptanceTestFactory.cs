using Accounting.Infrastructure.Persistence;
using Accounting.Infrastructure.Seeding;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.MsSql;

namespace Accounting.AcceptanceTests.Support;

/// <summary>
/// Boots the real API pipeline (auth, tenant middleware, mediator, EF, outbox) for
/// acceptance tests. Database strategy per the blueprint (§11): SQL Server via
/// Testcontainers when Docker is available; otherwise falls back to SQLite in-memory so
/// the suite still runs on developer machines without Docker. CI always uses SQL Server.
/// </summary>
public sealed class AcceptanceTestFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private MsSqlContainer? _sqlContainer;
    private SqliteConnection? _sqliteConnection;
    private bool _useSqlServer;

    public async Task InitializeAsync()
    {
        _useSqlServer = await TryStartSqlServerAsync();
        if (!_useSqlServer)
        {
            _sqliteConnection = new SqliteConnection("DataSource=:memory:");
            await _sqliteConnection.OpenAsync();
        }

        // Create the schema and seed reference data once per factory.
        using var scope = Services.CreateScope();
        SetTenant(scope.ServiceProvider);
        var context = scope.ServiceProvider.GetRequiredService<AccountingDbContext>();
        if (_useSqlServer)
        {
            await context.Database.MigrateAsync();
        }
        else
        {
            await context.Database.EnsureCreatedAsync();
        }

        await ReferenceDataSeeder.SeedAsync(context);
    }

    public new async Task DisposeAsync()
    {
        await base.DisposeAsync();
        if (_sqlContainer is not null)
        {
            await _sqlContainer.DisposeAsync();
        }

        if (_sqliteConnection is not null)
        {
            await _sqliteConnection.DisposeAsync();
        }
    }

    public static void SetTenant(IServiceProvider scopedProvider) =>
        scopedProvider
            .GetRequiredService<Accounting.Infrastructure.Tenancy.RequestContext>()
            .Set("demo", "acceptance-tests");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("Authentication:Mode", "Development");
        builder.UseSetting("ConnectionStrings:RabbitMq", string.Empty);
        builder.UseSetting("ConnectionStrings:WolverineDurability", string.Empty);
        builder.UseSetting("TenantRegistry:Tenants:demo", "unused-overridden-below");

        builder.ConfigureServices(services =>
        {
            // Swap the tenant-resolved SQL Server registration for the test database. EF Core 9+
            // registers configuration actions through an internal IDbContextOptionsConfiguration
            // service; both it and the options descriptor must go, or the SQL Server and SQLite
            // providers end up on the same options instance.
            var descriptors = services
                .Where(d =>
                    d.ServiceType == typeof(DbContextOptions<AccountingDbContext>)
                    || (
                        d.ServiceType.IsGenericType
                        && d.ServiceType.Name.Contains(
                            "IDbContextOptionsConfiguration",
                            StringComparison.Ordinal
                        )
                        && d.ServiceType.GenericTypeArguments.Contains(typeof(AccountingDbContext))
                    )
                )
                .ToList();
            foreach (var descriptor in descriptors)
            {
                services.Remove(descriptor);
            }

            services.AddDbContext<AccountingDbContext>(
                (sp, options) =>
                {
                    if (_useSqlServer)
                    {
                        options.UseSqlServer(_sqlContainer!.GetConnectionString());
                    }
                    else
                    {
                        options.UseSqlite(_sqliteConnection!);
                    }

                    options.AddInterceptors(sp.GetRequiredService<AuditSaveChangesInterceptor>());
                }
            );
        });
    }

    private async Task<bool> TryStartSqlServerAsync()
    {
        try
        {
            _sqlContainer = new MsSqlBuilder("mcr.microsoft.com/mssql/server:2022-latest").Build();
            await _sqlContainer.StartAsync();
            return true;
        }
        catch (Exception)
        {
            _sqlContainer = null;
            return false; // no Docker on this machine — SQLite fallback
        }
    }
}
