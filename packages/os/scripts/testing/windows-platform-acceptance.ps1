[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($env:OS -ne 'Windows_NT') {
  throw 'Windows platform acceptance must run on native Windows.'
}

$packageRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$bootstrap = Join-Path $packageRoot 'scripts\bootstrap.ps1'
$platformCli = Join-Path $packageRoot 'scripts\windows-platform.ts'
$builtService = Join-Path $packageRoot 'native\windows-service\bin\Release\Consuelo.Windows.Service.exe'
if (-not (Test-Path -LiteralPath $builtService)) {
  throw "Windows service build output is missing: $builtService"
}

$originalProfile = $env:USERPROFILE
$originalHome = $env:HOME
$originalPath = $env:PATH
$testProfile = Join-Path $env:RUNNER_TEMP 'Consuelo Windows Profile'
$consueloHome = Join-Path $testProfile '.consuelo'
$serviceBun = Join-Path $consueloHome 'bin\bun.exe'
$serviceHost = Join-Path $consueloHome 'bin\Consuelo.Windows.Service.exe'
$bundleDigest = ('a' * 64)
$release = Join-Path $consueloHome "runtime\releases\sha256-$bundleDigest"
$current = Join-Path $consueloHome 'runtime\current'
$workspaceMarker = Join-Path $consueloHome 'workspace.json'
$contentMarker = Join-Path $consueloHome 'content\custom\owned-by-user.txt'
$installed = $false
$ownedBun = $null

try {
  Remove-Item -LiteralPath $testProfile -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Path $testProfile -Force | Out-Null
  $env:USERPROFILE = $testProfile
  $env:HOME = $testProfile
  $env:PATH = (($originalPath -split ';') | Where-Object { $_ -notmatch '(?i)bun' }) -join ';'

  $ownedBun = (& $bootstrap -ResolveBunOnly | Select-Object -Last 1).Trim()
  if (-not (Test-Path -LiteralPath $ownedBun)) {
    throw 'Clean-profile Bun installation did not produce an executable.'
  }
  if (-not $ownedBun.StartsWith($testProfile, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Clean-profile Bun installation escaped USERPROFILE: $ownedBun"
  }

  $existingBun = (& $bootstrap -ResolveBunOnly -SkipBunInstall | Select-Object -Last 1).Trim()
  if ($existingBun -ne $ownedBun) {
    throw 'Existing-Bun resolution did not reuse the persisted Bun-owned executable.'
  }

  New-Item -ItemType Directory -Path (Split-Path $serviceHost), (Join-Path $release 'scripts\server'), (Split-Path $contentMarker) -Force | Out-Null
  Copy-Item -LiteralPath $ownedBun -Destination $serviceBun -Force
  if ((Get-FileHash -LiteralPath $ownedBun -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $serviceBun -Algorithm SHA256).Hash) {
    throw 'Protected service Bun copy failed integrity verification.'
  }
  Copy-Item -LiteralPath $builtService -Destination $serviceHost -Force
  Set-Content -LiteralPath (Join-Path $release 'scripts\server\supervisor.ts') -Encoding utf8 -Value @'
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: 46321,
  fetch() {
    return Response.json({ name: 'consuelo-os', version: 'windows-acceptance' });
  },
});
process.on('SIGTERM', () => server.stop(true));
'@
  New-Item -ItemType Junction -Path $current -Target $release | Out-Null
  Set-Content -LiteralPath $workspaceMarker -Encoding utf8 -Value '{"workspace":"preserve"}'
  Set-Content -LiteralPath $contentMarker -Encoding utf8 -Value 'preserve'

  & $ownedBun $platformCli install-service --home $consueloHome --bun $serviceBun --service-host $serviceHost --json
  if ($LASTEXITCODE -ne 0) { throw 'Native Windows service installation failed.' }
  $installed = $true

  $deadline = [DateTime]::UtcNow.AddSeconds(30)
  do {
    try {
      $health = Invoke-RestMethod -Uri 'http://127.0.0.1:46321/health' -TimeoutSec 2
    }
    catch {
      $health = $null
      Start-Sleep -Milliseconds 500
    }
  } while (-not $health -and [DateTime]::UtcNow -lt $deadline)
  if (-not $health -or $health.name -ne 'consuelo-os') { throw 'Native Windows service health did not become ready.' }

  $configuration = (& sc.exe qc ConsueloOS 2>&1 | Out-String)
  if ($configuration -notmatch 'AUTO_START') { throw 'Windows service is not configured for boot persistence.' }
  if ($configuration -notmatch 'NT SERVICE\\ConsueloOS') { throw 'Windows service is not using its service-specific virtual account.' }

  $status = & $ownedBun $platformCli status --home $consueloHome --bun $serviceBun --service-host $serviceHost --json | ConvertFrom-Json
  if ($status.state -ne 'running') { throw "Unexpected Windows service state: $($status.state)" }
  & $ownedBun $platformCli restart --home $consueloHome --bun $serviceBun --service-host $serviceHost --json | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Native Windows service restart failed.' }
  $diagnostics = & $ownedBun $platformCli diagnostics --home $consueloHome --bun $serviceBun --service-host $serviceHost --json | ConvertFrom-Json
  if ($diagnostics.bunExecutable -ne $serviceBun) { throw 'Diagnostics did not report the protected persisted Bun path.' }

  $acl = (& icacls.exe $consueloHome 2>&1 | Out-String)
  if ($acl -notmatch 'ConsueloOS') { throw 'Consuelo service ACL entry is missing.' }
  $profileAncestor = $testProfile
  while ($profileAncestor -and $profileAncestor -ne [IO.Path]::GetPathRoot($profileAncestor)) {
    $profileAcl = (& icacls.exe $profileAncestor 2>&1 | Out-String)
    if ($profileAcl -notmatch 'ConsueloOS') {
      throw "Consuelo service profile traversal ACL entry is missing: $profileAncestor"
    }
    $profileAncestor = Split-Path -Parent $profileAncestor
  }

  & $ownedBun $platformCli uninstall-service --home $consueloHome --bun $serviceBun --service-host $serviceHost --dry-run --json | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Windows uninstall dry run failed.' }
  if ((& sc.exe query ConsueloOS 2>&1 | Out-String) -notmatch 'RUNNING') { throw 'Dry-run uninstall mutated the service.' }

  & $ownedBun $platformCli uninstall-service --home $consueloHome --bun $serviceBun --service-host $serviceHost --json | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Windows service uninstall failed.' }
  $installed = $false
  if (-not (Test-Path -LiteralPath $workspaceMarker) -or -not (Test-Path -LiteralPath $contentMarker)) {
    throw 'Default Windows uninstall removed preserved workspace or user content.'
  }
  if ((Test-Path -LiteralPath $serviceBun) -or (Test-Path -LiteralPath $serviceHost)) {
    throw 'Default Windows uninstall retained service-owned executables.'
  }

  Copy-Item -LiteralPath $ownedBun -Destination $serviceBun -Force
  Copy-Item -LiteralPath $builtService -Destination $serviceHost -Force
  & $ownedBun $platformCli install-service --home $consueloHome --bun $serviceBun --service-host $serviceHost --json | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Windows service reinstall failed.' }
  $installed = $true
  & $ownedBun $platformCli uninstall-service --home $consueloHome --bun $serviceBun --service-host $serviceHost --json | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Final Windows service cleanup failed.' }
  $installed = $false

  Write-Output 'Windows platform acceptance passed.'
}
finally {
  if ($installed -and (Test-Path -LiteralPath $ownedBun)) {
    & $ownedBun $platformCli uninstall-service --home $consueloHome --bun $serviceBun --service-host $serviceHost --json 2>$null | Out-Null
  }
  $env:USERPROFILE = $originalProfile
  $env:HOME = $originalHome
  $env:PATH = $originalPath
  Remove-Item -LiteralPath $testProfile -Recurse -Force -ErrorAction SilentlyContinue
}
