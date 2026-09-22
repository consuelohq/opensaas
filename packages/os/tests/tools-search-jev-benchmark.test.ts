import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  assertJevBudget,
  buildJevDecisionRequest,
  encodeJevCatalog,
  estimateJevMaximumCostUsd,
  parseJevDecisionResponse,
  resolveJevBenchmarkConfig,
  type JevCatalogEntry,
} from '../scripts/tools-search-jev-benchmark';

const catalog: JevCatalogEntry[] = [
  { name: 'deployment.logs', category: 'deployment', description: 'read deployment logs', domainAliases: ['vercel'], keywords: ['runtime'], entities: ['logs'] },
  { name: 'fs.list', category: 'filesystem', description: 'list files in a directory' },
  { name: 'internal.hidden', category: 'internal', description: 'hidden helper', hidden: true },
];

describe('Jev tool-search benchmark adapter', () => {
  it('encodes visible tools into stable provider-safe choice ids plus abstain', () => {
    const encoded = encodeJevCatalog(catalog);
    expect(encoded.options).toEqual([
      expect.objectContaining({ id: 'tool_000', toolName: 'deployment.logs' }),
      expect.objectContaining({ id: 'tool_001', toolName: 'fs.list' }),
    ]);
    expect(encoded.criteria.tool_000).toContain('deployment.logs');
    expect(encoded.criteria.tool_000).toContain('vercel');
    expect(encoded.criteria.tool_000).toContain('runtime');
    expect(encoded.criteria.tool_001).toContain('fs.list');
    expect(encoded.criteria.none).toContain('No listed tool');
    expect(encoded.toolByChoice.get('tool_000')).toBe('deployment.logs');
    expect(encoded.toolByChoice.has('none')).toBe(false);
  });

  it('builds one typed choice question for the user query', () => {
    const encoded = encodeJevCatalog(catalog);
    const request = buildJevDecisionRequest({
      query: 'show vercel deployment logs',
      model: 'typesafe/jev-1.13',
      criteria: encoded.criteria,
    });
    expect(request.model).toBe('typesafe/jev-1.13');
    expect(request.state).toEqual({ query: 'show vercel deployment logs' });
    expect(request.questions.route.type).toBe('choice');
    expect(request.questions.route.criteria).toEqual(encoded.criteria);
    expect(request.questions.route.instructions).toContain('single Consuelo tool');
  });

  it('maps Jev choice probabilities back to the existing search result contract', () => {
    const encoded = encodeJevCatalog(catalog);
    const parsed = parseJevDecisionResponse({
      response: {
        answers: {
          route: {
            choice: 'tool_001',
            probabilities: {
              tool_001: 0.72,
              tool_000: 0.23,
              none: 0.05,
            },
            confidence: 0.72,
          },
        },
        usage: {
          input_tokens: 321,
          output_tokens: 0,
          cost: 0.000013482,
        },
      },
      encoded,
      latencyMs: 18,
    });

    expect(parsed.searchResult.recommended).toBe('fs.list');
    expect(parsed.searchResult.matches?.map((match) => match.name)).toEqual(['fs.list', 'deployment.logs']);
    expect(parsed.searchResult.confidence).toBe('high');
    expect(parsed.searchResult.retrievalMode).toBe('jev');
    expect(parsed.provider.latencyMs).toBe(18);
    expect(parsed.provider.inputTokens).toBe(321);
    expect(parsed.provider.costUsd).toBeCloseTo(0.000013482);
  });

  it('maps the explicit none choice to an abstention', () => {
    const encoded = encodeJevCatalog(catalog);
    const parsed = parseJevDecisionResponse({
      response: {
        answers: {
          route: {
            choice: 'none',
            probabilities: {
              none: 0.82,
              tool_000: 0.12,
              tool_001: 0.06,
            },
          },
        },
      },
      encoded,
      latencyMs: 11,
    });

    expect(parsed.searchResult.recommended).toBeUndefined();
    expect(parsed.searchResult.matches?.map((match) => match.name)).toEqual(['deployment.logs', 'fs.list']);
    expect(parsed.searchResult.confidence).toBe('high');
  });

  it('preflights the complete paid run against a conservative byte-as-token ceiling', () => {
    const requests = [
      { model: 'typesafe/jev-1.13', state: { query: 'a' }, questions: {} },
      { model: 'typesafe/jev-1.13', state: { query: 'b' }, questions: {} },
    ];
    const expected = requests.reduce((sum, request) => sum + Buffer.byteLength(JSON.stringify(request)), 0)
      * (0.042 / 1_000_000);
    expect(estimateJevMaximumCostUsd(requests)).toBeCloseTo(expected);
    expect(() => assertJevBudget({ requests, maxCostUsd: expected + 0.000001 })).not.toThrow();
    expect(() => assertJevBudget({ requests, maxCostUsd: expected / 2 })).toThrow(/budget/i);
  });

  it('uses environment-only credentials and allows model/budget overrides without exposing the key', () => {
    const config = resolveJevBenchmarkConfig({
      OPENROUTER_API_KEY: 'secret-test-key',
      JEV_MODEL: 'typesafe/jev-latest',
      JEV_BENCHMARK_MAX_COST_USD: '0.12',
    });
    expect(config.model).toBe('typesafe/jev-latest');
    expect(config.maxCostUsd).toBe(0.12);
    expect(config.apiKey).toBe('secret-test-key');
    expect(JSON.stringify(config.safeSummary)).not.toContain('secret-test-key');
    expect(config.safeSummary.hasApiKey).toBe(true);
  });

  it('exposes a stable package script for rerunning the Jev benchmark', async () => {
    const osPackage = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    const rootPackage = JSON.parse(await readFile(new URL('../../../package.json', import.meta.url), 'utf8'));
    expect(osPackage.scripts['tools:search:benchmark:jev']).toBe('bun ./scripts/tools-search-jev-benchmark.ts');
    expect(rootPackage.scripts['tools:search:benchmark:jev']).toBe('bun packages/os/scripts/tools-search-jev-benchmark.ts');
  });

});
