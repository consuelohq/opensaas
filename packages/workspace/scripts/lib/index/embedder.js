const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const { getEmbeddingConfig } = require('./embedding-config');

const EMBEDDING_CONFIG = getEmbeddingConfig();
const VECTOR_DIMENSIONS = EMBEDDING_CONFIG.dimensions;

const DEFAULT_MODEL_PATH = path.join(os.homedir(), '.cache', 'qmd', 'models', 'Qwen3-Embedding-4B-Q8_0.gguf');
const DOCUMENT_INSTRUCTION = 'Instruct: Represent this code for retrieval\nQuery: ';
const QUERY_INSTRUCTION = 'Instruct: Find code related to this question\nQuery: ';

// openrouter embedding API — same qwen3-embedding-4b model as local, zero CPU
const EMBEDDING_API_URL = 'https://openrouter.ai/api/v1/embeddings';
const EMBEDDING_API_MODEL = EMBEDDING_CONFIG.apiModel;

let _apiKey = null;
function getApiKey() {
  if (_apiKey) return _apiKey;
  try {
    _apiKey = execSync('security find-generic-password -a "$USER" -s "pi-proxy-openrouter-api-key" -w', { encoding: 'utf8' }).trim();
    return _apiKey;
  } catch { return null; }
}

const USE_API = process.env.WORKSPACE_EMBEDDING_API !== '0' && process.env.WORKSPACE_EMBEDDING_API !== 'false';

const embeddingContextsByPath = new Map();
const embeddingContextsPromiseByPath = new Map();
const embeddingContextCursorByPath = new Map();

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
    'Set WORKSPACE_EMBEDDING_DIMENSIONS to match the provider output, or explicitly enable truncation with WORKSPACE_EMBEDDING_TRUNCATE=1 for a benchmark.',
  ].join(' '));
}

function getEmbeddingContextCount() {
  const parsed = Number.parseInt(process.env.WORKSPACE_EMBEDDING_CONTEXTS || '2', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;

  return Math.min(parsed, 2);
}

async function createEmbeddingContexts(modelPath) {
  if (!fs.existsSync(modelPath)) {
    throw new Error(`embedding model not found: ${modelPath}`);
  }

  const { getLlama } = await import('node-llama-cpp');
  const llama = await getLlama();
  let model;
  model = await llama.loadModel({
    modelPath,
    gpuLayers: process.env.WORKSPACE_EMBEDDING_GPU_LAYERS || 'max',
    defaultContextFlashAttention: true,
  }).catch((error) => {
    if (process.env.WORKSPACE_EMBEDDING_GPU_LAYERS) {
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


async function embedTexts(texts, options = {}) {
  try {
    const apiKey = USE_API ? getApiKey() : null;
    if (apiKey) {
      return embedTextsApi(texts, apiKey, options);
    }
    return Promise.all(texts.map((text) => embedTextLocal(text, options)));
  } catch (error /* unknown */) {
    throw new Error(`batch embedding failed: ${getErrorMessage(error)}`);
  }
}

async function embedTextsApi(texts, apiKey, options = {}) {
  try {
    if (!Array.isArray(texts) || texts.length === 0) return [];
    const response = await fetch(EMBEDDING_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: EMBEDDING_API_MODEL, input: texts }),
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`embedding API failed (${response.status}): ${err}`);
    }
    const data = await response.json();
    const embeddings = data.data || [];
    if (embeddings.length !== texts.length) {
      throw new Error(`embedding API returned ${embeddings.length} embeddings for ${texts.length} inputs`);
    }
    return embeddings.map((item, index) => {
      if (!item?.embedding) throw new Error(`embedding API returned no embedding for input ${index}`);
      return prepareVector(new Float32Array(item.embedding));
    });
  } catch (error /* unknown */) {
    throw new Error(`embedding API batch failed: ${getErrorMessage(error)}`);
  }
}

async function embedText(text, options = {}) {
  const apiKey = USE_API ? getApiKey() : null;
  if (apiKey) {
    return embedTextApi(text, apiKey, options);
  }
  return embedTextLocal(text, options);
}

async function embedTextApi(text, apiKey, options = {}) {
  const response = await fetch(EMBEDDING_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: EMBEDDING_API_MODEL, input: [text] }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`embedding API failed (${response.status}): ${err}`);
  }
  const data = await response.json();
  const vector = data.data?.[0]?.embedding;
  if (!vector) throw new Error('embedding API returned no embedding');
  return prepareVector(new Float32Array(vector));
}

async function embedTextLocal(text, options = {}) {
  try {
    const context = await getEmbeddingContext(options.modelPath || DEFAULT_MODEL_PATH);
    const prefix = options.kind === 'query' ? QUERY_INSTRUCTION : DOCUMENT_INSTRUCTION;
    const embedding = await context.getEmbeddingFor(`${prefix}${text}`);
    return prepareVector(embedding.vector);
  } catch (error /* unknown */) {
    throw new Error(`embedding failed: ${getErrorMessage(error)}`);
  }
}

module.exports = {
  DEFAULT_MODEL_PATH,
  EMBEDDING_API_MODEL,
  embedText,
  embedTexts,
};
