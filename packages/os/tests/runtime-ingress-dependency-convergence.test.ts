import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { removeSafeTempDir } from './safe-temp-cleanup';

const osRoot = resolve(import.meta.dirname, '..');
const bootstrapPath = resolve(osRoot, 'scripts', 'bootstrap.sh');

function extractShellFunction(source: string, name: string): string {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => line === `${name}() {`);
  if (start === -1) throw new Error(`missing shell function: ${name}`);
  let depth = 0;
  const selected: string[] = [];
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    selected.push(line);
    for (const character of line) {
      if (character === '{') depth += 1;
      if (character === '}') depth -= 1;
    }
    if (index > start && depth === 0) return selected.join('\n');
  }
  throw new Error(`unterminated shell function: ${name}`);
}

function writeExecutable(path: string, source: string): void {
  writeFileSync(path, source);
  chmodSync(path, 0o755);
}

describe('runtime ingress dependency convergence', () => {
  it('rejects an outdated cloudflared executable and accepts the pinned version', () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-runtime-ingress-deps-'));
    try {
      const stale = join(home, 'cloudflared-stale');
      const pinned = join(home, 'cloudflared-pinned');
      writeExecutable(stale, '#!/bin/sh\necho "cloudflared version 2026.1.2 (built test)"\n');
      writeExecutable(pinned, '#!/bin/sh\necho "cloudflared version 2026.6.1 (built test)"\n');
      const bootstrap = readFileSync(bootstrapPath, 'utf8');
      const matcher = extractShellFunction(bootstrap, 'cloudflared_version_matches');
      const result = spawnSync('/bin/bash', ['-c', [
        'CLOUDFLARED_VERSION=2026.6.1',
        matcher,
        'cloudflared_version_matches "$STALE" && exit 41',
        'cloudflared_version_matches "$PINNED" || exit 42',
      ].join('\n')], {
        encoding: 'utf8',
        env: { ...process.env, STALE: stale, PINNED: pinned },
      });
      expect(result.status, result.stderr).toBe(0);
      const ensureCloudflared = extractShellFunction(bootstrap, 'ensure_cloudflared');
      expect(ensureCloudflared).toContain('cloudflared_version_matches "$candidate"');
      expect(ensureCloudflared).toContain('CLOUDFLARED_BIN="$managed_path"');
    } finally {
      removeSafeTempDir(home, 'consuelo-runtime-ingress-deps-');
    }
  });

  it('provides a dependency-only path that returns before onboarding and persists only ingress paths', () => {
    const bootstrap = readFileSync(bootstrapPath, 'utf8');
    expect(bootstrap).toContain('--runtime-dependencies-only) RUNTIME_DEPENDENCIES_ONLY=1');
    expect(bootstrap).toContain('if [ "$RUNTIME_DEPENDENCIES_ONLY" -eq 1 ]; then\n    reconcile_runtime_dependencies_only\n    return 0\n  fi');
    const reconcile = extractShellFunction(bootstrap, 'reconcile_runtime_dependencies_only');
    expect(reconcile).toContain('ensure_caddy');
    expect(reconcile).toContain('ensure_cloudflared');
    expect(reconcile).toContain('persist_ingress_runtime_paths');
    const persist = extractShellFunction(bootstrap, 'persist_ingress_runtime_paths');
    expect(persist).toContain('CLOUDFLARED_BIN');
    expect(persist).toContain('CADDY_BIN');
    expect(persist).not.toContain('BUN_BIN');
    expect(persist).not.toContain('PORTLESS_BIN');
  });
});
