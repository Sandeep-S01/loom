param(
  [ValidateSet("Validate", "Build", "Migrate", "Bootstrap", "Up", "Down", "Status", "Certify")]
  [string]$Action = "Validate",
  [string]$EnvFile = ".env.staging",
  [switch]$IncludeObservability,
  [switch]$ExerciseChat
)

function Read-EnvFile {
  param([string]$Path)
  $values = @{}
  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
    $parts = $trimmed.Split("=", 2)
    if ($parts.Count -eq 2) { $values[$parts[0].Trim()] = $parts[1].Trim() }
  }
  return $values
}

function Assert-StagingSettings {
  param([hashtable]$Settings)
  $required = @(
    "POSTGRES_PASSWORD", "DATABASE_URL", "REDIS_PASSWORD", "REDIS_URL",
    "PUBLIC_WEB_URL", "DEFAULT_USER_EMAIL", "DEFAULT_USER_PASSWORD",
    "PROVIDER_KEY_ENCRYPTION_SECRET", "COMPANION_PAIRING_SECRET", "METRICS_TOKEN"
  )
  foreach ($name in $required) {
    $value = $Settings[$name]
    if (-not $value -or $value.Contains("CHANGE_ME")) { throw "$name must be configured without placeholders." }
  }
  foreach ($name in @("DEFAULT_USER_PASSWORD", "PROVIDER_KEY_ENCRYPTION_SECRET", "COMPANION_PAIRING_SECRET", "METRICS_TOKEN")) {
    if ($Settings[$name].Length -lt 32) { throw "$name must contain at least 32 characters." }
  }
  if ($Settings.METRICS_TOKEN -notmatch '^[A-Za-z0-9._~-]{32,256}$') {
    throw "METRICS_TOKEN must use URL-safe alphanumeric token characters."
  }
  foreach ($name in @("DATABASE_URL", "REDIS_URL", "PUBLIC_WEB_URL")) {
    $uri = $null
    if (-not [Uri]::TryCreate($Settings[$name], [UriKind]::Absolute, [ref]$uri)) {
      throw "$name must be an absolute URL."
    }
  }
}

function Render-PrometheusConfig {
  param([string]$Root, [string]$MetricsToken)
  $template = Join-Path $Root "deployment\prometheus\prometheus.yml.template"
  $runtime = Join-Path $Root "deployment\runtime"
  New-Item -ItemType Directory -Path $runtime -Force | Out-Null
  $rendered = (Get-Content -LiteralPath $template -Raw).Replace("__METRICS_TOKEN__", $MetricsToken)
  Set-Content -LiteralPath (Join-Path $runtime "prometheus.yml") -Value $rendered -Encoding ascii
}

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$composeFile = Join-Path $root "compose.staging.yml"
$envPath = [IO.Path]::GetFullPath((Join-Path $root $EnvFile))

if (-not (Test-Path -LiteralPath $envPath)) {
  throw "Staging environment file not found: $envPath"
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is required."
}

$settings = Read-EnvFile -Path $envPath
Assert-StagingSettings -Settings $settings
Render-PrometheusConfig -Root $root -MetricsToken $settings.METRICS_TOKEN
$compose = @("compose", "--env-file", $envPath, "-f", $composeFile)

switch ($Action) {
  "Validate" {
    & docker @compose config --quiet
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose validation failed." }
    $alerts = Join-Path $root "deployment\prometheus\alerts.yml"
    & docker run --rm --entrypoint promtool -v "${alerts}:/alerts.yml:ro" prom/prometheus:v3.4.1 check rules /alerts.yml
    if ($LASTEXITCODE -ne 0) { throw "Prometheus alert validation failed." }
  }
  "Build" {
    & docker @compose build backend web migrate
    if ($LASTEXITCODE -ne 0) { throw "Staging image build failed." }
  }
  "Migrate" {
    & docker @compose --profile tools run --rm migrate
    if ($LASTEXITCODE -ne 0) { throw "Database migration failed." }
  }
  "Bootstrap" {
    & docker @compose --profile tools run --rm bootstrap
    if ($LASTEXITCODE -ne 0) { throw "Initial staging bootstrap failed." }
  }
  "Up" {
    & docker @compose build backend web migrate
    if ($LASTEXITCODE -ne 0) { throw "Staging image build failed." }
    & docker @compose --profile tools run --rm migrate
    if ($LASTEXITCODE -ne 0) { throw "Database migration failed; services were not updated." }
    & docker @compose --profile tools run --rm bootstrap
    if ($LASTEXITCODE -ne 0) { throw "Staging bootstrap failed; services were not updated." }
    $upArgs = @($compose)
    if ($IncludeObservability) { $upArgs += @("--profile", "observability") }
    & docker @upArgs up -d --remove-orphans
    if ($LASTEXITCODE -ne 0) { throw "Staging services failed to start." }
    & (Join-Path $PSScriptRoot "certify-staging.ps1") -EnvFile $envPath -WaitSeconds 120 -ExerciseChat:$ExerciseChat
  }
  "Down" {
    & docker @compose --profile observability down --remove-orphans
    if ($LASTEXITCODE -ne 0) { throw "Staging services failed to stop." }
  }
  "Status" {
    & docker @compose --profile observability ps
    if ($LASTEXITCODE -ne 0) { throw "Unable to read staging status." }
  }
  "Certify" {
    & (Join-Path $PSScriptRoot "certify-staging.ps1") -EnvFile $envPath -ExerciseChat:$ExerciseChat
  }
}
