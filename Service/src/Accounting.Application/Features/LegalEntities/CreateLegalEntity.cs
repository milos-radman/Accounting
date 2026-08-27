using Accounting.Application.Common;
using Accounting.Domain.ChartOfAccounts;
using Accounting.Domain.LegalEntities;
using Accounting.Domain.ValueObjects;
using FluentValidation;

namespace Accounting.Application.Features.LegalEntities;

public sealed record CreateLegalEntityCommand(
    string Name,
    string Description,
    string OwnerCode,
    string OwnerName,
    string BaseCurrency,
    long GliNumberSerie,
    string OpenPeriod,
    string Responsible,
    string CoaTemplateName,
    bool Revaluation = false
) : ICommand<Guid>;

public sealed class CreateLegalEntityValidator : AbstractValidator<CreateLegalEntityCommand>
{
    public CreateLegalEntityValidator()
    {
        RuleFor(c => c.Name).NotEmpty().MaximumLength(200);
        RuleFor(c => c.OwnerCode).NotEmpty().MaximumLength(20);
        RuleFor(c => c.BaseCurrency).NotEmpty().Length(3);
        RuleFor(c => c.GliNumberSerie).GreaterThan(0);
        RuleFor(c => c.OpenPeriod).Matches(@"^\d{6}$").WithMessage("Open period must be YYYYMM.");
        RuleFor(c => c.CoaTemplateName).NotEmpty();
    }
}

/// <summary>Chart-of-account templates provided by the platform (spec §ChartOfAccount).</summary>
public interface ICoaTemplateProvider
{
    IReadOnlyList<string> TemplateNames { get; }

    IReadOnlyList<(
        string Name,
        string Description,
        string Order,
        int Depth,
        string? ParentOrder
    )> GetTemplate(string templateName);
}

public sealed class CreateLegalEntityHandler : ICommandHandler<CreateLegalEntityCommand, Guid>
{
    private readonly IRepository<LegalEntity> _legalEntities;
    private readonly IRepository<EntityChartOfAccount> _charts;
    private readonly ICoaTemplateProvider _templates;
    private readonly IUnitOfWork _unitOfWork;

    public CreateLegalEntityHandler(
        IRepository<LegalEntity> legalEntities,
        IRepository<EntityChartOfAccount> charts,
        ICoaTemplateProvider templates,
        IUnitOfWork unitOfWork
    )
    {
        _legalEntities = legalEntities;
        _charts = charts;
        _templates = templates;
        _unitOfWork = unitOfWork;
    }

    public async ValueTask<Guid> Handle(
        CreateLegalEntityCommand command,
        CancellationToken cancellationToken
    )
    {
        var entity = LegalEntity.Create(
            command.Name,
            command.Description,
            command.OwnerCode,
            command.OwnerName,
            command.BaseCurrency,
            command.GliNumberSerie,
            Period.Parse(command.OpenPeriod),
            command.Responsible,
            command.Revaluation
        );
        _legalEntities.Add(entity);

        // The entity gets its own editable copy of the selected template (spec §ChartOfAccount).
        var templateNodes = _templates.GetTemplate(command.CoaTemplateName);
        var chart = EntityChartOfAccount.CreateFromTemplate(
            entity.Id,
            command.CoaTemplateName,
            templateNodes
        );
        _charts.Add(chart);

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return entity.Id;
    }
}
