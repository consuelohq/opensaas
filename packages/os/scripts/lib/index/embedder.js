const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  DEFAULT_API_MODEL,
  PROVIDER_LOCAL,
  PROVIDER_OPENROUTER,
  getEmbeddingConfig,
} = require('./embedding-config');
const { requestGatewayEmbeddings } = require('./embedding-gateway');

const EMBEDDING_CONFIG = getEmbeddingConfig();
const VECTOR_DIMENSIONS = EMBEDDING_CONFIG.dimensions;

const DOCUMENT_INSTRUCTION = 'Instruct: Represent this code for retrieval\nQuery: ';
const QUERY_INSTRUCTION = 'Instruct: Find code related to this question\nQuery: ';
const OPENROUTER_EMBEDDING_API_URL = 'https://openrouter.ai/api/v1/embeddings';
const EMBEDDING_API_MODEL = DEFAULT_API_MODEL;
const MODEL_FILE_NAME = 'Qwen3-Embedding-4B-Q8_0.gguf';

const embeddingContextsByPath = new Map();
const embeddingContextsPromiseByPath = new Map();
const embeddingContextCursorByPath = new Map();

function expandHome(value) {
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return value;
}

function getConsueloHome() {
  return path.resolve(expandHome(process.env.CONSUELO_HOME || '~/.consuelo/os'));
}

function getDefaultModelPath() {
  const configured = process.env.CONSUELO_EMBEDDING_MODEL_PATH || process.env.WORKSPACE_EMBEDDING_MODEL_PATH;
  if (configured) return path.resolve(expandHome(configured));
  return path.join(getConsueloHome(), 'models', MODEL_FILE_NAME);
}

const DEFAULT_MODEL_PATH = getDefaultModelPath();

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function normalizeVector(vector) {
  let magnitude = 0;
  for (const value of vector) {
    magnitude += value * value;
  }

  const divisor = Math.sqrt(magnitude) || 1;
  const normalized = new Float32Array(vector.length);
  for (let index = 0; index < vector.length; index += 1) {
    normalized[index] = vector[index] / divisor;
  }

  return normalized;
}

function prepareVector(vector) {
  if (vector.length === VECTOR_DIMENSIONS) return normalizeVector(vector);
  if (vector.length > VECTOR_DIMENSIONS && EMBEDDING_CONFIG.allowTruncate) {
    const truncated = new Float32Array(VECTOR_DIMENSIONS);
    for (let index = 0; index < VECTOR_DIMENSIONS; index += 1) {
      truncated[index] = vector[index];
    }
    return normalizeVector(truncated);
  }
  throw new Error([
    `embedding dimension mismatch: expected ${VECTOR_DIMENSIONS}, got ${vector.length}`,
    'Set CONSUELO_EMBEDDING_DIMENSIONS to match the provider output, or explicitly enable truncation with CONSUELO_EMBEDDING_TRUNCATE=1 for a benchmark.',
  ].join(' '));
}

function getEmbeddingContextCount() {
  const parsed = Number.parseInt(process.env.CONSUELO_EMBEDDING_CONTEXTS || process.env.WORKSPACE_EMBEDDING_CONTEXTS || '2', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;

  return Math.min(parsed, 2);
}

async function createEmbeddingContexts(modelPath) {
  if (!fs.existsSync(modelPath)) {
    throw new Error(`embedding model not found: ${modelPath}`);
  }

  const { getLlama } = await import('node-llama-cpp');
  const llama = await getLlama();
  const gpuLayers = process.env.CONSUELO_EMBEDDING_GPU_LAYERS || process.env.WORKSPACE_EMBEDDING_GPU_LAYERS;
  let model;
  model = await llama.loadModel({
    modelPath,
    gpuLayers: gpuLayers || 'max',
    defaultContextFlashAttention: true,
  }).catch((error) => {
    if (gpuLayers) {
      throw error;
    }

    return llama.loadModel({
      modelPath,
      gpuLayers: 'auto',
      defaultContextFlashAttention: true,
    });
  });

  const contexts = [];
  const contextCount = getEmbeddingContextCount();
  for (let index = 0; index < contextCount; index += 1) {
    contexts.push(await model.createEmbeddingContext({
      batchSize: 4096,
      contextSize: { min: 4096, max: 8192 },
      threads: 0,
    }));
  }

  return contexts;
}

async function getEmbeddingContext(modelPath = DEFAULT_MODEL_PATH) {
  const resolvedModelPath = modelPath || DEFAULT_MODEL_PATH;
  const existingContexts = embeddingContextsByPath.get(resolvedModelPath);
  if (existingContexts) {
    const cursor = embeddingContextCursorByPath.get(resolvedModelPath) || 0;
    const context = existingContexts[cursor % existingContexts.length];
    embeddingContextCursorByPath.set(resolvedModelPath, cursor + 1);
    return context;
  }

  if (!fs.existsSync(resolvedModelPath)) {
    throw new Error(`embedding model not found: ${resolvedModelPath}`);
  }

  if (!embeddingContextsPromiseByPath.has(resolvedModelPath)) {
    embeddingContextsPromiseByPath.set(resolvedModelPath, createEmbeddingContexts(resolvedModelPath));
  }

  let embeddingContexts;
  try {
    embeddingContexts = await embeddingContextsPromiseByPath.get(resolvedModelPath);
  } catch (error /* unknown */) {
    embeddingContextsPromiseByPath.delete(resolvedModelPath);
    throw new Error(`embedding context initialization failed: ${getErrorMessage(error)}`);
  }
  embeddingContextsByPath.set(resolvedModelPath, embeddingContexts);
  const cursor = embeddingContextCursorByPath.get(resolvedModelPath) || 0;
  const context = embeddingContexts[cursor % embeddingContexts.length];
  embeddingContextCursorByPath.set(resolvedModelPath, cursor + 1);
  return context;
}

function getDirectOpenRouterApiKey() {
  return process.env.CONSUELO_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || null;
}

async function embedTexts(texts, options = {}) {
  try {
    const provider = options.provider || EMBEDDING_CONFIG.provider;
    if (provider === PROVIDER_LOCAL) {
      return Promise.all(texts.map((text) => embedTextLocal(text, options)));
    }
    if (provider === PROVIDER_OPENROUTER) {
      const apiKey = getDirectOpenRouterApiKey();
      if (!apiKey) {
        throw new Error('direct OpenRouter embeddings require CONSUELO_OPENROUTER_API_KEY');
      }
      return embedTextsOpenRouter(texts, apiKey);
    }

    const vectors = await requestGatewayEmbeddings(texts, options, {
      config: EMBEDDING_CONFIG,
      installId: options.installId,
      repoHash: options.repoHash,
    });
    return vectors.map(prepareVector);
  } catch (error /* unknown */) {
    throw new Error(`batch embedding failed: ${getErrorMessage(error)}`);
  }
}

async function embedTextsOpenRouter(texts, apiKey) {
  try {
    if (!Array.isArray(texts) || texts.length === 0) return [];
    const response = await fetch(OPENROUTER_EMBEDDING_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: EMBEDDING_API_MODEL, input: texts }),
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) {
      const details = await response.text();
      throw new Error(`direct embedding provider failed (${response.status}): ${details}`);
    }
    const data = await response.json();
    const embeddings = data.data || [];
    if (embeddings.length !== texts.length) {
      throw new Error(`direct embedding provider returned ${embeddings.length} embeddings for ${texts.length} inputs`);
    }
    return embeddings.map((item, index) => {
      if (!item?.embedding) throw new Error(`direct embedding provider returned no embedding for input ${index}`);
      return prepareVector(new Float32Array(item.embedding));
    });
  } catch (error /* unknown */) {
    throw new Error(`direct embedding batch failed: ${getErrorMessage(error)}`);
  }
}

async function embedText(text, options = {}) {
  const vectors = await embedTexts([text], options);
  const vector = vectors[0];
  if (!vector) throw new Error('embedding provider returned no embedding');
  return vector;
}

async function embedTextLocal(text, options = {}) {
  try {
    const context = await getEmbeddingContext(options.modelPath || DEFAULT_MODEL_PATH);
    const prefix = options.kind === 'query' ? QUERY_INSTRUCTION : DOCUMENT_INSTRUCTION;
    const embedding = await context.getEmbeddingFor(`${prefix}${text}`);
    return prepareVector(embedding.vector);
  } catch (error /* unknown */) {
    throw new Error(`local embedding failed: ${getErrorMessage(error)}`);
  }
}

module.exports = {
  DEFAULT_MODEL_PATH,
  EMBEDDING_API_MODEL,
  embedText,
  embedTexts,
};
