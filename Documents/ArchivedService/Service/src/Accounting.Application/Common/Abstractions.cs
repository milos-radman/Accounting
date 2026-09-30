using Mediator;

namespace Accounting.Application.Common;

// Our own CQRS abstractions on top of Mediator.Abstractions (§2.1 of the blueprint):
// application code depends on these, which keeps a future mediator swap a one-week effort.

/// <summary>A state-changing use case. Wrapped in a transaction by the pipeline.</summary>
public interface ICommand<out TResponse> : IRequest<TResponse>;

/// <summary>A read-only use case returning DTOs, never entities.</summary>
public interface IQuery<out TResponse> : IRequest<TResponse>;

public interface ICommandHandler<in TCommand, TResponse> : IRequestHandler<TCommand, TResponse>
    where TCommand : ICommand<TResponse>;

public interface IQueryHandler<in TQuery, TResponse> : IRequestHandler<TQuery, TResponse>
    where TQuery : IQuery<TResponse>;

/// <summary>Resolved tenant of the current request/message. Set by middleware (§6).</summary>
public interface ITenantContext
{
    string TenantId { get; }
}

/// <summary>The authenticated principal of the current request/message.</summary>
public interface ICurrentUser
{
    string UserId { get; }
}

/// <summary>Unit of work: commits all aggregate changes of one use case atomically.</summary>
public interface IUnitOfWork
{
    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}

/// <summary>Thin collection-like repository over aggregates (§9).</summary>
public interface IRepository<T>
    where T : class
{
    Task<T?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    void Add(T entity);

    void Remove(T entity);

    /// <summary>Read-side flexibility: handlers shape queries, repositories stay thin.</summary>
    IQueryable<T> Query();
}

/// <summary>
/// Publishes integration events through the transactional outbox (§8.2). The publish
/// participates in the same transaction as the unit of work's SaveChanges.
/// </summary>
public interface IIntegrationEventPublisher
{
    ValueTask PublishAsync<TEvent>(
        TEvent integrationEvent,
        CancellationToken cancellationToken = default
    )
        where TEvent : class;
}
