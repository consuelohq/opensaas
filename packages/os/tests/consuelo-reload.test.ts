import {
  spawnSync,
} from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const osRoot = resolve(import.meta.dirname, '..');
const reloadScript = resolve(osRoot, 'scripts/consuelo-reload.js');
const temporaryHomes: string[] = [];

function executable(path: string, source: string): void {
  writeFileSync(path, source);
  chmodSync(path, 0o755);
}

function writeCaddyPool(consueloHome: string, ports: number[]): void {
  const caddyDirectory = join(consueloHome, 'node', 'caddy');
  mkdirSync(caddyDirectory, { recursive: true });
  writeFileSync(
    join(caddyDirectory, 'Caddyfile'),
    `http://:8080 {\n  reverse_proxy ${ports.map((port) => `127.0.0.1:${port}`).join(' ')} {\n    lb_policy round_robin\n  }\n}\n`,
  );
}

function createHarness(input: {
  bootstrapExit?: number;
  kickstartMissingOnce?: boolean;
  launchdLoaded?: boolean;
} = {}) {
  const home = mkdtempSync(join(tmpdir(), 'consuelo-reload-test-'));
  temporaryHomes.push(home);
  const bin = join(home, 'bin');
  const launchAgents = join(home, 'Library', 'LaunchAgents');
  const marker = join(home, 'launchd-bootstrapped');
  const launchLog = join(home, 'launchctl.log');
  const signalLog = join(home, 'kill.log');
  const missingKickstart = join(home, 'launchd-kickstart-missing');
  const launchAgent = join(launchAgents, 'com.consuelo.system.plist');
  mkdirSync(bin, { recursive: true });
  mkdirSync(launchAgents, { recursive: true });
  writeFileSync(launchAgent, '<plist/>');

  executable(join(bin, 'launchctl'), `#!/bin/sh
printf '%s\\n' "$*" >> "${launchLog}"
case "$1" in
  print) ${input.launchdLoaded ? 'exit 0' : 'exit 113'} ;;
  bootstrap)
    ${input.bootstrapExit ? `exit ${input.bootstrapExit}` : `touch "${marker}"; exit 0`}
    ;;
  kickstart)
    ${input.kickstartMissingOnce ? `if [ ! -f "${missingKickstart}" ]; then touch "${missingKickstart}"; printf '%s\n' 'Could not find service "com.consuelo.system" in domain for user gui: 501' >&2; exit 113; fi` : ''}
    touch "${marker}"; exit 0 ;;
  bootout) exit 0 ;;
esac
exit 0
`);
  executable(join(bin, 'curl'), `#!/bin/sh
if [ -f "${marker}" ]; then
  printf '%s\\n' '{"status":"ok","name":"consuelo-os"}'
  exit 0
fi
exit 22
`);
  executable(join(bin, 'pgrep'), '#!/bin/sh\nif [ -n "$CONSUELO_RELOAD_TEST_POOL_PATH" ]; then printf "%s\\n" 900; exit 0; fi\nexit 1\n');
  executable(join(bin, 'lsof'), '#!/bin/sh\nexit 1\n');
  executable(join(bin, 'sleep'), '#!/bin/sh\nexit 0\n');
  executable(join(bin, 'kill'), `#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"${signalLog}\"\nif [ \"$1\" = \"-USR2\" ] && [ -n \"$CONSUELO_RELOAD_TEST_POOL_PATH\" ]; then\n  node -e 'const fs=require(\"fs\"); const p=process.env.CONSUELO_RELOAD_TEST_POOL_PATH; const s=JSON.parse(fs.readFileSync(p,\"utf8\")); s.generatedAt=new Date().toISOString(); s.workers=s.workers.map((w,i)=>({...w, workerInstanceId:\`replacement-\${i}\`, pid:Number(w.pid||100)+1000, state:\"ready\", restartCount:Number(w.restartCount||0)+1})); fs.writeFileSync(p,JSON.stringify(s));'\nfi\nexit 0\n`);

  return {
    home,
    marker,
    launchLog,
    signalLog,
    launchAgent,
    env: {
      ...process.env,
      HOME: home,
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      CONSUELO_RELOAD_WAIT_ATTEMPTS: '1',
    },
  };
}

afterEach(() => {
  for (const home of temporaryHomes.splice(0)) {
    rmSync(home, { recursive: true, force: true });
  }
});

describe('Consuelo OS reload lifecycle', () => {
  it('budgets rolling reload polling for every worker and the supervisor drain timeout', () => {
    const source = readFileSync(reloadScript, 'utf8');
    expect(source).toContain('before.desiredWorkers');
    expect(source).toContain('CONSUELO_OS_DRAIN_TIMEOUT_MS');
    expect(source).toContain('Math.max(60_000, drainTimeoutMs + 20_000)');
    expect(source).toContain('/ RELOAD_POLL_MS');
  });

  it('should bootstrap an installed LaunchAgent when it is currently unloaded', () => {
    const harness = createHarness();
    const result = spawnSync(process.execPath, [reloadScript, 'start'], {
      cwd: osRoot,
      env: harness.env,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(existsSync(harness.marker)).toBe(true);
    expect(result.stdout).toContain('started: healthy');
  });

  it('should report the supervised worker pool in status output', () => {
    const harness = createHarness({ launchdLoaded: true });
    writeFileSync(harness.marker, 'ready');
    const runs = join(harness.home, '.consuelo', 'node', 'runs');
    mkdirSync(runs, { recursive: true });
    writeFileSync(join(runs, 'os-worker-pool.json'), JSON.stringify({
      schemaVersion: 1,
      desiredWorkers: 2,
      basePort: 46321,
      generatedAt: '2026-08-11T00:00:00.000Z',
      workers: [
        { workerId: 'worker-0', state: 'ready', port: 46321, pid: 101, restartCount: 0 },
        { workerId: 'worker-1', state: 'ready', port: 46322, pid: 102, restartCount: 1 },
      ],
    }));
    writeCaddyPool(join(harness.home, '.consuelo'), [46321, 46322]);

    const result = spawnSync(process.execPath, [reloadScript, 'status'], {
      cwd: osRoot,
      env: { ...harness.env, CONSUELO_HOME: join(harness.home, '.consuelo') },
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('workers: 2/2 ready');
    expect(result.stdout).toContain('worker states: desired=2 ready=2 draining=0 failed=0');
    expect(result.stdout).toContain('caddy upstreams: 127.0.0.1:46321, 127.0.0.1:46322');
    expect(result.stdout).toContain('HA: ready');
    expect(result.stdout).toContain('worker-0: ready port=46321 pid=101 restarts=0');
    expect(result.stdout).toContain('worker-1: ready port=46322 pid=102 restarts=1');
  });

  it('should exit nonzero when LaunchAgent bootstrap fails', () => {
    const harness = createHarness({ bootstrapExit: 70 });
    const result = spawnSync(process.execPath, [reloadScript, 'start'], {
      cwd: osRoot,
      env: harness.env,
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('launchctl bootstrap failed');
  });

  it('should kickstart a loaded LaunchAgent without booting out its own job', () => {
    const harness = createHarness({ launchdLoaded: true });
    const result = spawnSync(process.execPath, [reloadScript, 'restart-now'], {
      cwd: osRoot,
      env: { ...harness.env, CONSUELO_OS_RELOAD_LAUNCHD: '1' },
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const launchCommands = readFileSync(harness.launchLog, 'utf8');
    expect(launchCommands).toContain('kickstart -k gui/');
    expect(launchCommands).not.toContain('bootout');
    expect(launchCommands).not.toContain('bootstrap');
    expect(result.stdout).toContain('reloaded: healthy');
  });

  it('scrubs the retired generic MCP credential and reloads the LaunchAgent definition before restart', () => {
    const harness = createHarness({ launchdLoaded: true });
    writeFileSync(
      harness.launchAgent,
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<plist version="1.0"><dict>',
        '<key>Label</key><string>com.consuelo.system</string>',
        '<key>EnvironmentVariables</key><dict>',
        '<key>HOME</key><string>/tmp</string>',
        '<key>MCP_BEARER_TOKEN</key>',
        '<string>retired-fixture-value</string>',
        '</dict></dict></plist>',
      ].join('\n'),
    );

    const result = spawnSync(process.execPath, [reloadScript, 'restart-now'], {
      cwd: osRoot,
      env: harness.env,
      encoding: 'utf8',
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(readFileSync(harness.launchAgent, 'utf8')).not.toContain('MCP_BEARER_TOKEN');
    const launchctl = readFileSync(harness.launchLog, 'utf8');
    expect(launchctl).toContain('bootout');
    expect(launchctl).toContain('bootstrap');
  });

  it('should roll a healthy supervised worker pool on reload without restarting launchd', () => {
    const harness = createHarness({ launchdLoaded: true });
    writeFileSync(harness.marker, 'ready');
    const consueloHome = join(harness.home, '.consuelo');
    const runs = join(consueloHome, 'node', 'runs');
    mkdirSync(runs, { recursive: true });
    const poolPath = join(runs, 'os-worker-pool.json');
    writeFileSync(poolPath, JSON.stringify({
      schemaVersion: 1,
      desiredWorkers: 2,
      basePort: 46321,
      supervisorPid: 900,
      supportsRuntimeCurrentRollingReload: true,
      generatedAt: '2026-08-11T00:00:00.000Z',
      workers: [
        { workerId: 'worker-0', workerInstanceId: 'old-0', state: 'ready', port: 46321, pid: 101, restartCount: 0 },
        { workerId: 'worker-1', workerInstanceId: 'old-1', state: 'ready', port: 46322, pid: 102, restartCount: 0 },
      ],
    }));
    writeCaddyPool(consueloHome, [46321, 46322]);

    const result = spawnSync(process.execPath, [reloadScript, 'reload-now'], {
      cwd: osRoot,
      env: {
        ...harness.env,
        CONSUELO_HOME: consueloHome,
        CONSUELO_RELOAD_TEST_POOL_PATH: poolPath,
      },
      encoding: 'utf8',
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(readFileSync(harness.signalLog, 'utf8')).toContain('-USR2 900');
    const launchCommands = existsSync(harness.launchLog)
      ? readFileSync(harness.launchLog, 'utf8')
      : '';
    expect(launchCommands).not.toContain('kickstart -k');
    const rolled = JSON.parse(readFileSync(poolPath, 'utf8')) as {
      workers: Array<{ workerInstanceId: string; state: string }>;
    };
    expect(rolled.workers.map((entry) => entry.workerInstanceId)).toEqual([
      'replacement-0',
      'replacement-1',
    ]);
    expect(rolled.workers.every((entry) => entry.state === 'ready')).toBe(true);
    expect(result.stdout).toContain('reloaded: healthy');
  });

  it('should refuse rolling reload when Caddy upstreams do not exactly match the ready HA pool', () => {
    const harness = createHarness({ launchdLoaded: true });
    writeFileSync(harness.marker, 'ready');
    const consueloHome = join(harness.home, '.consuelo');
    const runs = join(consueloHome, 'node', 'runs');
    mkdirSync(runs, { recursive: true });
    const poolPath = join(runs, 'os-worker-pool.json');
    writeFileSync(poolPath, JSON.stringify({
      schemaVersion: 1,
      desiredWorkers: 2,
      basePort: 46321,
      supervisorPid: 900,
      generatedAt: '2026-08-11T00:00:00.000Z',
      workers: [
        { workerId: 'worker-0', workerInstanceId: 'old-0', state: 'ready', port: 46321, pid: 101, restartCount: 0 },
        { workerId: 'worker-1', workerInstanceId: 'old-1', state: 'ready', port: 46322, pid: 102, restartCount: 0 },
      ],
    }));
    writeCaddyPool(consueloHome, [46321]);

    const result = spawnSync(process.execPath, [reloadScript, 'reload-now'], {
      cwd: osRoot,
      env: {
        ...harness.env,
        CONSUELO_HOME: consueloHome,
        CONSUELO_RELOAD_TEST_POOL_PATH: poolPath,
      },
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Caddy worker upstreams do not match the ready worker pool');
  });

  it('should recover when a loaded LaunchAgent disappears before kickstart', () => {
    const harness = createHarness({ launchdLoaded: true, kickstartMissingOnce: true });
    const result = spawnSync(process.execPath, [reloadScript, 'restart-now'], {
      cwd: osRoot,
      env: { ...harness.env, CONSUELO_OS_RELOAD_LAUNCHD: '1' },
      encoding: 'utf8',
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const launchCommands = readFileSync(harness.launchLog, 'utf8');
    expect(launchCommands.match(/kickstart -k/g)).toHaveLength(2);
    expect(launchCommands).toContain('bootstrap gui/');
    expect(result.stdout).toContain('reloaded: healthy');
  });

  it('should bootstrap an unloaded LaunchAgent before kickstarting a reload', () => {
    const harness = createHarness();
    const result = spawnSync(process.execPath, [reloadScript, 'restart-now'], {
      cwd: osRoot,
      env: { ...harness.env, CONSUELO_OS_RELOAD_LAUNCHD: '1' },
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const launchCommands = readFileSync(harness.launchLog, 'utf8');
    expect(launchCommands).toContain('print gui/');
    expect(launchCommands).toContain('bootstrap gui/');
    expect(launchCommands).toContain('kickstart -k gui/');
    expect(result.stdout).toContain('reloaded: healthy');
  });
});
