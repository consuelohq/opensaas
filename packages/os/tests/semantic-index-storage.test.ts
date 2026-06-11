import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const storeSource = () => readFileSync(join(process.cwd(), 'scripts/lib/index/store.js'), 'utf8');

describe('OS semantic index storage wiring', () => {
  it('does not keep the workspace-index cache as the OS default', () => {
    const source = storeSource();

    expect(source).not.toContain("'.cache', 'workspace-index'");
    expect(source).not.toContain("path.join(cacheRoot, 'index.db')");
    expect(source).toContain("SEMANTIC_INDEX_DB_NAME = 'semantic-index.db'");
    expect(source).toContain("return path.join(getConsueloHome(), 'cache', 'semantic-index', getRepoHash(repoRoot, remoteUrl))");
    expect(source).toContain('function getSemanticIndexDbPath');
  });

  it('keeps default semantic index sidecars repo-scoped', () => {
    const source = storeSource();

    expect(source).toContain('function getRepoIdentifier(repoRoot, remoteUrl)');
    expect(source).toContain('function getRepoHash(repoRoot, remoteUrl)');
    expect(source).toContain("sha256(getRepoIdentifier(repoRoot, remoteUrl)).slice(0, 24)");
    expect(source).toContain("'semantic-index', getRepoHash(repoRoot, remoteUrl)");
    expect(source).toContain('getSemanticIndexAssetName(repoRoot, remoteUrl)');
  });

  it('registers one semantic index asset per repo in consuelo.db runtime assets', () => {
    const source = storeSource();

    expect(source).toContain("const registryDbPath = path.join(consueloHome, 'consuelo.db')");
    expect(source).toContain('CREATE TABLE IF NOT EXISTS runtime_assets');
    expect(source).toContain("SEMANTIC_INDEX_REGISTRY_PREFIX = 'semantic_index'");
    expect(source).toContain('return `${SEMANTIC_INDEX_REGISTRY_PREFIX}:${getRepoHash(repoRoot, remoteUrl)}`');
    expect(source).toContain('repoHash: getRepoHash(repoRoot, remoteUrl)');
    expect(source).toContain('repoIdentifier: getRepoIdentifier(repoRoot, remoteUrl)');
    expect(source).toContain("'sqlite'");
    expect(source).toContain('rebuildable');
  });

  it('keeps an explicit semantic index db override available', () => {
    const source = storeSource();

    expect(source).toContain('CONSUELO_SEMANTIC_INDEX_DB');
    expect(source).toContain('function getSemanticIndexOverride');
    expect(source).toContain('return path.dirname(explicitPath)');
    expect(source).toContain('return getSemanticIndexOverride() || path.join(getCacheRoot(repoRoot, remoteUrl), SEMANTIC_INDEX_DB_NAME)');
  });
});
