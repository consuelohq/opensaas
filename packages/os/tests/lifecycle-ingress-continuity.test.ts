import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createReloadServiceController } from '../scripts/lib/lifecycle';
import { removeSafeTempDir } from './safe-temp-cleanup';

const osRoot = resolve(import.meta.dirname, '..');

describe('lifecycle ingress continuity', () => {
  it('keeps routine reload strict, rolls workers from runtime/current, and pins worker health to its release', () => {
    const reload = readFileSync(resolve(osRoot, 'scripts', 'consuelo-reload.js'), 'utf8');
    const supervisor = readFileSync(resolve(osRoot, 'scripts', 'server', 'supervisor.ts'), 'utf8');
    const health = readFileSync(resolve(osRoot, 'scripts', 'server', 'routes', 'health.ts'), 'utf8');
    const daemon = readFileSync(resolve(osRoot, 'scripts', 'start-consuelo-daemon.sh'), 'utf8');

    expect(reload).toContain("case 'rolling-reload-now':");
    expect(reload).toContain('if (!tryRollingReload())');
    expect(reload).toContain('Run repair for destructive recovery.');
    expect(supervisor).toContain('realpathSync(layout.runtimeCurrentDir)');
    expect(supervisor).toContain('CONSUELO_OS_WORKER_RELEASE_PATH: runtime.root');
    expect(supervisor).toContain('supportsRuntimeCurrentRollingReload: true');
    expect(health).toContain('process.env.CONSUELO_OS_WORKER_RELEASE_PATH');
    expect(reload).toContain('supportsRuntimeCurrentRollingReload === true');
    expect(reload).toContain('handoffLegacySupervisor');
    expect(daemon).toContain(') &');
    expect(daemon.indexOf(') &')).toBeLessThan(daemon.indexOf('exec "$bun_bin" "$root_dir/scripts/server/supervisor.ts"'));
  });

  it('keeps Caddy and Cloudflared loaded while reconciling non-ingress sidecars', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-ingress-continuity-'));
    const launchAgents = join(home, 'Library', 'LaunchAgents');
    mkdirSync(launchAgents, { recursive: true });
    const ingressLabels = [
      'com.consuelo.caddy',
      'com.consuelo.os.cloudflared.connector-test',
    ];
    const sidecarLabels = [
      'com.consuelo.availability',
      'com.consuelo.os.node-heartbeat.node-test',
      'com.consuelo.portless.system',
      'com.consuelo.watchdog',
    ];
    for (const label of [...ingressLabels, ...sidecarLabels]) {
      writeFileSync(join(launchAgents, `${label}.plist`), '<plist/>\n');
    }
    const calls: Array<{ command: string; args: string[] }> = [];
    try {
      const controller = createReloadServiceController({
        osRoot,
        platform: 'darwin',
        environment: { HOME: home },
        userId: 501,
        run: async (command, args) => {
          calls.push({ command, args });
          return { exitCode: 0, stdout: '', stderr: '' };
        },
      });

      await controller.restart({ waitForCompletion: true });

      expect(calls[0]).toEqual({
        command: 'bash',
        args: [
          resolve(osRoot, 'scripts', 'install-system-daemons.sh'),
          '--definitions-only',
          '--quiet',
        ],
      });
      expect(calls[1]).toEqual({
        command: process.execPath,
        args: [resolve(osRoot, 'scripts', 'consuelo-reload.js'), 'rolling-reload-now'],
      });
      const launchctlCalls = calls.filter((call) => call.command === 'launchctl');
      for (const label of ingressLabels) {
        expect(JSON.stringify(launchctlCalls)).not.toContain(label);
      }
      for (const label of sidecarLabels) {
        expect(JSON.stringify(launchctlCalls)).toContain(label);
      }

      calls.length = 0;
      await controller.restart({ waitForCompletion: true, allowDestructiveFallback: true });
      expect(calls[0]).toEqual({
        command: 'bash',
        args: [
          resolve(osRoot, 'scripts', 'install-system-daemons.sh'),
          '--definitions-only',
          '--quiet',
        ],
      });
      expect(calls[1]).toEqual({
        command: process.execPath,
        args: [resolve(osRoot, 'scripts', 'consuelo-reload.js'), 'rolling-reload-now'],
      });
      expect(calls.filter((call) => call.command === process.execPath)).toHaveLength(1);
      const recoveryLaunchctlCalls = calls.filter((call) => call.command === 'launchctl');
      for (const label of ingressLabels) {
        expect(JSON.stringify(recoveryLaunchctlCalls)).not.toContain(label);
      }
    } finally {
      removeSafeTempDir(home, 'consuelo-ingress-continuity-');
    }
  });
});
