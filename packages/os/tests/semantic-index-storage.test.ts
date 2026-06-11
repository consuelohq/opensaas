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
    expect(source).toContain("return path.join(getConsueloHome(), 'cache')");
    expect(source).toContain('function getSemanticIndexDbPath');
  });

  it('registers the semantic index sidecar in consuelo.db runtime assets', () => {
    const source = storeSource();

    expect(source).toContain("const registryDbPath = path.join(consueloHome, 'consuelo.db')");
    expect(source).toContain('CREATE TABLE IF NOT EXISTS runtime_assets');
    expect(source).toContain("SEMANTIC_INDEX_REGISTRY_NAME = 'semantic_index'");
    expect(source).toContain("'semantic_index'");
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
