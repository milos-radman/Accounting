# Multi-stage build. Runtime: distroless chiseled image per the blueprint (§2) —
# no shell, minimal attack surface.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /source

COPY Directory.Build.props dotnet-tools.json ./
COPY src/Accounting.Contracts/*.csproj src/Accounting.Contracts/
COPY src/Accounting.Domain/*.csproj src/Accounting.Domain/
COPY src/Accounting.Application/*.csproj src/Accounting.Application/
COPY src/Accounting.Infrastructure/*.csproj src/Accounting.Infrastructure/
COPY src/Accounting.Api/*.csproj src/Accounting.Api/
RUN dotnet restore src/Accounting.Api

COPY src/ src/
RUN dotnet publish src/Accounting.Api -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled
WORKDIR /app
COPY --from=build /app .
EXPOSE 8080
USER app
ENTRYPOINT ["dotnet", "Accounting.Api.dll"]
