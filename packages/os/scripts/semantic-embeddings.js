#!/usr/bin/env bun

const fs = require('fs');

const {
  DEFAULT_GATEWAY_URL,
  getEmbeddingConfig,
  getEmbeddingConfigId,
} = require('./lib/index/embedding-config');
const {
  MAX_GATEWAY_BATCH_SIZE,
  MAX_GATEWAY_TEXT_CHARS,
  MAX_GATEWAY_TOTAL_CHARS,
} = require('./lib/index/embedding-gateway');
const { DEFAULT_MODEL_PATH } = require('./lib/index/embedder');

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function printHelp() {
  writeStdout('usage: bun run semantic:embeddings -- doctor [--json]');
  writeStdout('');
  writeStdout('inspect OS semantic-search embedding provider configuration.');
  writeStdout('');
  writeStdout('commands:');
  writeStdout('  doctor          print provider, gateway, limits, and local fallback status');
}

function parseArgs(argv) {
  const args = { command: 'doctor', json: false, help: false };
  for (const arg of argv) {
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (arg.startsWith('--')) {
      throw new Error(`unknown flag: ${arg}`);
    }
    args.command = arg;
  }
  return args;
}

function buildDoctorPayload() {
  const config = getEmbeddingConfig();
  const localModelExists = fs.existsSync(DEFAULT_MODEL_PATH);
  return {
    provider: config.provider,
    model: config.apiModel,
    dimensions: config.dimensions,
    embeddingConfigId: getEmbeddingConfigId(config),
    gateway: {
      url: config.gatewayUrl || DEFAULT_GATEWAY_URL,
      batchLimit: MAX_GATEWAY_BATCH_SIZE,
      itemCharLimit: MAX_GATEWAY_TEXT_CHARS,
      totalCharLimit: MAX_GATEWAY_TOTAL_CHARS,
    },
    local: {
      modelPath: DEFAULT_MODEL_PATH,
      modelExists: localModelExists,
      enabled: config.provider === 'local',
    },
  };
}

function printDoctor(payload) {
  writeStdout(`provider: ${payload.provider}`);
  writeStdout(`model: ${payload.model}`);
  writeStdout(`dimensions: ${payload.dimensions}`);
  writeStdout(`config: ${payload.embeddingConfigId}`);
  writeStdout(`gateway: ${payload.gateway.url}`);
  writeStdout(`limits: batch=${payload.gateway.batchLimit} item_chars=${payload.gateway.itemCharLimit} total_chars=${payload.gateway.totalCharLimit}`);
  writeStdout(`local_model: ${payload.local.modelPath}`);
  writeStdout(`local_model_exists: ${payload.local.modelExists ? 'yes' : 'no'}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (args.command !== 'doctor') {
    throw new Error(`unknown command: ${args.command}`);
  }
  const payload = buildDoctorPayload();
  if (args.json) {
    writeStdout(JSON.stringify(payload, null, 2));
    return;
  }
  printDoctor(payload);
}

main();
