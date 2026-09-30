using System.Text.Json;
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
if (string.IsNullOrWhiteSpace(databasePassword))
    throw new InvalidOperationException("Database:Password must be configured.");

var connectionString = new SqlConnectionStringBuilder
{
    DataSource = $"{database["Server"] ?? "localhost"},{database.GetValue("Port", 1433)}",
    InitialCatalog = database["Name"] ?? "AccountingDemo",
    UserID = database["User"] ?? "sa",
    Password = databasePassword,
    Encrypt = database.GetValue("Encrypt", false),
    TrustServerCertificate = database.GetValue("TrustServerCertificate", true),
}.ConnectionString;
await using (var connection = new SqlConnection(connectionString))
    await connection.OpenAsync();

var app = builder.Build();
app.UseExceptionHandler(handler => handler.Run(async context =>
{
    app.Logger.LogError(context.Features.Get<IExceptionHandlerFeature>()?.Error, "The demo SQL request failed.");
    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
    await context.Response.WriteAsJsonAsync(new { message = "The demo could not save or load its SQL data." });
}));
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/health", () => Results.Ok(new { status = "ready" }));

app.MapGet("/demo/state", async (CancellationToken cancellationToken) =>
{
    await using var connection = new SqlConnection(connectionString);
    await connection.OpenAsync(cancellationToken);
    await using var command = new SqlCommand("SELECT StateJson FROM dbo.DemoAppState WHERE StateKey = N'app'", connection);
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
    await using var command = new SqlCommand("""
        UPDATE dbo.DemoAppState
        SET StateJson = @stateJson, UpdatedAt = SYSUTCDATETIME()
        WHERE StateKey = N'app';
        IF @@ROWCOUNT = 0
            INSERT INTO dbo.DemoAppState (StateKey, StateJson) VALUES (N'app', @stateJson);
        """, connection);
    command.Parameters.AddWithValue("@stateJson", stateJson);
    command.Parameters["@stateJson"].Size = -1;
    await command.ExecuteNonQueryAsync(cancellationToken);
    return Results.NoContent();
});

app.MapFallbackToFile("index.html");
app.Run();
