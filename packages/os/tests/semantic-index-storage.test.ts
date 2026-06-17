import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

type StoreModule = {
  getCacheRoot: (repoRoot: string, remoteUrl?: string | null) => string;
  getRepoHash: (repoRoot: string, remoteUrl?: string | null) => string;
  getRepoIdentifier: (repoRoot: string, remoteUrl?: string | null) => string;
  getSemanticIndexAssetName: (repoRoot: string, remoteUrl?: string | null) => string;
  getSemanticIndexDbPath: (repoRoot: string, remoteUrl?: string | null) => string;
  registerSemanticIndex: (dbPath: string, cacheRoot: string, repoRoot: string, remoteUrl?: string | null) => void;
};

type FakeRun = { sql: string; args: unknown[] };

let tempHome: string;
let lastDatabase: { runs: FakeRun[] } | null = null;

function loadStoreModule(env: Record<string, string | undefined> = {}): StoreModule {
  process.env.CONSUELO_HOME = tempHome;
  delete process.env.CONSUELO_SEMANTIC_INDEX_DB;
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  const source = readFileSync(join(process.cwd(), 'scripts/lib/index/store.js'), 'utf8');
  const module = { exports: {} as StoreModule };
  lastDatabase = null;
  class FakeDatabase {
    runs: FakeRun[] = [];
    constructor() { lastDatabase = this; }
    exec() {}
    query(sql: string) {
      return { run: (...args: unknown[]) => this.runs.push({ sql, args }) };
    }
    close() {}
  }
  const sandbox = {
    Buffer,
    Date,
    Error,
    Float32Array,
    JSON,
    URL,
    module,
    process,
    require: (specifier: string) => {
      if (specifier === 'bun:sqlite') return { Database: FakeDatabase };
      if (specifier === 'sqlite-vec') return { load: () => undefined };
      if (specifier === './embedding-config') return {
        getEmbeddingConfig: () => ({ dimensions: 2560 }),
        getEmbeddingConfigId: () => 'consuelo-gateway-qwen-2560d-test',
      };
      return require(specifier);
    },
  };
  vm.runInNewContext(source, sandbox, { filename: 'store.js' });
  return module.exports;
}

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-semantic-index-'));
});

afterEach(() => {
  delete process.env.CONSUELO_HOME;
  delete process.env.CONSUELO_SEMANTIC_INDEX_DB;
  rmSync(tempHome, { recursive: true, force: true });
});

describe('OS semantic index storage wiring', () => {
  it('stores default semantic index sidecars under consuelo home and scopes them per repo', () => {
    const store = loadStoreModule();
    const repoA = '/tmp/repo-a';
    const repoB = '/tmp/repo-b';
    const pathA = store.getSemanticIndexDbPath(repoA, null);
    const pathB = store.getSemanticIndexDbPath(repoB, null);

    expect(pathA).toBe(join(tempHome, 'cache', 'semantic-index', store.getRepoHash(repoA, null), 'semantic-index.db'));
    expect(pathB).toBe(join(tempHome, 'cache', 'semantic-index', store.getRepoHash(repoB, null), 'semantic-index.db'));
    expect(pathA).not.toBe(pathB);
    expect(pathA).not.toContain('workspace-index');
  });

  it('keeps an explicit semantic index db override available', () => {
    const override = join(tempHome, 'custom', 'semantic.db');
    const store = loadStoreModule({ CONSUELO_SEMANTIC_INDEX_DB: override });

    expect(store.getSemanticIndexDbPath('/tmp/repo', null)).toBe(override);
    expect(store.getCacheRoot('/tmp/repo', null)).toBe(dirname(override));
  });

  it('uses repo-scoped runtime asset names', () => {
    const store = loadStoreModule();
    const repoRoot = '/tmp/repo';
    const remoteUrl = 'https://github.com/consuelohq/opensaas.git';

    expect(store.getSemanticIndexAssetName(repoRoot, remoteUrl)).toBe(`semantic_index:${store.getRepoHash(repoRoot, remoteUrl)}`);
  });

  it('registers semantic index assets without persisting raw remote credentials', () => {
    const store = loadStoreModule();
    const repoRoot = '/tmp/private-repo';
    const remoteUrl = 'https://token:secret@github.com/consuelohq/private.git';
    const dbPath = store.getSemanticIndexDbPath(repoRoot, remoteUrl);
    const cacheRoot = dirname(dbPath);

    store.registerSemanticIndex(dbPath, cacheRoot, repoRoot, remoteUrl);

    const run = lastDatabase?.runs[0];
    expect(run).toBeDefined();
    expect(run?.args[0]).toBe(store.getSemanticIndexAssetName(repoRoot, remoteUrl));
    expect(run?.args[1]).toBe('semantic_index');
    expect(run?.args[2]).toBe('sqlite');
    expect(run?.args[3]).toBe(dbPath);
    const metadata = JSON.parse(String(run?.args[7] ?? '{}')) as Record<string, unknown>;
    expect(metadata.repoHash).toBe(store.getRepoHash(repoRoot, remoteUrl));
    expect(metadata.repoIdentifier).toBe(store.getRepoIdentifier(repoRoot, remoteUrl));
    expect(metadata.remoteUrl).toBeUndefined();
    expect(JSON.stringify(metadata)).not.toContain('token:secret');
  });
});
