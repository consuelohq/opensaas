const DEFAULT_PROVIDER = 'openrouter';
const DEFAULT_MODEL_LABEL = 'Qwen3-Embedding-4B';
const DEFAULT_API_MODEL = 'qwen/qwen3-embedding-4b';
const DEFAULT_DIMENSIONS = 1024;
const DEFAULT_INSTRUCTION_VERSION = 'workspace-code-retrieval-v1';

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
  const dimensions = parseDimensions(overrides.dimensions ?? process.env.WORKSPACE_EMBEDDING_DIMENSIONS);
  const provider = overrides.provider || process.env.WORKSPACE_EMBEDDING_PROVIDER || DEFAULT_PROVIDER;
  const model = overrides.model || process.env.WORKSPACE_EMBEDDING_MODEL || DEFAULT_MODEL_LABEL;
  const apiModel = overrides.apiModel || process.env.WORKSPACE_EMBEDDING_API_MODEL || DEFAULT_API_MODEL;
  const instructionVersion = overrides.instructionVersion
    || process.env.WORKSPACE_EMBEDDING_INSTRUCTION_VERSION
    || DEFAULT_INSTRUCTION_VERSION;
  const truncate = overrides.truncate ?? process.env.WORKSPACE_EMBEDDING_TRUNCATE;
  const allowTruncate = truncate === undefined
    ? dimensions === DEFAULT_DIMENSIONS
    : truncate !== '0' && truncate !== 'false';

  return {
    allowTruncate,
    apiModel,
    dimensions,
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
  return config.provider === DEFAULT_PROVIDER
    && config.model === DEFAULT_MODEL_LABEL
    && config.apiModel === DEFAULT_API_MODEL
    && config.dimensions === DEFAULT_DIMENSIONS
    && config.instructionVersion === DEFAULT_INSTRUCTION_VERSION;
}

module.exports = {
  DEFAULT_API_MODEL,
  DEFAULT_DIMENSIONS,
  DEFAULT_INSTRUCTION_VERSION,
  DEFAULT_MODEL_LABEL,
  DEFAULT_PROVIDER,
  getEmbeddingConfig,
  getEmbeddingConfigId,
  isLegacyDefaultEmbeddingConfig,
};
