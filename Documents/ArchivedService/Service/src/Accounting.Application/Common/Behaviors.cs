using FluentValidation;
using Mediator;
using Microsoft.Extensions.Logging;

namespace Accounting.Application.Common;

/// <summary>Pipeline order (§4): logging → validation → handler. Transactions are owned
/// by the unit of work inside command handlers.</summary>
public sealed class LoggingBehavior<TMessage, TResponse> : IPipelineBehavior<TMessage, TResponse>
    where TMessage : IMessage
{
    private readonly ILogger<LoggingBehavior<TMessage, TResponse>> _logger;

    public LoggingBehavior(ILogger<LoggingBehavior<TMessage, TResponse>> logger)
    {
        _logger = logger;
    }

    public async ValueTask<TResponse> Handle(
        TMessage message,
        MessageHandlerDelegate<TMessage, TResponse> next,
        CancellationToken cancellationToken
    )
    {
        var name = typeof(TMessage).Name;
        _logger.LogInformation("Handling {UseCase}", name);
        var response = await next(message, cancellationToken);
        _logger.LogInformation("Handled {UseCase}", name);
        return response;
    }
}

public sealed class ValidationBehavior<TMessage, TResponse> : IPipelineBehavior<TMessage, TResponse>
    where TMessage : IMessage
{
    private readonly IEnumerable<IValidator<TMessage>> _validators;

    public ValidationBehavior(IEnumerable<IValidator<TMessage>> validators)
    {
        _validators = validators;
    }

    public async ValueTask<TResponse> Handle(
        TMessage message,
        MessageHandlerDelegate<TMessage, TResponse> next,
        CancellationToken cancellationToken
    )
    {
        foreach (var validator in _validators)
        {
            var result = await validator.ValidateAsync(message, cancellationToken);
            if (!result.IsValid)
            {
                throw new ValidationException(result.Errors);
            }
        }

        return await next(message, cancellationToken);
    }
}
