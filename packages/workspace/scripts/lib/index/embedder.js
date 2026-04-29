const fs = require('fs');
const os = require('os');
const path = require('path');

const { VECTOR_DIMENSIONS } = require('./store');

const DEFAULT_MODEL_PATH = path.join(os.homedir(), '.cache', 'qmd', 'models', 'Qwen3-Embedding-4B-Q8_0.gguf');
const DOCUMENT_INSTRUCTION = 'Instruct: Represent this code for retrieval\nQuery: ';
const QUERY_INSTRUCTION = 'Instruct: Find code related to this question\nQuery: ';

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

function truncateVector(vector) {
  const truncated = new Float32Array(VECTOR_DIMENSIONS);
  const length = Math.min(vector.length, VECTOR_DIMENSIONS);

  for (let index = 0; index < length; index += 1) {
    truncated[index] = vector[index];
  }

  return normalizeVector(truncated);
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

async function embedText(text, options = {}) {
  try {
    const context = await getEmbeddingContext(options.modelPath || DEFAULT_MODEL_PATH);
    const prefix = options.kind === 'query' ? QUERY_INSTRUCTION : DOCUMENT_INSTRUCTION;
    const embedding = await context.getEmbeddingFor(`${prefix}${text}`);
    return truncateVector(embedding.vector);
  } catch (error /* unknown */) {
    throw new Error(`embedding failed: ${getErrorMessage(error)}`);
  }
}

module.exports = {
  DEFAULT_MODEL_PATH,
  embedText,
};
