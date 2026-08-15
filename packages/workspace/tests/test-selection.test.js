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
    expect(new Set(explicitRuleIds).size).toBe(explicitRuleIds.length);
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
      registry.rules.find(
        (rule) => rule.id === 'auto:@consuelo/os:package-test',
      )?.tests[0]?.command,
    ).toEqual(['bun', 'run', '--cwd', 'packages/os', 'test']);
    const explicitTwentyFront = registry.rules.find(
      (rule) => rule.id === 'twenty-front-project',
    );
    expect(explicitTwentyFront?.tests[0]?.command).toEqual([
      'npx',
      'nx',
      'test',
      'twenty-front',
      '--coverage=false',
    ]);

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

  it('uses focused one-click managed cloud contracts instead of the broad OS package suite', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/os/cloudflare/os-device-authority/src/routes/managed-cloud-provisioning.ts',
      '--changed-file',
      'packages/os/scripts/lib/settings-site.ts',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);
    const suiteNames = data.selectedSuites.map((suite) => suite.name);

    expect(matchedRuleIds).toContain('os-managed-cloud-one-click-provisioning');
    expect(matchedRuleIds).not.toContain('auto:@consuelo/os:package-test');
    expect(suiteNames).toEqual(
      expect.arrayContaining([
        'OS one-click managed cloud contracts',
        'OS one-click managed cloud syntax contracts',
      ]),
    );
  });

  it('uses focused cloud-first auth onboarding contracts instead of the broad OS package suite', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts',
      '--changed-file',
      'packages/os/cloudflare/os-device-authority/src/services/cloud-first-onboarding.ts',
      '--changed-file',
      'packages/os/tests/cloud-first-web-onboarding.test.ts',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);
    const suiteNames = data.selectedSuites.map((suite) => suite.name);

    expect(matchedRuleIds).toContain('os-cloud-first-auth-onboarding');
    expect(matchedRuleIds).not.toContain('auto:@consuelo/os:package-test');
    expect(suiteNames).toEqual(
      expect.arrayContaining([
        'OS cloud-first auth onboarding contracts',
        'OS cloud-first auth onboarding Worker contract',
        'OS cloud-first auth onboarding syntax contracts',
      ]),
    );
  });

  it('uses focused canonical device approval contracts instead of the broad OS package suite', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts',
      '--changed-file',
      'packages/os/cloudflare/os-device-authority/src/routes/install-control-plane.ts',
      '--changed-file',
      'packages/os/scripts/lib/install-control-plane.ts',
      '--changed-file',
      'packages/consuelo-website/src/pages/login/device.astro',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);
    const suiteNames = data.selectedSuites.map((suite) => suite.name);

    expect(matchedRuleIds).toContain('os-device-approval-canonical-identity');
    expect(matchedRuleIds).not.toContain('auto:@consuelo/os:package-test');
    expect(suiteNames).toEqual([
      'OS canonical device approval contracts',
      'OS canonical device approval syntax contracts',
    ]);
  });

  it('uses focused ChatGPT MCP OAuth contracts instead of the broad OS package suite', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/os/cloudflare/os-device-authority/src/routes/mcp-oauth.ts',
      '--changed-file',
      'packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts',
      '--changed-file',
      'packages/os/tests/operator-oauth-client.test.ts',
      '--changed-file',
      'packages/os/tests/os-device-authority-worker.test.ts',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);
    const suiteNames = data.selectedSuites.map((suite) => suite.name);

    expect(matchedRuleIds).toContain('os-chatgpt-mcp-oauth');
    expect(matchedRuleIds).not.toContain('auto:@consuelo/os:package-test');
    expect(suiteNames).toEqual([
      'OS ChatGPT MCP OAuth contracts',
      'OS ChatGPT MCP OAuth syntax contracts',
      'OS canonical device approval contracts',
    ]);
  });

  it('uses focused ChatGPT node-routing facade contracts instead of the broad OS package suite', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/os/scripts/lib/mcp-gateway.ts',
      '--changed-file',
      'packages/os/scripts/os.ts',
      '--changed-file',
      'packages/os/tests/mcp-gateway.test.ts',
      '--changed-file',
      'packages/os/tests/os-get-steering-trace.test.ts',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);
    const suiteNames = data.selectedSuites.map((suite) => suite.name);

    expect(matchedRuleIds).toContain('os-chatgpt-node-routing-facade');
    expect(matchedRuleIds).not.toContain('auto:@consuelo/os:package-test');
    expect(suiteNames).toEqual([
      'OS ChatGPT node-routing facade contracts',
      'OS ChatGPT node-routing authority contracts',
      'OS ChatGPT node-routing syntax contracts',
    ]);
  });

  it('uses focused launcher copy interaction contracts instead of the broad OS package suite', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/os/scripts/lib/launcher-onboarding.ts',
      '--changed-file',
      'packages/consuelo-website/src/pages/os/launcher.astro',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);
    const suiteNames = data.selectedSuites.map((suite) => suite.name);

    expect(matchedRuleIds).toContain('os-launcher-copy-interaction');
    expect(matchedRuleIds).not.toContain('auto:@consuelo/os:package-test');
    expect(suiteNames).toEqual([
      'OS launcher copy interaction contracts',
      'OS launcher Sites materialization contracts',
      'Consuelo website launcher Astro check',
    ]);
  });

  it('uses focused OS release freshness contracts instead of the broad OS package suite', () => {
    const result = run([
      'check',
      '--changed-file',
      '.github/workflows/consuelo-os-runtime-publish.yaml',
      '--changed-file',
      'packages/os/package.json',
      '--changed-file',
      'packages/workspace/scripts/os-release.ts',
      '--changed-file',
      'packages/workspace/scripts/os-release-workspace-edge.ts',
      '--changed-file',
      'packages/workspace/scripts/os-release-device-auth.ts',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);
    const suiteNames = data.selectedSuites.map((suite) => suite.name);

    expect(matchedRuleIds).toContain('os-release-surface-freshness');
    expect(matchedRuleIds).not.toContain('auto:@consuelo/os:package-test');
    expect(suiteNames).toEqual(
      expect.arrayContaining([
        'OS release freshness contracts',
        'Workspace production release contracts',
        'Workspace Edge release dry run',
      ]),
    );
  });

  it('uses focused hosted-site reconciliation contracts instead of the broad OS package suite', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts',
      '--changed-file',
      'packages/os/cloudflare/os-device-authority/src/services/connectors.ts',
      '--changed-file',
      'packages/os/scripts/lib/lifecycle/engine.ts',
      '--changed-file',
      'packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts',
      '--changed-file',
      'packages/os/tests/cloudflare-d1-route-registry.test.ts',
      '--changed-file',
      'packages/os/tests/install-edge-site-publisher.test.ts',
      '--changed-file',
      'packages/os/tests/lifecycle-engine.test.ts',
      '--changed-file',
      'packages/os/tests/workspace-node-registry-routing.test.ts',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);
    const suiteNames = data.selectedSuites.map((suite) => suite.name);

    expect(matchedRuleIds).toContain('os-hosted-site-update-reconciliation');
    expect(matchedRuleIds).toContain('os-managed-cloud-one-click-provisioning');
    expect(matchedRuleIds).toContain('os-workspace-edge-rollout');
    expect(suiteNames).not.toContain('@consuelo/os package test');
    expect(suiteNames).toEqual(
      expect.arrayContaining([
        'OS hosted-site D1 reconciliation contract',
        'OS hosted-site lifecycle and node routing contracts',
      ]),
    );
  });

  it('uses the frozen OS Bun lock contract instead of the broad OS package suite', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/os/bun.lock',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);
    const suiteNames = data.selectedSuites.map((suite) => suite.name);
    const lockSuite = data.selectedSuites.find(
      (suite) => suite.name === 'OS Bun frozen lockfile contract',
    );

    expect(matchedRuleIds).toContain('os-bun-lockfile-consistency');
    expect(suiteNames).toContain('OS Bun frozen lockfile contract');
    expect(suiteNames).not.toContain('@consuelo/os package test');
    expect(lockSuite?.command).toEqual([
      'bun',
      'install',
      '--cwd',
      'packages/os',
      '--frozen-lockfile',
      '--lockfile-only',
      '--dry-run',
    ]);
  });

  it('uses the focused OS install-state inventory contract instead of the broad OS package suite', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/os/tests/install-state.test.ts',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);
    const suiteNames = data.selectedSuites.map((suite) => suite.name);
    const installStateSuite = data.selectedSuites.find(
      (suite) => suite.name === 'OS install-state tool inventory contract',
    );

    expect(matchedRuleIds).toContain('os-install-state-tool-inventory');
    expect(suiteNames).toContain('OS install-state tool inventory contract');
    expect(suiteNames).not.toContain('@consuelo/os package test');
    expect(installStateSuite?.command).toEqual([
      'bun',
      '--cwd',
      'packages/os',
      'test',
      'tests/install-state.test.ts',
    ]);
  });

  it('uses the focused Consuelo CI planner contract instead of the broad OS package suite', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/os/scripts/ci-plan.ts',
      '--changed-file',
      'packages/os/tests/ci-plan.test.ts',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);
    const suiteNames = data.selectedSuites.map((suite) => suite.name);

    expect(matchedRuleIds).toContain('consuelo-ci-planner');
    expect(matchedRuleIds).not.toContain('auto:@consuelo/os:package-test');
    expect(suiteNames).toEqual(['Consuelo CI planner contracts']);
  });

  it('uses the focused OS runtime-bundle distribution contract instead of the broad OS package suite', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/os/tests/distribution/runtime-bundle.test.ts',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);
    const suiteNames = data.selectedSuites.map((suite) => suite.name);
    const runtimeBundleSuite = data.selectedSuites.find(
      (suite) => suite.name === 'OS runtime-bundle distribution contract',
    );

    expect(matchedRuleIds).toContain('os-runtime-bundle-distribution-contract');
    expect(suiteNames).toContain('OS runtime-bundle distribution contract');
    expect(suiteNames).not.toContain('@consuelo/os package test');
    expect(runtimeBundleSuite?.command).toEqual([
      'bun',
      '--cwd',
      'packages/os',
      'test',
      'tests/distribution/runtime-bundle.test.ts',
    ]);
  });

  it('uses focused Vitest runtime regression contracts for verifier-only OS test fixes', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/os/tests/operator-login.test.ts',
      '--changed-file',
      'packages/os/tests/runtime-state.test.ts',
      '--changed-file',
      'packages/os/tests/node-resource-lock.test.ts',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);

    expect(matchedRuleIds).toContain('os-vitest-runtime-regressions');
    expect(matchedRuleIds).not.toContain('auto:@consuelo/os:package-test');
    expect(data.selectedSuites.map((suite) => suite.name)).toContain(
      'OS Vitest runtime regression contracts',
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

  it('uses focused M1 call-start compatibility contracts instead of the full Twenty server suite', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-call-start.service.ts',
      '--changed-file',
      'packages/twenty-server/src/engine/core-modules/consuelo-api/infrastructure/twenty-dialer-call-start.infrastructure.ts',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);

    expect(matchedRuleIds).toContain('twenty-migration-call-start-orchestration');
    expect(matchedRuleIds).not.toContain('twenty-server-project');
    expect(matchedRuleIds).not.toContain('auto:twenty-server:test');
    expect(data.selectedSuites).toHaveLength(1);
    expect(data.selectedSuites[0]).toMatchObject({
      name: 'Twenty call-start compatibility contracts',
      ruleId: 'twenty-migration-call-start-orchestration',
    });
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


  it('routes daemon startup managed Sites refresh through focused lifecycle coverage', () => {
    const data = json(run([
      'check',
      '--changed-file',
      'packages/os/scripts/start-consuelo-daemon.sh',
      '--json',
    ]));

    expect(data.matchedRules.map((rule) => rule.id)).toContain(
      'os-lifecycle-legacy-mcp-scrub',
    );
    expect(data.selectedSuites.map((suite) => suite.name)).not.toContain(
      '@consuelo/os package test',
    );
    const lifecycleSuite = data.selectedSuites.find(
      (suite) => suite.ruleId === 'os-lifecycle-legacy-mcp-scrub',
    );
    expect(lifecycleSuite?.command).toEqual(expect.arrayContaining([
      'tests/finish-line-lifecycle-contract.test.ts',
      'tests/daemon-bun-path.test.ts',
    ]));
  });

  it('routes lifecycle updater changes through the focused universal handoff contracts', () => {
    const data = json(run([
      'check',
      '--changed-file',
      'packages/os/scripts/lifecycle.ts',
      '--json',
    ]));

    expect(data.matchedRules.map((rule) => rule.id)).toContain(
      'os-lifecycle-update-handoff',
    );
    expect(data.matchedRules.map((rule) => rule.id)).not.toContain(
      'auto:@consuelo/os:package-test',
    );
    expect(data.selectedSuites.map((suite) => suite.name)).toEqual(
      expect.arrayContaining([
        'OS lifecycle update handoff contracts',
        'OS lifecycle syntax contracts',
      ]),
    );
  });

  it('routes native macOS menu changes through focused Mac contracts', () => {
    const data = json(run([
      'check',
      '--changed-file',
      'packages/os/native/macos/Sources/ConsueloMacCore/Presentation.swift',
      '--changed-file',
      'packages/os/scripts/testing/macos-alpha-package.sh',
      '--changed-file',
      'packages/os/tests/macos-platform.test.ts',
      '--json',
    ]));

    expect(data.matchedRules.map((rule) => rule.id)).toContain(
      'os-macos-menu-app',
    );
    expect(data.matchedRules.map((rule) => rule.id)).not.toContain(
      'auto:@consuelo/os:package-test',
    );
    expect(data.selectedSuites.map((suite) => suite.name)).toEqual([
      'macOS menu Swift contracts',
      'macOS menu platform contracts',
      'macOS alpha package syntax',
    ]);
  });

  it('uses focused native menu node discovery contracts instead of the broad OS package suite', () => {
    const data = json(run([
      'check',
      '--changed-file',
      'packages/os/scripts/lib/native-lifecycle-endpoint.ts',
      '--changed-file',
      'packages/os/scripts/lib/operator-token-store.ts',
      '--changed-file',
      'packages/os/scripts/lib/workspace-node-heartbeat-client.ts',
      '--json',
    ]));

    expect(data.matchedRules.map((rule) => rule.id)).toContain(
      'os-native-menu-node-discovery',
    );
    expect(data.matchedRules.map((rule) => rule.id)).not.toContain(
      'auto:@consuelo/os:package-test',
    );
    expect(data.selectedSuites.map((suite) => suite.name)).toEqual(
      expect.arrayContaining([
        'OS native lifecycle node discovery contracts',
        'OS node heartbeat script contracts',
        'OS operator login contracts',
        'OS node heartbeat client contracts',
        'OS workspace node routing contracts',
        'OS native menu node discovery syntax contracts',
      ]),
    );
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

});
