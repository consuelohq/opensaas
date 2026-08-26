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
  }, 15_000);

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
    expect(rule.source).toContain('packages/os/scripts/lib/trace-cost-estimator.ts');
    expect(serialized).not.toContain('packages/workspace/scripts/trace-site-inspector');
    expect(serialized).not.toContain('packages/workspace/tests/trace-site-inspector');
    expect(serialized).not.toContain('trace-gateway-service.test.ts');

    const result = run([
      'check',
      '--changed-file',
      'packages/os/scripts/lib/trace-cost-estimator.ts',
      '--json',
    ]);
    const data = json(result);
    const suites = data.selectedSuites.filter(
      (suite) => suite.ruleId === 'trace-site-pagination',
    );

    expect(data.matchedRules.map((matched) => matched.id)).toContain(
      'trace-site-pagination',
    );
    expect(data.matchedRules.map((matched) => matched.id)).not.toContain(
      'auto:@consuelo/os:package-test',
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

  it('uses focused bundled-skill contracts instead of the broad OS package suite', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/os/skills/branch/skill.json',
      '--changed-file',
      'packages/os/skills/skills.json',
      '--changed-file',
      'packages/os/tests/branch-skill.test.ts',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);
    const suiteNames = data.selectedSuites.map((suite) => suite.name);

    expect(matchedRuleIds).toContain('os-bundled-skill-contract');
    expect(matchedRuleIds).not.toContain('auto:@consuelo/os:package-test');
    expect(suiteNames).toEqual([
      'OS bundled skill contracts',
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
      '--changed-file',
      'packages/os/scripts/lib/nodes-site.ts',
      '--changed-file',
      'packages/os/scripts/lib/managed-cloud-public-pricing.ts',
      '--changed-file',
      'packages/os/scripts/lib/google-cloud-public-pricing-refresh.ts',
      '--changed-file',
      'packages/os/cloudflare/os-device-authority/src/services/managed-cloud-pricing.ts',
      '--changed-file',
      'packages/os/tests/managed-cloud-public-pricing.test.ts',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);
    const suiteNames = data.selectedSuites.map((suite) => suite.name);

    expect(matchedRuleIds).toContain('os-managed-cloud-one-click-provisioning');
    expect(matchedRuleIds).not.toContain('auto:@consuelo/os:package-test');
    expect(suiteNames).toContain('OS one-click managed cloud contracts');
    expect(suiteNames.some((name) =>
      name === 'OS one-click managed cloud syntax contracts'
      || name === 'OS internal workspace shell syntax'
    )).toBe(true);
  });

  it('uses focused managed-cloud checkout observability contracts instead of the broad OS package suite', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/os/cloudflare/os-device-authority/src/services/managed-cloud-billing.ts',
      '--changed-file',
      'packages/os/cloudflare/os-device-authority/src/services/synthetic-checkout.ts',
      '--changed-file',
      'packages/os/cloudflare/os-device-authority/src/services/checkout-observability.ts',
      '--changed-file',
      'packages/os/tests/managed-cloud-checkout-observability.test.ts',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);
    const suiteNames = data.selectedSuites.map((suite) => suite.name);

    expect(matchedRuleIds).toContain('os-managed-cloud-checkout-observability');
    expect(matchedRuleIds).not.toContain('auto:@consuelo/os:package-test');
    expect(suiteNames).toEqual(
      expect.arrayContaining([
        'OS managed cloud checkout observability contracts',
        'OS managed cloud checkout observability syntax contracts',
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

  it('uses focused MCP admission contracts instead of the broad OS package suite', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/os/scripts/server/routes/mcp.ts',
      '--changed-file',
      'packages/os/scripts/server/middleware/dangerous-material.ts',
      '--changed-file',
      'packages/os/scripts/server/logger.ts',
      '--changed-file',
      'packages/os/tests/mcp-gateway.test.ts',
      '--changed-file',
      'packages/documentation/src/content/docs/reference/mcp.mdx',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);
    const suiteNames = data.selectedSuites.map((suite) => suite.name);

    expect(matchedRuleIds).toContain('os-mcp-admission-error-contract');
    expect(matchedRuleIds).not.toContain('auto:@consuelo/os:package-test');
    expect(suiteNames).toEqual(expect.arrayContaining([
      'OS MCP admission contracts',
      'OS dangerous material ingress contracts',
      'OS MCP admission syntax contracts',
    ]));
    const ingressSuite = data.selectedSuites.find(
      (suite) => suite.name === 'OS dangerous material ingress contracts',
    );
    expect(ingressSuite?.command).toEqual([
      'bun',
      '--cwd',
      'packages/os',
      '../../node_modules/vitest/vitest.mjs',
      'run',
      'tests/dangerous-material-policy.test.ts',
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
    expect(matchedRuleIds).toContain('os-work-session-code-call');
    expect(matchedRuleIds).not.toContain('auto:@consuelo/os:package-test');
    expect(suiteNames).toEqual(expect.arrayContaining([
      'OS MCP admission contracts',
      'OS MCP admission syntax contracts',
      'OS work-session Code Call and MCP authority contracts',
      'OS ChatGPT node-routing facade contracts',
      'OS ChatGPT node-routing authority contracts',
    ]));
    expect(suiteNames.some((name) =>
      name === 'OS ChatGPT node-routing syntax contracts'
      || name === 'OS MCP admission syntax contracts'
    )).toBe(true);
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


  it('routes daemon startup managed Sites refresh through focused lifecycle handoff coverage', () => {
    const data = json(run([
      'check',
      '--changed-file',
      'packages/os/scripts/start-consuelo-daemon.sh',
      '--json',
    ]));

    expect(data.matchedRules.map((rule) => rule.id)).toContain(
      'os-lifecycle-update-handoff',
    );
    expect(data.selectedSuites.map((suite) => suite.name)).not.toContain(
      '@consuelo/os package test',
    );
    const lifecycleSuite = data.selectedSuites.find(
      (suite) => suite.ruleId === 'os-lifecycle-update-handoff',
    );
    expect(lifecycleSuite?.command).toEqual(expect.arrayContaining([
      'packages/os/tests/lifecycle-ingress-continuity.test.ts',
      'packages/os/tests/daemon-bun-path.test.ts',
    ]));
  });

  it('routes local OS response lifecycle changes through critical lifecycle coverage', () => {
    const data = json(run([
      'check',
      '--changed-file',
      'packages/os/scripts/server/app.ts',
      '--json',
    ]));

    expect(data.matchedRules.map((rule) => rule.id)).toContain(
      'os-lifecycle-update-handoff',
    );
    const lifecycleSuite = data.selectedSuites.find(
      (suite) => suite.ruleId === 'os-lifecycle-update-handoff',
    );
    expect(lifecycleSuite?.critical).toBe(true);
    expect(lifecycleSuite?.command).toEqual(expect.arrayContaining([
      'packages/os/tests/health-readiness.test.ts',
      'packages/os/tests/worker-pool-lifecycle.test.ts',
    ]));
  });

  it('routes Secrets management changes through focused sealed-credential contracts', () => {
    const data = json(run([
      'check',
      '--changed-file',
      'packages/os/scripts/lib/consuelo-sites-secrets-adapter.ts',
      '--changed-file',
      'packages/os/scripts/lib/node-sealed-credential-store.ts',
      '--changed-file',
      'packages/os/scripts/lib/secrets-site.ts',
      '--changed-file',
      'packages/os/scripts/lib/settings-site.ts',
      '--changed-file',
      'packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts',
      '--changed-file',
      'packages/os/scripts/lib/workspace-cloudflare-edge-router.ts',
      '--changed-file',
      'packages/os/scripts/lib/workspace-edge-route-seed.ts',
      '--changed-file',
      'packages/os/scripts/server/route-policies.ts',
      '--changed-file',
      'packages/os/scripts/server/routes/secrets.ts',
      '--changed-file',
      'packages/os/tests/local-os-server-hono-architecture.test.ts',
      '--changed-file',
      'packages/os/tests/secrets-hono-routes.test.ts',
      '--changed-file',
      'packages/os/tests/secrets-surface.test.ts',
      '--changed-file',
      'packages/os/tests/settings-site.test.ts',
      '--changed-file',
      'packages/os/tests/workspace-edge-route-seed-contract.test.ts',
      '--changed-file',
      'packages/os/tests/workspace-gateway-node-end-to-end.test.ts',
      '--json',
    ]));

    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);
    expect(matchedRuleIds).toContain('os-secrets-management');
    expect(data.selectedSuites.map((suite) => suite.ruleId)).not.toContain(
      'auto:@consuelo/os:package-test',
    );
    const suites = data.selectedSuites.filter(
      (candidate) => candidate.ruleId === 'os-secrets-management',
    );
    expect(suites.length).toBeGreaterThanOrEqual(3);
    expect(suites.every((suite) => suite.critical)).toBe(true);
    expect(JSON.stringify(suites)).toContain('tests/secrets-surface.test.ts');
    expect(JSON.stringify(suites)).toContain('tests/secrets-hono-routes.test.ts');
    expect(JSON.stringify(suites)).toContain('tests/internal-launcher-regressions.test.ts');
    expect(JSON.stringify(suites)).toContain('tests/workspace-gateway-node-end-to-end.test.ts');
    expect(JSON.stringify(data.selectedSuites)).toContain(
      'tests/workspace-edge-route-seed-contract.test.ts',
    );
  });

  it('selects Secrets contracts for every route seed and registry source independently', () => {
    for (const changedFile of [
      'packages/os/scripts/lib/workspace-edge-route-seed.ts',
      'packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts',
      'packages/os/tests/workspace-edge-route-seed-contract.test.ts',
    ]) {
      const data = json(run(['check', '--changed-file', changedFile, '--json']));
      expect(data.matchedRules.map((rule) => rule.id), changedFile).toContain(
        'os-secrets-management',
      );
    }
  });

  it('routes internal workspace shell and root Sites changes through loud focused contracts', () => {
    const data = json(run([
      'check',
      '--changed-file',
      'packages/os/scripts/lib/sites.ts',
      '--changed-file',
      'packages/os/scripts/lib/settings-site.ts',
      '--changed-file',
      'packages/os/scripts/lib/workspace-chrome.ts',
      '--changed-file',
      'packages/os/scripts/lib/observability-traces-site.ts',
      '--changed-file',
      'packages/os/tests/launcher-nodes-materialization.test.ts',
      '--json',
    ]));

    expect(data.matchedRules.map((rule) => rule.id)).toContain(
      'os-internal-workspace-shell',
    );
    expect(data.matchedRules.map((rule) => rule.id)).not.toContain(
      'auto:@consuelo/os:package-test',
    );
    const suite = data.selectedSuites.find(
      (candidate) => candidate.ruleId === 'os-internal-workspace-shell'
        && candidate.name === 'OS internal workspace shell contracts',
    );
    expect(suite?.critical).toBe(true);
    expect(suite?.command).toEqual(expect.arrayContaining([
      'tests/settings-site.test.ts',
      'tests/launcher-nodes-materialization.test.ts',
      'tests/observability-traces-site.test.ts',
      'tests/sites-cli.test.ts',
      'tests/launcher-local-customization.test.ts',
      'tests/internal-launcher-regressions.test.ts',
    ]));
  });

  it('routes gateway security and Caddy handoff changes through focused contracts instead of the broad OS package suite', () => {
    const data = json(run([
      'check',
      '--changed-file',
      'packages/os/scripts/lib/security-gateway.ts',
      '--changed-file',
      'packages/os/scripts/lib/caddy-worker-pool-reconciliation.ts',
      '--changed-file',
      'packages/os/tests/caddy-worker-pool-reconciliation.test.ts',
      '--json',
    ]));

    expect(data.matchedRules.map((rule) => rule.id)).toContain(
      'os-gateway-security-caddy-handoff',
    );
    expect(data.matchedRules.map((rule) => rule.id)).not.toContain(
      'auto:@consuelo/os:package-test',
    );
    expect(data.selectedSuites.map((suite) => suite.name)).toEqual(
      expect.arrayContaining([
        'OS gateway security and Caddy contracts',
        'OS gateway security syntax contracts',
      ]),
    );
  });

  it('routes lifecycle updater and gateway restart changes through the focused universal handoff contracts', () => {
    const data = json(run([
      'check',
      '--changed-file',
      'packages/os/scripts/lifecycle.ts',
      '--changed-file',
      'packages/os/scripts/bootstrap.sh',
      '--changed-file',
      'packages/os/scripts/lib/lifecycle/service.ts',
      '--changed-file',
      'packages/os/scripts/lib/platforms/linux.ts',
      '--changed-file',
      'packages/os/scripts/lib/caddy-worker-pool-reconciliation.ts',
      '--changed-file',
      'packages/os/tests/caddy-worker-pool-reconciliation.test.ts',
      '--changed-file',
      'packages/os/tests/caddy-worker-pool-migration.test.ts',
      '--changed-file',
      'packages/os/tests/lifecycle-restart-contract.test.ts',
      '--changed-file',
      'packages/os/tests/linux-platform.test.ts',
      '--json',
    ]));

    expect(data.matchedRules.map((rule) => rule.id)).toContain(
      'os-lifecycle-update-handoff',
    );
    expect(data.matchedRules.map((rule) => rule.id)).not.toContain(
      'auto:@consuelo/os:package-test',
    );
    const suiteNames = data.selectedSuites.map((suite) => suite.name);
    expect(suiteNames).toContain('OS lifecycle update handoff contracts');
    expect(suiteNames.some((name) =>
      name === 'OS lifecycle syntax contracts'
      || name === 'OS gateway security syntax contracts'
    )).toBe(true);
    const lifecycleSuite = data.selectedSuites.find(
      (suite) => suite.name === 'OS lifecycle update handoff contracts',
    );
    expect(lifecycleSuite?.command).toEqual(expect.arrayContaining([
      'packages/os/tests/lifecycle-restart-contract.test.ts',
      'packages/os/tests/runtime-ingress-dependency-convergence.test.ts',
      'packages/os/tests/caddy-worker-pool-reconciliation.test.ts',
      'packages/os/tests/caddy-worker-pool-migration.test.ts',
      'packages/os/tests/linux-platform.test.ts',
    ]));
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

  it('does not treat generated workspace types as lifecycle behavior by themselves', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/os/src/generated/workspace.d.ts',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);

    expect(matchedRuleIds).toContain('os-work-session-fs');
    expect(matchedRuleIds).toContain('os-lifecycle-update-handoff');
  });

  it('keeps shared facade schema ownership out of the session-specific exclusive rule', () => {
    const result = run(['check', '--changed-file', 'packages/workspace/scripts/lib/facade/schemas.ts', '--json']);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);
    expect(matchedRuleIds).toContain('workspace-facade');
    expect(matchedRuleIds).not.toContain('workspace-session-integration');
    expect(data.selectedSuites.map((suite) => suite.name)).toContain('workspace facade manifest contracts');
  });

  it('routes session integration changes to focused task/work compatibility tests', () => {
    for (const changedFile of [
      'packages/workspace/scripts/session-start.ts',
      'packages/os/hooks/task/workflow.js',
    ]) {
      const result = run(['check', '--changed-file', changedFile, '--json']);
      const data = json(result);
      const matchedRuleIds = data.matchedRules.map((rule) => rule.id);
      expect(matchedRuleIds).toContain('workspace-session-integration');
      expect(data.selectedSuites.map((suite) => suite.name)).toContain(
        'workspace session integration contracts',
      );
    }
  });

  it('routes work-session Code Call changes to focused authority tests', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/os/scripts/lib/code-call/process.ts',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);

    expect(matchedRuleIds).toContain('os-work-session-code-call');
    expect(data.selectedSuites.map((suite) => suite.name)).toContain(
      'OS work-session Code Call and MCP authority contracts',
    );
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
    expect(suiteNames).toContain('OS GitHub source-control contracts');
    expect(suiteNames).not.toContain('@consuelo/os package test');
  });


  it('uses focused compact explore response contracts instead of the broad OS package suite', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/os/scripts/explore.js',
      '--changed-file',
      'packages/os/scripts/lib/search/explore-output.js',
      '--changed-file',
      'packages/os/tools/decision-engine/handler.ts',
      '--changed-file',
      'packages/os/tests/explore-output-contract.test.ts',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);
    const suiteNames = data.selectedSuites.map((suite) => suite.name);

    expect(matchedRuleIds).toContain('os-compact-explore-response');
    expect(suiteNames).toContain('OS compact explore response contracts');
    expect(suiteNames).not.toContain('@consuelo/os package test');
  });


  it('uses focused headed browser handoff contracts instead of the broad OS package suite', () => {
    const result = run([
      'check',
      '--changed-file',
      'packages/os/scripts/lib/browser/service.ts',
      '--changed-file',
      'packages/os/tests/browser-service.test.ts',
      '--changed-file',
      'packages/workspace/scripts/lib/browser/service.ts',
      '--changed-file',
      'packages/workspace/tests/browser-service.test.ts',
      '--json',
    ]);
    const data = json(result);
    const matchedRuleIds = data.matchedRules.map((rule) => rule.id);
    const suiteNames = data.selectedSuites.map((suite) => suite.name);

    expect(matchedRuleIds).toContain('os-browser-headed-handoff');
    expect(suiteNames).toContain('OS headed browser handoff contracts');
    expect(suiteNames).not.toContain('@consuelo/os package test');
  });

});
