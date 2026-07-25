import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const osRoot = resolve(import.meta.dirname, '..');
const source = (path: string): string =>
  readFileSync(resolve(osRoot, path), 'utf8');

describe('Windows PowerShell bootstrap source', () => {
  it('preserves the public Home flag without shadowing PowerShell HOME', () => {
    const bootstrap = source('scripts/bootstrap.ps1');

    expect(bootstrap).not.toMatch(/\[string\]\$Home\b/);
    expect(bootstrap).toContain("[Alias('Home')]");
    expect(bootstrap).toContain('[string]$ConsueloHome');
    expect(bootstrap).toContain('GetFullPath($ConsueloHome)');
  });

  it('rejects unsupported hosts before any download, directory, Bun, or service mutation', () => {
    const bootstrap = source('scripts/bootstrap.ps1');
    const main = bootstrap.slice(
      bootstrap.indexOf('function Invoke-ConsueloWindowsBootstrap'),
    );

    expect(main.indexOf('Assert-SupportedWindowsHost')).toBeGreaterThan(-1);
    expect(main.indexOf('Assert-SupportedWindowsHost')).toBeLessThan(
      main.indexOf('New-Item'),
    );
    expect(main.indexOf('Assert-SupportedWindowsHost')).toBeLessThan(
      main.indexOf('Invoke-WebRequest'),
    );
    expect(main.indexOf('Assert-SupportedWindowsHost')).toBeLessThan(
      main.indexOf('Install-BunRuntime'),
    );
    expect(main.indexOf('Assert-SupportedWindowsHost')).toBeLessThan(
      main.indexOf('install-service'),
    );
  });

  it('detects native Windows safely under Windows PowerShell 5.1 strict mode', () => {
    const bootstrap = source('scripts/bootstrap.ps1');

    expect(bootstrap).toContain('Test-Path variable:IsWindows');
    expect(bootstrap).toContain("$env:OS -eq 'Windows_NT'");
    expect(bootstrap).not.toContain('if (-not $IsWindows');
  });

  it('downloads Consuelo bytes to a temporary file and verifies SHA-256 before extraction or execution', () => {
    const bootstrap = source('scripts/bootstrap.ps1');

    expect(bootstrap).toContain('Get-FileHash');
    expect(bootstrap).toContain('-Algorithm SHA256');
    expect(bootstrap).toContain('CONSUELO_WINDOWS_BUNDLE_SHA256');
    expect(bootstrap).toContain('checksum mismatch');
    expect(bootstrap.indexOf('Get-FileHash')).toBeLessThan(
      bootstrap.indexOf('tar.exe'),
    );
    expect(bootstrap).not.toContain('Invoke-Expression');
  });

  it('uses the Bun-owned installer path, copies a verified service executable into the protected home, and never requires WSL', () => {
    const bootstrap = source('scripts/bootstrap.ps1');

    expect(bootstrap).toContain('https://bun.sh/install.ps1');
    expect(bootstrap).toContain('.bun\\bin\\bun.exe');
    expect(bootstrap).toContain("Join-Path $binDirectory 'bun.exe'");
    expect(bootstrap).toContain('Copy-Item -LiteralPath $sourceBunExecutable');
    expect(bootstrap).toContain('$sourceBunHash');
    expect(bootstrap).toContain('$serviceBunHash');
    expect(bootstrap).toContain('--bun $serviceBunExecutable');
    expect(bootstrap).toContain('BUN_BIN');
    expect(bootstrap).not.toMatch(/\bwsl\.exe\b/i);
  });

  it('provides actionable execution-policy guidance without a dead browser helper', () => {
    const bootstrap = source('scripts/bootstrap.ps1');

    expect(bootstrap).not.toContain('function Open-ConsueloAuthorization');
    expect(bootstrap).toContain('Set-ExecutionPolicy -Scope Process Bypass');
    expect(bootstrap).toContain(
      'powershell.exe -NoProfile -ExecutionPolicy Bypass -File',
    );
  });
});

describe('Windows native acceptance source', () => {
  it('does not shadow PowerShell HOME with a case-insensitive local variable', () => {
    const acceptance = source(
      'scripts/testing/windows-platform-acceptance.ps1',
    );

    expect(acceptance).not.toMatch(/^\s*\$home\s*=/im);
    expect(acceptance).toContain(
      "$consueloHome = Join-Path $testProfile '.consuelo'",
    );
    expect(acceptance).toContain('--home $consueloHome');
  });

  it('preserves the intended readiness error when the health response stays null', () => {
    const acceptance = source(
      'scripts/testing/windows-platform-acceptance.ps1',
    );

    expect(acceptance).toContain(
      "if (-not $health -or $health.name -ne 'consuelo-os')",
    );
  });
});

describe('Windows browser-first device authorization', () => {
  it('opens the verification URL and copies fallback text with native Windows tools', () => {
    const installer = source('scripts/install.ts');

    expect(installer).toContain("process.platform === 'win32'");
    expect(installer).toContain("'rundll32.exe'");
    expect(installer).toContain("'url.dll,FileProtocolHandler'");
    expect(installer).not.toContain('Start-Process -FilePath $args[0]');
    expect(installer).toContain("'clip.exe'");
    expect(installer).toContain('Full URL: ${sanitizedVerificationUrl}');
  });
});
