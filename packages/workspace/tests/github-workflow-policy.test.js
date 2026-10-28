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

  test('uses one Bun-owned Consuelo CI setup boundary', () => {
    const workflow = readFileSync(join(workflowDir, 'consuelo-ci.yaml'), 'utf8');
    const setupAction = readFileSync(
      join(repoRoot, '.github/actions/consuelo-ci-setup/action.yaml'),
      'utf8',
    );

    expect(setupAction).toContain('uses: oven-sh/setup-bun@v2');
    expect(setupAction).toContain("default: '1.3.14'");
    expect(setupAction).toContain('uses: actions/setup-node@v4');
    expect(setupAction).toContain("default: '24'");
    expect(setupAction).toContain('uses: ./.github/actions/bun-install');
    expect(setupAction).toContain('working-directory: packages/workspace');
    expect(setupAction).toContain('working-directory: packages/os');
    expect(setupAction).toContain('bun install --frozen-lockfile');
    expect(workflow).toContain('uses: ./.github/actions/consuelo-ci-setup');
    expect(workflow).not.toContain('uses: oven-sh/setup-bun@v2');
    expect(workflow).not.toContain('uses: ./.github/actions/yarn-install');
    expect(workflow).toContain("install-workspace: 'true'");
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

  test('keeps OS-only Consuelo lanes off the root Bun install', () => {
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

  test('preserves OS security contract suites with a bounded hosted-runner subprocess timeout', () => {
    const workflow = readWorkflow('consuelo-ci.yaml');
    const command = workflow.jobs['os-contracts'].steps.find((step) =>
      step.name === 'Run OS contract tests')?.run;

    expect(command).toContain('tests/tool-manifest.test.ts');
    expect(command).toContain('tests/security-gateway.test.ts');
    expect(command).toContain('tests/workspace-gateway-contract.test.ts');
    expect(command).toContain('--testTimeout 15000');
  });

  test('uses shallow parent-aware checkouts for pull-request CI without removing verification jobs', () => {
    const workflow = readWorkflow('consuelo-ci.yaml');
    for (const jobName of ['consuelo-changes', 'workflow-security', 'verify']) {
      const checkout = workflow.jobs[jobName].steps.find((step) => step.uses === 'actions/checkout@v4');
      expect(checkout?.with?.['fetch-depth'], jobName).toBe(
        "${{ github.event_name != 'workflow_dispatch' && 2 || 0 }}",
      );
    }
    for (const jobName of [
      'workflow-security', 'verify', 'os-contracts', 'dialer', 'sites-gateway-cloudflare',
    ]) {
      expect(workflow.jobs[jobName], jobName).toBeDefined();
    }
  });

  test('keeps full Git ancestry for manual planner and both downstream diff consumers', () => {
    const workflow = readWorkflow('consuelo-ci.yaml');
    for (const jobName of ['consuelo-changes', 'workflow-security', 'verify']) {
      const checkout = workflow.jobs[jobName].steps.find((step) => step.uses === 'actions/checkout@v4');
      const depth = checkout?.with?.['fetch-depth'];
      expect(depth, jobName).toContain("github.event_name != 'workflow_dispatch'");
      expect(depth, jobName).toContain('2 || 0');
    }
    expect(workflow.jobs['workflow-security'].steps.some((step) =>
      step.run?.includes('check-github-workflows.cjs'))).toBe(true);
    expect(workflow.jobs.verify.steps.some((step) => step.run?.includes('bun run verify'))).toBe(true);
  });

  test('runs focused package, container, and security-contract lanes without full Git history', () => {
    const workflow = readWorkflow('consuelo-ci.yaml');
    for (const jobName of ['os-contracts', 'dialer', 'sites-gateway-cloudflare']) {
      const checkout = workflow.jobs[jobName].steps.find((step) => step.uses === 'actions/checkout@v4');
      expect(checkout?.with?.['fetch-depth'], jobName).toBe(1);
    }
    const dialer = workflow.jobs.dialer.steps;
    expect(dialer.some((step) => step.run?.includes('bun test packages/dialer/src'))).toBe(true);
    expect(dialer.some((step) => step.run?.includes('packages/dialer-server typecheck'))).toBe(true);
    expect(dialer.some((step) => step.run?.includes('packages/dialer-server build'))).toBe(true);
    expect(dialer.some((step) => step.run?.includes('docker build'))).toBe(true);
  });

  test('keeps docs and website status contracts while removing irrelevant checkout work', () => {
    const docs = readWorkflow('ci-docs.yaml');
    const website = readWorkflow('ci-website.yaml');

    for (const workflow of [docs, website]) {
      expect(workflow.permissions).toMatchObject({ contents: 'read', 'pull-requests': 'read' });
      expect(workflow.jobs['changed-files-check'].uses).toBe('./.github/workflows/changed-files.yaml');
    }
    expect(docs.jobs['docs-check'].steps.some((step) =>
      step.uses === 'styfle/cancel-workflow-action@0.11.0')).toBe(false);
    expect(docs.jobs['docs-check'].steps.find((step) =>
      step.uses === 'actions/checkout@v4')?.with?.['fetch-depth']).not.toBe(0);

    expect(website.jobs.website.needs).toContain('changed-files-check');
    const websiteCheckout = website.jobs.website.steps.find((step) => step.uses === 'actions/checkout@v4');
    expect(websiteCheckout?.if).toContain('needs.changed-files-check.outputs.any_changed');
    expect(website.jobs['ci-website-status-check'].needs).toContain('changed-files-check');
    expect(website.jobs.website.steps.some((step) =>
      step.run === 'bun run --cwd packages/consuelo-website build')).toBe(true);
  });

  test('runs real Swamp compatibility outside blocking pull-request CI', () => {
    const source = readFileSync(
      join(workflowDir, 'consuelo-swamp-compat.yaml'),
      'utf8',
    );
    const workflow = parse(source);
    const job = workflow.jobs['swamp-compatibility'];
    const setup = job.steps.find(
      (step) => step.uses === './.github/actions/consuelo-ci-setup',
    );
    const checkout = job.steps.find((step) => step.uses === 'actions/checkout@v4');

    expect(source).toContain('schedule:');
    expect(source).toContain('workflow_dispatch:');
    expect(source).toContain('push:');
    expect(source).not.toContain('pull_request:');
    expect(workflow.permissions.contents).toBe('read');
    expect(checkout.with['persist-credentials']).toBe(false);
    expect(setup).toBeTruthy();
    expect(setup.with['install-root']).toBe('false');
    expect(setup.with['install-os']).toBe('true');
    expect(source).toContain('swamp-linux-x86_64');
    expect(source).toContain('checksums.txt');
    expect(source).toContain('sha256sum --check --ignore-missing checksums.txt');
    expect(source).toContain('bun .github/scripts/consuelo-swamp-compat.ts');
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

    const distribution = readWorkflow('consuelo-os-distribution-environments.yaml');
    const native = distribution.jobs['native-runtime'];
    expect(native.strategy.matrix.include.map((entry) => entry.name)).toEqual([
      'linux', 'macos', 'macos-intel', 'windows',
    ]);
    expect(native.steps.some((step) => step.uses === 'nrwl/nx-set-shas@v4')).toBe(false);
    expect(native.steps.find((step) => step.uses === 'actions/checkout@v4')
      ?.with?.['fetch-depth']).toBe("${{ github.event_name == 'pull_request' && 2 || 0 }}");
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
