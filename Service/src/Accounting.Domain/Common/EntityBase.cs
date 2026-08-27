namespace Accounting.Domain.Common;

/// <summary>
/// Base type for all persisted entities (§9 of the architecture blueprint):
/// Guid v7 id, audit columns, shard key and optimistic-concurrency token.
/// Audit fields are populated by the persistence layer's SaveChanges interceptor.
/// </summary>
public abstract class EntityBase
{
    public Guid Id { get; protected set; } = Guid.CreateVersion7();

    public DateTimeOffset CreatedAt { get; private set; }

    public string CreatedBy { get; private set; } = string.Empty;

    public DateTimeOffset? UpdatedAt { get; private set; }

    public string? UpdatedBy { get; private set; }

    /// <summary>
    /// Present from day one so future sharding needs no data migration (§6).
    /// For this service the shard key is the TenantId.
    /// </summary>
    public string ShardKey { get; private set; } = string.Empty;

    public byte[] RowVersion { get; private set; } = [];

    /// <summary>Soft delete flag; a global query filter hides deleted rows (§9).</summary>
    public bool IsDeleted { get; private set; }

    public void MarkDeleted() => IsDeleted = true;

    /// <summary>Called by the persistence auditing interceptor only.</summary>
    public void SetCreated(DateTimeOffset at, string by, string shardKey)
    {
        CreatedAt = at;
        CreatedBy = by;
        ShardKey = shardKey;
    }

    /// <summary>Called by the persistence auditing interceptor only.</summary>
    public void SetUpdated(DateTimeOffset at, string by)
    {
        UpdatedAt = at;
        UpdatedBy = by;
    }
}
