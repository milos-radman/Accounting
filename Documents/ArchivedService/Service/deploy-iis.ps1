#Requires -RunAsAdministrator
# Publishes the API and (re)deploys it as an IIS site in the Demo environment.
# Safe to re-run: stops the app pool, republishes, restarts. See DEMO_DEPLOYMENT.md.
param(
    [Parameter(Mandatory)][string]$ConnectionString,
    [string]$Name = 'AccountingDemo',
    [string]$SitePath = 'C:\inetpub\AccountingDemo',
    [int]$Port = 8080
)
$ErrorActionPreference = 'Stop'
Import-Module WebAdministration

$poolPath = "IIS:\AppPools\$Name"
if ((Test-Path $poolPath) -and (Get-WebAppPoolState $Name).Value -ne 'Stopped') {
    Stop-WebAppPool $Name
    Start-Sleep -Seconds 3 # let the in-process app release its file locks
}

dotnet publish "$PSScriptRoot\src\Accounting.Api" -c Release -o $SitePath -p:EnvironmentName=Demo
if ($LASTEXITCODE) { throw 'dotnet publish failed' }

# ponytail: connection string written into the published appsettings (plain text on the demo
# box). Move to an environment variable / secret store before this leaves a trusted machine.
$settingsFile = Join-Path $SitePath 'appsettings.Demo.json'
$settings = Get-Content $settingsFile -Raw | ConvertFrom-Json
$settings.TenantRegistry.Tenants.demo = $ConnectionString
$settings | ConvertTo-Json -Depth 10 | Set-Content $settingsFile

if (-not (Test-Path $poolPath)) {
    New-WebAppPool $Name | Out-Null
    Set-ItemProperty $poolPath managedRuntimeVersion '' # "No Managed Code"
    Set-ItemProperty $poolPath processModel.loadUserProfile $true
}
if (-not (Test-Path "IIS:\Sites\$Name")) {
    New-Website -Name $Name -Port $Port -PhysicalPath $SitePath -ApplicationPool $Name | Out-Null
}
if ((Get-WebAppPoolState $Name).Value -ne 'Started') { Start-WebAppPool $Name }

"Deployed. Check: http://localhost:$Port/health/ready and http://localhost:$Port/scalar"
