using ArchUnitNET.Domain;
using ArchUnitNET.Loader;
using ArchUnitNET.xUnit;
using Xunit;
using static ArchUnitNET.Fluent.ArchRuleDefinition;
using ArchitectureModel = ArchUnitNET.Domain.Architecture;

namespace Accounting.UnitTests.Architecture;

/// <summary>
/// Executable Clean Architecture dependency rules (§3, §11). A failing test blocks merge.
/// </summary>
public sealed class LayerDependencyTests
{
    private static readonly System.Reflection.Assembly DomainAssembly =
        typeof(Accounting.Domain.Common.EntityBase).Assembly;

    private static readonly System.Reflection.Assembly ApplicationAssembly =
        typeof(Accounting.Application.Common.ITenantContext).Assembly;

    private static readonly System.Reflection.Assembly InfrastructureAssembly =
        typeof(Accounting.Infrastructure.DependencyInjection).Assembly;

    private static readonly System.Reflection.Assembly ApiAssembly =
        typeof(Accounting.Api.Auth.AuthorizationPolicies).Assembly;

    private static readonly ArchitectureModel Architecture = new ArchLoader()
        .LoadAssemblies(DomainAssembly, ApplicationAssembly, InfrastructureAssembly, ApiAssembly)
        .Build();

    private static IObjectProvider<IType> Layer(System.Reflection.Assembly assembly) =>
        Types().That().ResideInAssembly(assembly).As(assembly.GetName().Name!);

    [Fact]
    public void Domain_does_not_depend_on_outer_layers()
    {
        Types()
            .That()
            .Are(Layer(DomainAssembly))
            .Should()
            .NotDependOnAny(Layer(ApplicationAssembly))
            .AndShould()
            .NotDependOnAny(Layer(InfrastructureAssembly))
            .AndShould()
            .NotDependOnAny(Layer(ApiAssembly))
            .Check(Architecture);
    }

    [Fact]
    public void Application_does_not_depend_on_infrastructure_or_api()
    {
        Types()
            .That()
            .Are(Layer(ApplicationAssembly))
            .Should()
            .NotDependOnAny(Layer(InfrastructureAssembly))
            .AndShould()
            .NotDependOnAny(Layer(ApiAssembly))
            .Check(Architecture);
    }

    [Fact]
    public void Infrastructure_does_not_depend_on_api()
    {
        Types()
            .That()
            .Are(Layer(InfrastructureAssembly))
            .Should()
            .NotDependOnAny(Layer(ApiAssembly))
            .Check(Architecture);
    }

    [Fact]
    public void Domain_does_not_depend_on_mediator_or_wolverine()
    {
        // §2.1: cross-cutting code depends on our own abstractions, not the libraries.
        Types()
            .That()
            .Are(Layer(DomainAssembly))
            .Should()
            .NotDependOnAny(Types().That().ResideInNamespaceMatching("Wolverine.*"))
            .AndShould()
            .NotDependOnAny(Types().That().ResideInNamespaceMatching("Mediator.*"))
            .Check(Architecture);
    }

    [Fact]
    public void Application_does_not_depend_on_wolverine()
    {
        Types()
            .That()
            .Are(Layer(ApplicationAssembly))
            .Should()
            .NotDependOnAny(Types().That().ResideInNamespaceMatching("Wolverine.*"))
            .Check(Architecture);
    }
}
