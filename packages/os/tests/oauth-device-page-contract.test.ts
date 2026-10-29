import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const publicPackages = ['consuelo-website', 'dialer-website'];
const installer = readFileSync(
  new URL('../scripts/install.ts', import.meta.url),
  'utf8',
);

describe('device login page static-hosting contract', () => {
  it('preserves both legacy device URLs as canonical authority redirects', () => {
    for (const packageName of publicPackages) {
      const redirects = readFileSync(new URL(`../../${packageName}/public/_redirects`, import.meta.url), 'utf8');
      for (const path of ['/login/device', '/login/device/']) {
        expect(redirects).toContain(`${path} https://os.consuelohq.com/login/device 302`);
      }
    }
  });

  it('keeps authentication UI out of both static marketing packages', () => {
    for (const packageName of publicPackages) {
      expect(existsSync(new URL(`../../${packageName}/src/pages/login/device.astro`, import.meta.url))).toBe(false);
    }
  });

  it('installer only opens browser after the live device endpoint starts a session', () => {
    expect(installer).toContain("if (liveDeviceCode.status !== 'started')");
    expect(installer).toContain('throw new DeviceAuthorizationError(');
    expect(installer).not.toContain("return { status: 'fallback' };");
    expect(installer).not.toContain('startWorkspaceDeviceAuthorization');
  });

  it('sanitizes device approval URLs and only exposes the fallback URL when browser opening fails', () => {
    expect(installer).toContain(
      'const sanitizedVerificationUrl = sanitizeTerminalOutput(',
    );
    expect(installer).toContain('input.verificationUrl,');
    expect(installer).toContain(
      'if (!input.browserOpened)',
    );
    expect(installer).toContain(
      'copyDeviceVerificationUrl(sanitizedVerificationUrl)',
    );
    expect(installer).not.toContain('Full URL: ${sanitizedVerificationUrl}');
  });

  it('prints a valid Bun doctor command after install', () => {
    expect(installer).toContain('bun run --cwd ${result.home} doctor');
    expect(installer).not.toContain('bun --cwd ${result.home} run doctor');
  });
});
