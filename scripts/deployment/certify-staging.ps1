param(
  [string]$EnvFile = ".env.staging",
  [int]$WaitSeconds = 60,
  [switch]$ExerciseChat,
  [string]$EvidenceDirectory
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$envPath = if ([IO.Path]::IsPathRooted($EnvFile)) { $EnvFile } else { Join-Path $root $EnvFile }
$settings = @{}
foreach ($line in Get-Content -LiteralPath $envPath) {
  $trimmed = $line.Trim()
  if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
  $parts = $trimmed.Split("=", 2)
  if ($parts.Count -eq 2) { $settings[$parts[0].Trim()] = $parts[1].Trim() }
}

$publicUrl = $settings.PUBLIC_WEB_URL.TrimEnd("/")
$backendPort = if ($settings.BACKEND_HOST_PORT) { $settings.BACKEND_HOST_PORT } else { "3001" }
$backendUrl = "http://127.0.0.1:$backendPort"
$deadline = (Get-Date).AddSeconds($WaitSeconds)

do {
  try {
    $ready = Invoke-RestMethod -Uri "$publicUrl/api/v1/health/ready" -TimeoutSec 5
    if ($ready.status -eq "ok") { break }
  } catch {
    if ((Get-Date) -ge $deadline) { throw "Staging readiness did not become healthy: $($_.Exception.Message)" }
    Start-Sleep -Seconds 2
  }
} while ((Get-Date) -lt $deadline)

$web = Invoke-WebRequest -Uri $publicUrl -UseBasicParsing -TimeoutSec 10
if ($web.StatusCode -ne 200) { throw "Web smoke check returned HTTP $($web.StatusCode)." }
foreach ($header in @("Content-Security-Policy", "X-Content-Type-Options", "Referrer-Policy")) {
  if (-not $web.Headers[$header]) { throw "Required web security header is missing: $header" }
}

$loginBody = @{ email = $settings.DEFAULT_USER_EMAIL; password = $settings.DEFAULT_USER_PASSWORD } | ConvertTo-Json
$loginResponse = Invoke-WebRequest -Uri "$publicUrl/api/v1/session/login" -Method Post -ContentType "application/json" -Body $loginBody -Headers @{ Origin = $publicUrl } -UseBasicParsing -TimeoutSec 15
$login = $loginResponse.Content | ConvertFrom-Json
if ($login.user.role -ne "admin") { throw "Certification account is not an admin." }
$setCookie = $loginResponse.Headers["Set-Cookie"]
if (-not $setCookie) { throw "Login did not issue a browser session cookie." }
$cookie = $setCookie.Split(";", 2)[0]
$cookieParts = $cookie.Split("=", 2)
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$session.Cookies.Add([Uri]$publicUrl, (New-Object System.Net.Cookie($cookieParts[0], $cookieParts[1], "/")))
$models = Invoke-RestMethod -Uri "$publicUrl/api/v1/models/selector?mode=chat" -WebSession $session -TimeoutSec 15
if (-not $models.models -or $models.models.Count -lt 1) { throw "No eligible chat model is available." }

$metrics = Invoke-WebRequest -Uri "$backendUrl/metrics" -Headers @{ Authorization = "Bearer $($settings.METRICS_TOKEN)" } -UseBasicParsing -TimeoutSec 10
if ($metrics.StatusCode -ne 200 -or $metrics.Content -notmatch "loom_http_requests_total") {
  throw "Authenticated metrics certification failed."
}

if ($ExerciseChat) {
  $env:LOAD_TEST_CONFIRM = "true"
  $env:LOAD_TEST_BASE_URL = $backendUrl
  $env:LOAD_TEST_EMAIL = $settings.DEFAULT_USER_EMAIL
  $env:LOAD_TEST_PASSWORD = $settings.DEFAULT_USER_PASSWORD
  $env:LOAD_TEST_ORIGIN = $publicUrl
  $env:LOAD_TEST_REQUESTS = "2"
  $env:LOAD_TEST_CONCURRENCY = "1"
  try {
    & node (Join-Path $root "scripts\load\chat-load.mjs")
    if ($LASTEXITCODE -ne 0) { throw "Chat certification failed." }
  } finally {
    @("LOAD_TEST_CONFIRM", "LOAD_TEST_BASE_URL", "LOAD_TEST_EMAIL", "LOAD_TEST_PASSWORD", "LOAD_TEST_ORIGIN", "LOAD_TEST_REQUESTS", "LOAD_TEST_CONCURRENCY") |
      ForEach-Object { Remove-Item "Env:$_" -ErrorAction SilentlyContinue }
  }
}

$evidence = [ordered]@{
  certifiedAt = (Get-Date).ToUniversalTime().ToString("o")
  publicUrl = $publicUrl
  readiness = $ready.status
  database = $ready.database.status
  redis = $ready.redis.status
  eligibleChatModels = $models.models.Count
  adminAccess = $true
  metricsAuthenticated = $true
  chatExercised = [bool]$ExerciseChat
}
$evidenceJson = $evidence | ConvertTo-Json
if ($EvidenceDirectory) {
  $evidencePath = [IO.Path]::GetFullPath((Join-Path $root $EvidenceDirectory))
  if (-not $evidencePath.StartsWith($root + [IO.Path]::DirectorySeparatorChar)) {
    throw "Evidence directory must remain inside the repository workspace."
  }
  New-Item -ItemType Directory -Path $evidencePath -Force | Out-Null
  Set-Content -LiteralPath (Join-Path $evidencePath "staging-certification.json") -Value $evidenceJson -Encoding ascii
}
Write-Output $evidenceJson
