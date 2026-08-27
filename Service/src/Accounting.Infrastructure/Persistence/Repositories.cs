using Accounting.Application.Common;
using Accounting.Domain.Common;
using Microsoft.EntityFrameworkCore;
using Wolverine;
using Wolverine.EntityFrameworkCore;

namespace Accounting.Infrastructure.Persistence;

/// <summary>Thin collection-like repository over aggregates (§9).</summary>
internal sealed class Repository<T> : IRepository<T>
    where T : EntityBase
{
    private readonly AccountingDbContext _context;

    public Repository(AccountingDbContext context)
    {
        _context = context;
    }

    public async Task<T?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        await _context.Set<T>().FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

    public void Add(T entity) => _context.Set<T>().Add(entity);

    public void Remove(T entity) => entity.MarkDeleted(); // soft delete (§9)

    public IQueryable<T> Query() => _context.Set<T>();
}

/// <summary>
/// Unit of work over the Wolverine transactional outbox (§8.2): integration events published
/// during a use case are stored in the same transaction as the aggregate changes and flushed
/// to the broker afterwards. Selected when durable message persistence is configured.
/// </summary>
internal sealed class WolverineOutboxUnitOfWork : IUnitOfWork, IIntegrationEventPublisher
{
    private readonly IDbContextOutbox<AccountingDbContext> _outbox;

    public WolverineOutboxUnitOfWork(IDbContextOutbox<AccountingDbContext> outbox)
    {
        _outbox = outbox;
    }

    public ValueTask PublishAsync<TEvent>(
        TEvent integrationEvent,
        CancellationToken cancellationToken = default
    )
        where TEvent : class => _outbox.PublishAsync(integrationEvent);

    public Task SaveChangesAsync(CancellationToken cancellationToken = default) =>
        _outbox.SaveChangesAndFlushMessagesAsync(cancellationToken);
}

/// <summary>
/// Fallback unit of work for local development and tests where no durable message store
/// is configured (Wolverine's DbContext outbox requires one). Publishes inline after a
/// successful SaveChanges — at-most-once instead of transactional, acceptable off-production.
/// </summary>
internal sealed class DirectUnitOfWork : IUnitOfWork, IIntegrationEventPublisher
{
    private readonly AccountingDbContext _context;
    private readonly IMessageBus _bus;
    private readonly List<object> _pending = [];

    public DirectUnitOfWork(AccountingDbContext context, IMessageBus bus)
    {
        _context = context;
        _bus = bus;
    }

    public ValueTask PublishAsync<TEvent>(
        TEvent integrationEvent,
        CancellationToken cancellationToken = default
    )
        where TEvent : class
    {
        _pending.Add(integrationEvent);
        return ValueTask.CompletedTask;
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        await _context.SaveChangesAsync(cancellationToken);
        foreach (var message in _pending)
        {
            await _bus.PublishAsync(message);
        }

        _pending.Clear();
    }
}
