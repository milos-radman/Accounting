using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Accounting.Api.Auth;

/// <summary>
/// Local-development / demo authentication: issues a fixed principal so the service runs
/// without an identity provider. Activated exclusively when `Authentication:Mode` is
/// "Development" AND the environment is Development or Demo — Program.cs refuses the
/// combination anywhere else.
/// </summary>
public sealed class DevelopmentAuthenticationHandler
    : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "Development";

    public DevelopmentAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder
    )
        : base(options, logger, encoder) { }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var tenant =
            Request.Headers.TryGetValue("X-Tenant-Id", out var header)
            && !string.IsNullOrWhiteSpace(header)
                ? header.ToString()
                : "demo";
        var identity = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, "dev-user"),
                new Claim("sub", "dev-user"),
                new Claim("tenant_id", tenant),
                new Claim("scope", "accounting:read accounting:configure accounting:book"),
            ],
            SchemeName
        );
        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
