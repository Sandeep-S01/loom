param(
  [Parameter(Mandatory = $true)]
  [string]$BackupPath,

  [Parameter(Mandatory = $true)]
  [string]$ConfirmDatabaseName
)

$ErrorActionPreference = "Stop"

if (-not $env:DATABASE_URL) {
  throw "DATABASE_URL is required."
}
if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) {
  throw "pg_restore is required and was not found on PATH."
}

$resolvedBackup = (Resolve-Path -LiteralPath $BackupPath -ErrorAction Stop).Path
$databaseUri = [Uri]$env:DATABASE_URL
$databaseName = $databaseUri.AbsolutePath.TrimStart("/")
if (-not $databaseName -or $ConfirmDatabaseName -ne $databaseName) {
  throw "Confirmation must exactly match target database name '$databaseName'."
}

$checksumFile = "$resolvedBackup.sha256"
if (Test-Path -LiteralPath $checksumFile) {
  $expected = ((Get-Content -LiteralPath $checksumFile -Raw).Trim() -split "\s+")[0]
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedBackup).Hash.ToLowerInvariant()
  if ($expected.ToLowerInvariant() -ne $actual) {
    throw "Backup checksum validation failed."
  }
}

& pg_restore --dbname=$env:DATABASE_URL --clean --if-exists --no-owner --single-transaction $resolvedBackup
if ($LASTEXITCODE -ne 0) {
  throw "pg_restore failed with exit code $LASTEXITCODE."
}

Write-Output "Restore completed for database '$databaseName'."
