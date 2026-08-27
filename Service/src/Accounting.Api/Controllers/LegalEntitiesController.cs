using Accounting.Api.Auth;
using Accounting.Application.Features.ChartOfAccounts;
using Accounting.Application.Features.LegalEntities;
using Accounting.Application.Features.PseudoAccounts;
using Asp.Versioning;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Accounting.Api.Controllers;

[ApiController]
[ApiVersion(1)]
[Route("api/v{version:apiVersion}/legal-entities")]
public sealed class LegalEntitiesController : ControllerBase
{
    private readonly IMediator _mediator;

    public LegalEntitiesController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    [Authorize(AuthorizationPolicies.AccountingRead)]
    public async Task<IReadOnlyList<LegalEntityDto>> List(CancellationToken cancellationToken) =>
        await _mediator.Send(new ListLegalEntitiesQuery(), cancellationToken);

    [HttpGet("{id:guid}")]
    [Authorize(AuthorizationPolicies.AccountingRead)]
    public async Task<LegalEntityDto> Get(Guid id, CancellationToken cancellationToken) =>
        await _mediator.Send(new GetLegalEntityQuery(id), cancellationToken);

    [HttpPost]
    [Authorize(AuthorizationPolicies.AccountingConfigure)]
    public async Task<ActionResult<Guid>> Create(
        [FromBody] CreateLegalEntityCommand command,
        CancellationToken cancellationToken
    )
    {
        var id = await _mediator.Send(command, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id, version = "1" }, id);
    }

    [HttpPost("{id:guid}/close-period")]
    [Authorize(AuthorizationPolicies.AccountingConfigure)]
    public async Task<LegalEntityDto> ClosePeriod(Guid id, CancellationToken cancellationToken) =>
        await _mediator.Send(new ClosePeriodCommand(id), cancellationToken);
}

[ApiController]
[ApiVersion(1)]
[Route("api/v{version:apiVersion}/legal-entities/{legalEntityId:guid}/pseudo-accounts")]
public sealed class PseudoAccountsController : ControllerBase
{
    private readonly IMediator _mediator;

    public PseudoAccountsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    [Authorize(AuthorizationPolicies.AccountingRead)]
    public async Task<IReadOnlyList<PseudoAccountDto>> List(
        Guid legalEntityId,
        CancellationToken cancellationToken
    ) => await _mediator.Send(new ListPseudoAccountsQuery(legalEntityId), cancellationToken);

    public sealed record RegisterRequest(
        string Code,
        string Description,
        string? ExternalCode,
        string? ExternalDescription
    );

    [HttpPost]
    [Authorize(AuthorizationPolicies.AccountingConfigure)]
    public async Task<ActionResult<Guid>> Register(
        Guid legalEntityId,
        [FromBody] RegisterRequest request,
        CancellationToken cancellationToken
    )
    {
        var id = await _mediator.Send(
            new RegisterPseudoAccountCommand(
                legalEntityId,
                request.Code,
                request.Description,
                request.ExternalCode,
                request.ExternalDescription
            ),
            cancellationToken
        );
        return CreatedAtAction(nameof(List), new { legalEntityId, version = "1" }, id);
    }

    /// <summary>Bulk import of pseudo accounts exported from the customer's general ledger.</summary>
    [HttpPost("import")]
    [Authorize(AuthorizationPolicies.AccountingConfigure)]
    public async Task<ImportPseudoAccountsResult> Import(
        Guid legalEntityId,
        [FromBody] IReadOnlyList<ImportPseudoAccountRow> rows,
        CancellationToken cancellationToken
    ) =>
        await _mediator.Send(
            new ImportPseudoAccountsCommand(legalEntityId, rows),
            cancellationToken
        );

    [HttpDelete("{pseudoAccountId:guid}")]
    [Authorize(AuthorizationPolicies.AccountingConfigure)]
    public async Task<IActionResult> Remove(
        Guid legalEntityId,
        Guid pseudoAccountId,
        CancellationToken cancellationToken
    )
    {
        await _mediator.Send(
            new RemovePseudoAccountCommand(legalEntityId, pseudoAccountId),
            cancellationToken
        );
        return NoContent();
    }
}

[ApiController]
[ApiVersion(1)]
[Route("api/v{version:apiVersion}/legal-entities/{legalEntityId:guid}/chart-of-account")]
public sealed class ChartOfAccountController : ControllerBase
{
    private readonly IMediator _mediator;

    public ChartOfAccountController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    [Authorize(AuthorizationPolicies.AccountingRead)]
    public async Task<ChartOfAccountDto> Get(
        Guid legalEntityId,
        CancellationToken cancellationToken
    ) => await _mediator.Send(new GetChartOfAccountQuery(legalEntityId), cancellationToken);

    public sealed record NodeRequest(string Name, string Description, Guid? ParentNodeId);

    [HttpPost("nodes")]
    [Authorize(AuthorizationPolicies.AccountingConfigure)]
    public async Task<ActionResult<Guid>> AddNode(
        Guid legalEntityId,
        [FromBody] NodeRequest request,
        CancellationToken cancellationToken
    )
    {
        var id = await _mediator.Send(
            new AddCoaNodeCommand(
                legalEntityId,
                request.ParentNodeId,
                request.Name,
                request.Description
            ),
            cancellationToken
        );
        return CreatedAtAction(nameof(Get), new { legalEntityId, version = "1" }, id);
    }

    [HttpPut("nodes/{nodeId:guid}")]
    [Authorize(AuthorizationPolicies.AccountingConfigure)]
    public async Task<IActionResult> RenameNode(
        Guid legalEntityId,
        Guid nodeId,
        [FromBody] NodeRequest request,
        CancellationToken cancellationToken
    )
    {
        await _mediator.Send(
            new RenameCoaNodeCommand(legalEntityId, nodeId, request.Name, request.Description),
            cancellationToken
        );
        return NoContent();
    }

    [HttpDelete("nodes/{nodeId:guid}")]
    [Authorize(AuthorizationPolicies.AccountingConfigure)]
    public async Task<IActionResult> RemoveNode(
        Guid legalEntityId,
        Guid nodeId,
        CancellationToken cancellationToken
    )
    {
        await _mediator.Send(new RemoveCoaNodeCommand(legalEntityId, nodeId), cancellationToken);
        return NoContent();
    }

    public sealed record PlacementRequest
    {
        public required Guid PseudoAccountId { get; init; }
    }

    [HttpPost("nodes/{nodeId:guid}/accounts")]
    [Authorize(AuthorizationPolicies.AccountingConfigure)]
    public async Task<IActionResult> PlaceAccount(
        Guid legalEntityId,
        Guid nodeId,
        [FromBody] PlacementRequest request,
        CancellationToken cancellationToken
    )
    {
        await _mediator.Send(
            new PlacePseudoAccountCommand(legalEntityId, nodeId, request.PseudoAccountId),
            cancellationToken
        );
        return NoContent();
    }

    [HttpDelete("accounts/{pseudoAccountId:guid}")]
    [Authorize(AuthorizationPolicies.AccountingConfigure)]
    public async Task<IActionResult> RemovePlacement(
        Guid legalEntityId,
        Guid pseudoAccountId,
        CancellationToken cancellationToken
    )
    {
        await _mediator.Send(
            new RemovePlacementCommand(legalEntityId, pseudoAccountId),
            cancellationToken
        );
        return NoContent();
    }
}
