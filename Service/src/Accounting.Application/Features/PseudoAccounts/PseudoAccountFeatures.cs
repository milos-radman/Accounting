using Accounting.Application.Common;
using Accounting.Domain.Accounts;
using Accounting.Domain.ChartOfAccounts;
using Accounting.Domain.Common;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Unit = Mediator.Unit;

namespace Accounting.Application.Features.PseudoAccounts;

public sealed record PseudoAccountDto(
    Guid Id,
    string Code,
    string Description,
    string ExternalCode,
    string ExternalDescription,
    bool Revaluation,
    bool IsPlaced
)
{
    internal static PseudoAccountDto From(PseudoAccount a, bool isPlaced) =>
        new(
            a.Id,
            a.Code,
            a.Description,
            a.ExternalCode,
            a.ExternalDescription,
            a.Revaluation,
            isPlaced
        );
}

// ---------- Register ----------

public sealed record RegisterPseudoAccountCommand(
    Guid LegalEntityId,
    string Code,
    string Description,
    string? ExternalCode,
    string? ExternalDescription
) : ICommand<Guid>;

public sealed class RegisterPseudoAccountValidator : AbstractValidator<RegisterPseudoAccountCommand>
{
    public RegisterPseudoAccountValidator()
    {
        RuleFor(c => c.LegalEntityId).NotEmpty();
        RuleFor(c => c.Code).NotEmpty().MaximumLength(50);
        RuleFor(c => c.Description).MaximumLength(200);
    }
}

public sealed class RegisterPseudoAccountHandler
    : ICommandHandler<RegisterPseudoAccountCommand, Guid>
{
    private readonly IRepository<PseudoAccount> _accounts;
    private readonly IUnitOfWork _unitOfWork;

    public RegisterPseudoAccountHandler(IRepository<PseudoAccount> accounts, IUnitOfWork unitOfWork)
    {
        _accounts = accounts;
        _unitOfWork = unitOfWork;
    }

    public async ValueTask<Guid> Handle(
        RegisterPseudoAccountCommand command,
        CancellationToken cancellationToken
    )
    {
        var exists = await _accounts
            .Query()
            .AnyAsync(
                a => a.LegalEntityId == command.LegalEntityId && a.Code == command.Code,
                cancellationToken
            );
        if (exists)
        {
            throw new DomainConflictException(
                $"Pseudo account '{command.Code}' is already registered for the legal entity."
            );
        }

        var account = PseudoAccount.Register(
            command.LegalEntityId,
            command.Code,
            command.Description,
            command.ExternalCode,
            command.ExternalDescription
        );
        _accounts.Add(account);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return account.Id;
    }
}

// ---------- Import (from a general-ledger file upload) ----------

public sealed record ImportPseudoAccountRow(
    string Code,
    string Description,
    string? ExternalCode,
    string? ExternalDescription
);

public sealed record ImportPseudoAccountsCommand(
    Guid LegalEntityId,
    IReadOnlyList<ImportPseudoAccountRow> Rows
) : ICommand<ImportPseudoAccountsResult>;

public sealed record ImportPseudoAccountsResult(
    int Imported,
    int SkippedExisting,
    int SkippedInvalid
);

public sealed class ImportPseudoAccountsValidator : AbstractValidator<ImportPseudoAccountsCommand>
{
    public ImportPseudoAccountsValidator()
    {
        RuleFor(c => c.LegalEntityId).NotEmpty();
        RuleFor(c => c.Rows).NotEmpty();
    }
}

public sealed class ImportPseudoAccountsHandler
    : ICommandHandler<ImportPseudoAccountsCommand, ImportPseudoAccountsResult>
{
    private readonly IRepository<PseudoAccount> _accounts;
    private readonly IUnitOfWork _unitOfWork;

    public ImportPseudoAccountsHandler(IRepository<PseudoAccount> accounts, IUnitOfWork unitOfWork)
    {
        _accounts = accounts;
        _unitOfWork = unitOfWork;
    }

    public async ValueTask<ImportPseudoAccountsResult> Handle(
        ImportPseudoAccountsCommand command,
        CancellationToken cancellationToken
    )
    {
        var existingCodes = await _accounts
            .Query()
            .Where(a => a.LegalEntityId == command.LegalEntityId)
            .Select(a => a.Code)
            .ToListAsync(cancellationToken);
        var seen = new HashSet<string>(existingCodes, StringComparer.OrdinalIgnoreCase);

        var imported = 0;
        var skippedExisting = 0;
        var skippedInvalid = 0;
        foreach (var row in command.Rows)
        {
            if (string.IsNullOrWhiteSpace(row.Code))
            {
                skippedInvalid++;
                continue;
            }

            if (!seen.Add(row.Code.Trim()))
            {
                skippedExisting++;
                continue;
            }

            _accounts.Add(
                PseudoAccount.Register(
                    command.LegalEntityId,
                    row.Code,
                    row.Description,
                    row.ExternalCode,
                    row.ExternalDescription
                )
            );
            imported++;
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return new ImportPseudoAccountsResult(imported, skippedExisting, skippedInvalid);
    }
}

// ---------- Remove (guarded by chart-of-account placement) ----------

public sealed record RemovePseudoAccountCommand(Guid LegalEntityId, Guid PseudoAccountId)
    : ICommand<Unit>;

public sealed class RemovePseudoAccountHandler : ICommandHandler<RemovePseudoAccountCommand, Unit>
{
    private readonly IRepository<PseudoAccount> _accounts;
    private readonly IRepository<EntityChartOfAccount> _charts;
    private readonly IUnitOfWork _unitOfWork;

    public RemovePseudoAccountHandler(
        IRepository<PseudoAccount> accounts,
        IRepository<EntityChartOfAccount> charts,
        IUnitOfWork unitOfWork
    )
    {
        _accounts = accounts;
        _charts = charts;
        _unitOfWork = unitOfWork;
    }

    public async ValueTask<Unit> Handle(
        RemovePseudoAccountCommand command,
        CancellationToken cancellationToken
    )
    {
        var account =
            await _accounts
                .Query()
                .FirstOrDefaultAsync(
                    a =>
                        a.LegalEntityId == command.LegalEntityId && a.Id == command.PseudoAccountId,
                    cancellationToken
                )
            ?? throw new NotFoundException(nameof(PseudoAccount), command.PseudoAccountId);

        var chart = await _charts
            .Query()
            .Include(c => c.Placements)
            .FirstOrDefaultAsync(c => c.LegalEntityId == command.LegalEntityId, cancellationToken);
        if (chart?.IsPlaced(account.Id) == true)
        {
            throw new DomainConflictException(
                $"Pseudo account '{account.Code}' is placed on the chart of account and cannot "
                    + "be removed. Remove the placement first."
            );
        }

        _accounts.Remove(account);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}

// ---------- List ----------

public sealed record ListPseudoAccountsQuery(Guid LegalEntityId)
    : IQuery<IReadOnlyList<PseudoAccountDto>>;

public sealed class ListPseudoAccountsHandler
    : IQueryHandler<ListPseudoAccountsQuery, IReadOnlyList<PseudoAccountDto>>
{
    private readonly IRepository<PseudoAccount> _accounts;
    private readonly IRepository<EntityChartOfAccount> _charts;

    public ListPseudoAccountsHandler(
        IRepository<PseudoAccount> accounts,
        IRepository<EntityChartOfAccount> charts
    )
    {
        _accounts = accounts;
        _charts = charts;
    }

    public async ValueTask<IReadOnlyList<PseudoAccountDto>> Handle(
        ListPseudoAccountsQuery query,
        CancellationToken cancellationToken
    )
    {
        var accounts = await _accounts
            .Query()
            .Where(a => a.LegalEntityId == query.LegalEntityId)
            .OrderBy(a => a.Code)
            .ToListAsync(cancellationToken);

        var chart = await _charts
            .Query()
            .Include(c => c.Placements)
            .FirstOrDefaultAsync(c => c.LegalEntityId == query.LegalEntityId, cancellationToken);

        return accounts
            .Select(a => PseudoAccountDto.From(a, chart?.IsPlaced(a.Id) ?? false))
            .ToList();
    }
}
