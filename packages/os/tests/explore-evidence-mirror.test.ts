import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const evidenceModulePath = fileURLToPath(new URL('../scripts/lib/state/evidence-log.js', import.meta.url));
const storeModulePath = fileURLToPath(new URL('../scripts/lib/index/store.js', import.meta.url));
const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function temporaryRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function makeRepo(): { repoRoot: string; home: string } {
  const root = temporaryRoot('consuelo-explore-mirror-');
  const repoRoot = join(root, 'repo');
  const home = join(root, 'home');
  execFileSync('git', ['init', '-q', repoRoot]);
  return { repoRoot, home };
}

function registerEnvironment(root: string) {
  return {
    ...process.env,
    CONSUELO_HOME: join(root, 'home'),
    STORE_MODULE: storeModulePath,
    DB_PATH: join(root, 'cache', 'semantic-index.db'),
    CACHE_ROOT: join(root, 'cache'),
    REPO_ROOT: join(root, 'repo'),
    REMOTE_URL: 'https://example.test/opensaas.git',
  };
}

const registerCode = [
  'const { registerSemanticIndex } = require(process.env.STORE_MODULE);',
  'registerSemanticIndex(process.env.DB_PATH, process.env.CACHE_ROOT, process.env.REPO_ROOT, process.env.REMOTE_URL);',
].join('\n');

function waitForOutput(child: ChildProcessWithoutNullStreams, expected: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let output = '';
    let settled = false;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      output += chunk;
      if (!settled && output.includes(expected)) {
        settled = true;
        resolve();
      }
    });
    child.once('exit', (code) => {
      if (!settled) {
        settled = true;
        reject(new Error(`child exited ${code ?? 'unknown'} before emitting ${expected}`));
      }
    });
    child.once('error', (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
  });
}

function waitForExit(child: ChildProcessWithoutNullStreams): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => resolve({ code, stderr }));
  });
}

describe('Explore evidence mirroring', () => {
  it('reuses the caller-owned semantic index store for a required evidence mirror', () => {
    const { repoRoot, home } = makeRepo();
    const probeCode = [
      'const { appendEvidenceEvent } = require(process.env.EVIDENCE_MODULE);',
      'let inserts = 0;',
      'let closes = 0;',
      'let inserted = null;',
      "const store = { dbPath: '/existing/semantic-index.db', insertEvidenceEvent(event) { inserts += 1; inserted = event; }, db: { close() { closes += 1; } } };",
      "const result = appendEvidenceEvent(process.env.REPO_ROOT, { id: 'explore-result-test', occurred_at: '2026-09-22T22:00:00.000Z', type: 'explore.result', source: 'explore', status: 'found', details: { result_count: 1 } }, { requireMirror: true, store });",
      'process.stdout.write(JSON.stringify({ inserts, closes, inserted, result }));',
    ].join('\n');
    const output = execFileSync('bun', ['-e', probeCode], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        CONSUELO_HOME: home,
        EVIDENCE_MODULE: evidenceModulePath,
        REPO_ROOT: repoRoot,
      },
    });
    const probe = JSON.parse(output);

    expect(probe.inserts).toBe(1);
    expect(probe.inserted).toMatchObject({ id: 'explore-result-test', type: 'explore.result' });
    expect(probe.result.mirroredTo).toBe('/existing/semantic-index.db');
    expect(probe.result.mirrorError).toBeNull();
    expect(probe.closes).toBe(0);
  });

  it('routes required Explore evidence through the store already returned by ensureIndex', () => {
    for (const relativePath of [
      '../scripts/explore.js',
      '../../workspace/scripts/explore.js',
    ]) {
      const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
      expect(source).toMatch(/requireMirror:\s*true,\s*store:\s*indexResult\.store/);
    }
  });

  it('waits for a bounded Consuelo registry write lock instead of failing Explore store setup', async () => {
    const root = temporaryRoot('consuelo-explore-registry-lock-');
    const env = registerEnvironment(root);
    execFileSync('bun', ['-e', registerCode], { env, stdio: 'ignore' });

    const holderCode = [
      "const { Database } = require('bun:sqlite');",
      "const path = require('node:path');",
      "const db = new Database(path.join(process.env.CONSUELO_HOME, 'consuelo.db'));",
      "db.exec('BEGIN IMMEDIATE;');",
      "process.stdout.write('ready\\n');",
      "setTimeout(() => { db.exec('COMMIT;'); db.close(); }, 500);",
    ].join('\n');
    const holder = spawn('bun', ['-e', holderCode], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    const holderExit = waitForExit(holder);
    await waitForOutput(holder, 'ready');

    const contender = spawn('bun', ['-e', registerCode], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    const contenderResult = await waitForExit(contender);
    const holderResult = await holderExit;

    expect(holderResult.code, holderResult.stderr).toBe(0);
    expect(contenderResult.code, contenderResult.stderr).toBe(0);
  });
});
