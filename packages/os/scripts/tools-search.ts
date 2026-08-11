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

type SearchMetadata = {
  domain?: string;
  domainAliases?: string[];
  keywords?: string[];
  entities?: string[];
  hidden?: boolean;
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
    executionScope?: 'runtime' | 'workspace';
    branchMode?: string;
    branchArgumentStyle?: string;
    jsonFlag?: string;
    dryRunFlag?: string;
    arguments?: ToolCommandArgument[];
  };
  exampleInput?: Record<string, unknown>;
  sessionRequired?: boolean;
  search?: SearchMetadata;
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

type SearchDetail = 'compact' | 'full';

export type SearchOptions = {
  query: string;
  limit?: number;
  category?: string;
  readOnly?: boolean;
  mutating?: boolean;
  includeDocs?: boolean;
  includeEmbeddings?: boolean;
  detail?: SearchDetail;
};

type ToolDoc = {
  heading: string;
  snippet: string;
  source: string;
};

type ToolCard = {
  entry: ToolManifestEntry;
  doc?: ToolDoc;
  domain: string;
  namespaceTerms: Set<string>;
  domainTerms: Set<string>;
  configuredDomainAliases: Set<string>;
  operationTerms: Set<string>;
  surfaceOperationTerms: Set<string>;
  keywordTerms: Set<string>;
  entityTerms: Set<string>;
  descriptionTerms: Set<string>;
  text: string;
  hash: string;
  tokens: string[];
};

type ScoreParts = {
  exact: number;
  domain: number;
  name: number;
  operation: number;
  entity: number;
  keyword: number;
  lexical: number;
  bm25: number;
  capability: number;
  embedding: number;
};

type ScoredTool = {
  card: ToolCard;
  score: number;
  why: string[];
  scoreParts: ScoreParts;
};

type EmbeddingCache = {
  version: number;
  embeddingConfigId: string;
  cardVersion: string;
  entries: Record<string, number[]>;
};

type EmbeddingDiagnostics = {
  embeddingConfigId: string;
  cardsEmbedded: number;
  cardsReused: number;
  error?: string;
};

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(packageRoot, 'manifests', 'generated', 'tool.manifest.json');
const toolsDocPath = path.join(packageRoot, 'TOOLS.md');
const TOOL_CARD_VERSION = 'tools-search-card-v3';
const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 5;
const MAX_CANDIDATES = 8;

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'for', 'to', 'of', 'and', 'or', 'no', 'such', 'made', 'up', 'with', 'by', 'in', 'on',
  'please', 'can', 'could', 'would', 'you', 'me', 'my', 'our', 'this', 'that', 'these', 'those', 'it', 'its', 'them', 'they', 'from', 'into', 'at', 'as',
]);

// These words describe generic operations, not domains. They must never establish a domain by themselves.
const GENERIC_OPERATION_TOKENS = new Set([
  'search', 'find', 'lookup', 'read', 'get', 'view', 'check', 'checks', 'status', 'list', 'links', 'logs', 'log',
  'trace', 'inspect', 'show', 'create', 'update', 'delete', 'remove', 'write', 'edit', 'run', 'command', 'commands',
  'open', 'close', 'start', 'stop', 'sync', 'wait', 'deploy', 'redeploy', 'promote', 'generate', 'build', 'runtime', 'latest',
]);

const GENERIC_DOMAIN_TOKENS = new Set([
  'tool', 'tools', 'tooling', 'utilities', 'utility', 'workspace', 'wrapper', 'generic', 'operation', 'operations',
]);

// Common entities can select an operation inside a domain, but must not become domains themselves.
const GENERIC_ENTITY_TOKENS = new Set([
  'file', 'files', 'directory', 'directories', 'folder', 'folders',
  'pr', 'pull', 'request', 'review', 'reviews', 'comment', 'comments', 'feedback',
  'service', 'services', 'project', 'projects', 'page', 'pages', 'object', 'objects',
]);

const DOMAIN_STOP_TOKENS = new Set([
  ...GENERIC_DOMAIN_TOKENS,
  ...GENERIC_OPERATION_TOKENS,
  ...GENERIC_ENTITY_TOKENS,
]);

function normalizeText(value: string): string {
  return value
    .replace(/[._:/-]+/g, ' ')
    .replace(/[^a-zA-Z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeIdentifier(value: string): string {
  return normalizeText(value.replace(/([a-z0-9])([A-Z])/g, '$1 $2'));
}

function canonicalToken(token: string): string {
  if (token === 'prs') return 'pr';
  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss') && !token.endsWith('us') && !token.endsWith('is') && token !== 'status') {
    return token.slice(0, -1);
  }
  return token;
}

function canonicalTokens(tokens: string[]): string[] {
  return tokens.map(canonicalToken);
}

function surfaceTokensForText(value: string): string[] {
  return normalizeText(value).split(' ').filter((token) => token.length > 0 && !STOP_WORDS.has(token));
}

function surfaceTokensForIdentifier(value: string): string[] {
  return normalizeIdentifier(value).split(' ').filter((token) => token.length > 0 && !STOP_WORDS.has(token));
}

function tokensForText(value: string): string[] {
  return canonicalTokens(surfaceTokensForText(value));
}

function tokensForIdentifier(value: string): string[] {
  return canonicalTokens(surfaceTokensForIdentifier(value));
}

function meaningfulTokens(query: string): string[] {
  return tokensForText(query).filter((token) => !GENERIC_OPERATION_TOKENS.has(token));
}

function setOf(values: Iterable<string>): Set<string> {
  return new Set([...values].filter(Boolean));
}

function hashText(value: string): string {
  return createHash('sha256').update(value).digest('hex');
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

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
}

function booleanField(value: unknown): boolean {
  return value === true;
}

function osSkillCapabilities(definition: JsonObject): ToolCapability {
  const permission = stringField(definition.permission) ?? 'read';
  const mutating = booleanField(definition.writesRecords)
    || booleanField(definition.externalSideEffects)
    || ['write', 'execute', 'external', 'admin'].includes(permission);
  return { readOnly: !mutating, mutating, deterministic: false, safeToRetry: !mutating };
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
    underlying: implementationScript ? `consuelo-os call ${entry.name} (${implementationScript})` : `consuelo-os call ${entry.name}`,
    capabilities: osSkillCapabilities(definition),
    defaultTimeout: 120000,
    command: { internal: 'os-skill', arguments: [] },
    exampleInput: { name: entry.name, input: {} },
    sessionRequired: false,
    ...(isObject(definition.search) ? { search: definition.search as SearchMetadata } : {}),
  };
}

function projectCanonicalEntry(entry: CanonicalManifestEntry): ToolManifestEntry {
  if (entry.kind === 'facade-tool') return entry.definition as ToolManifestEntry;
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
    docs.set(name, { heading: headingMatch[0].trim(), snippet: compactSnippet(block), source: 'packages/os/TOOLS.md' });
  }
  return docs;
}

function domainFor(entry: ToolManifestEntry): string {
  const configured = stringField(entry.search?.domain);
  if (configured) return normalizeText(configured).replace(/\s+/g, '-');
  if (entry.name.includes('.')) return normalizeIdentifier(entry.name.split('.')[0]).replace(/\s+/g, '-');
  const category = normalizeText(entry.category || '');
  if (category && !GENERIC_DOMAIN_TOKENS.has(category)) return category.replace(/\s+/g, '-');
  return normalizeIdentifier(entry.name).replace(/\s+/g, '-');
}

function toolCardText(entry: ToolManifestEntry): string {
  const search = entry.search || {};
  return [
    entry.name,
    entry.category || '',
    entry.description || '',
    search.domain || '',
    ...(search.domainAliases || []),
    ...(search.keywords || []),
    ...(search.entities || []),
  ].join(' ');
}

function buildCards(manifest: ToolManifestEntry[], docs: Map<string, ToolDoc>): ToolCard[] {
  return manifest.map((entry) => {
    const search = entry.search || {};
    const namespaceTerms = setOf(entry.name.includes('.') ? tokensForIdentifier(entry.name.split('.')[0]) : []);
    const categoryTerms = tokensForText(entry.category || '').filter((token) => !GENERIC_DOMAIN_TOKENS.has(token));
    const configuredDomainAliases = setOf(stringArray(search.domainAliases).flatMap(tokensForText));
    const domainTerms = setOf([
      ...namespaceTerms,
      ...categoryTerms,
      ...tokensForText(search.domain || ''),
      ...configuredDomainAliases,
    ]);
    const leafName = entry.name.split('.').slice(-1)[0] || entry.name;
    const operationTerms = setOf(tokensForIdentifier(leafName));
    const surfaceOperationTerms = setOf(surfaceTokensForIdentifier(leafName));
    const keywordTerms = setOf(stringArray(search.keywords).flatMap(tokensForText));
    const entityTerms = setOf(stringArray(search.entities).flatMap(tokensForText));
    const descriptionTerms = setOf(tokensForText(entry.description || ''));
    const text = toolCardText(entry);
    const hash = hashText(JSON.stringify({ version: TOOL_CARD_VERSION, name: entry.name, text }));
    return {
      entry,
      doc: docs.get(entry.name),
      domain: domainFor(entry),
      namespaceTerms,
      domainTerms,
      configuredDomainAliases,
      operationTerms,
      surfaceOperationTerms,
      keywordTerms,
      entityTerms,
      descriptionTerms,
      text,
      hash,
      tokens: tokensForText(text),
    };
  });
}

function filterByOptions(cards: ToolCard[], options: SearchOptions): ToolCard[] {
  return cards
    .filter((card) => !options.category || card.entry.category === options.category)
    .filter((card) => options.readOnly !== true || card.entry.capabilities?.readOnly === true)
    .filter((card) => options.mutating !== true || card.entry.capabilities?.mutating === true);
}

type DomainIndex = {
  hard: Map<string, Set<string>>;
  soft: Map<string, Set<string>>;
  softCounts: Map<string, Map<string, number>>;
};

function addDomain(map: Map<string, Set<string>>, token: string, domain: string, explicit = false): void {
  if (!token || (!explicit && DOMAIN_STOP_TOKENS.has(token))) return;
  const values = map.get(token) || new Set<string>();
  values.add(domain);
  map.set(token, values);
}

function buildDomainIndex(cards: ToolCard[]): DomainIndex {
  const hard = new Map<string, Set<string>>();
  const soft = new Map<string, Set<string>>();
  const softCounts = new Map<string, Map<string, number>>();
  for (const card of cards) {
    for (const token of card.domainTerms) addDomain(hard, token, card.domain, card.configuredDomainAliases.has(token));
    const descriptorTokens = new Set([...card.descriptionTerms, ...card.keywordTerms, ...card.entityTerms]);
    for (const token of descriptorTokens) {
      if (DOMAIN_STOP_TOKENS.has(token)) continue;
      addDomain(soft, token, card.domain);
      const counts = softCounts.get(token) || new Map<string, number>();
      counts.set(card.domain, (counts.get(card.domain) || 0) + 1);
      softCounts.set(token, counts);
    }
  }
  return { hard, soft, softCounts };
}

function detectDomains(query: string, index: DomainIndex): { domains: Set<string>; terms: string[] } {
  const domains = new Set<string>();
  const matchedTerms: string[] = [];
  for (const token of tokensForText(query)) {
    const hardDomains = index.hard.get(token);
    if (hardDomains?.size) {
      for (const domain of hardDomains) domains.add(domain);
      matchedTerms.push(token);
      continue;
    }
    if (GENERIC_OPERATION_TOKENS.has(token)) continue;
    const softDomains = index.soft.get(token);
    if (softDomains?.size !== 1) continue;
    const domain = [...softDomains][0];
    const count = index.softCounts.get(token)?.get(domain) || 0;
    if (count < 2) continue;
    domains.add(domain);
    matchedTerms.push(token);
  }
  return { domains, terms: [...new Set(matchedTerms)] };
}

function computeIdf(cards: ToolCard[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const card of cards) {
    for (const token of new Set(card.tokens)) df.set(token, (df.get(token) || 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [token, count] of df) idf.set(token, Math.log(1 + (cards.length - count + 0.5) / (count + 0.5)));
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

function overlapCount(tokens: string[], values: Set<string>): number {
  let count = 0;
  for (const token of new Set(tokens)) if (values.has(token)) count += 1;
  return count;
}

function cheapCandidateScore(card: ToolCard, queryTokens: string[], anchoredDomains: Set<string>, idf: Map<string, number>): number {
  let score = anchoredDomains.has(card.domain) ? 80 : 0;
  const nameTerms = setOf(tokensForIdentifier(card.entry.name));
  for (const token of new Set(queryTokens)) {
    const weight = Math.max(1, idf.get(token) || 1);
    const genericScale = (GENERIC_OPERATION_TOKENS.has(token) || GENERIC_ENTITY_TOKENS.has(token))
      && !anchoredDomains.has(card.domain) ? 0.15 : 1;
    if (nameTerms.has(token)) score += 20 * weight * genericScale;
    if (card.operationTerms.has(token)) score += 24 * weight * genericScale;
    if (card.entityTerms.has(token)) score += 22 * weight * (GENERIC_ENTITY_TOKENS.has(token) ? 0.3 : 1);
    if (card.keywordTerms.has(token)) score += 16 * weight;
    if (card.configuredDomainAliases.has(token)) score += 30 * weight;
    else if (card.domainTerms.has(token)) score += 14 * weight;
    if (card.descriptionTerms.has(token)) score += 4 * weight;
  }
  return score;
}

function scoreCard(card: ToolCard, options: SearchOptions, anchoredDomains: Set<string>, idf: Map<string, number>, averageLength: number, embeddingScore = 0): ScoredTool {
  const rawQuery = options.query.trim().toLowerCase();
  const queryTokens = tokensForText(options.query);
  const nameTokens = setOf(tokensForIdentifier(card.entry.name));
  const why: string[] = [];
  const scoreParts: ScoreParts = { exact: 0, domain: 0, name: 0, operation: 0, entity: 0, keyword: 0, lexical: 0, bm25: 0, capability: 0, embedding: 0 };

  if (card.entry.name.toLowerCase() === rawQuery) {
    scoreParts.exact = 1000;
    why.push('exact tool name');
  }
  if (anchoredDomains.has(card.domain)) {
    scoreParts.domain = 90;
    why.push(`domain: ${card.domain}`);
  }
  if (normalizeIdentifier(card.entry.name) === normalizeText(options.query)) scoreParts.name += 90;

  const queryTokenSet = new Set(queryTokens);
  const surfaceQueryTokenSet = new Set(surfaceTokensForText(options.query));
  for (const token of queryTokenSet) {
    const weight = Math.min(3.5, Math.max(1, idf.get(token) || 1));
    const genericScale = (GENERIC_OPERATION_TOKENS.has(token) || GENERIC_ENTITY_TOKENS.has(token))
      && !anchoredDomains.has(card.domain) ? 0.15 : 1;
    if (nameTokens.has(token)) scoreParts.name += 18 * weight * genericScale;
    if (card.operationTerms.has(token)) scoreParts.operation += 28 * weight * genericScale;
    if (card.entityTerms.has(token)) scoreParts.entity += 24 * weight * (GENERIC_ENTITY_TOKENS.has(token) ? 0.25 : 1);
    if (card.keywordTerms.has(token)) scoreParts.keyword += 18 * weight * ((GENERIC_OPERATION_TOKENS.has(token) || GENERIC_ENTITY_TOKENS.has(token)) ? 0.3 : 1);
    if (card.configuredDomainAliases.has(token)) scoreParts.domain += 34 * weight;
    else if (card.domainTerms.has(token)) scoreParts.domain += 12 * weight;
    if (card.descriptionTerms.has(token)) scoreParts.lexical += 4 * weight;
  }
  if (card.operationTerms.size > 0 && [...card.operationTerms].every((token) => queryTokenSet.has(token))) {
    scoreParts.operation += 24;
  }
  if (card.surfaceOperationTerms.size > 0 && [...card.surfaceOperationTerms].every((token) => surfaceQueryTokenSet.has(token))) {
    scoreParts.operation += 30;
  }

  scoreParts.bm25 = Math.min(40, bm25Score(card, queryTokens, idf, averageLength) * 10);
  const capabilities = card.entry.capabilities || {};
  if (options.readOnly === true && capabilities.readOnly === true) scoreParts.capability += 12;
  if (options.mutating === true && capabilities.mutating === true) scoreParts.capability += 12;
  scoreParts.embedding = embeddingScore > 0 ? Math.min(35, embeddingScore * 35) : 0;
  if (scoreParts.embedding > 0) why.push('semantic fallback');

  const score = Object.values(scoreParts).reduce((sum, value) => sum + value, 0);
  return { card, score, why, scoreParts };
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
  return process.env.CONSUELO_TOOL_SEARCH_EMBEDDINGS !== '0' && process.env.CONSUELO_TOOL_SEARCH_EMBEDDINGS !== 'false';
}

function cacheFileFor(configId: string): string {
  return path.join(os.homedir(), '.cache', 'consuelo-tool-search', configId, `${TOOL_CARD_VERSION}.json`);
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
  } catch {
    return { version: 1, embeddingConfigId: configId, cardVersion: TOOL_CARD_VERSION, entries: {} };
  }
}

function writeEmbeddingCache(configId: string, cache: EmbeddingCache): void {
  const file = cacheFileFor(configId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(cache)}\n`);
}

async function embeddingScores(query: string, cards: ToolCard[]): Promise<{ scores: Map<string, number>; diagnostics: EmbeddingDiagnostics }> {
  if (!embeddingsEnabled()) return { scores: new Map(), diagnostics: { embeddingConfigId: 'disabled', cardsEmbedded: 0, cardsReused: 0 } };
  try {
    const runtime = getEmbeddingRuntime();
    const cache = readEmbeddingCache(runtime.configId);
    const missing = cards.filter((card) => !cache.entries[card.hash]);
    let cardsEmbedded = 0;
    if (missing.length > 0) {
      const batchSize = Math.max(1, Math.min(Number.parseInt(process.env.CONSUELO_TOOL_SEARCH_BATCH_SIZE || '32', 10) || 32, 64));
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
      if (vector) scores.set(card.hash, cosineSimilarity(queryVector, vector));
    }
    return { scores, diagnostics: { embeddingConfigId: runtime.configId, cardsEmbedded, cardsReused: cards.length - cardsEmbedded } };
  } catch (error: unknown) {
    return { scores: new Map(), diagnostics: { embeddingConfigId: 'error', cardsEmbedded: 0, cardsReused: 0, error: error instanceof Error ? error.message : String(error) } };
  }
}

function confidenceFor(scored: ScoredTool[], anchoredDomains: Set<string>, exact: boolean): 'high' | 'medium' | 'low' {
  if (exact) return 'high';
  if (scored.length === 0) return 'low';
  const top = scored[0].score;
  const gap = top - (scored[1]?.score || 0);
  if (anchoredDomains.size > 0 && top >= 90 && gap >= 10) return 'high';
  if (top >= 80 && gap >= 16) return 'high';
  if (top >= 48 && gap >= 7) return 'medium';
  return 'low';
}

function compactCapabilities(capabilities: ToolCapability | undefined): Pick<ToolCapability, 'readOnly' | 'mutating'> {
  return { readOnly: capabilities?.readOnly === true, mutating: capabilities?.mutating === true };
}

function toCompactMatch(item: ScoredTool): Record<string, unknown> {
  const entry = item.card.entry;
  const inputSchema = entry.inputSchema;
  return {
    name: entry.name,
    ...(entry.category ? { category: entry.category } : {}),
    ...(entry.description ? { description: entry.description } : {}),
    capabilities: compactCapabilities(entry.capabilities),
    ...(inputSchema && schemaTypeSignatures[inputSchema] ? { inputSignature: schemaTypeSignatures[inputSchema] } : {}),
    ...(entry.sessionRequired === true ? { sessionRequired: true } : {}),
  };
}

function workspaceCallSnippet(entry: ToolManifestEntry): string {
  const example = entry.exampleInput || {};
  if (entry.command?.internal === 'os-skill') return `await workspace.call({ tool: "call", input: ${JSON.stringify(example)} })`;
  const fields = [`tool: ${JSON.stringify(entry.name)}`, `input: ${JSON.stringify(example)}`];
  if (entry.sessionRequired === true) fields.push('taskSession: "<taskSession>"');
  return `await workspace.call({ ${fields.join(', ')} })`;
}

function toFullMatch(item: ScoredTool, includeDocs: boolean): Record<string, unknown> {
  const entry = item.card.entry;
  const inputSchema = entry.inputSchema;
  const outputSchema = entry.outputSchema;
  return {
    ...toCompactMatch(item),
    ...(entry.methodPath ? { methodPath: entry.methodPath } : {}),
    score: Math.round(item.score),
    scoreParts: Object.fromEntries(Object.entries(item.scoreParts).map(([key, value]) => [key, Math.round(value)])),
    ...(inputSchema ? { inputSchema } : {}),
    ...(outputSchema ? { outputSchema } : {}),
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

function parseArgs(argv: string[]): SearchOptions {
  let query = '';
  let limit = DEFAULT_LIMIT;
  let category: string | undefined;
  let readOnly: boolean | undefined;
  let mutating: boolean | undefined;
  let includeDocs = false;
  let includeEmbeddings = true;
  let detail: SearchDetail = 'compact';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--query' || arg === '-q') { query = argv[++index] || ''; continue; }
    if (arg === '--limit') { const parsed = Number(argv[++index]); if (Number.isFinite(parsed) && parsed > 0) limit = Math.min(Math.floor(parsed), MAX_LIMIT); continue; }
    if (arg === '--category') { category = argv[++index] || undefined; continue; }
    if (arg === '--read-only') { readOnly = true; continue; }
    if (arg === '--mutating') { mutating = true; continue; }
    if (arg === '--full') { detail = 'full'; continue; }
    if (arg === '--detail') { detail = argv[++index] === 'full' ? 'full' : 'compact'; continue; }
    if (arg === '--with-docs') { includeDocs = true; continue; }
    if (arg === '--no-docs') { includeDocs = false; continue; }
    if (arg === '--no-embeddings') { includeEmbeddings = false; continue; }
    if (arg === '--json') continue;
    if (!arg.startsWith('-') && !query) query = arg;
  }
  query = query.trim();
  if (!query) throw new Error('tools.search requires a query');
  return { query, limit, category, readOnly, mutating, includeDocs, includeEmbeddings, detail };
}

async function run(options: SearchOptions): Promise<Record<string, unknown>> {
  const detail = options.detail || 'compact';
  const requestedLimit = options.limit ?? DEFAULT_LIMIT;
  const displayLimit = Math.max(1, Math.min(requestedLimit, MAX_LIMIT));
  const includeDocs = detail === 'full' && options.includeDocs === true;
  const docs = includeDocs ? readToolDocs() : new Map<string, ToolDoc>();
  const allCards = buildCards(readManifest(), docs);
  const filteredCards = filterByOptions(allCards, options);
  const exact = filteredCards.find((card) => card.entry.name.toLowerCase() === options.query.trim().toLowerCase());
  const cards = exact ? filteredCards : filteredCards.filter((card) => card.entry.search?.hidden !== true);
  const queryTokens = tokensForText(options.query);
  const meaningful = meaningfulTokens(options.query);
  const idf = computeIdf(cards);
  const averageLength = cards.reduce((sum, card) => sum + card.tokens.length, 0) / Math.max(1, cards.length);
  const domainIndex = buildDomainIndex(cards);
  const detectedDomains = detectDomains(options.query, domainIndex);
  let retrievalMode: 'exact' | 'deterministic' | 'semantic-fallback' | 'abstain' = 'deterministic';
  let candidatesBeforeRanking = 0;
  let shortlist: ToolCard[] = [];
  let embeddingDiagnostics: EmbeddingDiagnostics = { embeddingConfigId: 'not-used', cardsEmbedded: 0, cardsReused: 0 };
  let embeddingMap = new Map<string, number>();

  if (exact) {
    retrievalMode = 'exact';
    shortlist = [exact];
    candidatesBeforeRanking = 1;
  } else if (meaningful.length === 0) {
    retrievalMode = 'abstain';
  } else {
    const distinctiveQueryTerms = new Set(queryTokens.filter((token) => !GENERIC_OPERATION_TOKENS.has(token) && !GENERIC_ENTITY_TOKENS.has(token)));
    const gated = detectedDomains.domains.size > 0
      ? cards.filter((card) => detectedDomains.domains.has(card.domain)
        || [...distinctiveQueryTerms].some((token) => card.operationTerms.has(token) || card.keywordTerms.has(token)))
      : cards;
    const cheap = gated
      .map((card) => ({ card, score: cheapCandidateScore(card, queryTokens, detectedDomains.domains, idf) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.card.entry.name.localeCompare(b.card.entry.name));
    candidatesBeforeRanking = cheap.length;
    shortlist = cheap.slice(0, MAX_CANDIDATES).map((item) => item.card);
  }

  let scored = shortlist
    .map((card) => scoreCard(card, options, detectedDomains.domains, idf, averageLength))
    .sort((a, b) => b.score - a.score || a.card.entry.name.localeCompare(b.card.entry.name));
  let confidence = confidenceFor(scored, detectedDomains.domains, Boolean(exact));
  let ambiguous = scored.length > 1 && scored[0].score - scored[1].score < 10;

  const semanticAllowed = !exact && retrievalMode !== 'abstain' && options.includeEmbeddings !== false && meaningful.length > 0;
  if (semanticAllowed && (scored.length === 0 || confidence === 'low' || (detectedDomains.domains.size === 0 && ambiguous))) {
    const eligible = detectedDomains.domains.size > 0 ? cards.filter((card) => detectedDomains.domains.has(card.domain)) : cards;
    const embeddings = await embeddingScores(options.query, eligible);
    embeddingDiagnostics = embeddings.diagnostics;
    if (embeddings.scores.size > 0) {
      retrievalMode = 'semantic-fallback';
      embeddingMap = embeddings.scores;
      const semanticTop = eligible
        .map((card) => ({ card, score: embeddingMap.get(card.hash) || 0 }))
        .filter((item) => item.score >= 0.18)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_CANDIDATES)
        .map((item) => item.card);
      const merged = new Map<string, ToolCard>();
      for (const card of [...shortlist, ...semanticTop]) merged.set(card.entry.name, card);
      shortlist = [...merged.values()].slice(0, MAX_CANDIDATES);
      scored = shortlist
        .map((card) => scoreCard(card, options, detectedDomains.domains, idf, averageLength, embeddingMap.get(card.hash) || 0))
        .sort((a, b) => b.score - a.score || a.card.entry.name.localeCompare(b.card.entry.name));
      confidence = confidenceFor(scored, detectedDomains.domains, false);
      ambiguous = scored.length > 1 && scored[0].score - scored[1].score < 10;
    }
  }

  if (scored.length === 0) retrievalMode = 'abstain';
  const recommended = confidence === 'low' ? undefined : scored[0]?.card.entry.name;
  const visibleScored = scored.slice(0, displayLimit);
  const matches = visibleScored.map((item) => detail === 'full' ? toFullMatch(item, includeDocs) : toCompactMatch(item));
  const base: Record<string, unknown> = {
    query: options.query,
    confidence,
    ambiguous,
    retrievalMode,
    ...(recommended ? { recommended } : {}),
    matches,
  };

  if (detail === 'full') {
    const compactPayloadBytes = Buffer.byteLength(JSON.stringify({
      query: options.query,
      confidence,
      ambiguous,
      retrievalMode,
      ...(recommended ? { recommended } : {}),
      matches: visibleScored.map(toCompactMatch),
    }));
    const catalogHash = hashText(JSON.stringify({ version: TOOL_CARD_VERSION, cards: allCards.map((card) => ({ name: card.entry.name, hash: card.hash })) }));
    base.diagnostics = {
      compactPayloadBytes,
      domainAnchors: detectedDomains.terms,
      domains: [...detectedDomains.domains],
      candidatesBeforeRanking,
      candidatesRanked: shortlist.length,
      returnedCount: matches.length,
      semanticFallback: retrievalMode === 'semantic-fallback',
      catalogHash,
      toolCount: allCards.length,
      searchedCount: cards.length,
      cardVersion: TOOL_CARD_VERSION,
      embeddings: embeddingDiagnostics,
    };
  }

  if (detail === 'full') (base.diagnostics as Record<string, unknown>).payloadBytes = Buffer.byteLength(JSON.stringify(base));
  return base;
}

export async function runToolSearch(options: SearchOptions): Promise<Record<string, unknown>> {
  return run(options);
}

if (import.meta.main) {
  try {
    const result = await run(parseArgs(Bun.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error: unknown) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
