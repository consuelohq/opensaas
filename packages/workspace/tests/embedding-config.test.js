import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  getEmbeddingConfig,
  getEmbeddingConfigId,
  isLegacyDefaultEmbeddingConfig,
} = require('../scripts/lib/index/embedding-config.js');

describe('embedding config', () => {
  it('uses 2560 dimensional 4B embeddings by default', () => {
    const config = getEmbeddingConfig({});

    expect(config.dimensions).toBe(2560);
    expect(config.model).toBe('Qwen3-Embedding-4B');
    expect(config.apiModel).toBe('qwen/qwen3-embedding-4b');
    expect(config.allowTruncate).toBe(false);
    expect(isLegacyDefaultEmbeddingConfig(config)).toBe(false);
    expect(getEmbeddingConfigId(config)).toContain('2560d');
  });

  it('keeps explicit 1024 config as the legacy fallback', () => {
    const config = getEmbeddingConfig({ dimensions: 1024 });

    expect(config.dimensions).toBe(1024);
    expect(config.allowTruncate).toBe(true);
    expect(isLegacyDefaultEmbeddingConfig(config)).toBe(true);
  });

  it('creates a distinct config id for 2560 dimensional 4B benchmarks', () => {
    const config = getEmbeddingConfig({ dimensions: 2560 });

    expect(config.dimensions).toBe(2560);
    expect(isLegacyDefaultEmbeddingConfig(config)).toBe(false);
    expect(getEmbeddingConfigId(config)).toContain('2560d');
    expect(getEmbeddingConfigId(config)).toContain('qwen-qwen3-embedding-4b');
  });

  it('rejects invalid dimensions', () => {
    expect(() => getEmbeddingConfig({ dimensions: 'nope' })).toThrow(/invalid embedding dimensions/);
  });
});
