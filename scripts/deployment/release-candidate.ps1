param(
  [Parameter(Mandatory = $true)][string]$Candidate,
  [ValidateSet("Draft", "Create")][string]$Mode = "Draft",
  [string]$BackendImage = "loom-backend:staging",
  [string]$WebImage = "loom-web:staging",
  [string]$EvidenceDirectory = "release-evidence",
  [string]$StagingEnvFile
)

function Invoke-Gate {
  param([string]$Name, [scriptblock]$Command)
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "Release gate failed: $Name" }
  $script:checks[$Name] = "passed"
}

function Get-ImageIdentity {
  param([string]$Image)
  $id = (& docker image inspect $Image --format '{{.Id}}' 2>$null).Trim()
  if (-not $id) {
    if ($script:Mode -eq "Create") { throw "Required image not found: $Image" }
    return [ordered]@{ reference = $Image; imageId = $null }
  }
  $digests = @(& docker image inspect $Image --format '{{range .RepoDigests}}{{println .}}{{end}}' 2>$null) | Where-Object { $_ }
  return [ordered]@{ reference = $Image; imageId = $id; repoDigests = $digests }
}

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if ($Candidate -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$') {
  throw "Candidate must be a release-safe name up to 64 characters."
}

$evidencePath = [IO.Path]::GetFullPath((Join-Path $root $EvidenceDirectory))
if (-not $evidencePath.StartsWith($root + [IO.Path]::DirectorySeparatorChar)) {
  throw "Evidence directory must remain inside the repository workspace."
}
New-Item -ItemType Directory -Path $evidencePath -Force | Out-Null

$commit = (& git -C $root rev-parse HEAD).Trim()
$branch = (& git -C $root branch --show-current).Trim()
$dirtyFiles = @(& git -C $root status --porcelain)
$isDirty = $dirtyFiles.Count -gt 0
if ($Mode -eq "Create" -and $isDirty) {
  throw "Release candidates require a clean worktree. Commit the reviewed changes first."
}
if ($Mode -eq "Create" -and -not $env:COMPANION_CI_RUN_URL) {
  throw "COMPANION_CI_RUN_URL is required to prove the Tauri companion build passed."
}

$checks = [ordered]@{}
if ($Mode -eq "Create") {
  Invoke-Gate "typecheck" { & pnpm typecheck }
  Invoke-Gate "tests" { & pnpm test }
  Invoke-Gate "lint" { & pnpm lint }
  Invoke-Gate "backendBuild" { & pnpm --filter '@clm/backend' build }
  Invoke-Gate "webBuild" { & pnpm --filter '@clm/web' build }
  Invoke-Gate "dependencyAudit" { & pnpm audit --prod }
  Invoke-Gate "e2eTypecheck" { & pnpm typecheck:e2e }
  Invoke-Gate "e2e" { & pnpm test:e2e }
}

if ($StagingEnvFile) {
  & (Join-Path $PSScriptRoot "certify-staging.ps1") -EnvFile $StagingEnvFile -EvidenceDirectory $EvidenceDirectory
  if ($LASTEXITCODE -ne 0) { throw "Staging certification failed." }
  $checks.stagingCertification = "passed"
} else {
  $checks.stagingCertification = "not-run"
}

$backendIdentity = Get-ImageIdentity $BackendImage
$webIdentity = Get-ImageIdentity $WebImage
$manifest = [ordered]@{
  schemaVersion = 1
  candidate = $Candidate
  mode = $Mode.ToLowerInvariant()
  createdAt = (Get-Date).ToUniversalTime().ToString("o")
  source = [ordered]@{
    commit = $commit
    branch = $branch
    cleanWorktree = -not $isDirty
    dirtyFileCount = $dirtyFiles.Count
    lockfileSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $root "pnpm-lock.yaml")).Hash.ToLowerInvariant()
  }
  images = [ordered]@{
    backend = $backendIdentity
    web = $webIdentity
  }
  checks = $checks
  companionCiRunUrl = $env:COMPANION_CI_RUN_URL
}
$manifestJson = $manifest | ConvertTo-Json -Depth 8
$manifestPath = Join-Path $evidencePath "$Candidate.manifest.json"
Set-Content -LiteralPath $manifestPath -Value $manifestJson -Encoding ascii
$manifestHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $manifestPath).Hash.ToLowerInvariant()
Set-Content -LiteralPath "$manifestPath.sha256" -Value "$manifestHash  $([IO.Path]::GetFileName($manifestPath))" -Encoding ascii
Write-Output $manifestJson
