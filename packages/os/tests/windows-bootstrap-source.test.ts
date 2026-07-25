import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const osRoot = resolve(import.meta.dirname, '..');
const source = (path: string): string =>
  readFileSync(resolve(osRoot, path), 'utf8');

describe('Windows PowerShell bootstrap source', () => {
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

  it('provides browser fallback and actionable execution-policy guidance', () => {
    const bootstrap = source('scripts/bootstrap.ps1');

    expect(bootstrap).toContain('Start-Process');
    expect(bootstrap).toContain('Set-ExecutionPolicy -Scope Process Bypass');
    expect(bootstrap).toContain(
      'powershell.exe -NoProfile -ExecutionPolicy Bypass -File',
    );
  });
});

describe('Windows browser-first device authorization', () => {
  it('opens the verification URL and copies fallback text with native Windows tools', () => {
    const installer = source('scripts/install.ts');

    expect(installer).toContain("process.platform === 'win32'");
    expect(installer).toContain("'powershell.exe'");
    expect(installer).toContain('Start-Process');
    expect(installer).toContain("'clip.exe'");
    expect(installer).toContain('Full URL: ${sanitizedVerificationUrl}');
  });
});
