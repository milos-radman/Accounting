using Accounting.Application.Features.Booking;
using Accounting.Contracts.IntegrationEvents;
using Accounting.Infrastructure.Tenancy;
using Mediator;
using Microsoft.Extensions.Logging;

namespace Accounting.Infrastructure.Messaging;

/// <summary>
/// Wolverine consumer for <see cref="AccountingEntryRequested"/> (discovered by convention,
/// §13). Resolves the tenant from the message, then dispatches the booking use case.
/// Idempotency lives in the use case: a redelivered MessageId returns the existing journal.
/// </summary>
public sealed class AccountingEntryRequestedHandler
{
    private readonly IMediator _mediator;
    private readonly RequestContext _requestContext;
    private readonly ILogger<AccountingEntryRequestedHandler> _logger;

    public AccountingEntryRequestedHandler(
        IMediator mediator,
        RequestContext requestContext,
        ILogger<AccountingEntryRequestedHandler> logger
    )
    {
        _mediator = mediator;
        _requestContext = requestContext;
        _logger = logger;
    }

    public async Task Handle(AccountingEntryRequested message, CancellationToken cancellationToken)
    {
        _requestContext.Set(message.TenantId, "message-bus");

        var result = await _mediator.Send(
            new ProcessAccountingEventCommand(
                message.MessageId,
                message.LegalEntityId,
                message.AccountingClassCode,
                message.AccountingEventCode,
                message.BookingDate,
                message.CurrencyCode,
                message.Agreement,
                message.AgreementLine,
                message.Portfolio,
                message.InvoiceNumber,
                message.Amounts,
                message.Attributes
            ),
            cancellationToken
        );

        if (result.WasAlreadyProcessed)
        {
            _logger.LogInformation(
                "Duplicate delivery of message {MessageId} ignored; GLI {GliNumber} already exists",
                message.MessageId,
                result.GliNumber
            );
        }
        else
        {
            _logger.LogInformation(
                "Created GLI {GliNumber} with {LineCount} lines from message {MessageId}",
                result.GliNumber,
                result.LineCount,
                message.MessageId
            );
        }
    }
}
