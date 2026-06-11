const DEFAULT_PROVIDER = 'consuelo-gateway';
const PROVIDER_LOCAL = 'local';
const PROVIDER_OPENROUTER = 'openrouter';
const DEFAULT_GATEWAY_URL = 'https://gateway.consuelohq.com/v1/os/semantic-embeddings';
const DEFAULT_MODEL_LABEL = 'Qwen3-Embedding-4B';
const DEFAULT_API_MODEL = 'qwen/qwen3-embedding-4b';
const LEGACY_DIMENSIONS = 1024;
const DEFAULT_DIMENSIONS = 2560;
const DEFAULT_INSTRUCTION_VERSION = 'workspace-code-retrieval-v1';

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function parseDimensions(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_DIMENSIONS;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`invalid embedding dimensions: ${value}`);
  }
  return parsed;
}

function normalizeSegment(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getEmbeddingConfig(overrides = {}) {
  const dimensions = parseDimensions(firstDefined(
    overrides.dimensions,
    process.env.CONSUELO_EMBEDDING_DIMENSIONS,
    process.env.WORKSPACE_EMBEDDING_DIMENSIONS,
  ));
  const provider = firstDefined(
    overrides.provider,
    process.env.CONSUELO_EMBEDDING_PROVIDER,
    process.env.WORKSPACE_EMBEDDING_PROVIDER,
    DEFAULT_PROVIDER,
  );
  const model = firstDefined(
    overrides.model,
    process.env.CONSUELO_EMBEDDING_MODEL,
    process.env.WORKSPACE_EMBEDDING_MODEL,
    DEFAULT_MODEL_LABEL,
  );
  const apiModel = firstDefined(
    overrides.apiModel,
    process.env.CONSUELO_EMBEDDING_API_MODEL,
    process.env.WORKSPACE_EMBEDDING_API_MODEL,
    DEFAULT_API_MODEL,
  );
  const gatewayUrl = firstDefined(
    overrides.gatewayUrl,
    process.env.CONSUELO_EMBEDDING_GATEWAY_URL,
    process.env.WORKSPACE_EMBEDDING_GATEWAY_URL,
    DEFAULT_GATEWAY_URL,
  );
  const instructionVersion = firstDefined(
    overrides.instructionVersion,
    process.env.CONSUELO_EMBEDDING_INSTRUCTION_VERSION,
    process.env.WORKSPACE_EMBEDDING_INSTRUCTION_VERSION,
    DEFAULT_INSTRUCTION_VERSION,
  );
  const truncate = firstDefined(
    overrides.truncate,
    process.env.CONSUELO_EMBEDDING_TRUNCATE,
    process.env.WORKSPACE_EMBEDDING_TRUNCATE,
  );
  const allowTruncate = truncate === undefined
    ? dimensions === LEGACY_DIMENSIONS
    : truncate !== '0' && truncate !== 'false';

  return {
    allowTruncate,
    apiModel,
    dimensions,
    gatewayUrl,
    instructionVersion,
    model,
    provider,
  };
}

function getEmbeddingConfigId(config = getEmbeddingConfig()) {
  return [
    normalizeSegment(config.provider),
    normalizeSegment(config.apiModel || config.model),
    `${config.dimensions}d`,
    normalizeSegment(config.instructionVersion),
  ].join('-');
}

function isLegacyDefaultEmbeddingConfig(config = getEmbeddingConfig()) {
  return config.provider === PROVIDER_OPENROUTER
    && config.model === DEFAULT_MODEL_LABEL
    && config.apiModel === DEFAULT_API_MODEL
    && config.dimensions === LEGACY_DIMENSIONS
    && config.instructionVersion === DEFAULT_INSTRUCTION_VERSION;
}

module.exports = {
  DEFAULT_API_MODEL,
  DEFAULT_DIMENSIONS,
  DEFAULT_GATEWAY_URL,
  DEFAULT_INSTRUCTION_VERSION,
  DEFAULT_MODEL_LABEL,
  DEFAULT_PROVIDER,
  LEGACY_DIMENSIONS,
  PROVIDER_LOCAL,
  PROVIDER_OPENROUTER,
  getEmbeddingConfig,
  getEmbeddingConfigId,
  isLegacyDefaultEmbeddingConfig,
};
