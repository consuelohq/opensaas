import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const script = 'packages/workspace/scripts/test-selection.js';

function run(args) {
  return spawnSync('node', [script, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 16,
  });
}

function json(result) {
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout);
}

describe('test selection registry', () => {
  it('discovers and seeds the existing test inventory', () => {
    const out = path.join(os.tmpdir(), `test-selection-${Date.now()}.json`);
    const result = run(['generate', '--out', out, '--json']);
    const summary = json(result).summary;
    const registry = JSON.parse(fs.readFileSync(out, 'utf8'));

    expect(summary.testFileCount).toBeGreaterThan(2000);
    expect(summary.mappedTestCount).toBeGreaterThan(2000);
    expect(summary.explicitRuleCount).toBeGreaterThanOrEqual(10);
    expect(registry.tests.some((test) => test.path === 'packages/workspace/tests/verification.test.js')).toBe(true);
    expect(registry.rules.some((rule) => rule.id === 'workspace-publish-gate')).toBe(true);
  });

  it('selects publish-gate tests for verify changes', () => {
    const result = run(['check', '--changed-file', 'packages/workspace/scripts/verify.js', '--json']);
    const data = json(result);

    expect(data.passed).toBe(true);
    expect(data.matchedRules.map((rule) => rule.id)).toContain('workspace-publish-gate');
    expect(data.selectedSuites.map((suite) => suite.name)).toContain('workspace verification stamp tests');
    expect(data.zeroSuiteReason).toBeNull();
  });

  it('reports zero-suite warnings for unmapped code', () => {
    const result = run(['check', '--changed-file', 'packages/unknown/src/example.ts', '--json']);
    const data = json(result);

    expect(data.passed).toBe(true);
    expect(data.level).toBe('warn');
    expect(data.selectedSuites).toHaveLength(0);
    expect(data.zeroSuiteReason).toContain('changed code selected zero suites');
  });
});
