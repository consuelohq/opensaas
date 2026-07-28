import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { classifyRuntimeBundlePath } from '../scripts/lib/distribution/runtime-bundle';

const packageRoot = resolve(import.meta.dirname, '..');

describe('deployment provider clean cutover', () => {
  it('exposes only the canonical deployment surface from the OS package', () => {
    const packageJson = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts).not.toHaveProperty('railway:logs');
    expect(packageJson.scripts).not.toHaveProperty('railway:redeploy');
  });

  it('keeps repository compatibility wrappers out of customer runtime bundles', () => {
    expect(classifyRuntimeBundlePath('scripts/railway-logs.js')).toBe('source-only');
    expect(classifyRuntimeBundlePath('scripts/railway-redeploy.js')).toBe('source-only');
  });

  it('removes the hidden Railway runtime shortcut from confirm', () => {
    const help = spawnSync('bun', [resolve(packageRoot, 'scripts/confirm.js'), '--help'], {
      encoding: 'utf8',
    });
    expect(help.status).toBe(0);
    expect(help.stdout).not.toContain('--runtime');
    expect(help.stdout).not.toContain('railway:logs');

    const retired = spawnSync('bun', [resolve(packageRoot, 'scripts/confirm.js'), '--runtime'], {
      encoding: 'utf8',
    });
    expect(retired.status).not.toBe(0);
    expect(`${retired.stdout}\n${retired.stderr}`).toContain('unknown argument: --runtime');
  });
});
