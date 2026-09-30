using Accounting.Application.Common;
using Microsoft.Extensions.Options;

namespace Accounting.Infrastructure.Tenancy;

/// <summary>
/// Scoped holder for the resolved tenant and user of the current request or message.
/// Populated by the API tenant middleware or the message consumer before any handler runs (§6).
/// </summary>
public sealed class RequestContext : ITenantContext, ICurrentUser
{
    private string? _tenantId;

    public string TenantId =>
        _tenantId
        ?? throw new InvalidOperationException(
            "No tenant has been resolved for the current scope. "
                + "This indicates a request bypassed the tenant middleware."
        );

    public string UserId { get; private set; } = "system";

    public bool HasTenant => _tenantId is not null;

    public void Set(string tenantId, string userId)
    {
        _tenantId = tenantId;
        UserId = userId;
    }
}

/// <summary>
/// Resolves the tenant's database connection string. Phase 1: a configuration-backed
/// registry (section "Tenants"). The central tenant-registry service replaces this
/// provider later without touching callers (§6).
/// </summary>
public interface ITenantConnectionStringProvider
{
    string GetConnectionString(string tenantId);
}

public sealed class TenantRegistryOptions
{
    /// <summary>TenantId → SQL connection string.</summary>
    public Dictionary<string, string> Tenants { get; } = new(StringComparer.OrdinalIgnoreCase);
}

internal sealed class ConfigurationTenantConnectionStringProvider : ITenantConnectionStringProvider
{
    private readonly IOptionsMonitor<TenantRegistryOptions> _options;

    public ConfigurationTenantConnectionStringProvider(
        IOptionsMonitor<TenantRegistryOptions> options
    )
    {
        _options = options;
    }

    public string GetConnectionString(string tenantId)
    {
        if (_options.CurrentValue.Tenants.TryGetValue(tenantId, out var connectionString))
        {
            return connectionString;
        }

        throw new UnknownTenantException(tenantId);
    }
}

public sealed class UnknownTenantException : Exception
{
    public UnknownTenantException(string tenantId)
        : base($"Tenant '{tenantId}' is not registered.") { }
}
