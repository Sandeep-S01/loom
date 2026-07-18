param(
  [string]$OutputDirectory = "backups"
)

$ErrorActionPreference = "Stop"

if (-not $env:DATABASE_URL) {
  throw "DATABASE_URL is required."
}
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw "pg_dump is required and was not found on PATH."
}

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$outputPath = [IO.Path]::GetFullPath((Join-Path $root $OutputDirectory))
if (-not $outputPath.StartsWith($root + [IO.Path]::DirectorySeparatorChar)) {
  throw "Backup directory must remain inside the repository workspace."
}

New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = Join-Path $outputPath "loom-$timestamp.dump"

& pg_dump --dbname=$env:DATABASE_URL --format=custom --no-owner --file=$backupFile
if ($LASTEXITCODE -ne 0) {
  throw "pg_dump failed with exit code $LASTEXITCODE."
}

$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $backupFile).Hash.ToLowerInvariant()
Set-Content -LiteralPath "$backupFile.sha256" -Value "$hash  $([IO.Path]::GetFileName($backupFile))" -Encoding ascii
Write-Output $backupFile
