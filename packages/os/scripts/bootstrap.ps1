[CmdletBinding()]
param(
  [string]$BundleUrl = $env:CONSUELO_WINDOWS_BUNDLE_URL,
  [string]$BundleSha256 = $env:CONSUELO_WINDOWS_BUNDLE_SHA256,
  [string]$Home = (Join-Path $env:USERPROFILE '.consuelo'),
  [switch]$SkipBunInstall,
  [switch]$ResolveBunOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Assert-SupportedWindowsHost {
  if (-not $IsWindows -and $env:OS -ne 'Windows_NT') {
    throw 'Consuelo OS Windows bootstrap requires native Windows. WSL is not supported.'
  }
  if ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture -ne 'X64') {
    throw 'Consuelo OS Windows bootstrap currently supports x64 hosts only.'
  }
  $operatingSystem = Get-CimInstance Win32_OperatingSystem
  $build = [int]$operatingSystem.BuildNumber
  if ($build -lt 19045) {
    throw "Unsupported Windows build $build. Use Windows 10 22H2, Windows 11, Windows Server 2022, or Windows Server 2025."
  }
  $principal = [Security.Principal.WindowsPrincipal]::new(
    [Security.Principal.WindowsIdentity]::GetCurrent()
  )
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Service registration requires an elevated PowerShell window. Choose Run as administrator and retry.'
  }
}

function Install-BunRuntime {
  param([switch]$SkipInstall)

  $ownedBun = Join-Path $env:USERPROFILE '.bun\bin\bun.exe'
  if (Test-Path -LiteralPath $ownedBun) {
    return (Resolve-Path -LiteralPath $ownedBun).Path
  }
  $existing = Get-Command bun.exe -ErrorAction SilentlyContinue
  if ($existing) {
    return $existing.Source
  }
  if ($SkipInstall) {
    throw "Bun was not found. Install Bun or remove -SkipBunInstall. Expected path: $ownedBun"
  }

  $installer = Join-Path ([IO.Path]::GetTempPath()) "consuelo-bun-$PID.ps1"
  try {
    Invoke-WebRequest -UseBasicParsing -Uri 'https://bun.sh/install.ps1' -OutFile $installer
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $ownedBun)) {
      throw 'The Bun-owned installer did not produce .bun\bin\bun.exe.'
    }
    return (Resolve-Path -LiteralPath $ownedBun).Path
  }
  finally {
    Remove-Item -LiteralPath $installer -Force -ErrorAction SilentlyContinue
  }
}

function Open-ConsueloAuthorization {
  param([Parameter(Mandatory = $true)][string]$Url)
  try {
    Start-Process -FilePath $Url
  }
  catch {
    Write-Host "Open this URL in a browser: $Url"
  }
}

function Find-ConsueloPackageRoot {
  param([Parameter(Mandatory = $true)][string]$ExtractedRoot)
  $candidate = Get-ChildItem -LiteralPath $ExtractedRoot -Filter package.json -File -Recurse |
    Where-Object { Test-Path -LiteralPath (Join-Path $_.Directory.FullName 'scripts\lifecycle.ts') } |
    Select-Object -First 1
  if (-not $candidate) {
    throw 'Verified Windows bundle does not contain the Consuelo OS package root.'
  }
  return $candidate.Directory.FullName
}

function Invoke-ConsueloWindowsBootstrap {
  Assert-SupportedWindowsHost
  if ($ResolveBunOnly) {
    $resolvedBun = Install-BunRuntime -SkipInstall:$SkipBunInstall
    Write-Output $resolvedBun
    return
  }
  if ([string]::IsNullOrWhiteSpace($BundleUrl)) {
    throw 'CONSUELO_WINDOWS_BUNDLE_URL or -BundleUrl is required.'
  }
  if ($BundleSha256 -notmatch '^[a-fA-F0-9]{64}$') {
    throw 'CONSUELO_WINDOWS_BUNDLE_SHA256 or -BundleSha256 must be a SHA-256 digest.'
  }

  $resolvedHome = [IO.Path]::GetFullPath($Home)
  $staging = Join-Path ([IO.Path]::GetTempPath()) "consuelo-windows-$PID"
  $archive = Join-Path $staging 'consuelo-os.tar.gz'
  $extracted = Join-Path $staging 'extracted'
  New-Item -ItemType Directory -Path $staging, $extracted -Force | Out-Null

  try {
    $bunExecutable = Install-BunRuntime -SkipInstall:$SkipBunInstall
    $env:BUN_BIN = $bunExecutable

    Invoke-WebRequest -UseBasicParsing -Uri $BundleUrl -OutFile $archive
    $actualDigest = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualDigest -ne $BundleSha256.ToLowerInvariant()) {
      throw "Consuelo Windows bundle checksum mismatch. Expected $BundleSha256, received $actualDigest."
    }

    & tar.exe -xzf $archive -C $extracted
    if ($LASTEXITCODE -ne 0) {
      throw 'Verified Consuelo Windows bundle extraction failed.'
    }
    $packageRoot = Find-ConsueloPackageRoot -ExtractedRoot $extracted

    $serviceSource = @(
      (Join-Path $packageRoot 'native\windows-service\bin\Release\Consuelo.Windows.Service.exe'),
      (Join-Path $packageRoot 'bin\windows\Consuelo.Windows.Service.exe')
    ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $serviceSource) {
      throw 'The verified Windows bundle is missing Consuelo.Windows.Service.exe. Use a Windows release artifact produced by the distribution pipeline.'
    }

    $binDirectory = Join-Path $resolvedHome 'bin'
    New-Item -ItemType Directory -Path $binDirectory -Force | Out-Null
    $serviceHost = Join-Path $binDirectory 'Consuelo.Windows.Service.exe'
    Copy-Item -LiteralPath $serviceSource -Destination $serviceHost -Force

    & $bunExecutable (Join-Path $packageRoot 'scripts\windows-platform.ts') install-service `
      --home $resolvedHome `
      --bun $bunExecutable `
      --service-host $serviceHost `
      --defer-start `
      --json
    if ($LASTEXITCODE -ne 0) {
      throw 'Consuelo Windows service registration failed.'
    }

    & $bunExecutable (Join-Path $packageRoot 'scripts\lifecycle.ts') install --home $resolvedHome
    if ($LASTEXITCODE -ne 0) {
      throw 'Consuelo lifecycle installation failed. The registered service remains stopped for diagnosis or retry.'
    }
  }
  catch [System.Management.Automation.PSSecurityException] {
    throw "PowerShell blocked the bootstrap. Run 'Set-ExecutionPolicy -Scope Process Bypass', then execute 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\bootstrap.ps1'."
  }
  finally {
    Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
  }
}

Invoke-ConsueloWindowsBootstrap
