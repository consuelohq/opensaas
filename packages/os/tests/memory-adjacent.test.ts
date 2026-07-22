import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const packageRoot = join(import.meta.dirname, '..');
const repoRoot = join(packageRoot, '..', '..');
const researchScript = join(packageRoot, 'scripts', 'research-ingest.js');
const tmpScript = join(packageRoot, 'scripts', 'tmp.js');
const memoryScript = join(packageRoot, 'scripts', 'memory.js');

let fixtureRoot: string;
let processTmp: string;
let consueloHome: string;

beforeEach(() => {
  fixtureRoot = mkdtempSync(join(tmpdir(), 'consuelo-os-memory-adjacent-'));
  processTmp = join(fixtureRoot, 'tmp');
  consueloHome = join(fixtureRoot, 'consuelo-home');
  mkdirSync(processTmp, { recursive: true });
});

afterEach(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

function cleanEnv(): NodeJS.ProcessEnv {
  const {
    SUPABASE_URL: _supabaseUrl,
    SUPABASE_KEY: _supabaseKey,
    SUPABASE_ANON_KEY: _supabaseAnonKey,
    ...rest
  } = process.env;
  return {
    ...rest,
    TMPDIR: processTmp,
    CONSUELO_HOME: consueloHome,
  };
}

function run(script: string, args: string[]) {
  return spawnSync('bun', [script, ...args], {
    cwd: packageRoot,
    encoding: 'utf8',
    env: cleanEnv(),
  });
}

describe('memory-adjacent OS workflows', () => {
  it('routes root compatibility scripts to the current OS runtimes', () => {
    const rootPackage = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(rootPackage.scripts.memory).toBe('bun packages/os/scripts/memory.js');
    expect(rootPackage.scripts['research:ingest']).toBe('bun packages/os/scripts/research-ingest.js');
    expect(rootPackage.scripts['stream:cleanup']).toBe('bun packages/workspace/scripts/stream-cleanup.js');
    expect(rootPackage.scripts['stream:create']).toBe('bun packages/os/scripts/stream-create.js');

    const memoryHelp = spawnSync('bun', ['run', 'memory', '--', '--help'], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: cleanEnv(),
    });
    expect(memoryHelp.status, memoryHelp.stderr).toBe(0);
    expect(memoryHelp.stdout).toContain('local Consuelo runtime database');

    const research = spawnSync('bun', [
      'run',
      'research:ingest',
      '--',
      'https://example.com/paper',
      '--dry-run',
      '--json',
      '--memory-title',
      'Root memory route',
      '--no-memory-save',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: cleanEnv(),
    });
    expect(research.status, research.stderr).toBe(0);
    expect(JSON.parse(research.stdout).memorySave).toMatchObject({
      enabled: false,
      title: 'Root memory route',
    });
  });

  it('uses memory naming throughout research ingest planning', () => {
    const result = run(researchScript, [
      'https://example.com/paper',
      '--dry-run',
      '--json',
      '--memory-title',
      'Research Bundle: Memory contract',
      '--memory-category',
      'teach',
      '--no-memory-save',
    ]);

    expect(result.status, result.stderr).toBe(0);
    const plan = JSON.parse(result.stdout);
    expect(plan.memorySave).toMatchObject({
      enabled: false,
      title: 'Research Bundle: Memory contract',
      category: 'teach',
    });
    expect(plan.memorySave.bundlePath).toEndWith('memory-bundle.md');
    expect(plan).not.toHaveProperty('contextSave');

    const retired = run(researchScript, [
      'https://example.com/paper',
      '--dry-run',
      '--context-title',
      'retired',
    ]);
    expect(retired.status).not.toBe(0);
    expect(retired.stderr).toContain('unknown flag: --context-title');
  });

  it('routes tmp save through the local memory runtime', () => {
    const written = run(tmpScript, ['write', 'handoff', 'tags: tmp, handoff\nMemory from tmp save.']);
    expect(written.status, written.stderr).toBe(0);

    const saved = run(tmpScript, ['save', 'handoff', 'Tmp memory handoff']);
    expect(saved.status, saved.stderr).toBe(0);
    expect(saved.stderr).not.toContain('SUPABASE');

    const found = run(memoryScript, ['find', 'Tmp memory handoff', '--category', 'handoff', '--json']);
    expect(found.status, found.stderr).toBe(0);
    expect(JSON.parse(found.stdout)).toEqual([
      expect.objectContaining({
        title: 'Tmp memory handoff',
        category: 'handoff',
        content: expect.stringContaining('Memory from tmp save.'),
      }),
    ]);
  });
});
