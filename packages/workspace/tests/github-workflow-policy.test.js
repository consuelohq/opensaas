import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, test } from 'vitest';
import { parse } from 'yaml';

const repoRoot = resolve(import.meta.dirname, '..', '..', '..');
const workflowDir = join(repoRoot, '.github', 'workflows');

const obsoleteWorkflowPaths = [
  '.github/workflows/claude.yml',
  '.github/workflows/i18n-pull.yaml',
  '.github/workflows/i18n-push.yaml',
  '.github/workflows/i18n-qa-report.yaml',
  '.github/workflows/upstream-sync.yml',
  '.github/workflows/ci-release-create.yaml',
  '.github/workflows/ci-release-merge.yaml',
  '.github/workflows/ci-breaking-changes.yaml',
  '.github/workflows/ci-create-app.yaml',
  '.github/workflows/ci-docker-build.yaml',
  '.github/workflows/ci-front.yaml',
  '.github/workflows/ci-sdk.yaml',
  '.github/workflows/ci-server.yaml',
  '.github/workflows/ci-shared.yaml',
  '.github/workflows/ci-test-docker-compose.yaml',
  '.github/workflows/ci-utils.yaml',
];

const retiredCredentialNames = [
  'CHROMATIC_PROJECT_TOKEN',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'TWENTY_DISPATCH_TOKEN',
  'CROWDIN_PERSONAL_TOKEN',
];

function readWorkflowSources() {
  return readdirSync(workflowDir)
    .filter((name) => name.endsWith('.yaml') || name.endsWith('.yml'))
    .map((name) => readFileSync(join(workflowDir, name), 'utf8'))
    .join('\n');
}

function readWorkflow(name) {
  return parse(readFileSync(join(workflowDir, name), 'utf8'));
}

describe('GitHub workflow policy', () => {
  test('delegates Consuelo routing to the Bun-native CI planner', () => {
    const workflow = readFileSync(join(workflowDir, 'consuelo-ci.yaml'), 'utf8');

    expect(workflow).toContain('bun packages/os/scripts/ci-plan.ts');
    expect(workflow).not.toContain('has_consuelo_package_change()');
    expect(workflow).not.toContain('git diff --name-only --diff-filter=ACMR');
    expect(workflow).not.toContain('workspace_contracts');
    expect(readWorkflow('consuelo-ci.yaml').jobs['workspace-contracts']).toBeUndefined();
  });

  test('uses one package-manager-neutral Consuelo CI setup boundary', () => {
    const workflow = readFileSync(join(workflowDir, 'consuelo-ci.yaml'), 'utf8');
    const setupAction = readFileSync(
      join(repoRoot, '.github/actions/consuelo-ci-setup/action.yaml'),
      'utf8',
    );

    expect(setupAction).toContain('uses: oven-sh/setup-bun@v2');
    expect(setupAction).toContain("default: '1.3.14'");
    expect(setupAction).toContain('uses: actions/setup-node@v4');
    expect(setupAction).toContain("default: '24'");
    expect(setupAction).toContain('uses: ./.github/actions/yarn-install');
    expect(setupAction).toContain('working-directory: packages/os');
    expect(setupAction).toContain('bun install --frozen-lockfile');
    expect(workflow).toContain('uses: ./.github/actions/consuelo-ci-setup');
    expect(workflow).not.toContain('uses: oven-sh/setup-bun@v2');
    expect(workflow).not.toContain('uses: ./.github/actions/yarn-install');
    expect(workflow).toContain("setup-node: 'false'");
  });

  test('includes local composite actions in workflow security policy', () => {
    const policy = readFileSync(
      join(repoRoot, 'packages/workspace/scripts/ci/check-github-workflows.cjs'),
      'utf8',
    );

    expect(policy).toContain("/^\\.github\\/actions\\/.+\\/action\\.ya?ml$/");
    expect(policy).toContain(
      'local composite actions must receive credentials explicitly from the caller',
    );
    expect(policy).toContain('const usesMutableBranch = /@(?:main|master)');
  });

  test('keeps OS-only Consuelo lanes off the root Yarn install', () => {
    const workflow = readWorkflow('consuelo-ci.yaml');

    for (const jobName of ['os-contracts', 'sites-gateway-cloudflare']) {
      const setup = workflow.jobs[jobName].steps.find(
        (step) => step.uses === './.github/actions/consuelo-ci-setup',
      );

      expect(setup, jobName).toBeTruthy();
      expect(setup.with['install-root'], jobName).toBe('false');
      expect(setup.with['install-os'], jobName).toBe('true');
    }
  });

  test('does not include retired automation or legacy Twenty workflows', () => {
    for (const path of obsoleteWorkflowPaths) {
      expect(existsSync(join(repoRoot, path)), path).toBe(false);
    }
  });

  test('does not reference retired CI credentials', () => {
    const workflows = readWorkflowSources();

    for (const credentialName of retiredCredentialNames) {
      expect(workflows, credentialName).not.toContain(credentialName);
    }
  });

  test('does not retain privileged allowlist entries for deleted workflows', () => {
    const policy = readFileSync(
      join(repoRoot, 'packages/workspace/scripts/ci/check-github-workflows.cjs'),
      'utf8',
    );

    for (const path of obsoleteWorkflowPaths) {
      expect(policy, path).not.toContain(path);
    }
  });

  test('scopes native OS distribution tests to relevant changed files', () => {
    const osDistributionWorkflow = readFileSync(
      join(workflowDir, 'consuelo-os-distribution-environments.yaml'),
      'utf8',
    );

    expect(osDistributionWorkflow).toContain(
      '- name: Resolve OS test comparison SHAs\n        uses: nrwl/nx-set-shas@v4',
    );
    expect(osDistributionWorkflow).toContain(
      '- uses: actions/checkout@v4\n        with:\n          fetch-depth: 0',
    );
    expect(osDistributionWorkflow).toContain(
      'NATIVE_TEST_BASE: ${{ github.event.pull_request.base.sha || github.event.before }}',
    );
    expect(osDistributionWorkflow).toContain(
      'NATIVE_TEST_HEAD: ${{ github.event.pull_request.head.sha || github.sha }}',
    );
    expect(osDistributionWorkflow).toContain(
      'run: node packages/workspace/scripts/ci/run-changed-os-native-tests.mjs',
    );
    expect(osDistributionWorkflow).toContain(
      'packages/workspace/tests/run-changed-os-native-tests.test.mjs',
    );
    expect(osDistributionWorkflow).not.toContain(
      'working-directory: packages/os\n        run: bun x vitest run tests/distribution --testTimeout 15000',
    );
  });
});
