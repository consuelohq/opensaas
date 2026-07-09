import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { writeFileForCli } from '../scripts/lib/fs/write';

const packageRoot = path.join(import.meta.dirname, '..');
const fsScript = path.join(packageRoot, 'scripts', 'fs.js');

function fixtureRoot(): string {
  return mkdtempSync(path.join(tmpdir(), 'consuelo-os-fs-write-'));
}

function runWrite(cwd: string, args: string[], input?: string) {
  const proc = spawnSync('bun', [fsScript, 'write', ...args], {
    cwd,
    input,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    status: proc.status ?? 0,
    stdout: proc.stdout,
    stderr: proc.stderr,
    json: proc.stdout.trim().startsWith('{') ? JSON.parse(proc.stdout) : null,
  };
}

function fsWriteTemps(root: string): string[] {
  return readdirSync(root).filter((entry) => entry.startsWith('.fs-write-'));
}

describe('OS fs.write service', () => {
  it('creates a new file with a structured result', async () => {
    const root = fixtureRoot();
    try {
      const result = await writeFileForCli({ path: 'new.txt', content: 'one\ntwo' }, { root });

      expect(result).toMatchObject({
        ok: true,
        operation: 'write',
        path: 'new.txt',
        existed: false,
        bytes: 7,
        lines: 2,
      });
      expect(readFileSync(path.join(root, 'new.txt'), 'utf8')).toBe('one\ntwo');
      expect(fsWriteTemps(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes an empty string intentionally', async () => {
    const root = fixtureRoot();
    try {
      writeFileSync(path.join(root, 'empty.txt'), 'remove me');

      const result = await writeFileForCli({ path: 'empty.txt', content: '', force: true }, { root });

      expect(result).toMatchObject({
        ok: true,
        operation: 'write',
        path: 'empty.txt',
        existed: true,
        bytes: 0,
        lines: 0,
      });
      expect(readFileSync(path.join(root, 'empty.txt'), 'utf8')).toBe('');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects overwrite without force', async () => {
    const root = fixtureRoot();
    try {
      writeFileSync(path.join(root, 'exists.txt'), 'old');

      const result = await writeFileForCli({ path: 'exists.txt', content: 'new' }, { root });

      expect(result).toMatchObject({
        ok: false,
        code: 'FILE_EXISTS',
        path: 'exists.txt',
      });
      expect(readFileSync(path.join(root, 'exists.txt'), 'utf8')).toBe('old');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('overwrites with force', async () => {
    const root = fixtureRoot();
    try {
      writeFileSync(path.join(root, 'exists.txt'), 'old');

      const result = await writeFileForCli({ path: 'exists.txt', content: 'new', force: true }, { root });

      expect(result).toMatchObject({
        ok: true,
        operation: 'write',
        existed: true,
        bytes: 3,
        lines: 1,
      });
      expect(readFileSync(path.join(root, 'exists.txt'), 'utf8')).toBe('new');
      expect(fsWriteTemps(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('appends with append mode', async () => {
    const root = fixtureRoot();
    try {
      writeFileSync(path.join(root, 'append.txt'), 'old');

      const result = await writeFileForCli({ path: 'append.txt', content: '\nnew', append: true }, { root });

      expect(result).toMatchObject({
        ok: true,
        operation: 'append',
        existed: true,
        bytes: 4,
        lines: 2,
      });
      expect(readFileSync(path.join(root, 'append.txt'), 'utf8')).toBe('old\nnew');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects conflicting force and append modes', async () => {
    const root = fixtureRoot();
    try {
      const result = await writeFileForCli({ path: 'bad.txt', content: 'x', force: true, append: true }, { root });

      expect(result).toMatchObject({
        ok: false,
        code: 'INVALID_WRITE_MODE',
        path: 'bad.txt',
      });
      expect(existsSync(path.join(root, 'bad.txt'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('creates parent directories only with mkdirs', async () => {
    const root = fixtureRoot();
    try {
      const missing = await writeFileForCli({ path: 'nested/file.txt', content: 'x' }, { root });
      expect(missing).toMatchObject({
        ok: false,
        code: 'PARENT_MISSING',
        path: 'nested/file.txt',
      });
      expect(existsSync(path.join(root, 'nested'))).toBe(false);

      const created = await writeFileForCli({ path: 'nested/file.txt', content: 'x', mkdirs: true }, { root });
      expect(created).toMatchObject({
        ok: true,
        createdParents: true,
      });
      expect(readFileSync(path.join(root, 'nested', 'file.txt'), 'utf8')).toBe('x');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects paths outside the root and symlink escapes', async () => {
    const tempRoot = fixtureRoot();
    const root = path.join(tempRoot, 'repo');
    const outside = path.join(tempRoot, 'outside');
    try {
      mkdirSync(root);
      mkdirSync(outside);
      symlinkSync(outside, path.join(root, 'escape-dir'));

      const dotDot = await writeFileForCli({ path: '../outside.txt', content: 'x' }, { root });
      expect(dotDot).toMatchObject({
        ok: false,
        code: 'PATH_OUTSIDE_ROOT',
      });

      const symlinkEscape = await writeFileForCli({ path: 'escape-dir/evil.txt', content: 'x' }, { root });
      expect(symlinkEscape).toMatchObject({
        ok: false,
        code: 'PATH_OUTSIDE_ROOT',
        path: 'escape-dir/evil.txt',
      });
      expect(existsSync(path.join(outside, 'evil.txt'))).toBe(false);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('preserves UTF-8 BOM when overwriting an existing BOM file', async () => {
    const root = fixtureRoot();
    try {
      writeFileSync(path.join(root, 'bom.txt'), Buffer.from([0xef, 0xbb, 0xbf, ...Buffer.from('old', 'utf8')]));

      const result = await writeFileForCli({ path: 'bom.txt', content: 'new', force: true }, { root });
      const bytes = readFileSync(path.join(root, 'bom.txt'));

      expect(result).toMatchObject({ ok: true, existed: true });
      expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      expect(bytes.toString('utf8')).toBe('\ufeffnew');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('OS fs.write CLI adapter', () => {
  it('prints JSON structured output when requested', () => {
    const root = fixtureRoot();
    try {
      const result = runWrite(root, ['cli.txt', '--content', 'hello', '--json']);

      expect(result.status).toBe(0);
      expect(result.json).toMatchObject({
        ok: true,
        operation: 'write',
        path: 'cli.txt',
        existed: false,
        bytes: 5,
        lines: 1,
      });
      expect(readFileSync(path.join(root, 'cli.txt'), 'utf8')).toBe('hello');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('preserves the compatibility line for human output', () => {
    const root = fixtureRoot();
    try {
      const result = runWrite(root, ['human.txt', '--content', 'hello']);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('wrote human.txt (1 lines)');
      expect(readFileSync(path.join(root, 'human.txt'), 'utf8')).toBe('hello');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps stdin compatibility for non-empty piped content', () => {
    const root = fixtureRoot();
    try {
      const result = runWrite(root, ['stdin.txt'], 'from stdin');

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('wrote stdin.txt (1 lines)');
      expect(readFileSync(path.join(root, 'stdin.txt'), 'utf8')).toBe('from stdin');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns typed errors for invalid mutation modes', () => {
    const root = fixtureRoot();
    try {
      const result = runWrite(root, ['bad.txt', '--content', 'x', '--force', '--append', '--json']);

      expect(result.status).toBe(1);
      expect(result.json).toMatchObject({
        ok: false,
        code: 'INVALID_WRITE_MODE',
        path: 'bad.txt',
      });
      expect(existsSync(path.join(root, 'bad.txt'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
