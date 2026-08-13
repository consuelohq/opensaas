import { describe, expect, it } from 'vitest';

import { reconcileWatchdogPlistSource } from '../scripts/migrations/reconcile-caddy-ha-watchdog';

describe('Caddy HA watchdog runtime migration', () => {
  it('moves an existing watchdog probe to the pooled Caddy health endpoint idempotently', () => {
    const legacy = `<plist><dict>
  <key>EnvironmentVariables</key>
  <dict>
    <key>WORKSPACE_WATCHDOG_LOCAL_PORT</key>
    <string>46321</string>
    <key>WORKSPACE_WATCHDOG_LOCAL_URL</key>
    <string>http://127.0.0.1:46321/health</string>
  </dict>
</dict></plist>`;

    const migrated = reconcileWatchdogPlistSource(legacy);

    expect(migrated).toContain('<string>46320</string>');
    expect(migrated).toContain('http://127.0.0.1:46320/health');
    expect(migrated).not.toContain('46321');
    expect(reconcileWatchdogPlistSource(migrated)).toBe(migrated);
  });
});
