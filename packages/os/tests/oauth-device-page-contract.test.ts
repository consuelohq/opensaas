import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const devicePage = readFileSync(
  new URL('../../consuelo-website/src/pages/login/device.astro', import.meta.url),
  'utf8',
);
const installer = readFileSync(new URL('../scripts/install.ts', import.meta.url), 'utf8');
const googleStrategy = readFileSync(
  new URL('../../twenty-server/src/engine/core-modules/auth/strategies/google.auth.strategy.ts', import.meta.url),
  'utf8',
);
const googleController = readFileSync(
  new URL('../../twenty-server/src/engine/core-modules/auth/controllers/google-auth.controller.ts', import.meta.url),
  'utf8',
);
const authService = readFileSync(
  new URL('../../twenty-server/src/engine/core-modules/auth/services/auth.service.ts', import.meta.url),
  'utf8',
);
const signInUpTypes = readFileSync(
  new URL('../../twenty-server/src/engine/core-modules/auth/types/signInUp.type.ts', import.meta.url),
  'utf8',
);
const configVariables = readFileSync(
  new URL('../../twenty-server/src/engine/core-modules/twenty-config/config-variables.ts', import.meta.url),
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

  it('starts Google-backed approval through the app/backend bridge', () => {
    expect(devicePage).toContain('Sign in to Consuelo OS');
    expect(devicePage).toContain('Continue with Google');
    expect(devicePage).toContain('/auth/google');
    expect(devicePage).toContain('action=os-device-approval');
    expect(devicePage).toContain('osDeviceUserCode');
    expect(devicePage).toContain('encodeURIComponent(normalizedUserCode)');
    expect(devicePage).not.toContain('approval will become active once the hosted approval endpoint is deployed');
  });

  it('installer only opens browser after the live device endpoint starts a session', () => {
    expect(installer).toContain("if (liveDeviceCode.status !== 'started')");
    expect(installer).toContain("return { status: 'fallback' };");
    expect(installer).not.toContain('startWorkspaceDeviceAuthorization');
  });

  it('sanitizes device approval URLs before printing terminal output', () => {
    expect(installer).toContain('sanitizeTerminalOutput(input.verificationUrl)');
    expect(installer).toContain('copyDeviceVerificationUrl(sanitizedVerificationUrl)');
    expect(installer).toContain('Full URL: ${sanitizedVerificationUrl}');
    expect(installer).toContain('authorize Consuelo OS in your browser: ${sanitizedVerificationUrl}');
  });

  it('prints a valid Bun doctor command after install', () => {
    expect(installer).toContain('bun run --cwd ${result.home} doctor');
    expect(installer).not.toContain('bun --cwd ${result.home} run doctor');
  });
});

describe('Google OS device approval bridge contract', () => {
  it('preserves the OS device approval code in Google OAuth state', () => {
    expect(signInUpTypes).toContain("| 'os-device-approval'");
    expect(googleStrategy).toContain('osDeviceUserCode: req.query.osDeviceUserCode');
    expect(googleStrategy).toContain('osDeviceUserCode?: string');
    expect(googleStrategy).toContain('osDeviceUserCode: state.osDeviceUserCode');
  });

  it('routes Google redirect approval through a signed server-to-server assertion', () => {
    expect(googleController).toContain("action === 'os-device-approval'");
    expect(googleController).toContain('approveOsDeviceWithGoogle');
    expect(authService).toContain('approveOsDeviceWithGoogle');
    expect(authService).toContain('OS_DEVICE_AUTH_ASSERTION_SECRET');
    expect(authService).toContain('OS_DEVICE_AUTH_ORIGIN');
    expect(authService).toContain('x-consuelo-account-assertion');
    expect(authService).toContain("auth_method: 'google'");
    expect(authService).toContain('/login/device/approve');
    expect(googleController).toContain('Device authorized');
    expect(googleController).toContain('data-os-device-approval-state');
    expect(googleController).toContain('Your device has been authorized. You can close this window and return to your terminal.');
    expect(configVariables).toContain('OS_DEVICE_AUTH_ASSERTION_SECRET');
    expect(configVariables).toContain('OS_DEVICE_AUTH_ORIGIN');
  });
});
