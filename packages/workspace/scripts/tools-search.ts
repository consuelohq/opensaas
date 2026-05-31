import fs from 'node:fs';
import path from 'node:path';

import { outputTypeSignatures, schemaTypeSignatures } from './lib/facade/schemas';

type ToolCapability = {
  readOnly?: boolean;
  mutating?: boolean;
  deterministic?: boolean;
  safeToRetry?: boolean;
};

type ToolCommandArgument = {
  source: string;
  flag?: string;
  kind?: string;
  required?: boolean;
};

type ToolManifestEntry = {
  name: string;
  methodPath?: string[];
  description?: string;
  category?: string;
  underlying?: string;
  capabilities?: ToolCapability;
  defaultTimeout?: number;
  inputSchema?: string;
  outputSchema?: string;
  command?: {
    script?: string;
    subcommand?: string;
    internal?: string;
    branchMode?: string;
    branchArgumentStyle?: string;
    jsonFlag?: string;
    dryRunFlag?: string;
    arguments?: ToolCommandArgument[];
  };
  exampleInput?: Record<string, unknown>;
  sessionRequired?: boolean;
};

type SearchOptions = {
  query: string;
  limit: number;
  category?: string;
  readOnly?: boolean;
  mutating?: boolean;
  includeDocs: boolean;
};

type ToolDoc = {
  heading: string;
  snippet: string;
  source: string;
};

type ToolSearchMatch = {
  name: string;
  methodPath?: string[];
  category?: string;
  score: number;
  description?: string;
  capabilities: ToolCapability;
  sessionRequired: boolean;
  inputSchema?: string;
  outputSchema?: string;
  inputSignature?: string;
  outputSignature?: string;
  exampleInput?: Record<string, unknown>;
  usage: {
    workspaceCall: string;
    script?: string;
    subcommand?: string;
    arguments: ToolCommandArgument[];
  };
  docs?: ToolDoc;
  why: string[];
};

const workspaceRoot = path.resolve(import.meta.dir, '..');
const manifestPath = path.join(workspaceRoot, 'tooling', 'tool-manifest.json');
const toolsDocPath = path.join(workspaceRoot, 'TOOLS.md');

const STOP_WORDS = new Set(['a', 'an', 'the', 'for', 'to', 'of', 'and', 'or', 'no', 'such', 'made', 'up']);
const GENERIC_ONLY_TOKENS = new Set(['tool', 'tools', 'search', 'find', 'query', 'lookup', 'file', 'files', 'fs', 'read', 'get', 'view']);
const READ_INTENT_TOKENS = new Set(['search', 'find', 'lookup', 'read', 'get', 'view', 'check', 'checks', 'status', 'list', 'logs', 'log', 'trace', 'inspect', 'screenshot']);

const QUERY_ALIASES: Record<string, string[]> = {
  pr: ['pull', 'request', 'github'],
  prs: ['pull', 'request', 'github'],
  pull: ['pr', 'github'],
  github: ['gh', 'pr', 'branch', 'repo'],
  gh: ['github', 'pr'],
  ticket: ['linear', 'issue'],
  jira: ['linear', 'issue'],
  file: ['fs', 'filesystem'],
  files: ['fs', 'filesystem'],
  grep: ['fs', 'search', 'ripgrep'],
  search: ['find', 'query', 'lookup'],
  read: ['get', 'fetch', 'view'],
  trace: ['context', 'logs', 'sentry'],
  log: ['logs', 'trace'],
  logs: ['railway', 'context', 'sentry'],
  codex: ['worker', 'cdx'],
  cdx: ['codex', 'worker'],
  pi: ['worker', 'mini'],
  deploy: ['railway', 'website', 'server'],
  browser: ['page', 'screenshot', 'open'],
  tool: ['manifest', 'schema', 'capability'],
  tools: ['manifest', 'schema', 'capability'],
};

function parseArgs(argv: string[]): SearchOptions {
  let query = '';
  let limit = 8;
  let category: string | undefined;
  let readOnly: boolean | undefined;
  let mutating: boolean | undefined;
  let includeDocs = true;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--query' || arg === '-q') {
      query = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--limit') {
      const parsed = Number(argv[index + 1]);
      if (Number.isFinite(parsed) && parsed > 0) limit = Math.min(Math.floor(parsed), 30);
      index += 1;
      continue;
    }
    if (arg === '--category') {
      category = argv[index + 1] || undefined;
      index += 1;
      continue;
    }
    if (arg === '--read-only') {
      readOnly = true;
      continue;
    }
    if (arg === '--mutating') {
      mutating = true;
      continue;
    }
    if (arg === '--no-docs') {
      includeDocs = false;
      continue;
    }
    if (arg === '--json') continue;
    if (!arg.startsWith('-') && !query) query = arg;
  }

  query = query.trim();
  if (!query) {
    throw new Error('tools.search requires a query. Example: bun run tools:search -- "linear issue" --json');
  }

  return { query, limit, category, readOnly, mutating, includeDocs };
}

function normalize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._:/-]+/g, ' ')
    .replace(/[^a-zA-Z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function tokensFor(value: string): string[] {
  return normalize(value).split(' ').filter((token) => token.length > 0);
}

function baseSearchTokens(query: string): string[] {
  return tokensFor(query).filter((token) => !STOP_WORDS.has(token));
}

function meaningfulSearchTokens(query: string): string[] {
  return baseSearchTokens(query).filter((token) => !GENERIC_ONLY_TOKENS.has(token));
}

function hasReadIntent(query: string): boolean {
  return baseSearchTokens(query).some((token) => READ_INTENT_TOKENS.has(token));
}

function allowsGenericOnlySearch(query: string): boolean {
  return new Set([
    'file search',
    'files search',
    'fs search',
    'tool search',
    'tools search',
    'search tools',
    'tool',
    'tools',
  ]).has(normalize(query));
}

function expandTokens(query: string): string[] {
  const base = baseSearchTokens(query);
  const expanded = new Set(base);
  for (const token of base) {
    for (const alias of QUERY_ALIASES[token] || []) expanded.add(alias);
  }
  return [...expanded];
}

function meaningfulExpandedTokens(query: string): Set<string> {
  const meaningful = new Set(meaningfulSearchTokens(query));
  for (const token of meaningfulSearchTokens(query)) {
    for (const alias of QUERY_ALIASES[token] || []) meaningful.add(alias);
  }
  return meaningful;
}

function fuzzyTokenMatch(needle: string, haystack: string): boolean {
  if (haystack.includes(needle)) return true;
  if (needle.length < 4) return false;
  let position = 0;
  for (const char of haystack) {
    if (char === needle[position]) position += 1;
    if (position === needle.length) return true;
  }
  return false;
}

function compactSnippet(value: string, limit = 600): string {
  const text = value.replace(/```[\s\S]*?```/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function readManifest(): ToolManifestEntry[] {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ToolManifestEntry[];
}

function readToolDocs(): Map<string, ToolDoc> {
  if (!fs.existsSync(toolsDocPath)) return new Map();
  const text = fs.readFileSync(toolsDocPath, 'utf8');
  const blocks = text.split(/\n(?=###\s+)/g);
  const docs = new Map<string, ToolDoc>();
  for (const block of blocks) {
    const headingMatch = block.match(/^###\s+([^\n]+)/);
    if (!headingMatch) continue;
    const name = headingMatch[1].trim().replace(/`/g, '');
    docs.set(name, {
      heading: headingMatch[0].trim(),
      snippet: compactSnippet(block),
      source: 'packages/workspace/TOOLS.md',
    });
  }
  return docs;
}

function scoreTool(entry: ToolManifestEntry, options: SearchOptions, docs: Map<string, ToolDoc>): { score: number; why: string[]; meaningfulMatches: number } {
  const rawQuery = options.query.trim().toLowerCase();
  const queryTokens = expandTokens(options.query);
  const meaningfulTokens = meaningfulExpandedTokens(options.query);
  const name = entry.name || '';
  const nameLower = name.toLowerCase();
  const nameTokens = tokensFor(name);
  const category = (entry.category || '').toLowerCase();
  const description = normalize(entry.description || '');
  const schema = normalize(`${entry.inputSchema || ''} ${entry.outputSchema || ''}`);
  const commandText = normalize(JSON.stringify(entry.command || {}));
  const exampleText = normalize(JSON.stringify(entry.exampleInput || {}));
  const doc = docs.get(entry.name);
  const docsText = normalize(doc?.snippet || '');
  const haystack = [nameTokens.join(' '), category, description, schema, commandText, exampleText, docsText].join(' ');
  const why: string[] = [];
  let score = 0;
  let meaningfulMatches = 0;

  if (nameLower === rawQuery) {
    score += 120;
    why.push('exact tool name match');
  }
  if (rawQuery.length >= 3 && nameLower.includes(rawQuery)) {
    score += 55;
    why.push('tool name contains query');
  }
  if (category && rawQuery === category) {
    score += 24;
    why.push('category match');
  }

  if (nameTokens.join(' ') === normalize(options.query)) {
    score += 45;
    why.push('tool name matches query phrase');
  }

  for (const token of queryTokens) {
    if (!token) continue;
    const isMeaningfulToken = meaningfulTokens.has(token);
    let tokenMatched = false;
    if (nameTokens.includes(token)) {
      score += 18;
      why.push(`name token: ${token}`);
      tokenMatched = true;
    } else if (nameTokens.some((nameToken) => nameToken.startsWith(token))) {
      score += 14;
      why.push(`name prefix: ${token}`);
      tokenMatched = true;
    } else if (nameTokens.some((nameToken) => fuzzyTokenMatch(token, nameToken))) {
      score += 6;
      why.push(`fuzzy name token: ${token}`);
      tokenMatched = true;
    }

    if (category.includes(token)) {
      score += 8;
      why.push(`category token: ${token}`);
      tokenMatched = true;
    }
    if (description.includes(token)) { score += 4; tokenMatched = true; }
    if (schema.includes(token)) { score += 3; tokenMatched = true; }
    if (commandText.includes(token)) { score += 2; tokenMatched = true; }
    if (exampleText.includes(token)) { score += 2; tokenMatched = true; }
    if (docsText.includes(token)) { score += 1; tokenMatched = true; }
    if (isMeaningfulToken && tokenMatched) meaningfulMatches += 1;
  }

  const capabilities = entry.capabilities || {};
  if (options.readOnly === true && capabilities.readOnly === true) score += 8;
  if (options.mutating === true && capabilities.mutating === true) score += 8;
  if (hasReadIntent(options.query)) {
    if (capabilities.readOnly === true) score += 10;
    if (capabilities.mutating === true) score -= 8;
  }

  return { score, why: [...new Set(why)].slice(0, 8), meaningfulMatches }; 
}

function workspaceCallSnippet(entry: ToolManifestEntry): string {
  const example = entry.exampleInput || {};
  const fields = [
    `tool: ${JSON.stringify(entry.name)}`,
    `input: ${JSON.stringify(example)}`,
  ];
  if (entry.sessionRequired === true) fields.push('taskSession: "<taskSession>"');
  return `await workspace.call({ ${fields.join(', ')} })`;
}

function toMatch(entry: ToolManifestEntry, score: number, why: string[], docs: Map<string, ToolDoc>, includeDocs: boolean): ToolSearchMatch {
  const inputSchema = entry.inputSchema;
  const outputSchema = entry.outputSchema;
  return {
    name: entry.name,
    ...(entry.methodPath ? { methodPath: entry.methodPath } : {}),
    ...(entry.category ? { category: entry.category } : {}),
    score,
    ...(entry.description ? { description: entry.description } : {}),
    capabilities: entry.capabilities || {},
    sessionRequired: entry.sessionRequired === true,
    ...(inputSchema ? { inputSchema } : {}),
    ...(outputSchema ? { outputSchema } : {}),
    ...(inputSchema && schemaTypeSignatures[inputSchema] ? { inputSignature: schemaTypeSignatures[inputSchema] } : {}),
    ...(outputSchema && outputTypeSignatures[outputSchema] ? { outputSignature: outputTypeSignatures[outputSchema] } : {}),
    ...(entry.exampleInput ? { exampleInput: entry.exampleInput } : {}),
    usage: {
      workspaceCall: workspaceCallSnippet(entry),
      ...(entry.command?.script ? { script: entry.command.script } : {}),
      ...(entry.command?.subcommand ? { subcommand: entry.command.subcommand } : {}),
      arguments: entry.command?.arguments || [],
    },
    ...(includeDocs && docs.get(entry.name) ? { docs: docs.get(entry.name) } : {}),
    why,
  };
}

function run(options: SearchOptions): Record<string, unknown> {
  const manifest = readManifest();
  const docs = options.includeDocs ? readToolDocs() : new Map<string, ToolDoc>();
  const matches = manifest
    .filter((entry) => !options.category || entry.category === options.category)
    .filter((entry) => options.readOnly !== true || entry.capabilities?.readOnly === true)
    .filter((entry) => options.mutating !== true || entry.capabilities?.mutating === true)
    .map((entry) => ({ entry, ...scoreTool(entry, options, docs) }))
    .filter((item) => item.score >= 20)
    .filter((item) => {
      const meaningfulTokens = meaningfulExpandedTokens(options.query);
      if (meaningfulTokens.size > 0) return item.meaningfulMatches > 0;
      return allowsGenericOnlySearch(options.query);
    })
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, options.limit)
    .map((item) => toMatch(item.entry, item.score, item.why, docs, options.includeDocs));

  return {
    query: options.query,
    limit: options.limit,
    filters: {
      ...(options.category ? { category: options.category } : {}),
      ...(options.readOnly ? { readOnly: true } : {}),
      ...(options.mutating ? { mutating: true } : {}),
    },
    totalMatches: matches.length,
    matches,
    guidance: matches.length > 0
      ? 'Use the highest-ranked read-only match for investigation. Use mutating tools only when the user asked for a state change.'
      : 'No matching tools found. Try broader intent keywords like "github pr", "linear issue", "file search", or "trace logs".',
  };
}

try {
  const result = run(parseArgs(Bun.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}



