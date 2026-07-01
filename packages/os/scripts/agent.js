#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');

const DEFAULT_BASE_URL = 'http://127.0.0.1:11434/v1';
const DEFAULT_MODEL = 'pi-proxy';
const DEFAULT_API_KEY = 'anything';
const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_MAX_TOKENS = 4096;

function writeStdout(value = '') { process.stdout.write(`${value}\n`); }
function writeStderr(value = '') { process.stderr.write(`${value}\n`); }

function printHelp() {
  [
    'usage: bun run agent -- [options] <prompt>',
    '',
    'calls an openai-compatible chat completions endpoint. defaults to local pi-proxy.',
    '',
    'examples:',
    '  bun run agent -- "say hello world"',
    '  bun run agent -- --google/gemma-4-31b-it "say hello world"',
    '  bun run agent -- --model google/gemma-4-31b-it "say hello world"',
    '  cat /tmp/input.txt | bun run agent -- "clean this transcript"',
    '',
    'options:',
    '  --base-url <url>      endpoint base url (default: AGENT_BASE_URL or local pi-proxy)',
    '  --model <model>       model name (default: AGENT_MODEL or pi-proxy)',
    '  --api-key <key>       bearer token (default: AGENT_API_KEY or anything)',
    '  --system <prompt>     system prompt',
    '  --timeout <ms>        request timeout in milliseconds',
    '  --json                output structured json',
    '  --quiet               suppress non-answer text',
    '  --help                show this help',
    '',
    'env:',
    '  AGENT_BASE_URL=http://127.0.0.1:11434/v1',
    '  AGENT_MODEL=pi-proxy',
    '  AGENT_API_KEY=anything',
  ].forEach(writeStdout);
}

function parsePositiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`invalid ${name}: ${value}`);
  }
  return parsed;
}

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.AGENT_BASE_URL || DEFAULT_BASE_URL,
    model: process.env.AGENT_MODEL || DEFAULT_MODEL,
    apiKey: process.env.AGENT_API_KEY || DEFAULT_API_KEY,
    system: process.env.AGENT_SYSTEM_PROMPT || '',
    timeoutMs: parsePositiveInteger(process.env.AGENT_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS), 'AGENT_TIMEOUT_MS'),
    maxTokens: parsePositiveInteger(process.env.AGENT_MAX_TOKENS || String(DEFAULT_MAX_TOKENS), 'AGENT_MAX_TOKENS'),
    json: false,
    quiet: false,
    help: false,
    promptParts: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];

    if (raw === '--help' || raw === '-h') {
      args.help = true;
      continue;
    }

    if (raw === '--json') {
      args.json = true;
      continue;
    }

    if (raw === '--quiet') {
      args.quiet = true;
      continue;
    }

    if (raw === '--base-url') {
      args.baseUrl = requireValue(argv, index, raw);
      index += 1;
      continue;
    }

    if (raw.startsWith('--base-url=')) {
      args.baseUrl = raw.slice('--base-url='.length);
      continue;
    }

    if (raw === '--model') {
      args.model = requireValue(argv, index, raw);
      index += 1;
      continue;
    }

    if (raw.startsWith('--model=')) {
      args.model = raw.slice('--model='.length);
      continue;
    }

    if (raw === '--api-key') {
      args.apiKey = requireValue(argv, index, raw);
      index += 1;
      continue;
    }

    if (raw.startsWith('--api-key=')) {
      args.apiKey = raw.slice('--api-key='.length);
      continue;
    }

    if (raw === '--system') {
      args.system = requireValue(argv, index, raw);
      index += 1;
      continue;
    }

    if (raw.startsWith('--system=')) {
      args.system = raw.slice('--system='.length);
      continue;
    }

    if (raw === '--timeout') {
      args.timeoutMs = parsePositiveInteger(requireValue(argv, index, raw), '--timeout');
      index += 1;
      continue;
    }

    if (raw.startsWith('--timeout=')) {
      args.timeoutMs = parsePositiveInteger(raw.slice('--timeout='.length), '--timeout');
      continue;
    }

    if (raw.startsWith('--') && raw.slice(2).includes('/')) {
      args.model = raw.slice(2);
      continue;
    }

    if (raw.startsWith('--')) {
      throw new Error(`unknown flag: ${raw}`);
    }

    args.promptParts.push(raw);
  }

  return args;
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`missing value for ${flag}`);
  }
  return value;
}

function readStdin() {
  if (process.stdin.isTTY) return '';
  return fs.readFileSync(0, 'utf8').trim();
}

function buildPrompt(promptParts, stdinText) {
  return [...promptParts, stdinText]
    .map(part => part.trim())
    .filter(Boolean)
    .join('\n\n');
}

function buildChatCompletionsUrl(baseUrl) {
  const trimmed = baseUrl.replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  return `${trimmed}/chat/completions`;
}

function postJson(urlString, payload, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const body = JSON.stringify(payload);
    const transport = url.protocol === 'https:' ? https : http;

    const request = transport.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
        ...headers,
      },
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch {
          reject(new Error('invalid json response'));
          return;
        }

        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          const message = parsed?.error?.message || text || `http ${response.statusCode}`;
          reject(new Error(message));
          return;
        }

        resolve(parsed);
      });
    });

    request.on('error', reject);
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`request timed out after ${timeoutMs}ms`));
    });
    request.write(body);
    request.end();
  });
}

function extractContent(response) {
  const content = response?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('response did not include choices[0].message.content');
  }
  return content.trim();
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch {
    writeStderr('failed to parse arguments');
    process.exitCode = 1;
    return;
  }

  if (args.help) {
    printHelp();
    return;
  }

  const prompt = buildPrompt(args.promptParts, readStdin());
  if (!prompt) {
    writeStderr('error: prompt is required');
    writeStderr('usage: bun run agent -- "say hello world"');
    process.exitCode = 1;
    return;
  }

  const startedAt = Date.now();
  const messages = args.system
    ? [{ role: 'system', content: args.system }, { role: 'user', content: prompt }]
    : [{ role: 'user', content: prompt }];

  await postJson(
    buildChatCompletionsUrl(args.baseUrl),
    {
      model: args.model,
      messages,
      max_tokens: args.maxTokens,
      stream: false,
    },
    { authorization: `Bearer ${args.apiKey}` },
    args.timeoutMs,
  )
    .then(response => {
      const content = extractContent(response);

      if (args.json) {
        writeStdout(JSON.stringify({
          ok: true,
          baseUrl: args.baseUrl,
          model: args.model,
          elapsedMs: Date.now() - startedAt,
          content,
        }, null, 2));
        return;
      }

      writeStdout(content);
    })
    .catch(err => {
      const message = err instanceof Error ? err.message : 'agent request failed';
      if (args.json) {
        writeStdout(JSON.stringify({ ok: false, model: args.model, error: message }, null, 2));
      } else if (!args.quiet) {
        writeStderr(`agent failed: ${message}`);
      }
      process.exitCode = 1;
    });
}

main();
