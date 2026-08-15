import { createHash } from 'node:crypto';

export const SEMANTIC_EMBEDDING_GATEWAY_HOST = 'gateway.consuelohq.com';
export const SEMANTIC_EMBEDDING_GATEWAY_PATH = '/v1/os/semantic-embeddings';
export const SEMANTIC_EMBEDDING_OPENROUTER_URL = 'https://openrouter.ai/api/v1/embeddings';
export const SEMANTIC_EMBEDDING_MODEL = 'qwen/qwen3-embedding-4b';
export const SEMANTIC_EMBEDDING_DIMENSIONS = 2560;
export const SEMANTIC_EMBEDDING_MAX_BATCH_SIZE = 32;
export const SEMANTIC_EMBEDDING_MAX_TEXT_CHARS = 4_000;
export const SEMANTIC_EMBEDDING_MAX_TOTAL_CHARS = 128_000;

const INSTALL_ID_PATTERN = /^ins_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const REPO_HASH_PATTERN = /^[a-f0-9]{24,64}$/;
const CONTENT_HASH_PATTERN = /^[a-f0-9]{64}$/;
const TOP_LEVEL_KEYS = new Set([
  'version',
  'provider',
  'model',
  'embeddingConfigId',
  'dimensions',
  'instructionVersion',
  'installId',
  'repoHash',
  'items',
]);
const ITEM_KEYS = new Set(['contentHash', 'kind', 'text']);

type SemanticEmbeddingKind = 'query' | 'document';

type SemanticEmbeddingItem = {
  contentHash: string;
  kind: SemanticEmbeddingKind;
  text: string;
};

type SemanticEmbeddingPayload = {
  version: 1;
  provider: 'consuelo-gateway';
  model: typeof SEMANTIC_EMBEDDING_MODEL;
  embeddingConfigId: string;
  dimensions: typeof SEMANTIC_EMBEDDING_DIMENSIONS;
  instructionVersion: string;
  installId: string | null;
  repoHash: string | null;
  items: SemanticEmbeddingItem[];
};

export type SemanticEmbeddingRateLimiter = {
  limit(input: { key: string }): Promise<{ success: boolean }>;
};

export type SemanticEmbeddingGatewayEnvironment = {
  OPENROUTER_API_KEY?: string;
  OS_SEMANTIC_EMBEDDING_RATE_LIMITER?: SemanticEmbeddingRateLimiter;
  OS_SEMANTIC_EMBEDDING_IP_RATE_LIMITER?: SemanticEmbeddingRateLimiter;
};

export type SemanticEmbeddingGatewayOptions = {
  fetchUpstream?: (request: Request) => Promise<Response>;
};

type ValidationResult =
  | { ok: true; payload: SemanticEmbeddingPayload; installId: string | null; ip: string }
  | { ok: false; response: Response };

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...extraHeaders,
    },
  });
}

function badRequest(code: string): Response {
  return jsonResponse(400, { error: code });
}

function serviceUnavailable(code: string): Response {
  return jsonResponse(503, { error: code });
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function validOptionalString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function parseItem(value: unknown): SemanticEmbeddingItem | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ITEM_KEYS)) return null;
  const { contentHash, kind, text } = value;
  if (typeof text !== 'string' || text.length === 0 || text.length > SEMANTIC_EMBEDDING_MAX_TEXT_CHARS) {
    return null;
  }
  if (kind !== 'query' && kind !== 'document') return null;
  if (typeof contentHash !== 'string' || !CONTENT_HASH_PATTERN.test(contentHash)) return null;
  if (sha256(text) !== contentHash) return null;
  return { contentHash, kind, text };
}

function requestIp(request: Request): string {
  const value = request.headers.get('cf-connecting-ip')?.trim();
  return value && value.length <= 80 ? value : 'unknown';
}

async function validateRequest(request: Request): Promise<ValidationResult> {
  if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
    return { ok: false, response: badRequest('invalid_content_type') };
  }

  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return { ok: false, response: badRequest('invalid_json') };
  }
  if (!isRecord(value) || !hasOnlyKeys(value, TOP_LEVEL_KEYS)) {
    return { ok: false, response: badRequest('invalid_embedding_request') };
  }
  if (
    value.version !== 1
    || value.provider !== 'consuelo-gateway'
    || value.model !== SEMANTIC_EMBEDDING_MODEL
    || value.dimensions !== SEMANTIC_EMBEDDING_DIMENSIONS
    || !validOptionalString(value.embeddingConfigId, 200)
    || !validOptionalString(value.instructionVersion, 120)
  ) {
    return { ok: false, response: badRequest('unsupported_embedding_contract') };
  }

  const modelHeader = request.headers.get('x-consuelo-embedding-model')?.trim();
  if (modelHeader !== SEMANTIC_EMBEDDING_MODEL) {
    return { ok: false, response: badRequest('unsupported_embedding_model') };
  }

  const bodyInstallId = value.installId === null ? null : typeof value.installId === 'string' ? value.installId.trim() : '';
  const headerInstallId = request.headers.get('x-consuelo-install-id')?.trim() || null;
  if (bodyInstallId && headerInstallId && bodyInstallId !== headerInstallId) {
    return { ok: false, response: badRequest('install_identity_mismatch') };
  }
  const installId = headerInstallId || bodyInstallId || null;
  if (installId && !INSTALL_ID_PATTERN.test(installId)) {
    return { ok: false, response: badRequest('invalid_install_identity') };
  }

  const repoHash = value.repoHash === null ? null : typeof value.repoHash === 'string' ? value.repoHash.trim() : '';
  if (repoHash && !REPO_HASH_PATTERN.test(repoHash)) {
    return { ok: false, response: badRequest('invalid_repo_hash') };
  }
  const repoHashHeader = request.headers.get('x-consuelo-repo-hash')?.trim() || null;
  if (repoHashHeader && (!REPO_HASH_PATTERN.test(repoHashHeader) || repoHashHeader !== repoHash)) {
    return { ok: false, response: badRequest('repo_hash_mismatch') };
  }

  if (!Array.isArray(value.items) || value.items.length === 0 || value.items.length > SEMANTIC_EMBEDDING_MAX_BATCH_SIZE) {
    return { ok: false, response: badRequest('invalid_embedding_batch') };
  }
  const items: SemanticEmbeddingItem[] = [];
  let totalChars = 0;
  let kind: SemanticEmbeddingKind | null = null;
  for (const rawItem of value.items) {
    const item = parseItem(rawItem);
    if (!item) return { ok: false, response: badRequest('invalid_embedding_item') };
    if (kind && item.kind !== kind) {
      return { ok: false, response: badRequest('mixed_embedding_kinds') };
    }
    kind = item.kind;
    totalChars += item.text.length;
    if (totalChars > SEMANTIC_EMBEDDING_MAX_TOTAL_CHARS) {
      return { ok: false, response: badRequest('embedding_request_too_large') };
    }
    items.push(item);
  }

  return {
    ok: true,
    payload: {
      version: 1,
      provider: 'consuelo-gateway',
      model: SEMANTIC_EMBEDDING_MODEL,
      embeddingConfigId: value.embeddingConfigId as string,
      dimensions: SEMANTIC_EMBEDDING_DIMENSIONS,
      instructionVersion: value.instructionVersion as string,
      installId,
      repoHash,
      items,
    },
    installId,
    ip: requestIp(request),
  };
}

async function rateLimitRequest(input: {
  env: SemanticEmbeddingGatewayEnvironment;
  installId: string | null;
  ip: string;
}): Promise<Response | null> {
  const installLimiter = input.env.OS_SEMANTIC_EMBEDDING_RATE_LIMITER;
  const ipLimiter = input.env.OS_SEMANTIC_EMBEDDING_IP_RATE_LIMITER;
  if (!installLimiter || !ipLimiter) {
    return serviceUnavailable('embedding_rate_limit_unavailable');
  }

  try {
    const installKey = input.installId
      ? `install:${input.installId}`
      : `anonymous:${input.ip}`;
    const installResult = await installLimiter.limit({ key: installKey });
    if (!installResult.success) {
      return jsonResponse(429, { error: 'embedding_rate_limited' }, { 'retry-after': '60' });
    }
    const ipResult = await ipLimiter.limit({ key: `ip:${input.ip}` });
    if (!ipResult.success) {
      return jsonResponse(429, { error: 'embedding_rate_limited' }, { 'retry-after': '60' });
    }
    return null;
  } catch {
    return serviceUnavailable('embedding_rate_limit_unavailable');
  }
}

function validateUpstreamEmbeddings(value: unknown, expected: number): number[][] | null {
  if (!isRecord(value) || !Array.isArray(value.data) || value.data.length !== expected) return null;
  const vectors: number[][] = [];
  for (const row of value.data) {
    if (!isRecord(row) || !Array.isArray(row.embedding) || row.embedding.length !== SEMANTIC_EMBEDDING_DIMENSIONS) {
      return null;
    }
    const vector = row.embedding;
    if (!vector.every((entry) => typeof entry === 'number' && Number.isFinite(entry))) return null;
    vectors.push(vector);
  }
  return vectors;
}

export async function handleSemanticEmbeddingGatewayRequest(input: {
  request: Request;
  env: SemanticEmbeddingGatewayEnvironment;
  options?: SemanticEmbeddingGatewayOptions;
}): Promise<Response | undefined> {
  const url = new URL(input.request.url);
  if (url.hostname.toLowerCase() !== SEMANTIC_EMBEDDING_GATEWAY_HOST) return undefined;
  if (url.pathname !== SEMANTIC_EMBEDDING_GATEWAY_PATH) {
    return jsonResponse(404, { error: 'not_found' });
  }
  if (input.request.method !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' }, { allow: 'POST' });
  }

  const validated = await validateRequest(input.request);
  if (!validated.ok) return validated.response;

  const rateLimitResponse = await rateLimitRequest({
    env: input.env,
    installId: validated.installId,
    ip: validated.ip,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const apiKey = input.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return serviceUnavailable('embedding_provider_unavailable');
  const fetchUpstream = input.options?.fetchUpstream ?? globalThis.fetch;

  let upstream: Response;
  try {
    upstream = await fetchUpstream(new Request(SEMANTIC_EMBEDDING_OPENROUTER_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'http-referer': 'https://consuelohq.com',
        'x-title': 'Consuelo OS Explore',
      },
      body: JSON.stringify({
        model: SEMANTIC_EMBEDDING_MODEL,
        input: validated.payload.items.map((item) => item.text),
        dimensions: SEMANTIC_EMBEDDING_DIMENSIONS,
      }),
    }));
  } catch {
    return jsonResponse(502, { error: 'embedding_upstream_failed' });
  }

  if (!upstream.ok) {
    return jsonResponse(502, { error: 'embedding_upstream_failed' });
  }

  let upstreamBody: unknown;
  try {
    upstreamBody = await upstream.json();
  } catch {
    return jsonResponse(502, { error: 'invalid_embedding_upstream_response' });
  }
  const vectors = validateUpstreamEmbeddings(upstreamBody, validated.payload.items.length);
  if (!vectors) return jsonResponse(502, { error: 'invalid_embedding_upstream_response' });

  return jsonResponse(200, {
    data: vectors.map((embedding, index) => ({ index, embedding })),
  });
}
