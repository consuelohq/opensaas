import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  resolveMacosSupervisedSidecarSpecs,
  startMacosSupervisedSidecars,
} from '../scripts/lib/macos-supervised-sidecars';

const temporaryHomes: string[] = [];

function createFixture() {
  const home = mkdtempSync(join(tmpdir(), 'consuelo-supervised-sidecars-'));
  temporaryHomes.push(home);
  const runtimeRoot = join(home, 'runtime', 'current');
  const generated = join(home, 'node', 'security', 'generated');
  const caddy = join(home, 'bin', 'caddy');
  const cloudflared = join(home, 'bin', 'cloudflared');
  mkdirSync(join(runtimeRoot, 'scripts'), { recursive: true });
  mkdirSync(generated, { recursive: true });
  mkdirSync(join(home, 'bin'), { recursive: true });
  writeFileSync(caddy, 'fixture');
  writeFileSync(cloudflared, 'fixture');
  writeFileSync(
    join(generated, 'macos-supervised-sidecars.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      connector: {
        id: 'connector-test',
        programArguments: [
          cloudflared,
          'tunnel',
          'run',
          '--token-file',
          join(generated, 'cloudflared-tunnel.token'),
          '--url',
          'http://127.0.0.1:46320',
        ],
      },
    })}\n`,
  );
  return { home, runtimeRoot, generated, caddy, cloudflared };
}

afterEach(() => {
  for (const home of temporaryHomes.splice(0)) {
    rmSync(home, { recursive: true, force: true });
  }
});

describe('macOS supervised sidecars', () => {
  it('resolves Caddy and Cloudflared as child processes without registering vendor launch items', () => {
    const { home, runtimeRoot, caddy, cloudflared } = createFixture();

    const specs = resolveMacosSupervisedSidecarSpecs({
      consueloHome: home,
      runtimeRoot,
      environment: {
        CADDY_BIN: caddy,
        CLOUDFLARED_BIN: cloudflared,
      },
    });

    expect(specs.map((spec) => spec.id)).toEqual(['caddy', 'cloudflared']);
    expect(specs[0]?.command).toEqual([
      '/bin/bash',
      join(runtimeRoot, 'scripts', 'start-caddy-daemon.sh'),
    ]);
    expect(specs[1]?.command[0]).toBe(cloudflared);
    expect(JSON.stringify(specs)).not.toContain('launchctl');
    expect(JSON.stringify(specs)).not.toContain('LaunchAgent');
  });

  it('restarts a crashed managed sidecar and terminates remaining children on supervisor stop', async () => {
    const { home, runtimeRoot, caddy, cloudflared } = createFixture();
    const spawned: Array<{
      id: string;
      signals: NodeJS.Signals[];
      exit: (code: number) => void;
    }> = [];

    const manager = await startMacosSupervisedSidecars({
      consueloHome: home,
      runtimeRoot: () => runtimeRoot,
      environment: { CADDY_BIN: caddy, CLOUDFLARED_BIN: cloudflared },
      restartDelayMs: 0,
      spawnProcess(spec) {
        let exit!: (code: number) => void;
        const exited = new Promise<number>((resolve) => {
          exit = resolve;
        });
        const entry = { id: spec.id, signals: [] as NodeJS.Signals[], exit };
        spawned.push(entry);
        return {
          pid: 100 + spawned.length,
          exited,
          kill(signal = 'SIGTERM') {
            entry.signals.push(signal);
            exit(0);
            return true;
          },
        };
      },
    });

    expect(spawned.map((entry) => entry.id)).toEqual(['caddy', 'cloudflared']);
    spawned[1]!.exit(9);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(spawned.filter((entry) => entry.id === 'cloudflared')).toHaveLength(2);

    await manager.stop();
    expect(spawned[0]!.signals).toContain('SIGTERM');
    expect(spawned.at(-1)!.signals).toContain('SIGTERM');
  });

  it('should terminate a spawned child when PID publication fails', async () => {
    const { home, runtimeRoot, caddy, cloudflared } = createFixture();
    const runtimeDir = join(home, 'node', 'runs', 'supervised-sidecars');
    const signals: NodeJS.Signals[] = [];

    const start = startMacosSupervisedSidecars({
      consueloHome: home,
      runtimeRoot: () => runtimeRoot,
      environment: { CADDY_BIN: caddy, CLOUDFLARED_BIN: cloudflared },
      spawnProcess() {
        chmodSync(runtimeDir, 0o500);
        return {
          pid: 777,
          exited: new Promise<number>(() => undefined),
          kill(signal = 'SIGTERM') {
            signals.push(signal);
            return true;
          },
        };
      },
    });

    await expect(start).rejects.toThrow();
    chmodSync(runtimeDir, 0o700);
    expect(signals).toContain('SIGTERM');
  });

  it('should avoid a duplicate delayed restart when reconcile already replaced the sidecar', async () => {
    const { home, runtimeRoot, caddy, cloudflared } = createFixture();
    const spawned: Array<{
      id: string;
      exit: (code: number) => void;
    }> = [];

    const manager = await startMacosSupervisedSidecars({
      consueloHome: home,
      runtimeRoot: () => runtimeRoot,
      environment: { CADDY_BIN: caddy, CLOUDFLARED_BIN: cloudflared },
      restartDelayMs: 30,
      spawnProcess(spec) {
        let exit!: (code: number) => void;
        const exited = new Promise<number>((resolve) => {
          exit = resolve;
        });
        spawned.push({ id: spec.id, exit });
        return {
          pid: 200 + spawned.length,
          exited,
          kill() {
            exit(0);
            return true;
          },
        };
      },
    });

    spawned.find((entry) => entry.id === 'cloudflared')!.exit(9);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await manager.reconcile();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(spawned.filter((entry) => entry.id === 'cloudflared')).toHaveLength(2);
    await manager.stop();
  });
});
