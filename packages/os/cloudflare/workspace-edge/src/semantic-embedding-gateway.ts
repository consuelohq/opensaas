import { createHash } from 'node:crypto';

export const SEMANTIC_EMBEDDING_GATEWAY_HOST = 'gateway.consuelohq.com';
export const SEMANTIC_EMBEDDING_GATEWAY_PATH = '/v1/os/semantic-embeddings';
export const SEMANTIC_EMBEDDING_OPENROUTER_URL = 'https://openrouter.ai/api/v1/embeddings';
export const SEMANTIC_EMBEDDING_MODEL = 'qwen/qwen3-embedding-4b';
export const SEMANTIC_EMBEDDING_DIMENSIONS = 2560;
export const SEMANTIC_EMBEDDING_MAX_BATCH_SIZE = 32;
export const SEMANTIC_EMBEDDING_MAX_TEXT_CHARS = 4_000;
export const SEMANTIC_EMBEDDING_MAX_TOTAL_CHARS = 128_000;
export const SEMANTIC_EMBEDDING_PROVIDER_TIMEOUT_MS = 30_000;

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
  providerTimeoutMs?: number;
  createProviderSignal?: (timeoutMs: number) => AbortSignal;
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

const ERROR_MESSAGES: Record<string, string> = {
  embedding_provider_timeout: 'The embedding provider did not respond before the request deadline.',
  embedding_provider_unavailable: 'The embedding provider is unavailable.',
  embedding_gateway_internal_error: 'The embedding gateway could not complete request validation.',
  embedding_rate_limit_unavailable: 'Embedding rate limiting is unavailable.',
  embedding_rate_limited: 'The embedding request rate limit was exceeded.',
  embedding_request_too_large: 'The embedding request exceeds the allowed input size.',
  embedding_upstream_failed: 'The embedding provider request failed.',
  install_identity_mismatch: 'The embedding install identity headers and body do not match.',
  invalid_content_type: 'Content-Type must be application/json.',
  invalid_embedding_batch: 'The embedding request batch is invalid.',
  invalid_embedding_item: 'An embedding request item is invalid.',
  invalid_embedding_request: 'The embedding request shape is invalid.',
  invalid_embedding_upstream_response: 'The embedding provider returned an invalid response.',
  invalid_install_identity: 'The embedding install identity is invalid.',
  invalid_json: 'The request body is not valid JSON.',
  invalid_repo_hash: 'The repository hash is invalid.',
  method_not_allowed: 'Only POST is allowed for this route.',
  mixed_embedding_kinds: 'All items in one embedding request must use the same kind.',
  not_found: 'The requested gateway route does not exist.',
  repo_hash_mismatch: 'The repository hash headers and body do not match.',
  unsupported_embedding_contract: 'The embedding request contract is unsupported.',
  unsupported_embedding_model: 'The requested embedding model is unsupported.',
};

function errorResponse(
  status: number,
  code: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return jsonResponse(status, {
    error: {
      code,
      message: ERROR_MESSAGES[code] || 'The embedding gateway request failed.',
    },
  }, extraHeaders);
}

function badRequest(code: string): Response {
  return errorResponse(400, code);
}

function serviceUnavailable(code: string): Response {
  return errorResponse(503, code);
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
  ip: string;
}): Promise<Response | null> {
  const installLimiter = input.env.OS_SEMANTIC_EMBEDDING_RATE_LIMITER;
  const ipLimiter = input.env.OS_SEMANTIC_EMBEDDING_IP_RATE_LIMITER;
  if (!installLimiter || !ipLimiter) {
    return serviceUnavailable('embedding_rate_limit_unavailable');
  }

  try {
    // installId is intentionally not an authorization or spend-control key: it is caller-minted
    // pseudonymous telemetry and can be rotated. Cloudflare-observed client identity owns spend limits.
    const installResult = await installLimiter.limit({ key: `client-ip:${input.ip}` });
    if (!installResult.success) {
      return errorResponse(429, 'embedding_rate_limited', { 'retry-after': '60' });
    }
    const ipResult = await ipLimiter.limit({ key: `ip:${input.ip}` });
    if (!ipResult.success) {
      return errorResponse(429, 'embedding_rate_limited', { 'retry-after': '60' });
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
    return errorResponse(404, 'not_found');
  }
  if (input.request.method !== 'POST') {
    return errorResponse(405, 'method_not_allowed', { allow: 'POST' });
  }

  let validated: Extract<ValidationResult, { ok: true }>;
  try {
    const validationResult = await validateRequest(input.request);
    if (!validationResult.ok) return validationResult.response;
    validated = validationResult;

    const rateLimitResponse = await rateLimitRequest({
      env: input.env,
      ip: validated.ip,
    });
    if (rateLimitResponse) return rateLimitResponse;
  } catch {
    return errorResponse(500, 'embedding_gateway_internal_error');
  }

  const apiKey = input.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return serviceUnavailable('embedding_provider_unavailable');
  const fetchUpstream = input.options?.fetchUpstream ?? globalThis.fetch;
  const providerTimeoutMs = Number.isFinite(input.options?.providerTimeoutMs)
    && Number(input.options?.providerTimeoutMs) > 0
    ? Number(input.options?.providerTimeoutMs)
    : SEMANTIC_EMBEDDING_PROVIDER_TIMEOUT_MS;
  const providerSignal = input.options?.createProviderSignal?.(providerTimeoutMs)
    ?? AbortSignal.timeout(providerTimeoutMs);

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
      signal: providerSignal,
    }));
  } catch {
    if (providerSignal.aborted) return serviceUnavailable('embedding_provider_timeout');
    return errorResponse(502, 'embedding_upstream_failed');
  }

  if (!upstream.ok) {
    return errorResponse(502, 'embedding_upstream_failed');
  }

  let upstreamBody: unknown;
  try {
    upstreamBody = await upstream.json();
  } catch {
    return errorResponse(502, 'invalid_embedding_upstream_response');
  }
  const vectors = validateUpstreamEmbeddings(upstreamBody, validated.payload.items.length);
  if (!vectors) return errorResponse(502, 'invalid_embedding_upstream_response');

  return jsonResponse(200, {
    data: vectors.map((embedding, index) => ({ index, embedding })),
  });
}
