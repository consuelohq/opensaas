import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const devicePage = readFileSync(
  new URL('../../consuelo-website/src/pages/login/device.astro', import.meta.url),
  'utf8',
);
const installer = readFileSync(new URL('../scripts/install.ts', import.meta.url), 'utf8');

describe('device login page static-hosting contract', () => {
  it('renders the user code from the browser URL instead of Astro build-time params', () => {
    expect(devicePage).toContain('data-device-code');
    expect(devicePage).toContain('window.location.search');
    expect(devicePage).toContain('URLSearchParams');
    expect(devicePage).toContain("get('user_code')");
    expect(devicePage).not.toContain("Astro.url.searchParams.get('user_code')");
    expect(devicePage).not.toContain("{formattedCode || 'Waiting for code'}");
  });

  it('does not tell users approval is enabled before backend approval exists', () => {
    expect(devicePage).not.toContain('Approval is not enabled on this public page yet');
    expect(devicePage).toContain('Return to your terminal to continue setup.');
  });

  it('installer only opens browser after the live device endpoint starts a session', () => {
    expect(installer).toContain("if (liveDeviceCode.status !== 'started')");
    expect(installer).toContain("return { status: 'fallback' };");
    expect(installer).not.toContain('startWorkspaceDeviceAuthorization');
  });
});
