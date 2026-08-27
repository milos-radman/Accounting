using System.Security.Claims;
using Accounting.Application.Common;
using Accounting.Domain.Common;
using Accounting.Infrastructure.Tenancy;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;

namespace Accounting.Api.Middleware;

/// <summary>
/// Resolves the tenant from the `tenant_id` claim into the scoped RequestContext (§6).
/// No request reaches a handler without a resolved tenant; missing/unknown → 400.
/// Health and OpenAPI endpoints are exempt.
/// </summary>
public sealed class TenantResolutionMiddleware
{
    private static readonly string[] ExemptPrefixes = ["/health", "/openapi", "/scalar"];

    private readonly RequestDelegate _next;

    public TenantResolutionMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, RequestContext requestContext)
    {
        if (Array.Exists(ExemptPrefixes, p => context.Request.Path.StartsWithSegments(p)))
        {
            await _next(context);
            return;
        }

        var tenantId = context.User.FindFirstValue("tenant_id");
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            await Results
                .Problem(
                    statusCode: StatusCodes.Status400BadRequest,
                    title: "Missing tenant",
                    detail: "The request carries no tenant_id claim."
                )
                .ExecuteAsync(context);
            return;
        }

        var userId =
            context.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? context.User.FindFirstValue("sub")
            ?? "unknown";
        requestContext.Set(tenantId, userId);
        await _next(context);
    }
}

/// <summary>Maps exceptions to RFC 7807 ProblemDetails responses (§5.2).</summary>
public sealed class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(
        RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger
    )
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception exception) when (!context.Response.HasStarted)
        {
            await WriteProblem(context, exception);
        }
    }

    private async Task WriteProblem(HttpContext context, Exception exception)
    {
        var correlationId = context.TraceIdentifier;
        (int status, string title, string? detail) = exception switch
        {
            ValidationException v => (
                StatusCodes.Status400BadRequest,
                "Validation failed",
                string.Join("; ", v.Errors.Select(e => e.ErrorMessage))
            ),
            NotFoundException => (StatusCodes.Status404NotFound, "Not found", exception.Message),
            DomainConflictException => (
                StatusCodes.Status409Conflict,
                "Conflict",
                exception.Message
            ),
            DomainRuleException => (
                StatusCodes.Status422UnprocessableEntity,
                "Business rule violated",
                exception.Message
            ),
            DomainException => (
                StatusCodes.Status422UnprocessableEntity,
                "Business rule violated",
                exception.Message
            ),
            UnknownTenantException => (
                StatusCodes.Status400BadRequest,
                "Unknown tenant",
                exception.Message
            ),
            UnauthorizedAccessException => (StatusCodes.Status403Forbidden, "Forbidden", null),
            _ => (StatusCodes.Status500InternalServerError, "An unexpected error occurred", null),
        };

        if (status == StatusCodes.Status500InternalServerError)
        {
            // Full exception is logged, never returned to the client (§5.2).
            _logger.LogError(
                exception,
                "Unhandled exception; correlation {CorrelationId}",
                correlationId
            );
        }

        var problem = new ProblemDetails
        {
            Status = status,
            Title = title,
            Detail = detail,
            Instance = context.Request.Path,
        };
        problem.Extensions["correlationId"] = correlationId;

        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(problem);
    }
}
