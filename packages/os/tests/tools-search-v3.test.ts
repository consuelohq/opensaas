import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { runToolSearch, type SearchOptions } from '../scripts/tools-search';
import { executeTool, getToolManifestEntry } from '../scripts/lib/facade/executor';
import type { CommandPlan, ToolRunner } from '../scripts/lib/facade/types';

type SearchResult = {
  recommended?: string;
  confidence: 'high' | 'medium' | 'low';
  retrievalMode: 'exact' | 'deterministic' | 'semantic-fallback' | 'abstain';
  matches: Array<Record<string, unknown>>;
  diagnostics?: {
    semanticFallback?: boolean;
    embeddings?: { embeddingConfigId?: string };
  };
};

async function search(query: string, options: Partial<SearchOptions> = {}): Promise<SearchResult> {
  return await runToolSearch({ query, includeDocs: false, includeEmbeddings: false, ...options }) as SearchResult;
}

function runner(plans: CommandPlan[]): ToolRunner {
  return async (plan) => {
    plans.push(plan);
    return { stdout: JSON.stringify({ ok: true }), stderr: '', exitCode: 0 };
  };
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('tools.search v3 architecture', () => {
  it('has one canonical implementation and no workspace compatibility copy', () => {
    expect(existsSync(path.join(repoRoot, 'packages/workspace/scripts/tools-search.ts'))).toBe(false);
    const rootPackage = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    expect(rootPackage.scripts['tools:search']).toBe('bun packages/os/scripts/tools-search.ts');
  });

  it('marks tool discovery as runtime-owned and executes it from the OS package root', async () => {
    const entry = getToolManifestEntry('tools.search');
    expect(entry?.command.executionScope).toBe('runtime');

    const plans: CommandPlan[] = [];
    const result = await executeTool('tools.search', { query: 'git diff' }, {
      cwd: '/tmp/not-a-repo',
      runner: runner(plans),
      now: () => 1000,
      randomUUID: () => 'abc123def4567890abc123def4567890',
    });
    expect(result.ok).toBe(true);
    expect(plans).toHaveLength(1);
    expect(plans[0].cwd.split(path.sep).slice(-2).join('/')).toBe('packages/os');
  });
});

describe('tools.search v3 retrieval', () => {
  it('honors explicit provider and domain anchors before generic operations', async () => {
    expect((await search('vercel deploy')).recommended).toBe('deployment.deploy');
    expect((await search('cloudflare deploy')).recommended).toBe('deployment.deploy');
    expect((await search('github pr checks reviews status')).recommended).toBe('github');
    expect((await search('r2 object list')).recommended).toBe('deployment.raw');
  });

  it('does not manufacture a deployment answer for ambiguous generic trace/log wording', async () => {
    const result = await search('trace logs');
    expect(result.recommended).toBeUndefined();
    expect(result.confidence).toBe('low');
  });

  it('returns a compact default payload with at most three results', async () => {
    const result = await search('github pull request review comments');
    expect(result.matches.length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(result).length).toBeLessThan(3000);
    expect(result.retrievalMode).toBeDefined();
    expect(result.matches[0]).not.toHaveProperty('scoreParts');
    expect(result).not.toHaveProperty('catalog');
  });

  it('keeps expanded results bounded to five', async () => {
    const result = await search('browser page screenshot', { limit: 30 });
    expect(result.matches.length).toBeLessThanOrEqual(5);
  });

  it('keeps exact tool-name lookup deterministic', async () => {
    const result = await search('git.diff');
    expect(result.recommended).toBe('git.diff');
    expect(result.confidence).toBe('high');
    expect(result.retrievalMode).toBe('exact');
  });

  it('does not invoke semantic fallback on a confident deterministic query', async () => {
    const result = await runToolSearch({ query: 'vercel deploy', includeDocs: false, detail: 'full' }) as SearchResult;
    expect(result.recommended).toBe('deployment.deploy');
    expect(result.retrievalMode).toBe('deterministic');
    expect(result.diagnostics?.semanticFallback).toBe(false);
    expect(result.diagnostics?.embeddings?.embeddingConfigId).toBe('not-used');
  });
});
