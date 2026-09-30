namespace Accounting.Application.Common;

/// <summary>Requested resource does not exist. Mapped to 404 by the API (§5.2).</summary>
public sealed class NotFoundException : Exception
{
    public NotFoundException(string resource, object key)
        : base($"{resource} '{key}' was not found.") { }
}
