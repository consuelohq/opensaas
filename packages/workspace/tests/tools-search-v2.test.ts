import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
type ToolMatch = {
  name: string;
  score: number;
  scoreParts?: Record<string, number | boolean | string>;
  capabilities?: { readOnly?: boolean; mutating?: boolean };
  why?: string[];
};

type ToolSearchPayload = {
  query: string;
  limit: number;
  searchedCount: number;
  returnedCount: number;
  totalMatches: number;
  confidence: 'high' | 'medium' | 'low';
  ambiguous: boolean;
  detectedIntent?: string;
  recommended?: string;
  matches: ToolMatch[];
  alternatives?: Array<{ intent: string; tools: string[] }>;
  guidance: unknown;
  catalog?: {
    source: string[];
    catalogHash: string;
    toolCount: number;
    cardsEmbedded: number;
    cardsReused: number;
  };
};

const packageRoot = join(import.meta.dirname, '..');
const toolSearchScript = join(packageRoot, 'scripts', 'tools-search.ts');

function runSearch(query: string, args: string[] = []): ToolSearchPayload {
  const result = spawnSync('bun', [toolSearchScript, query, '--json', ...args], {
    cwd: packageRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      WORKSPACE_TOOL_SEARCH_EMBEDDINGS: '0',
    },
  });

  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as ToolSearchPayload;
}

function names(payload: ToolSearchPayload): string[] {
  return payload.matches.map((match) => match.name);
}

describe('tools.search v2 intent resolution', () => {
  it('ranks cleanup above PR tools for abandon/delete branch intent while preserving alternatives', () => {
    const payload = runSearch('task close abandon delete branch pr', ['--limit', '3']);
    const resultNames = names(payload);

    expect(payload.searchedCount).toBeGreaterThan(payload.returnedCount);
    expect(payload.recommended).toBe('task.cleanup');
    expect(resultNames[0]).toBe('task.cleanup');
    expect(resultNames).toContain('task.pr');
    expect(resultNames).toContain('task.prs');
    expect(payload.ambiguous).toBe(true);
    expect(payload.alternatives?.some((group) => group.tools.includes('task.prs'))).toBe(true);
    expect(payload.alternatives?.some((group) => group.tools.includes('task.pr'))).toBe(true);
  });

  it('prefers read-only task PR link inspection for show/list wording', () => {
    const payload = runSearch('show task pr links', ['--limit', '3']);
    const resultNames = names(payload);

    expect(payload.recommended).toBe('task.prs');
    expect(resultNames[0]).toBe('task.prs');
    expect(payload.matches[0].capabilities?.readOnly).toBe(true);
    expect(resultNames).toContain('task.pr');
  });

  it('keeps exact tool names as the strongest signal', () => {
    const payload = runSearch('fs.apply_patch', ['--limit', '5']);
    expect(payload.recommended).toBe('fs.apply_patch');
    expect(names(payload)[0]).toBe('fs.apply_patch');
  });

  it('covers filesystem search/read/list and mutating file operations with safety guidance', () => {
    expect(names(runSearch('grep file contents for pattern', ['--limit', '5']))[0]).toBe('fs.search');
    expect(names(runSearch('read file lines', ['--limit', '5']))[0]).toBe('fs.read');
    expect(names(runSearch('list files in folder tree', ['--limit', '5']))[0]).toBe('fs.list');

    const writePayload = runSearch('write patch file contents', ['--limit', '8']);
    const writeNames = names(writePayload);
    expect(writeNames).toContain('fs.write');
    expect(writeNames).toContain('fs.apply_patch');
    expect(String(JSON.stringify(writePayload.guidance))).toContain('mutating');
  });

  it('routes programmable repo runtime and structured file work to code.call', () => {
    for (const query of [
      'run bun package command',
      'run tests package script',
      'syntax typecheck package scripts',
      'exact cli reproduction',
      'structured file rewrite python',
      'multi file transformation',
      'inspect many files and summarize',
      'generate files with bun script',
    ]) {
      const payload = runSearch(query, ['--limit', '5']);
      expect(payload.recommended, query).toBe('code.call');
      expect(names(payload)[0], query).toBe('code.call');
    }
  });

  it('keeps task and stream workflow tools ahead of code.call', () => {
    const expectations: Array<[string, string]> = [
      ['task push changed files', 'task.push'],
      ['task current existing branch worktree', 'task.current'],
      ['merge git task branch conflict', 'task.merge'],
      ['finish completed task branch', 'task.finish'],
      ['stream sync branch', 'stream.sync'],
    ];

    for (const [query, expected] of expectations) {
      const payload = runSearch(query, ['--limit', '8']);
      expect(payload.recommended, query).toBe(expected);
      expect(names(payload)[0], query).toBe(expected);
    }
  });

  it('keeps literal file and anchored patch operations on typed fs tools', () => {
    expect(runSearch('read file lines', ['--limit', '5']).recommended).toBe('fs.read');
    expect(runSearch('grep file contents for pattern', ['--limit', '5']).recommended).toBe('fs.search');
    expect(runSearch('search codebase with rg', ['--limit', '5']).recommended).toBe('fs.search');
    expect(runSearch('list directory files', ['--limit', '5']).recommended).toBe('fs.list');
    expect(runSearch('apply anchored patch', ['--limit', '5']).recommended).toBe('fs.apply_patch');
    expect(runSearch('write patch file contents', ['--limit', '5']).recommended).toBe('fs.apply_patch');
  });

  it('does not let caller display limit hide strong task alternatives', () => {
    const payload = runSearch('task close abandon delete branch pr', ['--limit', '1']);

    expect(payload.matches).toHaveLength(1);
    expect(payload.matches[0].name).toBe('task.cleanup');
    expect(payload.alternatives?.some((group) => group.tools.includes('task.pr'))).toBe(true);
    expect(payload.alternatives?.some((group) => group.tools.includes('task.prs'))).toBe(true);
  });

  it('reports live two-source catalog and cache diagnostics without inventing tools', () => {
    const payload = runSearch('no-such-made-up-tool', ['--limit', '5']);
    const manifest = JSON.parse(readFileSync(join(packageRoot, 'tooling', 'tool-manifest.json'), 'utf8')) as unknown[];
    expect(payload.catalog?.source).toEqual(['tool-manifest.json', 'TOOLS.md']);
    expect(payload.catalog?.toolCount).toBeGreaterThan(50);
    expect(payload.catalog?.toolCount).toBe(manifest.length);
    expect(payload.catalog?.catalogHash).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.matches).toEqual([]);
    expect(payload.recommended).toBeUndefined();
  });

  it('omits TOOLS.md from catalog sources when docs are skipped', () => {
    const payload = runSearch('linear issue', ['--limit', '3', '--no-docs']);
    expect(payload.catalog?.source).toEqual(['tool-manifest.json']);
    expect(payload.recommended).toBe('linear.issue');
    expect(payload.detectedIntent).toBe('read or search Linear issues');
  });
});