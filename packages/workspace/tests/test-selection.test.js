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

  it('routes current OS Trace inspector changes only to existing OS-owned suites', () => {
    const rulesPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../test-selection.rules.json',
    );
    const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    const rule = rules.rules.find((candidate) => candidate.id === 'trace-site-pagination');
    const serialized = JSON.stringify(rule);

    expect(rule).toBeDefined();
    expect(rule.source).toContain('packages/os/scripts/lib/trace-site-inspector/**');
    expect(serialized).not.toContain('packages/workspace/scripts/trace-site-inspector');
    expect(serialized).not.toContain('packages/workspace/tests/trace-site-inspector');
    expect(serialized).not.toContain('trace-gateway-service.test.ts');

    const result = run([
      'check',
      '--changed-file',
      'packages/os/scripts/lib/trace-site-inspector/table-formatters.ts',
      '--json',
    ]);
    const data = json(result);
    const suites = data.selectedSuites.filter(
      (suite) => suite.ruleId === 'trace-site-pagination',
    );

    expect(data.matchedRules.map((matched) => matched.id)).toContain(
      'trace-site-pagination',
    );
    expect(suites.length).toBeGreaterThan(0);
    for (const suite of suites) {
      expect(JSON.stringify(suite.command)).toContain('packages/os');
      expect(JSON.stringify(suite.command)).not.toContain('packages/workspace');
    }
  });

  it('suppresses a broad auto package suite when explicit critical coverage fully owns the changed code', () => {
    const registryPath = path.join(
      os.tmpdir(),
      `test-selection-explicit-coverage-${Date.now()}.json`,
    );
    fs.writeFileSync(
      registryPath,
      JSON.stringify({
        version: 1,
        rules: [
          {
            id: 'explicit-critical',
            source: ['packages/example/src/safe.ts'],
            critical: true,
            origin: 'explicit',
            tests: [{ name: 'focused suite', command: [process.execPath, '-e', ''] }],
          },
          {
            id: 'auto:example:package-test',
            source: ['packages/example/**'],
            critical: false,
            origin: 'auto',
            tests: [{ name: 'broad package suite', command: [process.execPath, '-e', 'void 0'] }],
          },
        ],
      }),
    );

    const covered = json(
      run([
        'check',
        '--registry',
        registryPath,
        '--changed-file',
        'packages/example/src/safe.ts',
        '--json',
      ]),
    );
    expect(covered.selectedSuites.map((suite) => suite.name)).toEqual([
      'focused suite',
    ]);

    const uncovered = json(
      run([
        'check',
        '--registry',
        registryPath,
        '--changed-file',
        'packages/example/src/other.ts',
        '--json',
      ]),
    );
    expect(uncovered.selectedSuites.map((suite) => suite.name)).toContain(
      'broad package suite',
    );
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
  it('can restrict selection to the committed diff so CI ignores install-time workspace noise', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'test-selection-committed-only-'));
    fs.copyFileSync(script, path.join(repo, 'test-selection.js'));
    fs.writeFileSync(
      path.join(repo, 'registry.json'),
      JSON.stringify({
        version: 1,
        rules: [
          {
            id: 'noise-suite',
            source: ['packages/twenty-sdk/**'],
            tests: [{ name: 'noise suite', command: [process.execPath, '-e', ''] }],
            critical: false,
            reason: 'fixture',
            origin: 'auto',
          },
        ],
      }),
    );
    spawnSync('git', ['init'], { cwd: repo });
    spawnSync('git', ['config', 'user.email', 'ci@example.invalid'], { cwd: repo });
    spawnSync('git', ['config', 'user.name', 'CI'], { cwd: repo });
    fs.writeFileSync(path.join(repo, 'README.md'), 'base\n');
    spawnSync('git', ['add', '.'], { cwd: repo });
    spawnSync('git', ['commit', '-m', 'base'], { cwd: repo });
    fs.mkdirSync(path.join(repo, 'packages/twenty-sdk'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'packages/twenty-sdk/install-noise.ts'), 'export {};\n');

    const result = spawnSync(
      'node',
      [path.join(repo, 'test-selection.js'), 'check', '--registry', 'registry.json', '--base', 'HEAD', '--committed-only', '--json'],
      { cwd: repo, encoding: 'utf8' },
    );
    expect(result.status).toBe(0);
    const data = JSON.parse(result.stdout);
    expect(data.changedFiles).toEqual([]);
    expect(data.selectedSuites).toEqual([]);
  });


  it('runs focused Consuelo OS contracts with Bun, OS cwd, and root Vitest', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'packages/workspace/test-selection.registry.json'), 'utf8'));
    const rules = new Map(registry.rules.map((rule) => [rule.id, rule]));
    for (const id of ['os-workspace-edge-rollout', 'os-lifecycle-legacy-mcp-scrub']) {
      const rule = rules.get(id);
      expect(rule).toBeTruthy();
      for (const suite of rule.tests) {
        const offset = suite.command[0] === 'env' ? 2 : 0;
        expect(suite.command.slice(offset, offset + 5)).toEqual([
          'bun', '--cwd', 'packages/os', '../../node_modules/vitest/vitest.mjs', 'run',
        ]);
      }
    }
  });

  it('uses focused GitHub source-control contracts instead of the broad OS package suite', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/os/cloudflare/os-device-authority/src/app.ts',
      '--changed-file',
      'packages/os/cloudflare/os-device-authority/src/stores.ts',
      '--changed-file',
      'packages/os/cloudflare/os-device-authority/src/types.ts',
      '--changed-file',
      'packages/os/cloudflare/os-device-authority/src/worker.ts',
      '--changed-file',
      'packages/os/scripts/lib/settings-site.ts',
      '--changed-file',
      'packages/os/tests/settings-site.test.ts',
      '--changed-file',
      'packages/os/cloudflare/os-device-authority/src/routes/github-source-control.ts',
      '--changed-file',
      'packages/os/cloudflare/os-device-authority/src/services/github-source-control.ts',
      '--changed-file',
      'packages/os/scripts/lib/github-source-control-client.ts',
      '--changed-file',
      'packages/os/scripts/lib/source-control-config.ts',
      '--changed-file',
      'packages/os/scripts/server/routes/settings.ts',
      '--changed-file',
      'packages/os/scripts/server/services/diffs-gateway.ts',
      '--changed-file',
      'packages/os/tests/github-source-control-authority.test.ts',
      '--changed-file',
      'packages/os/tests/diffs-hono-routes.test.ts',
      '--changed-file',
      'packages/os/tests/settings-hono-routes.test.ts',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);
    const suiteNames = data.selectedSuites.map((suite) => suite.name);

    expect(matchedRuleIds).toContain('os-github-source-control');
    expect(suiteNames).toEqual(['OS GitHub source-control contracts']);
  });

});
