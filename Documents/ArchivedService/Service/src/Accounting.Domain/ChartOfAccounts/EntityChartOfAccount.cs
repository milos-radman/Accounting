using Accounting.Domain.Common;

namespace Accounting.Domain.ChartOfAccounts;

/// <summary>
/// A legal entity's own chart of account, created as a copy of a template when the entity
/// is set up. The aggregate owns the node tree and the pseudo-account placements
/// (the PseudoAccountCOA link from the entity model). Invariants:
/// a node can only be removed when it has no children and no placements;
/// a pseudo account can be placed on exactly one node.
/// </summary>
public sealed class EntityChartOfAccount : EntityBase
{
    private readonly List<CoaNode> _nodes = [];
    private readonly List<PseudoAccountPlacement> _placements = [];

    private EntityChartOfAccount() { }

    public Guid LegalEntityId { get; private set; }

    /// <summary>Name of the template this chart was created from, e.g. "US GAAP Chart Of Account".</summary>
    public string TemplateName { get; private set; } = string.Empty;

    public IReadOnlyList<CoaNode> Nodes => _nodes.AsReadOnly();

    public IReadOnlyList<PseudoAccountPlacement> Placements => _placements.AsReadOnly();

    public static EntityChartOfAccount CreateFromTemplate(
        Guid legalEntityId,
        string templateName,
        IEnumerable<(
            string Name,
            string Description,
            string Order,
            int Depth,
            string? ParentOrder
        )> templateNodes
    )
    {
        var chart = new EntityChartOfAccount
        {
            LegalEntityId = legalEntityId,
            TemplateName = templateName,
        };

        var byOrder = new Dictionary<string, CoaNode>();
        foreach (var (name, description, order, depth, parentOrder) in templateNodes)
        {
            Guid? parentId = null;
            if (parentOrder is not null)
            {
                if (!byOrder.TryGetValue(parentOrder, out var parent))
                {
                    throw new DomainRuleException(
                        $"Template node '{order}' references missing parent '{parentOrder}'."
                    );
                }

                parentId = parent.Id;
            }

            var node = new CoaNode(chart.Id, name, description, order, depth, parentId);
            chart._nodes.Add(node);
            byOrder[order] = node;
        }

        return chart;
    }

    public CoaNode AddNode(Guid? parentId, string name, string description)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainRuleException("A chart-of-account node must have a name.");
        }

        CoaNode? parent = null;
        if (parentId is not null)
        {
            parent = FindNode(parentId.Value);
        }

        var siblings = _nodes.Count(n => n.ParentId == parentId);
        string order;
        int depth;
        if (parent is null)
        {
            var rootNumbers = _nodes
                .Where(n => n.ParentId is null)
                .Select(n => int.TryParse(n.Order, out var v) ? v : 0);
            order = (rootNumbers.DefaultIfEmpty(0).Max() + 1).ToString();
            depth = 0;
        }
        else
        {
            order = $"{parent.Order}.{siblings + 1}";
            depth = parent.Depth + 1;
        }

        var node = new CoaNode(Id, name.Trim(), description.Trim(), order, depth, parentId);
        _nodes.Add(node);
        return node;
    }

    public void RenameNode(Guid nodeId, string name, string description)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainRuleException("A chart-of-account node must have a name.");
        }

        FindNode(nodeId).Rename(name.Trim(), description.Trim());
    }

    public void RemoveNode(Guid nodeId)
    {
        var node = FindNode(nodeId);
        if (_nodes.Any(n => n.ParentId == nodeId))
        {
            throw new DomainConflictException(
                $"Node {node.Order} {node.Name} cannot be removed: it has sub-nodes."
            );
        }

        if (_placements.Any(p => p.CoaNodeId == nodeId))
        {
            throw new DomainConflictException(
                $"Node {node.Order} {node.Name} cannot be removed: pseudo accounts are placed on it."
            );
        }

        _nodes.Remove(node);
    }

    public PseudoAccountPlacement PlaceAccount(Guid pseudoAccountId, Guid nodeId)
    {
        var node = FindNode(nodeId);
        if (_placements.Any(p => p.PseudoAccountId == pseudoAccountId))
        {
            throw new DomainConflictException(
                "The pseudo account is already placed on the chart of account. Remove it first."
            );
        }

        var placement = new PseudoAccountPlacement(Id, pseudoAccountId, node.Id);
        _placements.Add(placement);
        return placement;
    }

    public void RemovePlacement(Guid pseudoAccountId)
    {
        var placement =
            _placements.Find(p => p.PseudoAccountId == pseudoAccountId)
            ?? throw new DomainRuleException(
                "The pseudo account is not placed on the chart of account."
            );
        _placements.Remove(placement);
    }

    public bool IsPlaced(Guid pseudoAccountId) =>
        _placements.Any(p => p.PseudoAccountId == pseudoAccountId);

    private CoaNode FindNode(Guid nodeId) =>
        _nodes.Find(n => n.Id == nodeId)
        ?? throw new DomainRuleException("The chart-of-account node does not exist.");
}

/// <summary>A node in a legal entity's chart of account.</summary>
public sealed class CoaNode : EntityBase
{
    private CoaNode() { }

    internal CoaNode(
        Guid chartId,
        string name,
        string description,
        string order,
        int depth,
        Guid? parentId
    )
    {
        ChartId = chartId;
        Name = name;
        Description = description;
        Order = order;
        Depth = depth;
        ParentId = parentId;
    }

    public Guid ChartId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public string Description { get; private set; } = string.Empty;

    /// <summary>Hierarchical display order, e.g. "1.5.3".</summary>
    public string Order { get; private set; } = string.Empty;

    public int Depth { get; private set; }

    public Guid? ParentId { get; private set; }

    internal void Rename(string name, string description)
    {
        Name = name;
        Description = description;
    }
}

/// <summary>PseudoAccountCOA: places one pseudo account on one chart node.</summary>
public sealed class PseudoAccountPlacement : EntityBase
{
    private PseudoAccountPlacement() { }

    internal PseudoAccountPlacement(Guid chartId, Guid pseudoAccountId, Guid coaNodeId)
    {
        ChartId = chartId;
        PseudoAccountId = pseudoAccountId;
        CoaNodeId = coaNodeId;
    }

    public Guid ChartId { get; private set; }

    public Guid PseudoAccountId { get; private set; }

    public Guid CoaNodeId { get; private set; }
}
