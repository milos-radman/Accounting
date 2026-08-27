using Accounting.Api.Auth;
using Accounting.Application.Common;
using Accounting.Application.Features.Booking;
using Accounting.Application.Features.Journals;
using Asp.Versioning;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Accounting.Api.Controllers;

[ApiController]
[ApiVersion(1)]
[Route("api/v{version:apiVersion}/journals")]
public sealed class JournalsController : ControllerBase
{
    private readonly IMediator _mediator;

    public JournalsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    [Authorize(AuthorizationPolicies.AccountingRead)]
    public async Task<IReadOnlyList<JournalSummaryDto>> Search(
        [FromQuery] Guid? legalEntityId,
        [FromQuery] bool differenceOnly,
        [FromQuery] DateOnly? bookedFrom,
        [FromQuery] DateOnly? bookedTo,
        [FromQuery] long? gliNumber,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default
    ) =>
        await _mediator.Send(
            new SearchJournalsQuery(
                legalEntityId,
                differenceOnly,
                bookedFrom,
                bookedTo,
                gliNumber,
                page,
                pageSize
            ),
            cancellationToken
        );

    [HttpGet("{gliNumber:long}")]
    [Authorize(AuthorizationPolicies.AccountingRead)]
    public async Task<JournalDto> Get(
        long gliNumber,
        [FromQuery] Guid? legalEntityId,
        CancellationToken cancellationToken
    ) => await _mediator.Send(new GetJournalQuery(gliNumber, legalEntityId), cancellationToken);
}

/// <summary>
/// Synchronous entry point for accounting event messages. The same use case is invoked by
/// the Wolverine consumer when messages arrive on the bus; this endpoint serves testing,
/// simulation UIs and domains that prefer HTTP (§8.1).
/// </summary>
[ApiController]
[ApiVersion(1)]
[Route("api/v{version:apiVersion}/accounting-events")]
public sealed class AccountingEventsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ITenantContext _tenant;

    public AccountingEventsController(IMediator mediator, ITenantContext tenant)
    {
        _mediator = mediator;
        _tenant = tenant;
    }

    public sealed record PostEventRequest
    {
        public Guid? MessageId { get; init; }

        public required Guid LegalEntityId { get; init; }

        public required string AccountingClassCode { get; init; }

        public required string AccountingEventCode { get; init; }

        public required DateOnly BookingDate { get; init; }

        public string? CurrencyCode { get; init; }

        public string? Agreement { get; init; }

        public int? AgreementLine { get; init; }

        public string? Portfolio { get; init; }

        public string? InvoiceNumber { get; init; }

        public Dictionary<string, decimal>? Amounts { get; init; }

        public Dictionary<string, string>? Attributes { get; init; }
    }

    [HttpPost]
    [Authorize(AuthorizationPolicies.AccountingBook)]
    public async Task<ActionResult<ProcessAccountingEventResult>> Post(
        [FromBody] PostEventRequest request,
        CancellationToken cancellationToken
    )
    {
        _ = _tenant.TenantId; // fail fast if the tenant middleware was bypassed

        var result = await _mediator.Send(
            new ProcessAccountingEventCommand(
                request.MessageId ?? Guid.CreateVersion7(),
                request.LegalEntityId,
                request.AccountingClassCode,
                request.AccountingEventCode,
                request.BookingDate,
                request.CurrencyCode ?? "EUR",
                request.Agreement,
                request.AgreementLine,
                request.Portfolio,
                request.InvoiceNumber,
                request.Amounts ?? [],
                request.Attributes ?? []
            ),
            cancellationToken
        );

        return result.WasAlreadyProcessed
            ? Ok(result)
            : CreatedAtAction(
                actionName: nameof(JournalsController.Get),
                controllerName: "Journals",
                routeValues: new { gliNumber = result.GliNumber, version = "1" },
                value: result
            );
    }
}
