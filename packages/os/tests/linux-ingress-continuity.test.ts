import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createLinuxPlatformAdapter,
  renderSystemdUserUnit,
  resolveLinuxPlatformPaths,
  type LinuxCommand,
} from '../scripts/lib/platforms/linux';
import { removeSafeTempDir } from './safe-temp-cleanup';

describe('Linux MCP ingress continuity', () => {
  it('keeps Cloudflared running while rolling the OS and restarting non-ingress sidecars', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-linux-ingress-continuity-'));
    const environment = { HOME: home };
    const paths = resolveLinuxPlatformPaths(home, environment);
    mkdirSync(paths.systemdUserDir, { recursive: true });
    mkdirSync(paths.runsDir, { recursive: true });
    writeFileSync(
      paths.unitPath,
      renderSystemdUserUnit({ home, bunExecutable: '/opt/consuelo/bin/bun' }),
    );
    writeFileSync(
      join(paths.runsDir, 'os-worker-pool.json'),
      `${JSON.stringify({ schemaVersion: 1, supportsRuntimeCurrentRollingReload: true })}\n`,
    );
    for (const unit of [
      'consuelo-cloudflared-connector-test.service',
      'consuelo-node-heartbeat.service',
      'consuelo-node-heartbeat.timer',
      'consuelo-watchdog.service',
    ]) {
      writeFileSync(join(paths.systemdUserDir, unit), '[Unit]\nDescription=test\n');
    }
    const commands: LinuxCommand[] = [];
    try {
      const adapter = createLinuxPlatformAdapter({
        home,
        environment,
        host: { platform: 'linux', architecture: 'x64', libc: 'glibc' },
        bunExecutable: '/opt/consuelo/bin/bun',
        run: async (command) => {
          commands.push(command);
          return { exitCode: 0, stdout: '', stderr: '' };
        },
      });

      await adapter.restart({ waitForCompletion: true });

      const rendered = JSON.stringify(commands);
      expect(rendered).not.toContain('restart","consuelo-cloudflared-connector-test.service');
      expect(rendered).toContain('reload","consuelo-os.service');
      expect(rendered).toContain('restart","consuelo-node-heartbeat.timer');
      expect(rendered).toContain('restart","consuelo-watchdog.service');
      expect(readFileSync(paths.unitPath, 'utf8')).toContain('rolling-reload-now');
    } finally {
      removeSafeTempDir(home, 'consuelo-linux-ingress-continuity-');
    }
  });

  it('restarts only the OS service once when upgrading a legacy supervisor and leaves Cloudflared alive', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-linux-ingress-legacy-'));
    const environment = { HOME: home };
    const paths = resolveLinuxPlatformPaths(home, environment);
    mkdirSync(paths.systemdUserDir, { recursive: true });
    writeFileSync(
      paths.unitPath,
      renderSystemdUserUnit({ home, bunExecutable: '/opt/consuelo/bin/bun' }),
    );
    writeFileSync(
      join(paths.systemdUserDir, 'consuelo-cloudflared-connector-test.service'),
      '[Unit]\nDescription=test\n',
    );
    const commands: LinuxCommand[] = [];
    try {
      const adapter = createLinuxPlatformAdapter({
        home,
        environment,
        host: { platform: 'linux', architecture: 'x64', libc: 'glibc' },
        bunExecutable: '/opt/consuelo/bin/bun',
        run: async (command) => {
          commands.push(command);
          return { exitCode: 0, stdout: '', stderr: '' };
        },
      });

      await adapter.restart({ waitForCompletion: true });

      const rendered = JSON.stringify(commands);
      expect(rendered).toContain('restart\",\"consuelo-os.service');
      expect(rendered).not.toContain('reload\",\"consuelo-os.service');
      expect(rendered).not.toContain('restart\",\"consuelo-cloudflared-connector-test.service');
    } finally {
      removeSafeTempDir(home, 'consuelo-linux-ingress-legacy-');
    }
  });
});
