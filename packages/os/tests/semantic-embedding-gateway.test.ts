import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);

type EmbeddingConfig = {
  apiModel: string;
  dimensions: number;
  gatewayUrl: string;
  provider: string;
};

type EmbeddingConfigModule = {
  getEmbeddingConfig: (overrides?: Record<string, unknown>) => EmbeddingConfig;
};

type GatewayPayload = {
  model: string;
  installId: string | null;
  repoHash: string | null;
  items: Array<{ contentHash: string; kind: string; text: string }>;
};

type GatewayAudit = {
  itemCount: number;
  totalChars: number;
  contentHashes: string[];
};

type GatewayModule = {
  createGatewayEmbeddingPayload: (
    texts: string[],
    options?: { kind?: string },
    metadata?: { installId?: string; repoHash?: string; config?: EmbeddingConfig },
  ) => GatewayPayload;
  createGatewayEmbeddingAudit: (payload: GatewayPayload) => GatewayAudit;
  requestGatewayEmbeddings: (
    texts: string[],
    options?: { kind?: string },
    runtime?: { config?: EmbeddingConfig; fetchImpl?: typeof fetch; installId?: string; repoHash?: string },
  ) => Promise<Float32Array[]>;
};

function loadIndexModule<TModule>(fileName: string): TModule {
  const resolved = require.resolve(`../scripts/lib/index/${fileName}`);
  delete require.cache[resolved];
  return require(resolved) as TModule;
}

function withEnv<TValue>(values: Record<string, string | undefined>, callback: () => TValue): TValue {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(values)) {
    previous.set(key, process.env[key]);
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return callback();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function makeVector(length: number): number[] {
  return Array.from({ length }, (_, index) => (index === 0 ? 1 : 0));
}

describe('OS semantic embedding gateway default', () => {
  it('defaults embedding config to the Consuelo hosted gateway', () => {
    withEnv({
      CONSUELO_EMBEDDING_GATEWAY_URL: undefined,
      CONSUELO_EMBEDDING_PROVIDER: undefined,
      WORKSPACE_EMBEDDING_PROVIDER: undefined,
    }, () => {
      const configModule = loadIndexModule<EmbeddingConfigModule>('embedding-config.js');
      const config = configModule.getEmbeddingConfig();
      expect(config.provider).toBe('consuelo-gateway');
      expect(config.apiModel).toBe('qwen/qwen3-embedding-4b');
      expect(config.gatewayUrl).toContain('consuelohq.com');
      expect(config.gatewayUrl).not.toContain('openrouter.ai');
    });
  });

  it('builds a fixed-model gateway payload and redacted audit metadata', () => {
    const gateway = loadIndexModule<GatewayModule>('embedding-gateway.js');
    const payload = gateway.createGatewayEmbeddingPayload(
      ['function run() { return true; }'],
      { kind: 'document' },
      { installId: 'install_123', repoHash: 'repo_abc' },
    );
    const audit = gateway.createGatewayEmbeddingAudit(payload);
    expect(payload.model).toBe('qwen/qwen3-embedding-4b');
    expect(payload.installId).toBe('install_123');
    expect(payload.repoHash).toBe('repo_abc');
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]?.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.items[0]?.kind).toBe('document');
    expect(JSON.stringify(audit)).not.toContain('function run');
    expect(audit).toMatchObject({ itemCount: 1, totalChars: 31 });
  });

  it('requests embeddings from the Consuelo gateway without an OpenRouter key', async () => {
    const gateway = loadIndexModule<GatewayModule>('embedding-gateway.js');
    const configModule = loadIndexModule<EmbeddingConfigModule>('embedding-config.js');
    const config = configModule.getEmbeddingConfig({ dimensions: 4 });
    let requestBody = '';
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requestBody = String(init?.body ?? '');
      return new Response(JSON.stringify({ data: [{ embedding: makeVector(4) }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const vectors = await gateway.requestGatewayEmbeddings(
      ['code chunk'],
      { kind: 'document' },
      { config, fetchImpl, installId: 'install_123', repoHash: 'repo_abc' },
    );
    const body = JSON.parse(requestBody) as GatewayPayload;
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('consuelohq.com');
    expect(body.model).toBe('qwen/qwen3-embedding-4b');
    expect(body.items[0]?.text).toBe('code chunk');
    expect(vectors[0]).toBeInstanceOf(Float32Array);
    expect(vectors[0]).toHaveLength(4);
  });

  it('keeps local embeddings as explicit opt-in mode', () => {
    withEnv({ CONSUELO_EMBEDDING_PROVIDER: 'local' }, () => {
      const configModule = loadIndexModule<EmbeddingConfigModule>('embedding-config.js');
      expect(configModule.getEmbeddingConfig().provider).toBe('local');
    });
  });

  it('wires the embedder to the hosted gateway without the private Keychain item', () => {
    const source = readFileSync(join(process.cwd(), 'scripts/lib/index/embedder.js'), 'utf8');
    expect(source).toContain('requestGatewayEmbeddings');
    expect(source).not.toContain('pi-proxy-openrouter-api-key');
  });

  it('uses embedding config dimensions for the SQLite vector table', () => {
    const source = readFileSync(join(process.cwd(), 'scripts/lib/index/store.js'), 'utf8');
    expect(source).toContain("require('./embedding-config')");
    expect(source).toContain('EMBEDDING_CONFIG.dimensions');
    expect(source).not.toContain('const VECTOR_DIMENSIONS = 1024');
  });

  it('adds a semantic embeddings doctor command surface', () => {
    const packageJson = readFileSync(join(process.cwd(), 'package.json'), 'utf8');
    const doctorSource = readFileSync(join(process.cwd(), 'scripts/semantic-embeddings.js'), 'utf8');
    expect(packageJson).toContain('semantic:embeddings');
    expect(doctorSource).toContain('provider');
    expect(doctorSource).toContain('gateway');
    expect(doctorSource).toContain('local_model_exists');
  });
});
