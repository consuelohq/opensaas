import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const devicePage = readFileSync(
  new URL(
    '../../consuelo-website/src/pages/login/device.astro',
    import.meta.url,
  ),
  'utf8',
);
const installer = readFileSync(
  new URL('../scripts/install.ts', import.meta.url),
  'utf8',
);

describe('device login page static-hosting contract', () => {
  it('renders the user code from the browser URL instead of Astro build-time params', () => {
    expect(devicePage).toContain('data-device-code');
    expect(devicePage).toContain('window.location.search');
    expect(devicePage).toContain('URLSearchParams');
    expect(devicePage).toContain("get('user_code')");
    expect(devicePage).not.toContain("Astro.url.searchParams.get('user_code')");
    expect(devicePage).not.toContain("{formattedCode || 'Waiting for code'}");
  });

  it('starts Google-backed approval directly through Consuelo OS Device Authority', () => {
    expect(devicePage).toContain('Authorize this device');
    expect(devicePage).toContain('Approve with Google');
    expect(devicePage).toContain('https://os.consuelohq.com/login/google/start');
    expect(devicePage).toContain('user_code=');
    expect(devicePage).toContain('encodeURIComponent(normalizedUserCode)');
    expect(devicePage).not.toContain('/auth/google');
    expect(devicePage).not.toContain('action=os-device-approval');
    expect(devicePage).not.toContain('osDeviceUserCode');
    expect(devicePage).not.toContain(
      'approval will become active once the hosted approval endpoint is deployed',
    );
  });

  it('installer only opens browser after the live device endpoint starts a session', () => {
    expect(installer).toContain("if (liveDeviceCode.status !== 'started')");
    expect(installer).toContain("return { status: 'fallback' };");
    expect(installer).not.toContain('startWorkspaceDeviceAuthorization');
  });

  it('sanitizes device approval URLs before printing terminal output', () => {
    expect(installer).toContain(
      'const sanitizedVerificationUrl = sanitizeTerminalOutput(',
    );
    expect(installer).toContain('input.verificationUrl,');
    expect(installer).toContain(
      'copyDeviceVerificationUrl(sanitizedVerificationUrl)',
    );
    expect(installer).toContain('Full URL: ${sanitizedVerificationUrl}');
    expect(installer).toContain(
      'authorize Consuelo OS in your browser: ${sanitizedVerificationUrl}',
    );
  });

  it('prints a valid Bun doctor command after install', () => {
    expect(installer).toContain('bun run --cwd ${result.home} doctor');
    expect(installer).not.toContain('bun --cwd ${result.home} run doctor');
  });
});
