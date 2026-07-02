import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { applyManifestOverlay, readManifestOverlay, resolveOverlayHome } from './lib/manifest-overlay';
import { outputTypeSignatures, schemaTypeSignatures } from './lib/facade/schemas';

const require = createRequire(import.meta.url);

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
type JsonObject = Record<string, unknown>;

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

type CanonicalManifestEntry = {
  name: string;
  kind: 'os-skill' | 'facade-tool';
  source: string;
  sourcePath: string;
  category: string;
  description: string;
  title?: string;
  core: boolean;
  definition: JsonObject;
};

type CanonicalToolManifest = {
  version: 1;
  kind: 'consuelo-os-tool-manifest';
  tools: CanonicalManifestEntry[];
};

type SearchOptions = {
  query: string;
  limit: number;
  category?: string;
  readOnly?: boolean;
  mutating?: boolean;
  includeDocs: boolean;
  includeEmbeddings?: boolean;
};

type ToolDoc = {
  heading: string;
  snippet: string;
  source: string;
};

type ToolCard = {
  entry: ToolManifestEntry;
  doc?: ToolDoc;
  text: string;
  hash: string;
  tokens: string[];
};

type ScoreParts = {
  exact: number;
  name: number;
  lexical: number;
  bm25: number;
  intent: number;
  capability: number;
  embedding: number;
};

type ScoredTool = {
  card: ToolCard;
  score: number;
  why: string[];
  meaningfulMatches: number;
  matchedIntentIds: string[];
  scoreParts: ScoreParts;
};

type ToolSearchMatch = {
  name: string;
  methodPath?: string[];
  category?: string;
  score: number;
  scoreParts: ScoreParts;
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

type IntentPack = {
  id: string;
  label: string;
  terms: string[];
  requireAny?: string[];
  boost: Record<string, number>;
  alternatives?: Array<{ intent: string; tools: string[] }>;
  safeDefault?: string;
  mutatingGuidance?: string;
};

type EmbeddingCache = {
  version: number;
  embeddingConfigId: string;
  cardVersion: string;
  entries: Record<string, number[]>;
};

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(workspaceRoot, 'manifests', 'tool.manifest.json');
const toolsDocPath = path.join(workspaceRoot, 'TOOLS.md');
const TOOL_CARD_VERSION = 'tools-search-card-v2';

const STOP_WORDS = new Set(['a', 'an', 'the', 'for', 'to', 'of', 'and', 'or', 'no', 'such', 'made', 'up', 'with', 'by', 'in', 'on']);
const GENERIC_ONLY_TOKENS = new Set(['tool', 'tools', 'search', 'find', 'query', 'lookup', 'file', 'files', 'fs', 'read', 'get', 'view']);
const READ_INTENT_TOKENS = new Set(['search', 'find', 'lookup', 'read', 'get', 'view', 'check', 'checks', 'status', 'list', 'links', 'logs', 'log', 'trace', 'inspect', 'screenshot', 'show']);

const QUERY_ALIASES: Record<string, string[]> = {
  abandon: ['cleanup', 'clean', 'remove', 'delete', 'stale', 'worktree', 'branch'],
  close: ['cleanup', 'finish', 'pr'],
  cleanup: ['clean', 'remove', 'delete', 'stale', 'worktree', 'branch'],
  clean: ['cleanup', 'remove', 'delete'],
  delete: ['cleanup', 'remove', 'trash'],
  remove: ['cleanup', 'delete', 'trash'],
  stale: ['cleanup', 'worktree', 'branch'],
  worktree: ['task', 'branch', 'cleanup'],
  pr: ['pull', 'request', 'github'],
  prs: ['pull', 'request', 'github', 'links'],
  pull: ['pr', 'github'],
  github: ['gh', 'pr', 'branch', 'repo'],
  gh: ['github', 'pr'],
  ticket: ['linear', 'issue'],
  jira: ['linear', 'issue'],
  file: ['fs', 'filesystem'],
  files: ['fs', 'filesystem'],
  grep: ['fs', 'search', 'ripgrep', 'pattern'],
  ripgrep: ['grep', 'fs', 'search'],
  patch: ['fs', 'write', 'edit'],
  write: ['fs', 'file', 'mutating'],
  trash: ['fs', 'delete', 'remove'],
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
  bun: ['runtime', 'package', 'script', 'code', 'call'],
  python: ['runtime', 'transform', 'script', 'code', 'call'],
  bash: ['runtime', 'shell', 'script', 'code', 'call'],
  typecheck: ['syntax', 'check', 'package', 'script', 'code'],
  codegen: ['generate', 'generated', 'package', 'script', 'edit', 'code'],
  generate: ['codegen', 'generated', 'package', 'script', 'edit'],
  generated: ['codegen', 'generate', 'package', 'script', 'edit'],
  diagnostic: ['runtime', 'inspect', 'code'],
  diagnostics: ['runtime', 'inspect', 'code'],
  summarize: ['structured', 'packet', 'bounded'],
  summary: ['structured', 'packet', 'bounded'],
  packet: ['structured', 'bounded', 'json'],
  codemod: ['transform', 'rewrite', 'edit', 'code'],
  transformation: ['transform', 'rewrite', 'code'],
  transform: ['rewrite', 'codemod', 'code'],
  rewrite: ['transform', 'codemod', 'edit', 'code'],
  rg: ['ripgrep', 'grep', 'search', 'pattern'],
  tool: ['manifest', 'schema', 'capability'],
  tools: ['manifest', 'schema', 'capability'],
};

const INTENT_PACKS: IntentPack[] = [
  {
    id: 'task-cleanup',
    label: 'clean up or abandon a task branch/worktree',
    terms: ['cleanup', 'clean', 'abandon', 'delete', 'remove', 'stale', 'worktree', 'branch'],
    requireAny: ['cleanup', 'clean', 'abandon', 'delete', 'remove', 'stale'],
    boost: { 'task.cleanup': 105, 'fs.trash': -35, 'task.pr': 12, 'task.prs': 20, 'task.finish': -60 },
    alternatives: [
      { intent: 'inspect task PR links', tools: ['task.prs'] },
      { intent: 'create or refresh the stream review PR', tools: ['task.pr'] },
      { intent: 'merge a pull request', tools: ['task.merge'] },
      { intent: 'finish a merged task branch', tools: ['task.finish'] },
    ],
    safeDefault: 'Use task.prs when only inspecting PR state; use task.cleanup only when the user intends branch/worktree cleanup.',
    mutatingGuidance: 'task.cleanup mutates branches/worktrees unless preview/dry-run flags are used.',
  },
  {
    id: 'task-current',
    label: 'inspect current task branch or worktree state',
    terms: ['task', 'current', 'existing', 'branch', 'worktree', 'status'],
    requireAny: ['current', 'existing', 'status'],
    boost: { 'task.current': 105, 'task.prs': 12, 'stream.context': 8, 'task.cleanup': -55 },
    safeDefault: 'Use task.current for inspecting existing task branch/worktree state; use task.cleanup only for explicit cleanup/abandon/delete intent.',
  },
  {
    id: 'task-pr-links',
    label: 'inspect task and review PR links',
    terms: ['show', 'list', 'links', 'prs', 'pr'],
    requireAny: ['show', 'list', 'links', 'prs'],
    boost: { 'task.prs': 95, 'task.pr': 8, 'task.merge': -14, 'task.cleanup': -24 },
    alternatives: [
      { intent: 'create or refresh the stream review PR', tools: ['task.pr'] },
      { intent: 'merge a pull request', tools: ['task.merge'] },
    ],
    safeDefault: 'task.prs is the safe read-only default for inspecting task PR links.',
  },
  {
    id: 'task-pr-create',
    label: 'create or refresh a stream review PR',
    terms: ['create', 'refresh', 'review', 'stream', 'pr', 'pull', 'request'],
    requireAny: ['create', 'refresh', 'review'],
    boost: { 'task.pr': 90, 'task.prs': 12, 'task.merge': -8, 'task.cleanup': -24 },
    alternatives: [
      { intent: 'inspect task PR links', tools: ['task.prs'] },
      { intent: 'merge a pull request', tools: ['task.merge'] },
    ],
  },
  {
    id: 'stream-sync',
    label: 'sync a stream branch',
    terms: ['stream', 'sync', 'branch', 'latest'],
    requireAny: ['sync'],
    boost: { 'stream.sync': 105, 'stream.context': 10, 'task.pr': -30, 'task.cleanup': -40 },
    safeDefault: 'Use stream.sync for syncing stream branches; use task.pr only when creating or refreshing a review PR.',
  },
  {
    id: 'task-merge',
    label: 'merge a pull request',
    terms: ['merge', 'pull', 'request', 'pr', 'squash', 'wait'],
    requireAny: ['merge', 'squash'],
    boost: { 'task.merge': 95, 'task.pr': 22, 'task.prs': 8, 'task.cleanup': -20 },
    alternatives: [
      { intent: 'create or refresh the stream review PR', tools: ['task.pr'] },
      { intent: 'inspect task PR links', tools: ['task.prs'] },
    ],
  },
  {
    id: 'task-finish',
    label: 'finish a completed task branch',
    terms: ['finish', 'done', 'complete', 'close', 'task'],
    requireAny: ['finish', 'done', 'complete'],
    boost: { 'task.finish': 95, 'task.cleanup': 22, 'task.prs': 8 },
  },
  {
    id: 'code-call-runtime',
    label: 'run focused repo runtime checks and package scripts',
    terms: [
      'run',
      'command',
      'cli',
      'reproduce',
      'reproduction',
      'exact',
      'bun',
      'python',
      'bash',
      'test',
      'tests',
      'typecheck',
      'syntax',
      'check',
      'package',
      'script',
      'scripts',
      'diagnostic',
      'diagnostics',
      'verify',
    ],
    requireAny: [
      'command',
      'cli',
      'reproduce',
      'reproduction',
      'bun',
      'python',
      'bash',
      'test',
      'tests',
      'typecheck',
      'syntax',
      'package',
      'script',
      'scripts',
      'diagnostic',
      'diagnostics',
    ],
    boost: { 'code.call': 125, 'fs.read': -20, 'fs.search': -15, 'fs.list': -15, 'fs.write': -10 },
    safeDefault: 'code.call is the repo runtime default for package scripts, tests, typechecks, syntax checks, exact CLI reproduction, and focused diagnostics; use task.* and stream.* for lifecycle workflow operations.',
  },
  {
    id: 'code-call-structured-file-work',
    label: 'run structured multi-file inspection or transformation',
    terms: [
      'structured',
      'summarize',
      'summary',
      'packet',
      'bounded',
      'shape',
      'shaping',
      'transform',
      'transformation',
      'rewrite',
      'codemod',
      'codegen',
      'generate',
      'generated',
      'multi',
      'many',
      'files',
      'python',
      'bun',
      'json',
      'inspect',
    ],
    requireAny: [
      'structured',
      'summarize',
      'summary',
      'packet',
      'bounded',
      'transform',
      'transformation',
      'rewrite',
      'codemod',
      'codegen',
      'generate',
      'generated',
      'python',
      'bun',
      'json',
    ],
    boost: { 'code.call': 120, 'fs.read': -20, 'fs.search': -10, 'fs.list': -10, 'fs.write': -10 },
    safeDefault: 'Use code.call for programmable multi-file inspection, bounded JSON packets, codegen, and deterministic rewrites; use fs.read/fs.search/fs.list for simple literal file operations and fs.apply_patch for anchored patches.',
  },
  {
    id: 'fs-search',
    label: 'search repo files',
    terms: ['grep', 'ripgrep', 'rg', 'search', 'find', 'pattern', 'contents', 'files', 'codebase'],
    requireAny: ['grep', 'ripgrep', 'rg', 'pattern', 'contents'],
    boost: { 'fs.search': 105, 'tools.search': -35, 'mac.search': 12, 'context.search': -18, 'task.cleanup': -45 },
    safeDefault: 'fs.search is the read-only default for searching repository files.',
  },
  {
    id: 'fs-read',
    label: 'read file contents',
    terms: ['read', 'open', 'show', 'lines', 'contents', 'file'],
    requireAny: ['read', 'open', 'lines'],
    boost: { 'fs.read': 95, 'mac.read': 12, 'fs.search': 10 },
  },
  {
    id: 'fs-list',
    label: 'list files or directories',
    terms: ['list', 'tree', 'folder', 'directory', 'dirs', 'files'],
    requireAny: ['list', 'tree', 'folder', 'directory'],
    boost: { 'fs.list': 95, 'mac.list': 10, 'fs.search': 8 },
  },
  {
    id: 'fs-write-patch',
    label: 'write or patch task worktree files',
    terms: ['write', 'patch', 'apply', 'anchored', 'anchor', 'hunk', 'edit', 'replace', 'file', 'contents'],
    requireAny: ['write', 'patch', 'apply', 'anchored', 'anchor', 'hunk', 'edit', 'replace'],
    boost: { 'fs.apply_patch': 120, 'fs.write': 45, 'fs.trash': 18, 'fs.read': 8, 'code.call': -20 },
    mutatingGuidance: 'fs.apply_patch is the default for anchored patch/apply/hunk edits; fs.write is for whole-file write/append/overwrite; prefer fs.read/fs.search for investigation.',
  },
  {
    id: 'browser-screenshot',
    label: 'capture or inspect rendered browser state',
    terms: ['browser', 'screenshot', 'page', 'rendered', 'snapshot', 'accessibility'],
    requireAny: ['browser', 'screenshot', 'rendered', 'snapshot'],
    boost: { 'browser.screenshot': 86, 'browser.test': 72, 'browser.snap': 60, 'browser.open': 32 },
  },
  {
    id: 'linear-issue',
    label: 'read or search Linear issues',
    terms: ['linear', 'issue', 'ticket', 'jira', 'dev'],
    requireAny: ['linear', 'issue', 'ticket', 'jira'],
    boost: { 'linear.issue': 86, 'linear.search': 72, 'linear.createIssue': -16 },
  },
  {
    id: 'railway-logs',
    label: 'inspect Railway logs or deploy status',
    terms: ['railway', 'logs', 'deploy', 'errors', 'runtime'],
    requireAny: ['railway', 'logs', 'deploy'],
    boost: { 'railway.logs': 86, 'railway.redeploy': -20 },
  },
];

function parseArgs(argv: string[]): SearchOptions {
  let query = '';
  let limit = 8;
  let category: string | undefined;
  let readOnly: boolean | undefined;
  let mutating: boolean | undefined;
  let includeDocs = true;
  let includeEmbeddings = true;

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
    if (arg === '--no-embeddings') {
      includeEmbeddings = false;
      continue;
    }
    if (arg === '--json') continue;
    if (!arg.startsWith('-') && !query) query = arg;
  }

  query = query.trim();
  if (!query) {
    throw new Error('tools.search requires a query. Example: bun run tools:search -- "linear issue" --json');
  }

  return { query, limit, category, readOnly, mutating, includeDocs, includeEmbeddings };
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
  return new Set(['file search', 'files search', 'fs search', 'tool search', 'tools search', 'search tools', 'tool', 'tools']).has(normalize(query));
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

function hashText(value: string): string {
  return createHash('sha256').update(value).digest('hex');
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

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readCanonicalManifest(): CanonicalToolManifest {
  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown;
  if (!isObject(parsed) || !Array.isArray(parsed.tools)) {
    throw new Error(`${manifestPath}: expected generated tool manifest with tools array`);
  }

  const manifest = parsed as CanonicalToolManifest;
  const home = resolveOverlayHome();
  if (!fs.existsSync(path.join(home, 'config.json'))) return manifest;
  return applyManifestOverlay(manifest, readManifestOverlay(home));
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function booleanField(value: unknown): boolean {
  return value === true;
}

function osSkillCapabilities(definition: JsonObject): ToolCapability {
  const permission = stringField(definition.permission) ?? 'read';
  const mutating = booleanField(definition.writesRecords)
    || booleanField(definition.externalSideEffects)
    || ['write', 'execute', 'external', 'admin'].includes(permission);

  return {
    readOnly: !mutating,
    mutating,
    deterministic: false,
    safeToRetry: !mutating,
  };
}

function projectOsSkillEntry(entry: CanonicalManifestEntry): ToolManifestEntry {
  const definition = entry.definition;
  const implementation = isObject(definition.implementation) ? definition.implementation : {};
  const implementationScript = stringField(implementation.script);

  return {
    name: entry.name,
    methodPath: ['call', entry.name],
    description: entry.description,
    category: entry.category,
    underlying: implementationScript
      ? `consuelo-os call ${entry.name} (${implementationScript})`
      : `consuelo-os call ${entry.name}`,
    capabilities: osSkillCapabilities(definition),
    defaultTimeout: 120000,
    command: {
      internal: 'os-skill',
      arguments: [],
    },
    exampleInput: {
      name: entry.name,
      input: {},
    },
    sessionRequired: false,
  };
}

function projectCanonicalEntry(entry: CanonicalManifestEntry): ToolManifestEntry {
  if (entry.kind === 'facade-tool') {
    return entry.definition as ToolManifestEntry;
  }

  return projectOsSkillEntry(entry);
}

function readManifest(): ToolManifestEntry[] {
  return readCanonicalManifest().tools.map(projectCanonicalEntry);
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
      source: 'packages/os/TOOLS.md',
    });
  }
  return docs;
}

function toolCardText(entry: ToolManifestEntry, doc?: ToolDoc): string {
  const args = entry.command?.arguments?.map((arg) => `${arg.source} ${arg.flag || ''} ${arg.kind || ''}`).join(' ') || '';
  return [
    `name: ${entry.name}`,
    `category: ${entry.category || ''}`,
    `description: ${entry.description || ''}`,
    `capabilities: readOnly=${entry.capabilities?.readOnly === true} mutating=${entry.capabilities?.mutating === true} deterministic=${entry.capabilities?.deterministic === true} safeToRetry=${entry.capabilities?.safeToRetry === true}`,
    `input schema: ${entry.inputSchema || ''}`,
    `output schema: ${entry.outputSchema || ''}`,
    `method path: ${(entry.methodPath || []).join('.')}`,
    `script: ${entry.command?.script || ''} ${entry.command?.subcommand || ''}`,
    `arguments: ${args}`,
    `example: ${JSON.stringify(entry.exampleInput || {})}`,
    `docs: ${doc?.snippet || ''}`,
  ].join('\n');
}

function buildCards(manifest: ToolManifestEntry[], docs: Map<string, ToolDoc>): ToolCard[] {
  return manifest.map((entry) => {
    const doc = docs.get(entry.name);
    const text = toolCardText(entry, doc);
    const hash = hashText(JSON.stringify({ version: TOOL_CARD_VERSION, entry, doc, text }));
    return { entry, doc, text, hash, tokens: tokensFor(text) };
  });
}

function termSet(query: string): Set<string> {
  return new Set(baseSearchTokens(query));
}
function intentMatches(pack: IntentPack, queryTerms: Set<string>): boolean {
  const hasTerm = pack.terms.some((term) => queryTerms.has(term));
  if (!hasTerm) return false;
  if (!pack.requireAny?.length) return true;
  return pack.requireAny.some((term) => queryTerms.has(term));
}

function matchedIntentPacks(query: string): IntentPack[] {
  const terms = termSet(query);
  return INTENT_PACKS.filter((pack) => intentMatches(pack, terms));
}

function computeIdf(cards: ToolCard[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const card of cards) {
    for (const token of new Set(card.tokens)) df.set(token, (df.get(token) || 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [token, count] of df) {
    idf.set(token, Math.log(1 + (cards.length - count + 0.5) / (count + 0.5)));
  }
  return idf;
}

function bm25Score(card: ToolCard, queryTokens: string[], idf: Map<string, number>, averageLength: number): number {
  const k1 = 1.2;
  const b = 0.75;
  const counts = new Map<string, number>();
  for (const token of card.tokens) counts.set(token, (counts.get(token) || 0) + 1);
  let score = 0;
  for (const token of new Set(queryTokens)) {
    const freq = counts.get(token) || 0;
    if (freq === 0) continue;
    const numerator = freq * (k1 + 1);
    const denominator = freq + k1 * (1 - b + b * (card.tokens.length / Math.max(1, averageLength)));
    score += (idf.get(token) || 0) * (numerator / denominator);
  }
  return score;
}

function cosineSimilarity(a: number[] | Float32Array, b: number[] | Float32Array): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  for (let index = 0; index < length; index += 1) dot += a[index] * b[index];
  return Math.max(0, dot);
}

function getEmbeddingRuntime(): { embedText: (text: string, options?: Record<string, unknown>) => Promise<Float32Array>; embedTexts: (texts: string[], options?: Record<string, unknown>) => Promise<Float32Array[]>; configId: string } {
  const { embedText, embedTexts } = require('./lib/index/embedder');
  const { getEmbeddingConfig, getEmbeddingConfigId } = require('./lib/index/embedding-config');
  const config = getEmbeddingConfig();
  return { embedText, embedTexts, configId: getEmbeddingConfigId(config) };
}

function embeddingsEnabled(): boolean {
  return process.env.WORKSPACE_TOOL_SEARCH_EMBEDDINGS !== '0' && process.env.WORKSPACE_TOOL_SEARCH_EMBEDDINGS !== 'false';
}

function cacheFileFor(configId: string): string {
  return path.join(os.homedir(), '.cache', 'workspace-tool-search', configId, `${TOOL_CARD_VERSION}.json`);
}

function readEmbeddingCache(configId: string): EmbeddingCache {
  const file = cacheFileFor(configId);
  if (!fs.existsSync(file)) return { version: 1, embeddingConfigId: configId, cardVersion: TOOL_CARD_VERSION, entries: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as EmbeddingCache;
    if (parsed.embeddingConfigId !== configId || parsed.cardVersion !== TOOL_CARD_VERSION || parsed.version !== 1) {
      return { version: 1, embeddingConfigId: configId, cardVersion: TOOL_CARD_VERSION, entries: {} };
    }
    return parsed;
  } catch (error: unknown) {
    void error;
    return { version: 1, embeddingConfigId: configId, cardVersion: TOOL_CARD_VERSION, entries: {} };
  }
}
function writeEmbeddingCache(configId: string, cache: EmbeddingCache): void {
  const file = cacheFileFor(configId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(cache)}\n`);
}

async function embeddingScores(query: string, cards: ToolCard[]): Promise<{ scores: Map<string, number>; diagnostics: { embeddingConfigId: string; cardsEmbedded: number; cardsReused: number; error?: string } }> {
  if (!embeddingsEnabled()) {
    return { scores: new Map(), diagnostics: { embeddingConfigId: 'disabled', cardsEmbedded: 0, cardsReused: 0 } };
  }

  try {
    const runtime = getEmbeddingRuntime();
    const cache = readEmbeddingCache(runtime.configId);
    const missing = cards.filter((card) => !cache.entries[card.hash]);
    let cardsEmbedded = 0;

    if (missing.length > 0) {
      const batchSize = Math.max(1, Math.min(Number.parseInt(process.env.WORKSPACE_TOOL_SEARCH_BATCH_SIZE || '32', 10) || 32, 64));
      for (let index = 0; index < missing.length; index += batchSize) {
        const batch = missing.slice(index, index + batchSize);
        const vectors = await runtime.embedTexts(batch.map((card) => card.text), { kind: 'document' });
        vectors.forEach((vector, vectorIndex) => {
          cache.entries[batch[vectorIndex].hash] = Array.from(vector);
          cardsEmbedded += 1;
        });
      }
      writeEmbeddingCache(runtime.configId, cache);
    }

    const queryVector = await runtime.embedText(query, { kind: 'query' });
    const scores = new Map<string, number>();
    for (const card of cards) {
      const vector = cache.entries[card.hash];
      if (!vector) continue;
      scores.set(card.hash, cosineSimilarity(queryVector, vector));
    }

    return {
      scores,
      diagnostics: {
        embeddingConfigId: runtime.configId,
        cardsEmbedded,
        cardsReused: cards.length - cardsEmbedded,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { scores: new Map(), diagnostics: { embeddingConfigId: 'error', cardsEmbedded: 0, cardsReused: 0, error: message } };
  }
}

function scoreCard(card: ToolCard, options: SearchOptions, docs: Map<string, ToolDoc>, intents: IntentPack[], bm25: number, embeddingScore: number): ScoredTool {
  const rawQuery = options.query.trim().toLowerCase();
  const queryTokens = expandTokens(options.query);
  const meaningfulTokens = meaningfulExpandedTokens(options.query);
  const entry = card.entry;
  const name = entry.name || '';
  const nameLower = name.toLowerCase();
  const nameTokens = tokensFor(name);
  const category = (entry.category || '').toLowerCase();
  const description = normalize(entry.description || '');
  const schema = normalize(`${entry.inputSchema || ''} ${entry.outputSchema || ''}`);
  const commandText = normalize(JSON.stringify(entry.command || {}));
  const exampleText = normalize(JSON.stringify(entry.exampleInput || {}));
  const docsText = normalize(docs.get(entry.name)?.snippet || '');
  const why: string[] = [];
  let meaningfulMatches = 0;
  const scoreParts: ScoreParts = { exact: 0, name: 0, lexical: 0, bm25: 0, intent: 0, capability: 0, embedding: 0 };

  if (nameLower === rawQuery) {
    scoreParts.exact += 300;
    why.push('exact tool name match');
  }
  if (rawQuery.length >= 3 && nameLower.includes(rawQuery)) {
    scoreParts.name += 100;
    why.push('tool name contains query');
  }
  if (category && rawQuery === category) {
    scoreParts.lexical += 24;
    why.push('category match');
  }
  if (nameTokens.join(' ') === normalize(options.query)) {
    scoreParts.name += 70;
    why.push('tool name matches query phrase');
  }

  for (const token of queryTokens) {
    if (!token) continue;
    const isMeaningfulToken = meaningfulTokens.has(token);
    let tokenMatched = false;
    if (nameTokens.includes(token)) {
      scoreParts.name += 22;
      why.push(`name token: ${token}`);
      tokenMatched = true;
    } else if (nameTokens.some((nameToken) => nameToken.startsWith(token))) {
      scoreParts.name += 16;
      why.push(`name prefix: ${token}`);
      tokenMatched = true;
    } else if (nameTokens.some((nameToken) => fuzzyTokenMatch(token, nameToken))) {
      scoreParts.name += 6;
      why.push(`fuzzy name token: ${token}`);
      tokenMatched = true;
    }

    if (category.includes(token)) { scoreParts.lexical += 8; why.push(`category token: ${token}`); tokenMatched = true; }
    if (description.includes(token)) { scoreParts.lexical += 5; tokenMatched = true; }
    if (schema.includes(token)) { scoreParts.lexical += 4; tokenMatched = true; }
    if (commandText.includes(token)) { scoreParts.lexical += 3; tokenMatched = true; }
    if (exampleText.includes(token)) { scoreParts.lexical += 2; tokenMatched = true; }
    if (docsText.includes(token)) { scoreParts.lexical += 2; tokenMatched = true; }
    if (isMeaningfulToken && tokenMatched) meaningfulMatches += 1;
  }

  scoreParts.bm25 = Math.min(60, bm25 * 18);
  if (scoreParts.bm25 > 0) why.push('bm25 tool-card match');

  const matchedIntentIds: string[] = [];
  for (const intent of intents) {
    const boost = intent.boost[entry.name] || 0;
    if (boost !== 0) {
      scoreParts.intent += boost;
      matchedIntentIds.push(intent.id);
      why.push(`intent: ${intent.label}`);
    }
  }

  const capabilities = entry.capabilities || {};
  if (options.readOnly === true && capabilities.readOnly === true) scoreParts.capability += 12;
  if (options.mutating === true && capabilities.mutating === true) scoreParts.capability += 12;
  if (hasReadIntent(options.query)) {
    if (capabilities.readOnly === true) scoreParts.capability += 14;
    if (capabilities.mutating === true) scoreParts.capability -= 10;
  }

  scoreParts.embedding = embeddingScore > 0 ? Math.min(45, embeddingScore * 45) : 0;
  if (scoreParts.embedding > 0) why.push('embedding tool-card match');

  const score = Object.values(scoreParts).reduce((sum, value) => sum + Number(value), 0);
  return { card, score, why: [...new Set(why)].slice(0, 10), meaningfulMatches, matchedIntentIds, scoreParts };
}

function workspaceCallSnippet(entry: ToolManifestEntry): string {
  const example = entry.exampleInput || {};
  if (entry.command?.internal === 'os-skill') {
    return `await workspace.call({ tool: "call", input: ${JSON.stringify(example)} })`;
  }

  const fields = [`tool: ${JSON.stringify(entry.name)}`, `input: ${JSON.stringify(example)}`];
  if (entry.sessionRequired === true) fields.push('taskSession: "<taskSession>"');
  return `await workspace.call({ ${fields.join(', ')} })`;
}

function toMatch(item: ScoredTool, includeDocs: boolean): ToolSearchMatch {
  const entry = item.card.entry;
  const inputSchema = entry.inputSchema;
  const outputSchema = entry.outputSchema;
  return {
    name: entry.name,
    ...(entry.methodPath ? { methodPath: entry.methodPath } : {}),
    ...(entry.category ? { category: entry.category } : {}),
    score: Math.round(item.score),
    scoreParts: {
      exact: Math.round(item.scoreParts.exact),
      name: Math.round(item.scoreParts.name),
      lexical: Math.round(item.scoreParts.lexical),
      bm25: Math.round(item.scoreParts.bm25),
      intent: Math.round(item.scoreParts.intent),
      capability: Math.round(item.scoreParts.capability),
      embedding: Math.round(item.scoreParts.embedding),
    },
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
    ...(includeDocs && item.card.doc ? { docs: item.card.doc } : {}),
    why: item.why,
  };
}

function filterByOptions(cards: ToolCard[], options: SearchOptions): ToolCard[] {
  return cards
    .filter((card) => !options.category || card.entry.category === options.category)
    .filter((card) => options.readOnly !== true || card.entry.capabilities?.readOnly === true)
    .filter((card) => options.mutating !== true || card.entry.capabilities?.mutating === true);
}

function chooseConfidence(matches: ScoredTool[], ambiguous: boolean): 'high' | 'medium' | 'low' {
  if (matches.length === 0) return 'low';
  const top = matches[0].score;
  const gap = top - (matches[1]?.score || 0);
  if (!ambiguous && top >= 130 && gap >= 35) return 'high';
  if (top >= 55) return 'medium';
  return 'low';
}

function buildAlternatives(intents: IntentPack[], scored: ScoredTool[], recommended?: string): Array<{ intent: string; tools: string[] }> {
  const available = new Set(scored.map((item) => item.card.entry.name));
  const groups: Array<{ intent: string; tools: string[] }> = [];
  const seen = new Set<string>();
  for (const intent of intents) {
    for (const group of intent.alternatives || []) {
      const tools = group.tools.filter((tool) => tool !== recommended && available.has(tool));
      if (tools.length === 0) continue;
      const key = `${group.intent}:${tools.join(',')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      groups.push({ intent: group.intent, tools });
    }
  }
  return groups.slice(0, 8);
}

function buildGuidance(matches: ScoredTool[], intents: IntentPack[], ambiguous: boolean): Record<string, unknown> | string {
  if (matches.length === 0) {
    return 'No matching tools found. Try broader intent keywords like "github pr", "linear issue", "file search", or "trace logs".';
  }
  const top = matches[0];
  const mutating = top.card.entry.capabilities?.mutating === true;
  const safeDefaults = intents.map((intent) => intent.safeDefault).filter(Boolean);
  const mutatingGuidance = intents.map((intent) => intent.mutatingGuidance).filter(Boolean);
  return {
    summary: 'Use the recommended tool when its intent matches the user request. Inspect alternatives when ambiguous.',
    recommendedUse: mutating ? 'Mutating recommendation; use dry-run/preview or get explicit user intent when state change is unclear.' : 'Read-only recommendation is safe for investigation.',
    ambiguous,
    safeDefaults,
    mutatingGuidance,
  };
}

async function run(options: SearchOptions): Promise<Record<string, unknown>> {
  const manifest = readManifest();
  const docs = options.includeDocs ? readToolDocs() : new Map<string, ToolDoc>();
  const allCards = buildCards(manifest, docs);
  const cards = filterByOptions(allCards, options);
  const intents = matchedIntentPacks(options.query);
  const queryTokens = expandTokens(options.query);
  const meaningfulTokens = meaningfulExpandedTokens(options.query);
  const idf = computeIdf(cards);
  const averageLength = cards.reduce((sum, card) => sum + card.tokens.length, 0) / Math.max(1, cards.length);
  let embeddings: Awaited<ReturnType<typeof embeddingScores>>;
  if (options.includeEmbeddings === false) {
    embeddings = {
      scores: new Map(),
      diagnostics: { embeddingConfigId: 'disabled', cardsEmbedded: 0, cardsReused: 0 },
    };
  } else {
    try {
      embeddings = await embeddingScores(options.query, cards);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      embeddings = {
        scores: new Map(),
        diagnostics: { embeddingConfigId: 'error', cardsEmbedded: 0, cardsReused: 0, error: message },
      };
    }
  }

  let scored = cards
    .map((card) => scoreCard(card, options, docs, intents, bm25Score(card, queryTokens, idf, averageLength), embeddings.scores.get(card.hash) || 0))
    .filter((item) => item.score >= 20)
    .filter((item) => {
      if (meaningfulTokens.size > 0) {
        return item.meaningfulMatches > 0 || item.matchedIntentIds.length > 0 || item.scoreParts.embedding >= 12 || item.scoreParts.exact > 0;
      }
      return allowsGenericOnlySearch(options.query);
    })
    .sort((a, b) => b.score - a.score || a.card.entry.name.localeCompare(b.card.entry.name));

  if (scored.length > 0 && scored[0].score < 35) scored = [];

  const recommended = scored[0]?.card.entry.name;
  const winningIntentId = scored[0]?.matchedIntentIds[0];
  const detectedIntent = winningIntentId
    ? INTENT_PACKS.find((intent) => intent.id === winningIntentId)?.label
    : intents[0]?.label;
  const alternatives = buildAlternatives(intents, scored, recommended);
  const ambiguous = alternatives.length > 0 || (scored.length > 1 && scored[0].score - scored[1].score < 18);
  const confidence = chooseConfidence(scored, ambiguous);
  const displayLimit = Math.max(1, Math.min(options.limit, 30));
  const matches = scored.slice(0, displayLimit).map((item) => toMatch(item, options.includeDocs));
  const catalogHash = hashText(JSON.stringify({ version: TOOL_CARD_VERSION, cards: allCards.map((card) => ({ name: card.entry.name, hash: card.hash })) }));
  const catalogSource = ['tool.manifest.json', ...(options.includeDocs ? ['TOOLS.md'] : [])];

  return {
    query: options.query,
    limit: options.limit,
    searchedCount: cards.length,
    returnedCount: matches.length,
    filters: {
      ...(options.category ? { category: options.category } : {}),
      ...(options.readOnly ? { readOnly: true } : {}),
      ...(options.mutating ? { mutating: true } : {}),
    },
    totalMatches: scored.length,
    confidence,
    ambiguous,
    ...(detectedIntent ? { detectedIntent } : {}),
    ...(recommended ? { recommended } : {}),
    matches,
    ...(alternatives.length > 0 ? { alternatives } : {}),
    guidance: buildGuidance(scored, intents, ambiguous),
    catalog: {
      source: catalogSource,
      catalogHash,
      toolCount: allCards.length,
      searchedCount: cards.length,
      cardVersion: TOOL_CARD_VERSION,
      embeddingConfigId: embeddings.diagnostics.embeddingConfigId,
      cardsEmbedded: embeddings.diagnostics.cardsEmbedded,
      cardsReused: embeddings.diagnostics.cardsReused,
      ...(embeddings.diagnostics.error ? { embeddingError: embeddings.diagnostics.error } : {}),
    },
  };
}

export async function runToolSearch(options: SearchOptions): Promise<Record<string, unknown>> {
  return run(options);
}

if (import.meta.main) {
  try {
    const result = await run(parseArgs(Bun.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}