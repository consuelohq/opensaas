const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  DEFAULT_API_MODEL,
  DEFAULT_GATEWAY_URL,
  DEFAULT_PROVIDER,
  getEmbeddingConfig,
  getEmbeddingConfigId,
} = require('./embedding-config');

const CONSUELO_GATEWAY_PROVIDER = DEFAULT_PROVIDER;
const APPROVED_EMBEDDING_MODEL = DEFAULT_API_MODEL;
const MAX_GATEWAY_BATCH_SIZE = 32;
const MAX_GATEWAY_TEXT_CHARS = 4_000;
const MAX_GATEWAY_TOTAL_CHARS = 128_000;
const GATEWAY_TIMEOUT_MS = 60_000;
const INSTALL_ID_PATTERN = /^ins_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
let cachedInstallId = null;

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeKind(kind) {
  return kind === 'query' ? 'query' : 'document';
}

function getConsueloHome() {
  const raw = process.env.CONSUELO_HOME
    || process.env.CONSUELO_OS_HOME
    || path.join(os.homedir(), '.consuelo');
  const expanded = raw === '~'
    ? os.homedir()
    : raw.startsWith('~/')
      ? path.join(os.homedir(), raw.slice(2))
      : raw;
  const resolved = path.resolve(expanded);
  if (path.basename(resolved) === 'os' && path.basename(path.dirname(resolved)) === '.consuelo') {
    return path.dirname(resolved);
  }
  return resolved;
}

function isInstallId(value) {
  return typeof value === 'string' && INSTALL_ID_PATTERN.test(value.trim().toLowerCase());
}

function readPersistedInstallId(filePath) {
  try {
    const value = fs.readFileSync(filePath, 'utf8').trim().toLowerCase();
    return isInstallId(value) ? value : null;
  } catch {
    return null;
  }
}

function persistInstallId(filePath, installId) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(directory, 0o700); } catch { /* Best effort on non-POSIX filesystems. */ }

  try {
    fs.writeFileSync(filePath, `${installId}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    try { fs.chmodSync(filePath, 0o600); } catch { /* Best effort on non-POSIX filesystems. */ }
    return installId;
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      const existing = readPersistedInstallId(filePath);
      if (existing) return existing;
      try { fs.rmSync(filePath, { force: true }); } catch { /* Retry creation below. */ }
      fs.writeFileSync(filePath, `${installId}\n`, {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600,
      });
      try { fs.chmodSync(filePath, 0o600); } catch { /* Best effort on non-POSIX filesystems. */ }
      return installId;
    }
    throw error;
  }
}

function getInstallId() {
  const inherited = process.env.CONSUELO_INSTALL_ID || process.env.CONSUELO_OS_INSTALL_ID;
  if (isInstallId(inherited)) return inherited.trim().toLowerCase();
  if (cachedInstallId) return cachedInstallId;

  const filePath = path.join(getConsueloHome(), 'node', 'identity', 'install-id');
  const existing = readPersistedInstallId(filePath);
  if (existing) {
    cachedInstallId = existing;
    return cachedInstallId;
  }

  const generated = `ins_${crypto.randomUUID().toLowerCase()}`;
  cachedInstallId = persistInstallId(filePath, generated);
  return cachedInstallId;
}

function assertGatewayBatch(texts) {
  if (!Array.isArray(texts)) {
    throw new Error('embedding gateway input must be an array of strings');
  }
  if (texts.length === 0) return;
  if (texts.length > MAX_GATEWAY_BATCH_SIZE) {
    throw new Error(`embedding gateway batch too large: ${texts.length} > ${MAX_GATEWAY_BATCH_SIZE}`);
  }

  let totalChars = 0;
  for (let index = 0; index < texts.length; index += 1) {
    const text = texts[index];
    if (typeof text !== 'string') {
      throw new Error(`embedding gateway item ${index} must be a string`);
    }
    if (text.length > MAX_GATEWAY_TEXT_CHARS) {
      throw new Error(`embedding gateway item ${index} exceeds ${MAX_GATEWAY_TEXT_CHARS} chars`);
    }
    totalChars += text.length;
  }
  if (totalChars > MAX_GATEWAY_TOTAL_CHARS) {
    throw new Error(`embedding gateway request exceeds ${MAX_GATEWAY_TOTAL_CHARS} chars`);
  }
}

function createGatewayEmbeddingPayload(texts, options = {}, metadata = {}) {
  assertGatewayBatch(texts);
  const config = metadata.config || getEmbeddingConfig();
  const kind = normalizeKind(options.kind);
  const model = config.apiModel || APPROVED_EMBEDDING_MODEL;

  return {
    version: 1,
    provider: CONSUELO_GATEWAY_PROVIDER,
    model,
    embeddingConfigId: getEmbeddingConfigId(config),
    dimensions: config.dimensions,
    instructionVersion: config.instructionVersion,
    installId: metadata.installId || getInstallId(),
    repoHash: metadata.repoHash || null,
    items: texts.map((text) => ({
      contentHash: sha256(text),
      kind,
      text,
    })),
  };
}

function createGatewayEmbeddingAudit(payload) {
  return {
    provider: payload.provider,
    model: payload.model,
    embeddingConfigId: payload.embeddingConfigId,
    installId: payload.installId,
    repoHash: payload.repoHash,
    itemCount: payload.items.length,
    totalChars: payload.items.reduce((total, item) => total + item.text.length, 0),
    contentHashes: payload.items.map((item) => item.contentHash),
  };
}

function parseEmbeddingRows(value) {
  if (!value || typeof value !== 'object') return [];
  const body = value;
  if (Array.isArray(body.data)) return body.data;
  if (Array.isArray(body.embeddings)) return body.embeddings;
  return [];
}

function toVector(row, index) {
  const vector = row?.embedding || row?.vector;
  if (!Array.isArray(vector)) {
    throw new Error(`embedding gateway returned no embedding for input ${index}`);
  }
  return new Float32Array(vector);
}

async function requestGatewayEmbeddings(texts, options = {}, runtime = {}) {
  const config = runtime.config || getEmbeddingConfig();
  const gatewayUrl = config.gatewayUrl || DEFAULT_GATEWAY_URL;
  const fetchImpl = runtime.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('embedding gateway fetch implementation is unavailable');
  }

  const payload = createGatewayEmbeddingPayload(texts, options, {
    config,
    installId: runtime.installId,
    repoHash: runtime.repoHash,
  });

  const response = await fetchImpl(gatewayUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-consuelo-embedding-model': payload.model,
      ...(payload.installId ? { 'x-consuelo-install-id': payload.installId } : {}),
      ...(payload.repoHash ? { 'x-consuelo-repo-hash': payload.repoHash } : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
  });

  if (!response.ok) {
    const details = await response.text().catch((error) => getErrorMessage(error));
    throw new Error(`embedding gateway failed (${response.status}): ${details.slice(0, 240)}`);
  }

  const body = await response.json();
  const rows = parseEmbeddingRows(body);
  if (rows.length !== texts.length) {
    throw new Error(`embedding gateway returned ${rows.length} embeddings for ${texts.length} inputs`);
  }
  return rows.map(toVector);
}

module.exports = {
  APPROVED_EMBEDDING_MODEL,
  CONSUELO_GATEWAY_PROVIDER,
  DEFAULT_GATEWAY_URL,
  MAX_GATEWAY_BATCH_SIZE,
  MAX_GATEWAY_TEXT_CHARS,
  MAX_GATEWAY_TOTAL_CHARS,
  createGatewayEmbeddingAudit,
  createGatewayEmbeddingPayload,
  getInstallId,
  requestGatewayEmbeddings,
};
