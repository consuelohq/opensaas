import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const packageFile = (path: string) => new URL(`../${path}`, import.meta.url);
const repoFile = (path: string) => new URL(`../../../${path}`, import.meta.url);
const read = (path: string) => readFileSync(packageFile(path), 'utf8');

const observePages = [
  ['observe/index.mdx', 'Overview'],
  ['observe/runs.mdx', 'Runs'],
  ['observe/traces.mdx', 'Traces'],
  ['observe/tool-calls.mdx', 'Tool calls'],
  ['observe/artifacts.mdx', 'Artifacts'],
  ['observe/logs.mdx', 'Logs'],
  ['observe/debugging-failures.mdx', 'Debugging failures'],
] as const;

describe('Observe documentation contract', () => {
  test('publishes the complete approved Observe hierarchy in navigation order', () => {
    const navigation = read('src/lib/docs-navigation.ts');
    const orderedLabels = [
      "label: 'Overview', slug: 'observe'",
      "label: 'Runs', slug: 'observe/runs'",
      "label: 'Traces', slug: 'observe/traces'",
      "label: 'Tool calls', slug: 'observe/tool-calls'",
      "label: 'Artifacts', slug: 'observe/artifacts'",
      "label: 'Logs', slug: 'observe/logs'",
      "label: 'Debugging failures', slug: 'observe/debugging-failures'",
    ];
    let previousIndex = -1;
    for (const needle of orderedLabels) {
      const currentIndex = navigation.indexOf(needle, previousIndex + 1);
      expect(currentIndex).toBeGreaterThan(previousIndex);
      previousIndex = currentIndex;
    }
    for (const [sourcePath] of observePages) {
      expect(existsSync(packageFile(`src/content/docs/${sourcePath}`))).toBe(true);
    }
  });

  test('marks every Observe page as preview and records current evidence', () => {
    for (const [sourcePath] of observePages) {
      const source = read(`src/content/docs/${sourcePath}`);
      expect(source).toContain('status: preview');
      expect(source).toContain('verifiedAt: 2026-07-13');
      expect(source).toContain('evidence:');
      expect(source).toContain('source:');
      expect(source).toContain('tests:');
      expect(source).toContain('runtime:');
      expect(source).not.toContain('Use this section to understand what ran, what changed, and why.');
    }
  });

  test('references evidence files that exist in the current repository', () => {
    for (const [sourcePath] of observePages) {
      const source = read(`src/content/docs/${sourcePath}`);
      const evidencePaths = [
        ...source.matchAll(/^\s*- source: (packages\/[^\n]+)$/gm),
        ...source.matchAll(/^\s+- (packages\/[^\n]+)$/gm),
      ].map((match) => match[1]);
      expect(evidencePaths.length).toBeGreaterThan(0);
      for (const evidencePath of evidencePaths) {
        expect(existsSync(repoFile(evidencePath))).toBe(true);
      }
    }
  });

  test('teaches the verified distinction between runs, traces, and tool calls', () => {
    const overview = read('src/content/docs/observe/index.mdx');
    for (const term of ['run', 'trace', 'tool call', 'artifact', 'log']) {
      expect(overview.toLowerCase()).toContain(term);
    }

    const runs = read('src/content/docs/observe/runs.mdx');
    expect(runs).toContain('skill_executions');
    expect(runs).toContain('execution_events');
    expect(runs).toContain('doctor:watch');
    expect(runs).toContain('doctor:analytics');
    expect(runs).toContain('started');
    expect(runs).toContain('succeeded');
    expect(runs).toContain('failed');

    const toolCalls = read('src/content/docs/observe/tool-calls.mdx');
    expect(toolCalls).toContain('tool_traces');
    expect(toolCalls).toContain('taskSession');
    expect(toolCalls).toContain('branch');
    expect(toolCalls).toContain('worktree');
    expect(toolCalls).toContain('context -- trace');
  });

  test('documents the current trace surface and its degraded states honestly', () => {
    const traces = read('src/content/docs/observe/traces.mdx');
    expect(traces).toContain('/gateway/traces/recent');
    expect(traces).toContain('/gateway/traces/events');
    expect(traces).toContain('Consuelo gateway');
    expect(traces).toContain('bridge-required');
    expect(traces).toContain('stale');
    expect(traces).toContain('degraded');
    expect(traces).not.toContain('browser connects directly to localhost');
    expect(traces).not.toContain('full distributed trace');
  });

  test('documents artifact provenance, local diagnostics, and redaction boundaries', () => {
    const artifacts = read('src/content/docs/observe/artifacts.mdx');
    expect(artifacts).toContain('artifacts -- history');
    expect(artifacts).toContain('traceId');
    expect(artifacts).toContain('contentSha256');
    expect(artifacts).toContain('immutable');

    const logs = read('src/content/docs/observe/logs.mdx');
    expect(logs).toContain('doctor:errors');
    expect(logs).toContain('stderr');
    expect(logs).toContain('[REDACTED_SECRET]');
    expect(logs).toContain('Do not put secrets');
  });

  test('gives a symptom-first failure workflow using trace IDs and error codes', () => {
    const debugging = read('src/content/docs/observe/debugging-failures.mdx');
    expect(debugging).toContain('trace ID');
    expect(debugging).toContain('error code');
    expect(debugging).toContain('SKILL_NOT_FOUND');
    expect(debugging).toContain('TRACE_STORE_UNAVAILABLE');
    expect(debugging).toContain('gateway');
  });

  test('keeps a checked-in Observe claim ledger and replaces the speculative legacy page', () => {
    const ledger = read('evidence/observe-claims.md');
    for (const heading of ['Claim', 'Public page', 'Source code', 'Tests', 'Runtime verification', 'Status']) {
      expect(ledger).toContain(heading);
    }
    expect(ledger).toContain('skill_executions');
    expect(ledger).toContain('tool_traces');
    expect(ledger).toContain('Consuelo gateway');
    expect(ledger).toContain('redaction');

    expect(existsSync(packageFile('src/content/docs/os/concepts/observability.mdx'))).toBe(false);
    const redirects = read('src/lib/legacy-redirects.mjs');
    expect(redirects).toContain("'/os/concepts/observability': '/observe/'");
  });
});
