using Microsoft.AspNetCore.Authorization;

namespace Accounting.Api.Auth;

/// <summary>
/// Policy-based authorization (§7). Policies are defined once here and referenced by
/// name on endpoints. All endpoints require authentication by default (fallback policy).
/// </summary>
public static class AuthorizationPolicies
{
    /// <summary>Read access to accounting data.</summary>
    public const string AccountingRead = "accounting:read";

    /// <summary>Maintain configuration (rules, formulas, accounts, chart of account).</summary>
    public const string AccountingConfigure = "accounting:configure";

    /// <summary>Post accounting event messages and create journals.</summary>
    public const string AccountingBook = "accounting:book";

    public static void Configure(AuthorizationOptions options)
    {
        options.FallbackPolicy = new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .Build();

        options.AddPolicy(
            AccountingRead,
            policy => policy.RequireAuthenticatedUser().RequireClaim("tenant_id")
        );

        options.AddPolicy(
            AccountingConfigure,
            policy => policy.RequireAuthenticatedUser().RequireClaim("tenant_id")
        );

        options.AddPolicy(
            AccountingBook,
            policy => policy.RequireAuthenticatedUser().RequireClaim("tenant_id")
        );
    }
}
