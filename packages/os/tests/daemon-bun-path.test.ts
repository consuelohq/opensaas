import { chmodSync, copyFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const sourceScript = new URL('../scripts/start-consuelo-daemon.sh', import.meta.url).pathname;
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

  const result = Bun.spawnSync({
    cmd: ['/bin/bash', daemonScript],
    env: {
      HOME: root,
      USER: 'consuelo-test',
      BUN_BIN: bunBinary,
      WORKSPACE_DAEMON_HOME: root,
      WORKSPACE_DAEMON_USER: 'consuelo-test',
      WORKSPACE_DAEMON_CONSUELO_HOME: path.join(root, '.consuelo'),
      WORKSPACE_DAEMON_PATH: workspacePath.replaceAll('{BUN_DIR}', bunDirectory),
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  expect(result.exitCode).toBe(0);
  return new TextDecoder().decode(result.stdout).trim();
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
    const bunSegments = outputPath.split(':').filter((segment) => segment.endsWith('/.bun/bin'));

    expect(bunSegments).toHaveLength(1);
    expect(outputPath.split(':').slice(-2)).toEqual(['/usr/bin', '/bin']);
  });
});
