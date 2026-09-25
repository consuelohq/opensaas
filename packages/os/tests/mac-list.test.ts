import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../scripts/mac.js');
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'consuelo-mac-list-'));
  roots.push(root);
  const accessible = join(root, 'accessible');
  const blocked = join(root, 'blocked');
  mkdirSync(accessible);
  mkdirSync(blocked);
  writeFileSync(join(accessible, 'visible.txt'), 'visible');
  return { root, accessible, blocked };
}

function runWithBlockedPath(root: string, blockedPath: string) {
  const preload = join(root, 'preload.cjs');
  writeFileSync(preload, `
const fs = require('node:fs');
const path = require('node:path');
const original = fs.readdirSync;
fs.readdirSync = function patchedReaddirSync(target, ...args) {
  if (path.resolve(String(target)) === path.resolve(process.env.CONSUELO_TEST_BLOCKED_PATH)) {
    const error = new Error('EPERM: operation not permitted, scandir ' + target);
    error.code = 'EPERM';
    throw error;
  }
  return original.call(this, target, ...args);
};
`);
  return spawnSync('node', ['-r', preload, SCRIPT, 'list', root, '--depth', '2', '--json'], {
    encoding: 'utf8',
    env: { ...process.env, CONSUELO_TEST_BLOCKED_PATH: blockedPath },
  });
}

describe('mac.list protected descendant handling', () => {
  test('returns accessible entries and explicit skipped diagnostics for a protected descendant', () => {
    const { root, accessible, blocked } = fixture();
    const result = runWithBlockedPath(root, blocked);

    expect(result.status).toBe(0);
    const envelope = JSON.parse(result.stdout);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: accessible, type: 'directory' }),
      expect.objectContaining({ path: join(accessible, 'visible.txt'), type: 'file' }),
      expect.objectContaining({ path: blocked, type: 'directory' }),
    ]));
    expect(envelope.data.skipped).toEqual([
      expect.objectContaining({ path: blocked, code: 'EPERM' }),
    ]);
  });

  test('still fails when the requested root itself is unreadable', () => {
    const { root } = fixture();
    const result = runWithBlockedPath(root, root);

    expect(result.status).toBe(1);
    const envelope = JSON.parse(result.stdout);
    expect(envelope.ok).toBe(false);
    expect(envelope.code).toBe('COMMAND_FAILED');
    expect(envelope.message).toContain('EPERM');
  });
});
