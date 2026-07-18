param(
  [Parameter(Mandatory = $true)][string]$BackendImage,
  [Parameter(Mandatory = $true)][string]$WebImage,
  [string]$EnvFile = ".env.staging",
  [Parameter(Mandatory = $true)][ValidateSet("ROLLBACK")][string]$Confirm
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$envPath = [IO.Path]::GetFullPath((Join-Path $root $EnvFile))
$composeFile = Join-Path $root "compose.staging.yml"
if (-not (Test-Path -LiteralPath $envPath)) { throw "Environment file not found: $envPath" }

$env:BACKEND_IMAGE = $BackendImage
$env:WEB_IMAGE = $WebImage
try {
  & docker compose --env-file $envPath -f $composeFile up -d --no-build backend web
  if ($LASTEXITCODE -ne 0) { throw "Rollback deployment failed." }
  & (Join-Path $PSScriptRoot "certify-staging.ps1") -EnvFile $envPath
} finally {
  Remove-Item Env:BACKEND_IMAGE, Env:WEB_IMAGE -ErrorAction SilentlyContinue
}
