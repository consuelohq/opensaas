import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { createWorkspaceEdgeHandler } from '../cloudflare/workspace-edge/src/index';
import {
  createInMemoryWorkspaceRouteD1,
  migrateWorkspaceRouteD1,
} from '../scripts/lib/workspace-cloudflare-d1-route-registry';
import { CLOUDFLARE_WORKER_RELEASE_CONFIGS } from '../scripts/lib/cloudflare-worker-release-readiness';

const GATEWAY_URL = 'https://gateway.consuelohq.com/v1/os/semantic-embeddings';
const OPENROUTER_EMBEDDINGS_URL = 'https://openrouter.ai/api/v1/embeddings';
const APPROVED_MODEL = 'qwen/qwen3-embedding-4b';
const DIMENSIONS = 2560;
const INSTALL_ID = 'ins_00000000-0000-4000-8000-000000000001';

function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function gatewayPayload(text = 'where is Explore retrieval implemented') {
  return {
    version: 1,
    provider: 'consuelo-gateway',
    model: APPROVED_MODEL,
    embeddingConfigId: 'qwen-qwen3-embedding-4b:2560:v1',
    dimensions: DIMENSIONS,
    instructionVersion: 'qwen3-retrieval-v1',
    installId: INSTALL_ID,
    repoHash: 'a'.repeat(64),
    items: [{
      contentHash: contentHash(text),
      kind: 'query',
      text,
    }],
  };
}

function vector(): number[] {
  return Array.from({ length: DIMENSIONS }, (_, index) => index === 0 ? 1 : 0);
}

function rateLimiter(success = true) {
  const keys: string[] = [];
  return {
    keys,
    binding: {
      limit: vi.fn(async ({ key }: { key: string }) => {
        keys.push(key);
        return { success };
      }),
    },
  };
}

async function createGateway(input: {
  installAllowed?: boolean;
  ipAllowed?: boolean;
  openRouterApiKey?: string;
} = {}) {
  const routeDb = createInMemoryWorkspaceRouteD1();
  await migrateWorkspaceRouteD1(routeDb);
  const installLimiter = rateLimiter(input.installAllowed ?? true);
  const ipLimiter = rateLimiter(input.ipAllowed ?? true);
  const upstreamRequests: Request[] = [];
  const fetchEmbeddingUpstream = vi.fn(async (request: Request) => {
    upstreamRequests.push(request.clone());
    return new Response(JSON.stringify({ data: [{ embedding: vector() }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  const handler = createWorkspaceEdgeHandler({
    WORKSPACE_ROUTE_REGISTRY: routeDb,
    CONSUELO_EDGE_SIGNING_SECRET: 'edge-secret',
    OPENROUTER_API_KEY: input.openRouterApiKey ?? 'server-only-openrouter-key',
    OS_SEMANTIC_EMBEDDING_RATE_LIMITER: installLimiter.binding,
    OS_SEMANTIC_EMBEDDING_IP_RATE_LIMITER: ipLimiter.binding,
  } as never, {
    fetchEmbeddingUpstream,
  } as never);

  return { handler, installLimiter, ipLimiter, upstreamRequests, fetchEmbeddingUpstream };
}

function request(body: unknown = gatewayPayload()): Request {
  return new Request(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': '203.0.113.7',
      'x-consuelo-install-id': INSTALL_ID,
      'x-consuelo-embedding-model': APPROVED_MODEL,
    },
    body: JSON.stringify(body),
  });
}

describe('Consuelo hosted Explore embedding gateway', () => {
  it('requires the provider secret and both Cloudflare rate-limit bindings at deploy time', () => {
    const wrangler = readFileSync(
      new URL('../cloudflare/workspace-edge/wrangler.toml', import.meta.url),
      'utf8',
    );

    expect(CLOUDFLARE_WORKER_RELEASE_CONFIGS['workspace-edge'].requiredSecrets).toContain('OPENROUTER_API_KEY');
    expect(wrangler).toContain('name = "OS_SEMANTIC_EMBEDDING_RATE_LIMITER"');
    expect(wrangler).toContain('name = "OS_SEMANTIC_EMBEDDING_IP_RATE_LIMITER"');
    expect(wrangler).toMatch(/limit\s*=\s*600/);
    expect(wrangler).toMatch(/limit\s*=\s*1200/);
    expect(wrangler).toMatch(/period\s*=\s*60/);
  });

  it('handles the global gateway hostname before workspace hostname lookup', async () => {
    const gateway = await createGateway();

    const response = await gateway.handler(request());
    const body = await response.json() as { data?: Array<{ embedding?: number[] }> };

    expect(response.status).toBe(200);
    expect(body.data?.[0]?.embedding).toHaveLength(DIMENSIONS);
    expect(gateway.upstreamRequests).toHaveLength(1);
    expect(gateway.upstreamRequests[0]?.url).toBe(OPENROUTER_EMBEDDINGS_URL);
    expect(gateway.installLimiter.keys).toEqual([`install:${INSTALL_ID}`]);
    expect(gateway.ipLimiter.keys).toEqual(['ip:203.0.113.7']);
  });

  it('keeps the shared OpenRouter key server-side and forces the approved embedding request', async () => {
    const gateway = await createGateway({ openRouterApiKey: 'never-return-this-key' });

    const response = await gateway.handler(request());
    const responseText = await response.text();
    const upstream = gateway.upstreamRequests[0]!;
    const upstreamBody = await upstream.json() as Record<string, unknown>;

    expect(upstream.headers.get('authorization')).toBe('Bearer never-return-this-key');
    expect(upstream.url).toBe(OPENROUTER_EMBEDDINGS_URL);
    expect(upstreamBody).toMatchObject({
      model: APPROVED_MODEL,
      dimensions: DIMENSIONS,
      input: ['where is Explore retrieval implemented'],
    });
    expect(responseText).not.toContain('never-return-this-key');
  });

  it('rejects arbitrary models and never forwards them upstream', async () => {
    const gateway = await createGateway();
    const payload = { ...gatewayPayload(), model: 'openai/gpt-5' };

    const response = await gateway.handler(request(payload));

    expect(response.status).toBe(400);
    expect(gateway.fetchEmbeddingUpstream).not.toHaveBeenCalled();
  });

  it('does not expose any other OpenRouter-compatible route on the gateway hostname', async () => {
    const gateway = await createGateway();

    const response = await gateway.handler(new Request('https://gateway.consuelohq.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'openai/gpt-5', messages: [] }),
    }));

    expect(response.status).toBe(404);
    expect(gateway.fetchEmbeddingUpstream).not.toHaveBeenCalled();
  });

  it('requires POST for the one public embedding route', async () => {
    const gateway = await createGateway();
    const response = await gateway.handler(new Request(GATEWAY_URL, { method: 'GET' }));

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    expect(gateway.fetchEmbeddingUpstream).not.toHaveBeenCalled();
  });

  it('rate-limits by pseudonymous install identity before spending provider money', async () => {
    const gateway = await createGateway({ installAllowed: false });

    const response = await gateway.handler(request());

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(gateway.fetchEmbeddingUpstream).not.toHaveBeenCalled();
  });
});
