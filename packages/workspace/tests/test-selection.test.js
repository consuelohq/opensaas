import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scripts/test-selection.js');

function run(args, options = {}) {
  return spawnSync('node', [script, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 16,
    ...options,
    env: {
      ...process.env,
      ...(options.env || {}),
    },
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

    expect(summary.testFileCount).toBeGreaterThan(0);
    expect(summary.mappedTestCount).toBeGreaterThan(0);
    expect(summary.mappedTestCount).toBeLessThanOrEqual(summary.testFileCount);
    const explicitRuleIds = registry.rules.filter((rule) => rule.origin === 'explicit').map((rule) => rule.id);
    expect(explicitRuleIds).toEqual(expect.arrayContaining([
      'workspace-facade',
      'workspace-publish-gate',
      'workspace-test-selection',
    ]));
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

  it('does not treat ordinary json config changes as docs-only', () => {
    const result = run(['check', '--changed-file', 'package.json', '--json']);
    const data = json(result);

    expect(data.level).toBe('warn');
    expect(data.zeroSuiteReason).toContain('changed code selected zero suites');
  });

  it('allows explicit documentation json paths as docs-only', () => {
    const result = run(['check', '--changed-file', 'docs/example.schema.json', '--json']);
    const data = json(result);

    expect(data.level).toBe('pass');
    expect(data.zeroSuiteReason).toContain('changed files are docs');
  });

  it('fails timed out suite commands', () => {
    const registryPath = path.join(os.tmpdir(), `test-selection-timeout-${Date.now()}.json`);
    fs.writeFileSync(registryPath, JSON.stringify({
      version: 1,
      rules: [
        {
          id: 'timeout-rule',
          source: ['packages/slow/**'],
          critical: true,
          origin: 'test',
          tests: [
            {
              name: 'slow suite',
              command: [process.execPath, '-e', 'setTimeout(() => {}, 1000)'],
            },
          ],
        },
      ],
    }));

    const result = run([
      'check',
      '--registry', registryPath,
      '--changed-file', 'packages/slow/src/index.ts',
      '--run',
      '--json',
    ], { env: { TEST_SUITE_TIMEOUT_MS: '50' } });
    const data = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(data.passed).toBe(false);
    expect(data.failedSuites).toHaveLength(1);
    expect(data.failedSuites[0].status).toBe('failed');
    expect(data.failedSuites[0].error?.code).toBe('ETIMEDOUT');
  });

});
