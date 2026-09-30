using Accounting.Application.Common;
using Accounting.Domain.Accounts;
using Accounting.Domain.ChartOfAccounts;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Unit = Mediator.Unit;

namespace Accounting.Application.Features.ChartOfAccounts;

public sealed record CoaNodeDto(
    Guid Id,
    string Name,
    string Description,
    string Order,
    int Depth,
    Guid? ParentId,
    IReadOnlyList<PlacedAccountDto> PlacedAccounts
);

public sealed record PlacedAccountDto(Guid PseudoAccountId, string Code, string Description);

public sealed record ChartOfAccountDto(
    Guid Id,
    Guid LegalEntityId,
    string TemplateName,
    IReadOnlyList<CoaNodeDto> Nodes
);

// ---------- Get ----------

public sealed record GetChartOfAccountQuery(Guid LegalEntityId) : IQuery<ChartOfAccountDto>;

public sealed class GetChartOfAccountHandler
    : IQueryHandler<GetChartOfAccountQuery, ChartOfAccountDto>
{
    private readonly IRepository<EntityChartOfAccount> _charts;
    private readonly IRepository<PseudoAccount> _accounts;

    public GetChartOfAccountHandler(
        IRepository<EntityChartOfAccount> charts,
        IRepository<PseudoAccount> accounts
    )
    {
        _charts = charts;
        _accounts = accounts;
    }

    public async ValueTask<ChartOfAccountDto> Handle(
        GetChartOfAccountQuery query,
        CancellationToken cancellationToken
    )
    {
        var chart = await LoadChart(_charts, query.LegalEntityId, cancellationToken);
        var accountsById = await _accounts
            .Query()
            .Where(a => a.LegalEntityId == query.LegalEntityId)
            .ToDictionaryAsync(a => a.Id, cancellationToken);

        var placementsByNode = chart.Placements.ToLookup(p => p.CoaNodeId);
        var nodes = chart
            .Nodes.OrderBy(n => n.Order, StringComparer.Ordinal)
            .Select(n => new CoaNodeDto(
                n.Id,
                n.Name,
                n.Description,
                n.Order,
                n.Depth,
                n.ParentId,
                placementsByNode[n.Id]
                    .Select(p =>
                        accountsById.TryGetValue(p.PseudoAccountId, out var a)
                            ? new PlacedAccountDto(a.Id, a.Code, a.Description)
                            : new PlacedAccountDto(p.PseudoAccountId, "?", string.Empty)
                    )
                    .ToList()
            ))
            .ToList();

        return new ChartOfAccountDto(chart.Id, chart.LegalEntityId, chart.TemplateName, nodes);
    }

    internal static async Task<EntityChartOfAccount> LoadChart(
        IRepository<EntityChartOfAccount> charts,
        Guid legalEntityId,
        CancellationToken cancellationToken
    ) =>
        await charts
            .Query()
            .Include(c => c.Nodes)
            .Include(c => c.Placements)
            .FirstOrDefaultAsync(c => c.LegalEntityId == legalEntityId, cancellationToken)
        ?? throw new NotFoundException(nameof(EntityChartOfAccount), legalEntityId);
}

// ---------- Node maintenance ----------

public sealed record AddCoaNodeCommand(
    Guid LegalEntityId,
    Guid? ParentNodeId,
    string Name,
    string Description
) : ICommand<Guid>;

public sealed class AddCoaNodeValidator : AbstractValidator<AddCoaNodeCommand>
{
    public AddCoaNodeValidator()
    {
        RuleFor(c => c.LegalEntityId).NotEmpty();
        RuleFor(c => c.Name).NotEmpty().MaximumLength(200);
    }
}

public sealed class AddCoaNodeHandler : ICommandHandler<AddCoaNodeCommand, Guid>
{
    private readonly IRepository<EntityChartOfAccount> _charts;
    private readonly IUnitOfWork _unitOfWork;

    public AddCoaNodeHandler(IRepository<EntityChartOfAccount> charts, IUnitOfWork unitOfWork)
    {
        _charts = charts;
        _unitOfWork = unitOfWork;
    }

    public async ValueTask<Guid> Handle(
        AddCoaNodeCommand command,
        CancellationToken cancellationToken
    )
    {
        var chart = await GetChartOfAccountHandler.LoadChart(
            _charts,
            command.LegalEntityId,
            cancellationToken
        );
        var node = chart.AddNode(command.ParentNodeId, command.Name, command.Description);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return node.Id;
    }
}

public sealed record RenameCoaNodeCommand(
    Guid LegalEntityId,
    Guid NodeId,
    string Name,
    string Description
) : ICommand<Unit>;

public sealed class RenameCoaNodeValidator : AbstractValidator<RenameCoaNodeCommand>
{
    public RenameCoaNodeValidator()
    {
        RuleFor(c => c.Name).NotEmpty().MaximumLength(200);
    }
}

public sealed class RenameCoaNodeHandler : ICommandHandler<RenameCoaNodeCommand, Unit>
{
    private readonly IRepository<EntityChartOfAccount> _charts;
    private readonly IUnitOfWork _unitOfWork;

    public RenameCoaNodeHandler(IRepository<EntityChartOfAccount> charts, IUnitOfWork unitOfWork)
    {
        _charts = charts;
        _unitOfWork = unitOfWork;
    }

    public async ValueTask<Unit> Handle(
        RenameCoaNodeCommand command,
        CancellationToken cancellationToken
    )
    {
        var chart = await GetChartOfAccountHandler.LoadChart(
            _charts,
            command.LegalEntityId,
            cancellationToken
        );
        chart.RenameNode(command.NodeId, command.Name, command.Description);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}

public sealed record RemoveCoaNodeCommand(Guid LegalEntityId, Guid NodeId) : ICommand<Unit>;

public sealed class RemoveCoaNodeHandler : ICommandHandler<RemoveCoaNodeCommand, Unit>
{
    private readonly IRepository<EntityChartOfAccount> _charts;
    private readonly IUnitOfWork _unitOfWork;

    public RemoveCoaNodeHandler(IRepository<EntityChartOfAccount> charts, IUnitOfWork unitOfWork)
    {
        _charts = charts;
        _unitOfWork = unitOfWork;
    }

    public async ValueTask<Unit> Handle(
        RemoveCoaNodeCommand command,
        CancellationToken cancellationToken
    )
    {
        var chart = await GetChartOfAccountHandler.LoadChart(
            _charts,
            command.LegalEntityId,
            cancellationToken
        );
        chart.RemoveNode(command.NodeId);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}

// ---------- Placements (PseudoAccountCOA) ----------

public sealed record PlacePseudoAccountCommand(
    Guid LegalEntityId,
    Guid NodeId,
    Guid PseudoAccountId
) : ICommand<Unit>;

public sealed class PlacePseudoAccountHandler : ICommandHandler<PlacePseudoAccountCommand, Unit>
{
    private readonly IRepository<EntityChartOfAccount> _charts;
    private readonly IRepository<PseudoAccount> _accounts;
    private readonly IUnitOfWork _unitOfWork;

    public PlacePseudoAccountHandler(
        IRepository<EntityChartOfAccount> charts,
        IRepository<PseudoAccount> accounts,
        IUnitOfWork unitOfWork
    )
    {
        _charts = charts;
        _accounts = accounts;
        _unitOfWork = unitOfWork;
    }

    public async ValueTask<Unit> Handle(
        PlacePseudoAccountCommand command,
        CancellationToken cancellationToken
    )
    {
        var accountExists = await _accounts
            .Query()
            .AnyAsync(
                a => a.LegalEntityId == command.LegalEntityId && a.Id == command.PseudoAccountId,
                cancellationToken
            );
        if (!accountExists)
        {
            throw new NotFoundException(nameof(PseudoAccount), command.PseudoAccountId);
        }

        var chart = await GetChartOfAccountHandler.LoadChart(
            _charts,
            command.LegalEntityId,
            cancellationToken
        );
        chart.PlaceAccount(command.PseudoAccountId, command.NodeId);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}

public sealed record RemovePlacementCommand(Guid LegalEntityId, Guid PseudoAccountId)
    : ICommand<Unit>;

public sealed class RemovePlacementHandler : ICommandHandler<RemovePlacementCommand, Unit>
{
    private readonly IRepository<EntityChartOfAccount> _charts;
    private readonly IUnitOfWork _unitOfWork;

    public RemovePlacementHandler(IRepository<EntityChartOfAccount> charts, IUnitOfWork unitOfWork)
    {
        _charts = charts;
        _unitOfWork = unitOfWork;
    }

    public async ValueTask<Unit> Handle(
        RemovePlacementCommand command,
        CancellationToken cancellationToken
    )
    {
        var chart = await GetChartOfAccountHandler.LoadChart(
            _charts,
            command.LegalEntityId,
            cancellationToken
        );
        chart.RemovePlacement(command.PseudoAccountId);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}
