using Accounting.Application.Common;
using Accounting.Domain.LegalEntities;
using Microsoft.EntityFrameworkCore;

namespace Accounting.Application.Features.LegalEntities;

public sealed record LegalEntityDto(
    Guid Id,
    string Name,
    string Description,
    string OwnerCode,
    string OwnerName,
    string BaseCurrency,
    bool Revaluation,
    long GliNumberSerie,
    long NextGliNumber,
    string OpenPeriod,
    string ClosedPeriod,
    string? EndOfMonthPeriod,
    string Responsible
)
{
    internal static LegalEntityDto From(LegalEntity e) =>
        new(
            e.Id,
            e.Name,
            e.Description,
            e.OwnerCode,
            e.OwnerName,
            e.BaseCurrency,
            e.Revaluation,
            e.GliNumberSerie,
            e.NextGliNumber,
            e.OpenPeriod.ToString(),
            e.ClosedPeriod.ToString(),
            e.EndOfMonthPeriod?.ToString(),
            e.Responsible
        );
}

public sealed record ListLegalEntitiesQuery : IQuery<IReadOnlyList<LegalEntityDto>>;

public sealed class ListLegalEntitiesHandler
    : IQueryHandler<ListLegalEntitiesQuery, IReadOnlyList<LegalEntityDto>>
{
    private readonly IRepository<LegalEntity> _legalEntities;

    public ListLegalEntitiesHandler(IRepository<LegalEntity> legalEntities)
    {
        _legalEntities = legalEntities;
    }

    public async ValueTask<IReadOnlyList<LegalEntityDto>> Handle(
        ListLegalEntitiesQuery query,
        CancellationToken cancellationToken
    )
    {
        var entities = await _legalEntities
            .Query()
            .OrderBy(e => e.Name)
            .ToListAsync(cancellationToken);
        return entities.Select(LegalEntityDto.From).ToList();
    }
}

public sealed record GetLegalEntityQuery(Guid Id) : IQuery<LegalEntityDto>;

public sealed class GetLegalEntityHandler : IQueryHandler<GetLegalEntityQuery, LegalEntityDto>
{
    private readonly IRepository<LegalEntity> _legalEntities;

    public GetLegalEntityHandler(IRepository<LegalEntity> legalEntities)
    {
        _legalEntities = legalEntities;
    }

    public async ValueTask<LegalEntityDto> Handle(
        GetLegalEntityQuery query,
        CancellationToken cancellationToken
    )
    {
        var entity =
            await _legalEntities.GetByIdAsync(query.Id, cancellationToken)
            ?? throw new NotFoundException(nameof(LegalEntity), query.Id);
        return LegalEntityDto.From(entity);
    }
}

public sealed record ClosePeriodCommand(Guid LegalEntityId) : ICommand<LegalEntityDto>;

public sealed class ClosePeriodHandler : ICommandHandler<ClosePeriodCommand, LegalEntityDto>
{
    private readonly IRepository<LegalEntity> _legalEntities;
    private readonly IUnitOfWork _unitOfWork;

    public ClosePeriodHandler(IRepository<LegalEntity> legalEntities, IUnitOfWork unitOfWork)
    {
        _legalEntities = legalEntities;
        _unitOfWork = unitOfWork;
    }

    public async ValueTask<LegalEntityDto> Handle(
        ClosePeriodCommand command,
        CancellationToken cancellationToken
    )
    {
        var entity =
            await _legalEntities.GetByIdAsync(command.LegalEntityId, cancellationToken)
            ?? throw new NotFoundException(nameof(LegalEntity), command.LegalEntityId);
        entity.CloseCurrentPeriod();
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return LegalEntityDto.From(entity);
    }
}
