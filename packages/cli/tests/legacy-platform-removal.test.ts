import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const cliPackagePath = fileURLToPath(
  new URL('../package.json', import.meta.url),
);
const cliIndexPath = fileURLToPath(new URL('../src/index.ts', import.meta.url));
const cliPackageRoot = fileURLToPath(new URL('../', import.meta.url));

const readCliPackage = (): {
  description?: string;
  dependencies?: Record<string, string>;
} => JSON.parse(readFileSync(cliPackagePath, 'utf8'));

const runCliHelp = (): string => {
  const result = spawnSync('bun', [cliIndexPath, '--help'], {
    cwd: cliPackageRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      SENTRY_DSN: '',
    },
  });

  if (result.status !== 0) {
    throw new Error(
      `consuelo --help failed (${result.status ?? 'unknown'}): ${result.stderr}`,
    );
  }

  return result.stdout;
};

describe('Consuelo CLI legacy platform removal', () => {
  it('has no twenty-sdk package or source dependency', () => {
    const manifest = readCliPackage();
    const indexSource = readFileSync(cliIndexPath, 'utf8');

    expect(manifest.dependencies?.['twenty-sdk']).toBeUndefined();
    expect(indexSource).not.toContain('twenty-sdk/cli');
  });

  it('exposes the Consuelo command surface without Twenty workspace/platform commands', () => {
    const help = runCliHelp();

    expect(help).toContain('Consuelo command-line interface');
    expect(help).toContain('login');
    expect(help).not.toContain('--workspace');
    expect(help).not.toMatch(/\bauth:(login|logout|status|switch|list)\b/);
    expect(help).not.toMatch(/\bapp:(dev|uninstall|generate)\b/);
    expect(help).not.toMatch(/\bentity:add\b/);
    expect(help).not.toMatch(/\bfunction:(logs|execute)\b/);
  });
});
