using Accounting.Api.Auth;
using Accounting.Api.Middleware;
using Accounting.Application.Common;
using Accounting.Infrastructure;
using Asp.Versioning;
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Scalar.AspNetCore;
using Serilog;
using Wolverine;
using Wolverine.RabbitMQ;
using Wolverine.SqlServer;

var builder = WebApplication.CreateBuilder(args);

// ---------- Logging (§5.3): structured JSON to stdout ----------
builder.Host.UseSerilog(
    (context, configuration) =>
        configuration
            .ReadFrom.Configuration(context.Configuration)
            .Enrich.FromLogContext()
            .WriteTo.Console(new Serilog.Formatting.Compact.CompactJsonFormatter())
);

// ---------- Telemetry (§5.3) ----------
builder
    .Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService("accounting-api"))
    .WithTracing(tracing =>
        tracing.AddAspNetCoreInstrumentation().AddHttpClientInstrumentation().AddOtlpExporter()
    )
    .WithMetrics(metrics => metrics.AddAspNetCoreInstrumentation().AddOtlpExporter());

// ---------- AuthN (§7): OIDC JWT bearer, IdP-agnostic ----------
var authMode = builder.Configuration["Authentication:Mode"];
if (string.Equals(authMode, "Development", StringComparison.OrdinalIgnoreCase))
{
    if (!builder.Environment.IsDevelopment())
    {
        throw new InvalidOperationException(
            "Authentication:Mode=Development is only allowed in the Development environment."
        );
    }

    builder
        .Services.AddAuthentication(DevelopmentAuthenticationHandler.SchemeName)
        .AddScheme<
            Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions,
            DevelopmentAuthenticationHandler
        >(DevelopmentAuthenticationHandler.SchemeName, null);
}
else
{
    builder
        .Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            // Only the Authority differs between Entra ID (SaaS) and Keycloak (self-hosted).
            options.Authority = builder.Configuration["Authentication:Authority"];
            options.Audience = builder.Configuration["Authentication:Audience"];
            options.TokenValidationParameters.ValidateAudience = !string.IsNullOrEmpty(
                builder.Configuration["Authentication:Audience"]
            );
        });
}

builder.Services.AddAuthorization(AuthorizationPolicies.Configure);

// ---------- CORS (§5.8): deny all by default; explicit origins per environment ----------
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
    {
        if (allowedOrigins.Length > 0)
        {
            policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod();
        }
    })
);

// ---------- API surface ----------
builder.Services.AddControllers();
builder
    .Services.AddApiVersioning(options =>
    {
        options.DefaultApiVersion = new ApiVersion(1);
        options.AssumeDefaultVersionWhenUnspecified = true;
        options.ReportApiVersions = true;
    })
    .AddMvc();
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();

// ---------- Application: Mediator (CQRS-lite, §4) + FluentValidation (§5.1) ----------
builder.Services.AddMediator(options =>
{
    options.ServiceLifetime = ServiceLifetime.Scoped;
    options.Assemblies = [typeof(ITenantContext).Assembly];
});
builder.Services.AddScoped(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
builder.Services.AddScoped(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
builder.Services.AddValidatorsFromAssembly(typeof(ITenantContext).Assembly);

// ---------- Infrastructure: tenancy, EF Core, repositories, outbox (§6, §8, §9) ----------
builder.Services.AddInfrastructure(builder.Configuration);

// ---------- Messaging host: Wolverine + RabbitMQ (§2.1, §8) ----------
builder.Host.UseWolverine(options =>
{
    options.ServiceName = "accounting";

    var wolverineConnection = builder.Configuration.GetConnectionString("WolverineDurability");
    if (!string.IsNullOrEmpty(wolverineConnection))
    {
        options.PersistMessagesWithSqlServer(wolverineConnection, "wolverine");
        options.Policies.UseDurableLocalQueues();
    }

    var rabbitConnection = builder.Configuration.GetConnectionString("RabbitMq");
    if (!string.IsNullOrEmpty(rabbitConnection))
    {
        options.UseRabbitMq(new Uri(rabbitConnection)).AutoProvision();
        options
            .PublishMessage<Accounting.Contracts.IntegrationEvents.JournalCreated>()
            .ToRabbitExchange("accounting-events");
        options.ListenToRabbitQueue("accounting-entry-requests");
    }
});

var app = builder.Build();

app.UseSerilogRequestLogging();
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<TenantResolutionMiddleware>();

app.MapControllers();
app.MapHealthChecks("/health/live").AllowAnonymous();
app.MapHealthChecks("/health/ready").AllowAnonymous();
app.MapOpenApi().AllowAnonymous();
if (app.Environment.IsDevelopment())
{
    app.MapScalarApiReference().AllowAnonymous();
}

await app.RunAsync();

/// <summary>Exposed for WebApplicationFactory-based acceptance tests.</summary>
public partial class Program
{
    protected Program() { }
}
