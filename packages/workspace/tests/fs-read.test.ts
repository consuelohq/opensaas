import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, expect, test } from 'vitest';

const cleanupPaths: string[] = [];
const repoRoot = path.resolve(import.meta.dirname, '../../..');

function makeTempDirectory() {
  const directory = mkdtempSync(path.join(tmpdir(), 'workspace-fs-read-'));
  cleanupPaths.push(directory);
  return directory;
}

function runRead(cwd: string, args: string[]) {
  return spawnSync('bun', [path.join(repoRoot, 'packages/workspace/scripts/fs.js'), 'read', ...args, '--json'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

function readJson(cwd: string, args: string[]) {
  const result = runRead(cwd, args);
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout) as unknown;
}

afterEach(() => {
  while (cleanupPaths.length > 0) {
    rmSync(cleanupPaths.pop()!, { force: true, recursive: true });
  }
});

test('should return a structured text page for a small UTF-8 file', () => {
  const root = makeTempDirectory();
  writeFileSync(path.join(root, 'small.txt'), 'one\ntwo\nthree\n');

  const payload = readJson(root, ['small.txt']) as Record<string, unknown>;

  expect(payload).toMatchObject({
    type: 'text-page',
    path: 'small.txt',
    encoding: 'utf8',
    offset: 1,
    truncated: false,
    content: 'one\ntwo\nthree\n',
  });
  expect(payload.mime).toBe('text/plain');
  expect(payload).not.toHaveProperty('next');
  expect(payload).not.toHaveProperty('lines');
});

test('should page large text with offset limit truncated and next', () => {
  const root = makeTempDirectory();
  writeFileSync(path.join(root, 'large.txt'), Array.from({ length: 5000 }, (_, index) => `line-${index + 1}`).join('\n'));

  const payload = readJson(root, ['large.txt', '--offset', '20', '--limit', '5']) as Record<string, unknown>;

  expect(payload).toMatchObject({
    type: 'text-page',
    path: 'large.txt',
    encoding: 'utf8',
    offset: 20,
    limit: 5,
    truncated: true,
    next: 25,
    content: 'line-20\nline-21\nline-22\nline-23\nline-24',
  });
});

test('should keep from and to as aliases for page semantics', () => {
  const root = makeTempDirectory();
  writeFileSync(path.join(root, 'range.txt'), 'a\nb\nc\nd\n');

  const payload = readJson(root, ['range.txt', '--from', '2', '--to', '3']) as Record<string, unknown>;

  expect(payload).toMatchObject({
    type: 'text-page',
    offset: 2,
    limit: 2,
    content: 'b\nc',
    truncated: true,
    next: 4,
  });
});

test('should cap requested limits at the hard maximum', () => {
  const root = makeTempDirectory();
  writeFileSync(path.join(root, 'limit.txt'), 'one\ntwo\n');

  const payload = readJson(root, ['limit.txt', '--limit', '2500']) as Record<string, unknown>;

  expect(payload).toMatchObject({
    type: 'text-page',
    limit: 2000,
    truncated: false,
  });
});

test('should return a typed offset error when the requested page is out of range', () => {
  const root = makeTempDirectory();
  writeFileSync(path.join(root, 'short.txt'), 'one\ntwo\n');

  const payload = readJson(root, ['short.txt', '--offset', '20']) as Record<string, unknown>;

  expect(payload).toMatchObject({
    type: 'error',
    path: 'short.txt',
    error: {
      code: 'OFFSET_OUT_OF_RANGE',
    },
  });
  expect(JSON.stringify(payload)).toContain('Offset 20 is out of range');
});

test('should truncate very long lines with a visible suffix', () => {
  const root = makeTempDirectory();
  writeFileSync(path.join(root, 'long-line.txt'), `${'x'.repeat(5000)}\n`);

  const payload = readJson(root, ['long-line.txt']) as Record<string, unknown>;

  expect(payload.type).toBe('text-page');
  expect(String(payload.content)).toContain('... (line truncated to 2000 chars)');
  expect(String(payload.content).length).toBeLessThan(2100);
});

test('should detect binary pdf and invalid utf8 without dumping bytes', () => {
  const root = makeTempDirectory();
  writeFileSync(path.join(root, 'nulls.bin'), Buffer.from([0, 1, 2, 3, 4]));
  writeFileSync(path.join(root, 'fake.pdf'), '%PDF-1.7\n%test\n');
  writeFileSync(path.join(root, 'invalid.txt'), Buffer.from([0xc3, 0x28]));

  const payload = readJson(root, ['nulls.bin', 'fake.pdf', 'invalid.txt']) as { results: Array<Record<string, unknown>> };

  expect(payload.results).toHaveLength(3);
  expect(payload.results[0]).toMatchObject({ ok: true, result: { type: 'binary', path: 'nulls.bin' } });
  expect(payload.results[1]).toMatchObject({ ok: true, result: { type: 'binary', path: 'fake.pdf', mime: 'application/pdf' } });
  expect(payload.results[2]).toMatchObject({ ok: false, error: { code: 'INVALID_UTF8' } });
});

test('should detect supported image media using magic bytes', () => {
  const root = makeTempDirectory();
  writeFileSync(path.join(root, 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]));
  writeFileSync(path.join(root, 'image.jpg'), Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]));
  writeFileSync(path.join(root, 'image.gif'), Buffer.from([0x47, 0x49, 0x46, 0x38, 1, 2, 3]));
  writeFileSync(path.join(root, 'image.webp'), Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1]));

  const payload = readJson(root, ['image.png', 'image.jpg', 'image.gif', 'image.webp']) as { results: Array<{ ok: boolean; result: Record<string, unknown> }> };

  expect(payload.results.map((entry) => entry.result.mime)).toEqual(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
  for (const entry of payload.results) {
    expect(entry).toMatchObject({ ok: true, result: { type: 'media', encoding: 'base64' } });
    expect(typeof entry.result.content).toBe('string');
  }
});

test('should return typed errors for directories traversal and symlink escapes', () => {
  const root = makeTempDirectory();
  const outside = makeTempDirectory();
  mkdirSync(path.join(root, 'dir'));
  writeFileSync(path.join(outside, 'outside.txt'), 'outside\n');
  symlinkSync(path.join(outside, 'outside.txt'), path.join(root, 'escape-link.txt'));

  const payload = readJson(root, ['dir', '../outside.txt', 'escape-link.txt']) as { results: Array<Record<string, unknown>> };

  expect(payload.results[0]).toMatchObject({ ok: false, error: { code: 'DIRECTORY_NOT_READABLE' } });
  expect(payload.results[1]).toMatchObject({ ok: false, error: { code: 'PATH_OUTSIDE_ROOT' } });
  expect(payload.results[2]).toMatchObject({ ok: false, error: { code: 'PATH_OUTSIDE_ROOT' } });
});

test('should keep partial success when reading multiple files', () => {
  const root = makeTempDirectory();
  writeFileSync(path.join(root, 'exists.txt'), 'ok\n');

  const payload = readJson(root, ['exists.txt', 'missing.txt']) as { results: Array<Record<string, unknown>> };

  expect(payload.results).toHaveLength(2);
  expect(payload.results[0]).toMatchObject({ ok: true, result: { type: 'text-page', content: 'ok\n' } });
  expect(payload.results[1]).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
});


test('should keep json output free of ansi decoration', () => {
  const root = makeTempDirectory();
  writeFileSync(path.join(root, 'plain.txt'), 'clean\n');

  const result = runRead(root, ['plain.txt']);

  expect(result.status).toBe(0);
  expect(result.stdout).not.toMatch(/\x1b\[[0-9;]*m/);
  expect(result.stdout).not.toContain('────');
  expect(JSON.parse(result.stdout)).toMatchObject({ type: 'text-page' });
});
