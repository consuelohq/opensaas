import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../scripts/test-selection.js',
);

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
    const explicitRuleIds = registry.rules
      .filter((rule) => rule.origin === 'explicit')
      .map((rule) => rule.id);
    expect(explicitRuleIds).toEqual(
      expect.arrayContaining([
        'workspace-facade',
        'workspace-publish-gate',
        'workspace-test-selection',
      ]),
    );
    expect(
      registry.tests.some(
        (test) => test.path === 'packages/workspace/tests/verification.test.js',
      ),
    ).toBe(true);
    expect(
      registry.rules.some((rule) => rule.id === 'workspace-publish-gate'),
    ).toBe(true);
    expect(
      registry.rules.find((rule) => rule.id === 'frontend-lint-config-contract')
        ?.exclusive,
    ).toBe(true);
    expect(
      registry.rules.find(
        (rule) => rule.id === 'auto:@consuelo/dialer-server:package-test',
      ),
    ).toBeUndefined();
    expect(
      registry.rules.find(
        (rule) => rule.id === 'auto:@consuelo/lead-connector:package-test',
      ),
    ).toBeUndefined();
    expect(
      registry.rules.find((rule) => rule.id === 'auto:@consuelo/os:package-test')
        ?.tests[0]?.command,
    ).toEqual(['bun', 'run', '--cwd', 'packages/os', 'test']);
    const autoTwentyShared = registry.rules.find(
      (rule) => rule.id === 'auto:twenty-shared:test',
    );
    expect(autoTwentyShared?.tests[0]?.command).toEqual([
      'npx',
      'nx',
      'test',
      'twenty-shared',
      '--coverage=false',
    ]);
  });

  it('uses exclusive frontend config contracts instead of unrelated package suites', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/twenty-front/eslint.config.mjs',
      '--changed-file',
      'packages/twenty-ui/eslint.config.mjs',
      '--changed-file',
      'packages/eslint-rules/eslint.config.react.mjs',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);
    const suiteNames = data.selectedSuites.map((suite) => suite.name);

    expect(matchedRuleIds).toContain('frontend-lint-config-contract');
    expect(matchedRuleIds).not.toContain('twenty-front-project');
    expect(matchedRuleIds).not.toContain('auto:twenty-front:test');
    expect(matchedRuleIds).not.toContain('auto:twenty-ui:test');
    expect(matchedRuleIds).not.toContain('auto:twenty-eslint-rules:test');
    expect(suiteNames).toEqual(
      expect.arrayContaining([
        'changed frontend lint helper tests',
        'GitHub workflow policy tests',
        'changed GitHub workflow security checks',
        'changed frontend files lint',
      ]),
    );
  });

  it('keeps runtime source on the broader project suite alongside an exclusive config contract', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/twenty-front/eslint.config.mjs',
      '--changed-file',
      'packages/twenty-front/src/modules/dialer/hooks/useDialer.ts',
      '--json',
    ]);
    const data = json(result);
    const configRule = data.matchedRules.find(
      (rule) => rule.id === 'frontend-lint-config-contract',
    );
    const projectRule = data.matchedRules.find(
      (rule) => rule.id === 'twenty-front-project',
    );

    expect(configRule?.matchedFiles).toEqual([
      'packages/twenty-front/eslint.config.mjs',
    ]);
    expect(projectRule?.matchedFiles).toEqual([
      'packages/twenty-front/src/modules/dialer/hooks/useDialer.ts',
    ]);
    expect(data.selectedSuites.map((suite) => suite.name)).toContain(
      'twenty-front test target',
    );
  });

  it('uses the focused OS artifact contract for the metering manifest removal', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/os/scripts/artifacts-design.ts',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);

    expect(matchedRuleIds).toContain('obsolete-metering-artifact-contract');
    expect(matchedRuleIds).not.toContain('auto:@consuelo/os:package-test');
    expect(data.selectedSuites.map((suite) => suite.name)).toEqual([
      'OS artifact manifest contract',
    ]);
  });

  it('uses the focused native OS workflow contracts for Windows workflow assertions', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/os/tests/windows-platform.test.ts',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);

    expect(matchedRuleIds).toContain('native-os-workflow-contract');
    expect(matchedRuleIds).not.toContain('auto:@consuelo/os:package-test');
    expect(data.selectedSuites.map((suite) => suite.name)).toEqual([
      'native OS selector tests',
      'native Windows workflow contracts',
      'GitHub workflow policy tests',
      'changed GitHub workflow security checks',
    ]);
  });

  it('uses the API package Jest configuration for API changes', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/api/src/routes/parallel.ts',
      '--json',
    ]);
    const data = json(result);
    const apiSuite = data.selectedSuites.find(
      (suite) => suite.ruleId === 'api-package',
    );

    expect(apiSuite?.command).toEqual([
      'bunx',
      'jest',
      '--config',
      'packages/api/jest.config.mjs',
      '--runInBand',
    ]);
  });

  it('selects the Hono dialer-server suite for standalone server changes', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/dialer-server/src/app.ts',
      '--json',
    ]);
    const data = json(result);
    const serverSuite = data.selectedSuites.find(
      (suite) => suite.ruleId === 'dialer-server-package',
    );

    expect(serverSuite?.command).toEqual([
      'bun',
      'test',
      'packages/dialer-server/src',
    ]);
  });

  it('selects LeadConnector provider contracts for integration package changes', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/lead-connector/src/application/oauth.ts',
      '--json',
    ]);
    const data = json(result);
    const providerSuite = data.selectedSuites.find(
      (suite) => suite.ruleId === 'lead-connector-package',
    );

    expect(providerSuite?.command).toEqual([
      'bun',
      'test',
      'packages/lead-connector/src',
    ]);
  });

  it('selects publish-gate tests for verify changes', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/workspace/scripts/verify.js',
      '--json',
    ]);
    const data = json(result);

    expect(data.passed).toBe(true);
    expect(data.matchedRules.map((rule) => rule.id)).toContain(
      'workspace-publish-gate',
    );
    expect(data.selectedSuites.map((suite) => suite.name)).toContain(
      'workspace verification stamp tests',
    );
    expect(data.zeroSuiteReason).toBeNull();
  });

  it('reports zero-suite warnings for unmapped code', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/unknown/src/example.ts',
      '--json',
    ]);
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
    const result = run([
      'check',
      '--changed-file',
      'docs/example.schema.json',
      '--json',
    ]);
    const data = json(result);

    expect(data.level).toBe('pass');
    expect(data.zeroSuiteReason).toContain('changed files are docs');
  });

  it('propagates the selected base to suite commands', () => {
    const registryPath = path.join(
      os.tmpdir(),
      `test-selection-base-${Date.now()}.json`,
    );
    fs.writeFileSync(
      registryPath,
      JSON.stringify({
        version: 1,
        rules: [
          {
            id: 'base-env-rule',
            source: ['packages/base-env/**'],
            critical: true,
            origin: 'test',
            tests: [
              {
                name: 'base environment suite',
                command: [
                  process.execPath,
                  '-e',
                  "if (process.env.NX_BASE !== 'origin/custom-base' || process.env.BASE_REF !== 'origin/custom-base') process.exit(1)",
                ],
              },
            ],
          },
        ],
      }),
    );

    const result = run([
      'check',
      '--registry',
      registryPath,
      '--base',
      'origin/custom-base',
      '--changed-file',
      'packages/base-env/src/index.ts',
      '--run',
      '--json',
    ]);
    const data = json(result);

    expect(data.failedSuites).toHaveLength(0);
    expect(data.runResults[0]?.status).toBe('passed');
  });

  it('fails timed out suite commands', () => {
    const registryPath = path.join(
      os.tmpdir(),
      `test-selection-timeout-${Date.now()}.json`,
    );
    fs.writeFileSync(
      registryPath,
      JSON.stringify({
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
      }),
    );

    const result = run(
      [
        'check',
        '--registry',
        registryPath,
        '--changed-file',
        'packages/slow/src/index.ts',
        '--run',
        '--json',
      ],
      { env: { TEST_SUITE_TIMEOUT_MS: '50' } },
    );
    const data = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(data.passed).toBe(false);
    expect(data.failedSuites).toHaveLength(1);
    expect(data.failedSuites[0].status).toBe('failed');
    expect(data.failedSuites[0].error?.code).toBe('ETIMEDOUT');
  });
});
