import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createInstallDiagnostics,
  isDevDiagnosticsEnabled,
  redactDiagnosticValue,
} from '../scripts/lib/install-diagnostics';

describe('development install diagnostics', () => {
  it('is disabled unless CONSUELO_OS_DEV_DIAGNOSTICS=1', () => {
    expect(isDevDiagnosticsEnabled({})).toBe(false);
    expect(isDevDiagnosticsEnabled({ CONSUELO_OS_DEV_DIAGNOSTICS: '0' })).toBe(false);
    expect(isDevDiagnosticsEnabled({ CONSUELO_OS_DEV_DIAGNOSTICS: '1' })).toBe(true);
  });

  it('redacts secrets and tokens from diagnostic values', () => {
    expect(redactDiagnosticValue('abc-cloudflared_tunnel_token_fixture-xyz')).toContain('[redacted]');
    expect(redactDiagnosticValue('https://os.consuelohq.com/login/device?user_code=ABCD1234')).toBe(
      'https://os.consuelohq.com/login/device?user_code=[redacted]',
    );
    expect(redactDiagnosticValue('/Users/kokayi/.consuelo')).toContain('/Users/[user]/');
    expect(redactDiagnosticValue('/home/kokayi/.consuelo')).toContain('/home/[user]/');
    expect(redactDiagnosticValue('cloudflared_tunnel_token=secret-token-123')).toBe('cloudflared_tunnel_token=[redacted]');
    expect(redactDiagnosticValue('cloudflare_tunnel_token=secret-token-123')).toBe('cloudflare_tunnel_token=[redacted]');
    expect(redactDiagnosticValue('https://os.consuelohq.com/setup?cloudflare_tunnel_token=secret-token-123&ok=1')).toBe(
      'https://os.consuelohq.com/setup?cloudflare_tunnel_token=[redacted]&ok=1',
    );
    expect(redactDiagnosticValue('https://os.consuelohq.com/setup?cloudflared_tunnel_token=secret-token-123')).toBe(
      'https://os.consuelohq.com/setup?cloudflared_tunnel_token=[redacted]',
    );
  });

  it('writes local JSON and JSONL reports without enabling normal telemetry', () => {
    const reportsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-install-diagnostics-'));
    const diagnostics = createInstallDiagnostics({
      env: {
        CONSUELO_OS_DEV_DIAGNOSTICS: '1',
        CONSUELO_OS_DEV_REPORTS_DIR: reportsRoot,
      },
      home: path.join(os.tmpdir(), 'consuelo-home'),
      argv: ['install.ts'],
    });

    diagnostics.recordStep('workspace', 'start');
    diagnostics.recordPromptDecision('workspace.name', 'testing-ttd');
    diagnostics.recordHttp('device.code', 200, 'started');
    diagnostics.finish({ status: 'ok' });

    expect(diagnostics.enabled).toBe(true);
    expect(fs.existsSync(path.join(diagnostics.reportDir, 'install-report.json'))).toBe(true);
    expect(fs.existsSync(path.join(diagnostics.reportDir, 'installer-events.jsonl'))).toBe(true);
    const report = JSON.parse(fs.readFileSync(path.join(diagnostics.reportDir, 'install-report.json'), 'utf8')) as Record<string, unknown>;
    expect(report).toMatchObject({ status: 'ok' });
    expect(JSON.stringify(report)).not.toContain('testing-ttd');
    expect(JSON.stringify(report)).not.toContain('cloudflared_tunnel_token');
  });
});
