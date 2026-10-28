import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '..', '..', '..');
const docsDeployScript = join(repoRoot, 'packages/workspace/scripts/docs-deploy.js');
const webDeployScript = join(repoRoot, 'packages/workspace/scripts/web-deploy.js');

function runScript(scriptPath, args = []) {
  return spawnSync('bun', [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

describe('deploy wrapper CLI validation', () => {
  test('docs deploy reports invalid flags without an uncaught stack trace', () => {
    const result = runScript(docsDeployScript, ['--bogus']);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('unknown flag: --bogus');
    expect(result.stderr).not.toContain('Error: unknown flag');
    expect(result.stderr).not.toContain('at main');
  });

  test('web deploy requires a branch value before forwarding passthrough args', () => {
    const result = runScript(webDeployScript, ['docs', '--branch']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--branch requires a value');
    expect(result.stderr).not.toContain('TypeError');
    expect(result.stderr).not.toContain('web deploy: docs');
  });

  test('web deploy subprocesses have an explicit timeout guard', () => {
    const source = readFileSync(webDeployScript, 'utf8');

    expect(source).toMatch(/spawnSync\('bun',[\s\S]*timeout:\s*300000/);
  });
});
