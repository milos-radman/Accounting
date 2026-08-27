using Accounting.Application.Common;
using Accounting.Contracts.IntegrationEvents;
using Accounting.Domain.Accounts;
using Accounting.Domain.Booking;
using Accounting.Domain.Common;
using Accounting.Domain.Configuration;
using Accounting.Domain.Formulas;
using Accounting.Domain.Journals;
using Accounting.Domain.LegalEntities;
using Accounting.Domain.Rules;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace Accounting.Application.Features.Booking;

/// <summary>
/// The central use case of the service: apply the legal entity's accounting rules to an
/// incoming event message and create the resulting GLI journal. Invoked both by the
/// message consumer (bus) and by the API endpoint.
/// </summary>
public sealed record ProcessAccountingEventCommand(
    Guid MessageId,
    Guid LegalEntityId,
    string AccountingClassCode,
    string AccountingEventCode,
    DateOnly BookingDate,
    string CurrencyCode,
    string? Agreement,
    int? AgreementLine,
    string? Portfolio,
    string? InvoiceNumber,
    IReadOnlyDictionary<string, decimal> Amounts,
    IReadOnlyDictionary<string, string> Attributes
) : ICommand<ProcessAccountingEventResult>;

public sealed record ProcessAccountingEventResult(
    Guid JournalId,
    long GliNumber,
    int LineCount,
    decimal TotalDebit,
    decimal TotalCredit,
    bool HasDifference,
    bool WasAlreadyProcessed
);

public sealed class ProcessAccountingEventValidator
    : AbstractValidator<ProcessAccountingEventCommand>
{
    public ProcessAccountingEventValidator()
    {
        RuleFor(c => c.MessageId).NotEmpty();
        RuleFor(c => c.LegalEntityId).NotEmpty();
        RuleFor(c => c.AccountingClassCode).NotEmpty();
        RuleFor(c => c.AccountingEventCode).NotEmpty();
        RuleFor(c => c.CurrencyCode).NotEmpty().Length(3);
        RuleFor(c => c.Amounts)
            .NotEmpty()
            .WithMessage("The message must carry at least one amount.");
        RuleForEach(c => c.Amounts)
            .Must(a => !string.IsNullOrWhiteSpace(a.Key))
            .WithMessage("Amount type names must not be empty.");
    }
}

public sealed class ProcessAccountingEventHandler
    : ICommandHandler<ProcessAccountingEventCommand, ProcessAccountingEventResult>
{
    private readonly IRepository<LegalEntity> _legalEntities;
    private readonly IRepository<AccountingClass> _classes;
    private readonly IRepository<AccountingEvent> _events;
    private readonly IRepository<AccountingRule> _rules;
    private readonly IRepository<Formula> _formulas;
    private readonly IRepository<PseudoAccount> _accounts;
    private readonly IRepository<Journal> _journals;
    private readonly IIntegrationEventPublisher _publisher;
    private readonly IUnitOfWork _unitOfWork;

    public ProcessAccountingEventHandler(
        IRepository<LegalEntity> legalEntities,
        IRepository<AccountingClass> classes,
        IRepository<AccountingEvent> events,
        IRepository<AccountingRule> rules,
        IRepository<Formula> formulas,
        IRepository<PseudoAccount> accounts,
        IRepository<Journal> journals,
        IIntegrationEventPublisher publisher,
        IUnitOfWork unitOfWork
    )
    {
        _legalEntities = legalEntities;
        _classes = classes;
        _events = events;
        _rules = rules;
        _formulas = formulas;
        _accounts = accounts;
        _journals = journals;
        _publisher = publisher;
        _unitOfWork = unitOfWork;
    }

    public async ValueTask<ProcessAccountingEventResult> Handle(
        ProcessAccountingEventCommand command,
        CancellationToken cancellationToken
    )
    {
        // Idempotency (§8.2): a redelivered message must not create a second journal.
        var existing = await _journals
            .Query()
            .FirstOrDefaultAsync(j => j.SourceMessageId == command.MessageId, cancellationToken);
        if (existing is not null)
        {
            return new ProcessAccountingEventResult(
                existing.Id,
                existing.GliNumber,
                existing.Lines.Count,
                existing.TotalDebit,
                existing.TotalCredit,
                existing.HasDifference,
                WasAlreadyProcessed: true
            );
        }

        var entity =
            await _legalEntities.GetByIdAsync(command.LegalEntityId, cancellationToken)
            ?? throw new NotFoundException(nameof(LegalEntity), command.LegalEntityId);
        entity.EnsureBookingAllowed(command.BookingDate);

        var accountingClass =
            await _classes
                .Query()
                .FirstOrDefaultAsync(c => c.Code == command.AccountingClassCode, cancellationToken)
            ?? throw new NotFoundException(nameof(AccountingClass), command.AccountingClassCode);

        var accountingEvent =
            await _events
                .Query()
                .FirstOrDefaultAsync(e => e.Code == command.AccountingEventCode, cancellationToken)
            ?? throw new NotFoundException(nameof(AccountingEvent), command.AccountingEventCode);

        var rules = await _rules
            .Query()
            .Where(r =>
                r.LegalEntityId == entity.Id
                && r.AccountingClassId == accountingClass.Id
                && r.AccountingEventId == accountingEvent.Id
            )
            .ToListAsync(cancellationToken);
        if (rules.Count == 0)
        {
            throw new DomainRuleException(
                $"No accounting rules are configured for {entity.Name} / "
                    + $"{accountingClass.Name} / {accountingEvent.Name}."
            );
        }

        var formulaIds = rules.Select(r => r.FormulaId).Distinct().ToList();
        var formulas = await _formulas
            .Query()
            .Include(f => f.Conditions)
            .Where(f => formulaIds.Contains(f.Id))
            .ToDictionaryAsync(f => f.Id, cancellationToken);

        var accounts = await _accounts
            .Query()
            .Where(a => a.LegalEntityId == entity.Id)
            .ToDictionaryAsync(a => a.Code, cancellationToken);

        var drafts = BookingEngine.Produce(
            rules,
            formulas,
            accounts,
            new BookingRequest(
                command.Amounts,
                command.Attributes,
                command.Agreement,
                command.AgreementLine,
                command.InvoiceNumber,
                command.Portfolio
            )
        );
        if (drafts.Count == 0)
        {
            throw new DomainRuleException(
                "The message did not produce any journal lines — all amounts were zero or "
                    + "no account could be resolved."
            );
        }

        var journal = Journal.Create(
            entity.ReserveGliNumber(),
            entity.Id,
            accountingEvent.Id,
            accountingEvent.Code,
            accountingEvent.Name,
            command.BookingDate,
            command.CurrencyCode.ToUpperInvariant(),
            JournalOrigin.EventMessage,
            drafts,
            command.MessageId
        );
        _journals.Add(journal);

        await _publisher.PublishAsync(
            new JournalCreated
            {
                JournalId = journal.Id,
                GliNumber = journal.GliNumber,
                LegalEntityId = entity.Id,
                AccountingEventCode = accountingEvent.Code,
                BookingDate = journal.BookingDate,
                LineCount = journal.Lines.Count,
                TotalDebit = journal.TotalDebit,
                TotalCredit = journal.TotalCredit,
                HasDifference = journal.HasDifference,
            },
            cancellationToken
        );

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new ProcessAccountingEventResult(
            journal.Id,
            journal.GliNumber,
            journal.Lines.Count,
            journal.TotalDebit,
            journal.TotalCredit,
            journal.HasDifference,
            WasAlreadyProcessed: false
        );
    }
}
