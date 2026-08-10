import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

const packageRoot = path.join(import.meta.dirname, '..');
const fsScript = path.join(packageRoot, 'scripts', 'fs.js');
const readModule = path.join(packageRoot, 'scripts', 'lib', 'fs', 'read.ts');
const oldReadModule = path.join(packageRoot, 'scripts', 'lib', 'fs', 'read.js');

function fixtureRoot(): string {
  return mkdtempSync(path.join(tmpdir(), 'consuelo-workspace-fs-read-'));
}

function runRead(cwd: string, args: string[]) {
  const proc = spawnSync('bun', [fsScript, 'read', ...args, '--json'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    status: proc.status ?? 0,
    stdout: proc.stdout,
    stderr: proc.stderr,
    json: proc.stdout.trim() ? JSON.parse(proc.stdout) : null,
  };
}

describe('workspace fs.read bounded ingestion', () => {
  it('should return a structured text page for a small UTF-8 file', () => {
    const root = fixtureRoot();
    try {
      writeFileSync(path.join(root, 'small.txt'), 'one\ntwo\nthree\n');
      const result = runRead(root, ['small.txt']);

      expect(result.status).toBe(0);
      expect(result.json).toMatchObject({
        type: 'text-page',
        path: 'small.txt',
        mime: 'text/plain',
        encoding: 'utf8',
        offset: 1,
        truncated: false,
        content: 'one\ntwo\nthree',
      });
      expect(result.json.next).toBeUndefined();
      expect(result.stdout).not.toMatch(/\x1b\[/);
      expect(result.stdout).not.toContain('────');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should return only the requested page with next for large text files', () => {
    const root = fixtureRoot();
    try {
      writeFileSync(path.join(root, 'large.txt'), Array.from({ length: 300 }, (_, index) => `line-${index + 1}`).join('\n'));
      const result = runRead(root, ['large.txt', '--offset', '101', '--limit', '25']);

      expect(result.status).toBe(0);
      expect(result.json).toMatchObject({
        type: 'text-page',
        path: 'large.txt',
        offset: 101,
        limit: 25,
        truncated: true,
        next: 126,
      });
      expect(result.json.content.split('\n')).toHaveLength(25);
      expect(result.json.content).toContain('line-101');
      expect(result.json.content).toContain('line-125');
      expect(result.json.content).not.toContain('line-1\n');
      expect(result.json.content).not.toContain('line-300');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should reject malformed files-json with a helpful error', () => {
    const root = fixtureRoot();
    try {
      const proc = spawnSync('bun', [fsScript, 'read', '--files-json', '{bad', '--json'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
      });

      expect(proc.status).toBe(1);
      expect(proc.stdout.trim()).toBe('');
      expect(proc.stderr).toContain('--files-json must be valid JSON');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should return a typed error for inverted line ranges', () => {
    const root = fixtureRoot();
    try {
      writeFileSync(path.join(root, 'range.txt'), 'one\ntwo\nthree\n');
      const result = runRead(root, ['range.txt', '--offset', '3', '--to', '2']);

      expect(result.status).toBe(0);
      expect(result.json).toMatchObject({
        type: 'error',
        code: 'INVALID_RANGE',
        path: 'range.txt',
      });
      expect(result.json.message).toContain('--to');
      expect(result.json.message).toContain('3');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should return a typed out-of-range error', () => {
    const root = fixtureRoot();
    try {
      writeFileSync(path.join(root, 'short.txt'), 'one\ntwo\n');
      const result = runRead(root, ['short.txt', '--offset', '10', '--limit', '5']);

      expect(result.status).toBe(0);
      expect(result.json).toMatchObject({
        type: 'error',
        code: 'OFFSET_OUT_OF_RANGE',
        path: 'short.txt',
      });
      expect(result.json.message).toContain('10');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should cap requested limits at the hard maximum', () => {
    const root = fixtureRoot();
    try {
      writeFileSync(path.join(root, 'many.txt'), Array.from({ length: 2105 }, (_, index) => `line-${index + 1}`).join('\n'));
      const result = runRead(root, ['many.txt', '--limit', '5000']);

      expect(result.status).toBe(0);
      expect(result.json.type).toBe('text-page');
      expect(result.json.limit).toBe(2000);
      expect(result.json.content.split('\n')).toHaveLength(2000);
      expect(result.json.truncated).toBe(true);
      expect(result.json.next).toBe(2001);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should truncate long lines with a visible suffix', () => {
    const root = fixtureRoot();
    try {
      writeFileSync(path.join(root, 'long-line.txt'), `${'x'.repeat(5000)}\n`);
      const result = runRead(root, ['long-line.txt']);

      expect(result.status).toBe(0);
      expect(result.json.type).toBe('text-page');
      expect(result.json.content.length).toBeLessThan(2300);
      expect(result.json.content).toContain('line truncated to 2000 chars');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should not dump binary, PDF, or invalid UTF-8 files as text', () => {
    const root = fixtureRoot();
    try {
      writeFileSync(path.join(root, 'binary.bin'), Buffer.from([0, 1, 2, 3]));
      writeFileSync(path.join(root, 'fake.pdf'), '%PDF-1.7\n%test\n');
      writeFileSync(path.join(root, 'bad-utf8.txt'), Buffer.from([0xc3, 0x28]));

      expect(runRead(root, ['binary.bin']).json).toMatchObject({ type: 'binary', path: 'binary.bin' });
      expect(runRead(root, ['fake.pdf']).json).toMatchObject({ type: 'binary', path: 'fake.pdf' });
      const invalid = runRead(root, ['bad-utf8.txt']).json;
      expect(['binary', 'error']).toContain(invalid.type);
      expect(JSON.stringify(invalid)).not.toContain('�');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should detect supported image media and enforce the media limit', () => {
    const root = fixtureRoot();
    try {
      writeFileSync(path.join(root, 'tiny.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]));
      const media = runRead(root, ['tiny.png']).json;
      expect(media).toMatchObject({
        type: 'media',
        path: 'tiny.png',
        mime: 'image/png',
        encoding: 'base64',
        sizeBytes: 11,
      });
      expect(typeof media.content).toBe('string');
      expect(media.content.length).toBeGreaterThan(0);

      writeFileSync(path.join(root, 'huge.png'), Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(20 * 1024 * 1024 + 1),
      ]));
      expect(runRead(root, ['huge.png']).json).toMatchObject({
        type: 'error',
        code: 'MEDIA_TOO_LARGE',
        path: 'huge.png',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should return typed errors for directories and path escapes', () => {
    const tempRoot = fixtureRoot();
    const root = path.join(tempRoot, 'repo');
    const outside = path.join(tempRoot, 'outside.txt');
    try {
      mkdirSync(root);
      mkdirSync(path.join(root, 'dir'));
      writeFileSync(outside, 'outside');
      symlinkSync(outside, path.join(root, 'escape-link.txt'));

      expect(runRead(root, ['dir']).json).toMatchObject({
        type: 'error',
        code: 'DIRECTORY_NOT_READABLE',
        path: 'dir',
      });
      expect(runRead(root, ['../outside.txt']).json).toMatchObject({
        type: 'error',
        code: 'PATH_OUTSIDE_ROOT',
      });
      expect(runRead(root, ['escape-link.txt']).json).toMatchObject({
        type: 'error',
        code: 'PATH_OUTSIDE_ROOT',
        path: 'escape-link.txt',
      });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('should isolate partial failures in multi-file reads', () => {
    const root = fixtureRoot();
    try {
      writeFileSync(path.join(root, 'a.txt'), 'alpha\n');
      const result = runRead(root, ['a.txt', 'missing.txt']);

      expect(result.status).toBe(0);
      expect(result.json.results).toHaveLength(2);
      expect(result.json.results[0]).toMatchObject({
        path: 'a.txt',
        ok: true,
        page: { type: 'text-page', content: 'alpha' },
      });
      expect(result.json.results[1]).toMatchObject({
        path: 'missing.txt',
        ok: false,
        error: { type: 'error', code: 'NOT_FOUND' },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should use Effect in the dedicated workspace read implementation and remove the old JS implementation', () => {
    expect(existsSync(oldReadModule)).toBe(false);
    expect(existsSync(readModule)).toBe(true);
    const source = readFileSync(readModule, 'utf8');
    expect(source).toMatch(/from ['\"]effect['\"]/);
    expect(source).toContain('Effect.gen');

    const generatorBodies = source.match(/Effect\.gen\(function\* \(\) \{[\s\S]*?\n\}\)/g) ?? [];
    expect(generatorBodies.length).toBeGreaterThan(0);
    for (const body of generatorBodies) {
      expect(body).not.toMatch(/\btry\s*\{/);
      expect(body).not.toMatch(/\bcatch\s*\(/);
      expect(body).not.toMatch(/\bawait\b/);
    }
  });
});
