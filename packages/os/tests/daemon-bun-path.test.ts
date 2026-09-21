import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const sourceScript = new URL(
  '../scripts/start-consuelo-daemon.sh',
  import.meta.url,
).pathname;
const temporaryDirectories: string[] = [];

function runDaemonWrapper(workspacePath: string): string {
  const root = mkdtempSync(path.join(tmpdir(), 'consuelo-daemon-bun-path-'));
  temporaryDirectories.push(root);
  const scriptsDirectory = path.join(root, 'scripts');
  const bunDirectory = path.join(root, '.bun', 'bin');
  mkdirSync(scriptsDirectory, { recursive: true });
  mkdirSync(bunDirectory, { recursive: true });

  const daemonScript = path.join(scriptsDirectory, 'start-consuelo-daemon.sh');
  const bunBinary = path.join(bunDirectory, 'bun');
  copyFileSync(sourceScript, daemonScript);
  writeFileSync(bunBinary, '#!/bin/sh\nprintf "%s\n" "$PATH"\n', 'utf8');
  chmodSync(daemonScript, 0o755);
  chmodSync(bunBinary, 0o755);

  const result = spawnSync('/bin/bash', [daemonScript], {
    env: {
      ...process.env,
      HOME: root,
      USER: 'consuelo-test',
      BUN_BIN: bunBinary,
      WORKSPACE_DAEMON_HOME: root,
      WORKSPACE_DAEMON_USER: 'consuelo-test',
      WORKSPACE_DAEMON_CONSUELO_HOME: path.join(root, '.consuelo'),
      WORKSPACE_DAEMON_PATH: workspacePath.replaceAll(
        '{BUN_DIR}',
        bunDirectory,
      ),
    },
    encoding: 'utf8',
  });

  expect(result.status).toBe(0);
  return result.stdout.trim();
}

async function runManagedSitesRefreshScenario(
  refreshExitCode: number,
  options: { hangRefresh?: boolean; timeoutSeconds?: number } = {},
): {
  status: number | null;
  stderr: string;
  calls: string[];
  home: string;
  durationMs: number;
} {
  const root = mkdtempSync(path.join(tmpdir(), 'consuelo-daemon-sites-refresh-'));
  temporaryDirectories.push(root);
  const scriptsDirectory = path.join(root, 'scripts');
  const bunDirectory = path.join(root, '.bun', 'bin');
  const consueloHome = path.join(root, '.consuelo');
  const callLog = path.join(root, 'bun-calls.log');
  mkdirSync(scriptsDirectory, { recursive: true });
  mkdirSync(bunDirectory, { recursive: true });

  const daemonScript = path.join(scriptsDirectory, 'start-consuelo-daemon.sh');
  const bunBinary = path.join(bunDirectory, 'bun');
  copyFileSync(sourceScript, daemonScript);
  writeFileSync(
    bunBinary,
    [
      '#!/bin/sh',
      'printf "%s|%s\n" "$CONSUELO_HOME" "$*" >> "$CALL_LOG"',
      'case "${1:-} ${2:-} ${3:-}" in',
      '  *"/scripts/os.ts sites refresh"*)',
      '    if [ "${HANG_REFRESH:-0}" = "1" ]; then sleep 3; fi',
      '    exit "$REFRESH_EXIT_CODE" ;;',
      'esac',
      'exit 0',
      '',
    ].join('\n'),
    'utf8',
  );
  chmodSync(daemonScript, 0o755);
  chmodSync(bunBinary, 0o755);

  const startedAt = Date.now();
  const result = spawnSync('/bin/bash', [daemonScript], {
    env: {
      ...process.env,
      HOME: root,
      USER: 'consuelo-test',
      BUN_BIN: bunBinary,
      WORKSPACE_DAEMON_HOME: root,
      WORKSPACE_DAEMON_USER: 'consuelo-test',
      WORKSPACE_DAEMON_CONSUELO_HOME: consueloHome,
      WORKSPACE_DAEMON_PATH: `${bunDirectory}:/usr/bin:/bin`,
      CALL_LOG: callLog,
      REFRESH_EXIT_CODE: String(refreshExitCode),
      HANG_REFRESH: options.hangRefresh ? '1' : '0',
      WORKSPACE_DAEMON_SITES_REFRESH_TIMEOUT_SECONDS: String(options.timeoutSeconds ?? 15),
    },
    encoding: 'utf8',
  });

  const deadline = Date.now() + 1_000;
  let calls: string[] = [];
  while (Date.now() < deadline) {
    calls = readFileSync(callLog, 'utf8').trim().split('\n').filter(Boolean);
    if (calls.some((call) => call.includes('/scripts/os.ts sites refresh --json'))) break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  return {
    status: result.status,
    stderr: result.stderr,
    calls,
    home: consueloHome,
    durationMs: Date.now() - startedAt,
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('Consuelo OS daemon Bun PATH', () => {
  it('should prepend the configured Bun directory when launchd PATH omits it', () => {
    const outputPath = runDaemonWrapper('/usr/bin:/bin');
    const segments = outputPath.split(':');

    expect(segments[0]).toContain('/.bun/bin');
    expect(segments.slice(1)).toEqual(['/usr/bin', '/bin']);
  });

  it('should preserve a single configured Bun directory when launchd PATH already contains it', () => {
    const outputPath = runDaemonWrapper('{BUN_DIR}:/usr/bin:/bin');
    const bunSegments = outputPath
      .split(':')
      .filter((segment) => segment.endsWith('/.bun/bin'));

    expect(bunSegments).toHaveLength(1);
    expect(outputPath.split(':').slice(-2)).toEqual(['/usr/bin', '/bin']);
  });

  it('should start the supervisor without making managed Sites refresh a readiness prerequisite', async () => {
    const result = await runManagedSitesRefreshScenario(17);

    expect(result.status).toBe(0);
    expect(result.calls).toHaveLength(2);
    expect(result.calls.some((call) => call.includes(`${result.home}|`) && call.includes('/scripts/os.ts sites refresh --json'))).toBe(true);
    expect(result.calls.some((call) => call.includes('/scripts/server/supervisor.ts'))).toBe(true);
  });

  it('should continue to supervisor when managed Sites refresh exceeds the startup timeout', async () => {
    const result = await runManagedSitesRefreshScenario(0, {
      hangRefresh: true,
      timeoutSeconds: 1,
    });

    expect(result.status).toBe(0);
    expect(result.durationMs).toBeLessThan(2_500);
    expect(result.calls.some((call) => call.includes('/scripts/os.ts sites refresh --json'))).toBe(true);
    expect(result.calls.some((call) => call.includes('/scripts/server/supervisor.ts'))).toBe(true);
  });

});
