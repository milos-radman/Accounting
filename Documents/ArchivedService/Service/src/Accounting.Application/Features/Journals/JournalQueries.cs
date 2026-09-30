using Accounting.Application.Common;
using Accounting.Domain.Common;
using Accounting.Domain.Journals;
using Microsoft.EntityFrameworkCore;

namespace Accounting.Application.Features.Journals;

public sealed record JournalLineDto(
    int LineNumber,
    string PseudoAccountCode,
    string Description,
    string LedgerName,
    decimal Debit,
    decimal Credit,
    string? Agreement,
    int? AgreementLine,
    string? InvoiceNumber,
    string? FormulaCode,
    string? AmountTypeName,
    string? ResolutionTrace,
    string? ExternalAccount
);

public sealed record JournalDto(
    Guid Id,
    long GliNumber,
    Guid LegalEntityId,
    string AccountingEventName,
    DateOnly BookingDate,
    string Currency,
    decimal TotalDebit,
    decimal TotalCredit,
    bool HasDifference,
    DateTimeOffset? ExportedAt,
    IReadOnlyList<JournalLineDto> Lines
)
{
    internal static JournalDto From(Journal j) =>
        new(
            j.Id,
            j.GliNumber,
            j.LegalEntityId,
            j.AccountingEventName,
            j.BookingDate,
            j.Currency,
            j.TotalDebit,
            j.TotalCredit,
            j.HasDifference,
            j.ExportedAt,
            j.Lines.Select(l => new JournalLineDto(
                    l.LineNumber,
                    l.PseudoAccountCode,
                    l.Description,
                    l.LedgerName,
                    l.Debit,
                    l.Credit,
                    l.Agreement,
                    l.AgreementLine,
                    l.InvoiceNumber,
                    l.FormulaCode,
                    l.AmountTypeName,
                    l.ResolutionTrace,
                    l.ExternalAccount
                ))
                .ToList()
        );
}

public sealed record JournalSummaryDto(
    Guid Id,
    long GliNumber,
    Guid LegalEntityId,
    string AccountingEventName,
    DateOnly BookingDate,
    int LineCount,
    bool HasDifference,
    DateTimeOffset? ExportedAt
);

public sealed record SearchJournalsQuery(
    Guid? LegalEntityId = null,
    bool DifferenceOnly = false,
    DateOnly? BookedFrom = null,
    DateOnly? BookedTo = null,
    long? GliNumber = null,
    int Page = 1,
    int PageSize = 50
) : IQuery<IReadOnlyList<JournalSummaryDto>>;

public sealed class SearchJournalsHandler
    : IQueryHandler<SearchJournalsQuery, IReadOnlyList<JournalSummaryDto>>
{
    private readonly IRepository<Journal> _journals;

    public SearchJournalsHandler(IRepository<Journal> journals)
    {
        _journals = journals;
    }

    public async ValueTask<IReadOnlyList<JournalSummaryDto>> Handle(
        SearchJournalsQuery query,
        CancellationToken cancellationToken
    )
    {
        var journals = _journals.Query();
        if (query.LegalEntityId is { } entityId)
        {
            journals = journals.Where(j => j.LegalEntityId == entityId);
        }

        if (query.GliNumber is { } gli)
        {
            journals = journals.Where(j => j.GliNumber == gli);
        }

        if (query.BookedFrom is { } from)
        {
            journals = journals.Where(j => j.BookingDate >= from);
        }

        if (query.BookedTo is { } to)
        {
            journals = journals.Where(j => j.BookingDate <= to);
        }

        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 200);
        var result = await journals
            .OrderByDescending(j => j.GliNumber)
            .Select(j => new
            {
                j.Id,
                j.GliNumber,
                j.LegalEntityId,
                j.AccountingEventName,
                j.BookingDate,
                LineCount = j.Lines.Count,
                TotalDebit = j.Lines.Sum(l => l.Debit),
                TotalCredit = j.Lines.Sum(l => l.Credit),
                j.ExportedAt,
            })
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return result
            .Select(j => new JournalSummaryDto(
                j.Id,
                j.GliNumber,
                j.LegalEntityId,
                j.AccountingEventName,
                j.BookingDate,
                j.LineCount,
                j.TotalDebit != j.TotalCredit,
                j.ExportedAt
            ))
            .Where(j => !query.DifferenceOnly || j.HasDifference)
            .ToList();
    }
}

/// <summary>
/// GLI numbers are unique per legal entity (each entity has its own number serie), so the
/// lookup is scoped by entity. Omitting the entity is only safe when the number is unique
/// across the tenant — the handler rejects ambiguous matches instead of guessing.
/// </summary>
public sealed record GetJournalQuery(long GliNumber, Guid? LegalEntityId = null)
    : IQuery<JournalDto>;

public sealed class GetJournalHandler : IQueryHandler<GetJournalQuery, JournalDto>
{
    private readonly IRepository<Journal> _journals;

    public GetJournalHandler(IRepository<Journal> journals)
    {
        _journals = journals;
    }

    public async ValueTask<JournalDto> Handle(
        GetJournalQuery query,
        CancellationToken cancellationToken
    )
    {
        var journals = _journals
            .Query()
            .Include(j => j.Lines)
            .Where(j => j.GliNumber == query.GliNumber);
        if (query.LegalEntityId is { } entityId)
        {
            journals = journals.Where(j => j.LegalEntityId == entityId);
        }

        var matches = await journals.Take(2).ToListAsync(cancellationToken);
        return matches switch
        {
            [] => throw new NotFoundException(nameof(Journal), query.GliNumber),
            [var journal] => JournalDto.From(journal),
            _ => throw new DomainConflictException(
                $"GLI {query.GliNumber} exists for more than one legal entity. "
                    + "Specify legalEntityId to disambiguate."
            ),
        };
    }
}
