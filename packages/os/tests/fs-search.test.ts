import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

const packageRoot = path.join(import.meta.dirname, '..');
const fsScript = path.join(packageRoot, 'scripts', 'fs.js');
const searchModule = path.join(packageRoot, 'scripts', 'lib', 'fs', 'search.ts');
const bunExecutable = spawnSync('which', ['bun'], { encoding: 'utf8' }).stdout.trim() || 'bun';

function fixtureRoot(): string {
  return mkdtempSync(path.join(tmpdir(), 'consuelo-os-fs-search-'));
}

function runSearch(cwd: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  const proc = spawnSync(bunExecutable, [fsScript, 'search', ...args], {
    cwd,
    encoding: 'utf8',
    env,
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    status: proc.status ?? 0,
    stdout: proc.stdout,
    stderr: proc.stderr,
    json: proc.stdout.trim().startsWith('{') ? JSON.parse(proc.stdout) : null,
  };
}

describe('OS fs.search structured ripgrep service', () => {
  it('returns structured ANSI-free JSON search results', () => {
    const root = fixtureRoot();
    try {
      writeFileSync(path.join(root, 'a.ts'), 'alpha one\nbeta\nalpha two\n');
      writeFileSync(path.join(root, 'b.ts'), 'gamma\n');

      const result = runSearch(root, ['alpha', '.', '--json']);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.json).toMatchObject({
        type: 'search-results',
        pattern: 'alpha',
        root: '.',
        truncated: false,
      });
      expect(result.json.matches).toEqual([
        { type: 'match', path: 'a.ts', line: 1, text: 'alpha one' },
        { type: 'match', path: 'a.ts', line: 3, text: 'alpha two' },
      ]);
      expect(result.stdout).not.toMatch(/\x1b\[/);
      expect(Array.isArray(result.json)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns an empty structured result for no matches', () => {
    const root = fixtureRoot();
    try {
      writeFileSync(path.join(root, 'a.ts'), 'alpha\n');
      const result = runSearch(root, ['missing', '.', '--json']);

      expect(result.status).toBe(0);
      expect(result.stdout.trim()).not.toBe('no matches');
      expect(result.json).toMatchObject({
        type: 'search-results',
        pattern: 'missing',
        matches: [],
        truncated: false,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('treats dash-leading patterns as literals', () => {
    const root = fixtureRoot();
    try {
      writeFileSync(path.join(root, 'a.ts'), '-literal-pattern\n');

      const result = runSearch(root, ['-literal-pattern', 'a.ts', '--json']);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.json).toMatchObject({
        type: 'search-results',
        pattern: '-literal-pattern',
      });
      expect(result.json.matches).toEqual([
        { type: 'match', path: 'a.ts', line: 1, text: '-literal-pattern' },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('treats dash-leading paths as targets', () => {
    const root = fixtureRoot();
    try {
      writeFileSync(path.join(root, '-target.ts'), 'needle\n');

      const result = runSearch(root, ['needle', '-target.ts', '--json']);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.json.matches).toEqual([
        { type: 'match', path: '-target.ts', line: 1, text: 'needle' },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('propagates ripgrep transport errors', () => {
    const root = fixtureRoot();
    try {
      mkdirSync(path.join(root, 'missing-bin'));
      writeFileSync(path.join(root, 'a.ts'), 'needle\n');

      const result = runSearch(root, ['needle', '.', '--json'], {
        ...process.env,
        PATH: path.join(root, 'missing-bin'),
      });

      expect(result.status).not.toBe(0);
      expect(result.json).toBeNull();
      expect(result.stderr).toContain('error: search failed: Unable to run ripgrep');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('supports include filters, file targets, and max result truncation', () => {
    const root = fixtureRoot();
    try {
      mkdirSync(path.join(root, 'src'));
      writeFileSync(path.join(root, 'src', 'a.ts'), 'needle one\nneedle two\n');
      writeFileSync(path.join(root, 'src', 'b.md'), 'needle markdown\n');

      const filtered = runSearch(root, ['needle', 'src', '--include', '*.ts', '--max-results', '1', '--json']);
      expect(filtered.status).toBe(0);
      expect(filtered.json).toMatchObject({
        type: 'search-results',
        pattern: 'needle',
        limit: 1,
        truncated: true,
      });
      expect(filtered.json.matches).toEqual([
        { type: 'match', path: path.join('src', 'a.ts'), line: 1, text: 'needle one' },
      ]);

      const fileTarget = runSearch(root, ['needle', path.join('src', 'a.ts'), '--json']);
      expect(fileTarget.status).toBe(0);
      expect(fileTarget.json.matches.map((match: { path: string }) => match.path)).toEqual([
        path.join('src', 'a.ts'),
        path.join('src', 'a.ts'),
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('composes then-read JSON with bounded fs.read pages', () => {
    const root = fixtureRoot();
    try {
      writeFileSync(path.join(root, 'a.ts'), 'zero\none alpha\ntwo\nthree alpha\nfour\n');
      const result = runSearch(root, ['alpha', 'a.ts', '--context', '1', '--then-read', '--json']);

      expect(result.status).toBe(0);
      expect(result.json.type).toBe('search-results');
      expect(result.json.matches).toHaveLength(2);
      expect(result.json.reads).toEqual([
        {
          path: 'a.ts',
          ok: true,
          ranges: [{ from: 1, to: 5 }],
          page: expect.objectContaining({
            type: 'text-page',
            path: 'a.ts',
            offset: 1,
            content: expect.stringContaining('one alpha'),
          }),
        },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('extracts search behavior into an Effect-backed module and removes stale full-file then-read slicing', () => {
    const moduleSource = readFileSync(searchModule, 'utf8');
    const fsSource = readFileSync(fsScript, 'utf8');

    expect(moduleSource).toMatch(/from ['"]effect['"]/);
    expect(moduleSource).toContain('Effect.gen');
    expect(moduleSource).toContain('runSearchForCli');
    expect(fsSource).not.toContain("readFileSync(fp, 'utf8').split('\\n')");
    expect(fsSource).not.toContain('readFileSync(fp, "utf8").split("\\n")');
  });
});
