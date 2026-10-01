using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Server.IIS;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Data.SqlClient;

const long maxRequestBytes = 25 * 1024 * 1024;

var builder = WebApplication.CreateBuilder(args);
builder.Services.Configure<IISServerOptions>(options => options.MaxRequestBodySize = maxRequestBytes);
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = maxRequestBytes);

var database = builder.Configuration.GetSection("Database");
var databasePassword = database["Password"];
var connectionString = new SqlConnectionStringBuilder
{
    DataSource = $"{database["Server"] ?? "localhost"},{database.GetValue("Port", 1433)}",
    InitialCatalog = database["Name"] ?? "AccountingDemo",
    UserID = database["User"] ?? "sa",
    Password = databasePassword ?? string.Empty,
    Encrypt = database.GetValue("Encrypt", false),
    TrustServerCertificate = database.GetValue("TrustServerCertificate", true),
}.ConnectionString;

var app = builder.Build();
app.UseExceptionHandler(handler => handler.Run(async context =>
{
    var error = context.Features.Get<IExceptionHandlerFeature>()?.Error;
    var diagnosticId = Guid.NewGuid().ToString("N");
    app.Logger.LogError(error, "The demo request failed. Diagnostic ID: {DiagnosticId}", diagnosticId);
    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
    var details = error?.ToString() ?? "No exception details were captured.";
    details = Regex.Replace(details, "(?im)(password|pwd)\\s*=.*$", "$1=[REDACTED]");
    await context.Response.WriteAsJsonAsync(new
    {
        message = "The demo could not load or save its data. The database may be unavailable; please retry in a moment.",
        diagnosticId,
        details = new { timeUtc = DateTime.UtcNow, method = context.Request.Method, path = context.Request.Path.Value, exception = details },
    });
}));
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/health", () => Results.Ok(new { status = "ready" }));

app.MapGet("/demo/state", async (CancellationToken cancellationToken) =>
{
    await using var connection = new SqlConnection(connectionString);
    await connection.OpenAsync(cancellationToken);
    await using var command = new SqlCommand("dbo.GetDemoState", connection) { CommandType = System.Data.CommandType.StoredProcedure };
    var state = await command.ExecuteScalarAsync(cancellationToken);
    return state is null or DBNull
        ? Results.NoContent()
        : Results.Content((string)state, "application/json; charset=utf-8");
});

app.MapPut("/demo/state", async (JsonElement state, CancellationToken cancellationToken) =>
{
    if (state.ValueKind != JsonValueKind.Object)
        return Results.BadRequest(new { message = "Demo state must be a JSON object." });

    var stateJson = state.GetRawText();
    await using var connection = new SqlConnection(connectionString);
    await connection.OpenAsync(cancellationToken);
    await using var command = new SqlCommand("dbo.SaveDemoState", connection) { CommandType = System.Data.CommandType.StoredProcedure };
    command.Parameters.Add("@StateJson", System.Data.SqlDbType.NVarChar, -1).Value = stateJson;
    await command.ExecuteNonQueryAsync(cancellationToken);
    return Results.NoContent();
});

app.MapFallbackToFile("index.html");
app.Run();
