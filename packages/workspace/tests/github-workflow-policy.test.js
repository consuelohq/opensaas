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

const legacyTwentyWorkflowScopes = {
  'ci-front.yaml': [
    'packages/twenty-front/**',
    'packages/twenty-server/**',
    'packages/twenty-shared/**',
    'packages/twenty-ui/**',
    'packages/twenty-sdk/**',
    'packages/twenty-e2e-testing/**',
  ],
  'ci-server.yaml': [
    'packages/twenty-server/**',
    'packages/twenty-shared/**',
  ],
  'ci-sdk.yaml': ['packages/twenty-sdk/**'],
  'ci-shared.yaml': ['packages/twenty-shared/**'],
  'ci-test-docker-compose.yaml': ['packages/twenty-docker/**'],
  'ci-create-app.yaml': ['packages/create-twenty-app/**'],
  'ci-utils.yaml': ['packages/twenty-*/**'],
  'ci-breaking-changes.yaml': [
    'packages/twenty-server/**',
    'packages/twenty-shared/**',
  ],
};

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
    expect(policy).toContain('local composite actions must receive credentials explicitly from the caller');
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

  test('scopes legacy Twenty pull-request CI to Twenty-owned paths', () => {
    for (const [name, requiredPaths] of Object.entries(legacyTwentyWorkflowScopes)) {
      const workflow = readWorkflow(name);
      const pullRequest = workflow.on?.pull_request;

      expect(pullRequest, name).toBeTruthy();
      expect(pullRequest.paths, name).toEqual(expect.arrayContaining(requiredPaths));
      expect(pullRequest.paths, name).not.toContain('package.json');
      expect(pullRequest.paths, name).not.toContain('yarn.lock');
      expect(pullRequest.paths, name).not.toContain('packages/**');
      expect(workflow.on?.merge_group, name).toBeUndefined();
      expect(workflow.name, name).toMatch(new RegExp('^Legacy Twenty / '));
    }
  });

  test('does not include retired automation workflows', () => {
    for (const path of obsoleteWorkflowPaths) {
      expect(existsSync(join(repoRoot, path)), path).toBe(false);
    }
  });

  test('does not reference retired CI credentials or the disabled Chromatic job', () => {
    const workflows = readWorkflowSources();
    const frontWorkflow = readFileSync(join(workflowDir, 'ci-front.yaml'), 'utf8');

    for (const credentialName of retiredCredentialNames) {
      expect(workflows, credentialName).not.toContain(credentialName);
    }
    expect(frontWorkflow).not.toContain('front-chromatic-deployment:');
    expect(frontWorkflow).not.toContain('if: false');
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

  test('runs typecheck and test from the filtered frontend file set', () => {
    const frontWorkflow = readFileSync(
      join(workflowDir, 'ci-front.yaml'),
      'utf8',
    );

    expect(frontWorkflow).toContain(
      '- name: Resolve frontend task comparison SHAs\n        uses: nrwl/nx-set-shas@v4',
    );
    expect(frontWorkflow).toContain(
      'run: node packages/workspace/scripts/ci/run-changed-frontend-task.mjs --task ${{ matrix.task }}',
    );
    expect(frontWorkflow).toContain(
      'packages/workspace/tests/run-changed-frontend-task.test.mjs',
    );
    expect(frontWorkflow).not.toContain(
      '- name: Run ${{ matrix.task }} task\n        if: matrix.task != \'lint\'\n        uses: ./.github/actions/nx-affected',
    );
  });

  test('installs Bun and scopes shared tasks to changed frontend files', () => {
    const sharedWorkflow = readFileSync(
      join(workflowDir, 'ci-shared.yaml'),
      'utf8',
    );

    const bunIndex = sharedWorkflow.indexOf('uses: oven-sh/setup-bun@v2');
    const shaIndex = sharedWorkflow.indexOf('uses: nrwl/nx-set-shas@v4');
    const selectorIndex = sharedWorkflow.indexOf(
      'run: node packages/workspace/scripts/ci/run-changed-frontend-task.mjs --task ${{ matrix.task }}',
    );

    expect(bunIndex).toBeGreaterThan(-1);
    expect(shaIndex).toBeGreaterThan(bunIndex);
    expect(selectorIndex).toBeGreaterThan(shaIndex);
    expect(sharedWorkflow).toContain(
      'run: node packages/workspace/scripts/ci/lint-changed-frontend-files.mjs',
    );
    expect(sharedWorkflow).not.toContain(
      '- name: Run ${{ matrix.task }} task\n        uses: ./.github/actions/nx-affected',
    );
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

  test('runs Docker Compose CI with the pgvector PostgreSQL image required by migrations', () => {
    const dockerComposeWorkflow = readFileSync(
      join(workflowDir, 'ci-test-docker-compose.yaml'),
      'utf8',
    );

    expect(dockerComposeWorkflow).toContain(
      `yq eval '.services.db.image = "pgvector/pgvector:pg16"' -i docker-compose.yml`,
    );
  });

  test('uses available hosted runners for the Server and Front build pipelines', () => {
    const serverWorkflow = readFileSync(
      join(workflowDir, 'ci-server.yaml'),
      'utf8',
    );
    const frontWorkflow = readFileSync(
      join(workflowDir, 'ci-front.yaml'),
      'utf8',
    );

    expect(serverWorkflow).not.toContain('runs-on: ubuntu-latest-8-cores');
    expect(frontWorkflow).not.toContain('runs-on: ubuntu-latest-8-cores');
    expect(serverWorkflow).toContain('server-setup:\n    needs: changed-files-check');
    expect(frontWorkflow).toContain('front-sb-build:\n    needs: changed-files-check');
    expect(frontWorkflow).toContain('front-build:\n    needs: changed-files-check');
  });

  test('builds Consuelo backend workspace dependencies before server typecheck', () => {
    const serverWorkflow = readFileSync(
      join(workflowDir, 'ci-server.yaml'),
      'utf8',
    );
    const dependencyBuild =
      'npx nx run-many --target=build --projects=@consuelo/logger,@consuelo/coaching,@consuelo/contacts,@consuelo/dialer,@consuelo/agent';
    const dependencyBuildIndex = serverWorkflow.indexOf(dependencyBuild);
    const bunSetupIndex = serverWorkflow.indexOf('uses: oven-sh/setup-bun@v2');
    const typecheckIndex = serverWorkflow.indexOf(
      'node packages/workspace/scripts/ci/run-changed-server-task.mjs',
    );
    const graphqlIndex = serverWorkflow.indexOf(
      'node packages/workspace/scripts/ci/run-changed-server-task.mjs --graphql',
    );
    const migrationIndex = serverWorkflow.indexOf(
      'node packages/workspace/scripts/ci/run-changed-server-task.mjs --migrations',
    );

    expect(bunSetupIndex).toBeGreaterThan(-1);
    expect(dependencyBuildIndex).toBeGreaterThan(-1);
    expect(typecheckIndex).toBeGreaterThan(bunSetupIndex);
    expect(typecheckIndex).toBeGreaterThan(dependencyBuildIndex);
    expect(migrationIndex).toBeGreaterThan(typecheckIndex);
    expect(graphqlIndex).toBeGreaterThan(typecheckIndex);
  });

  test('installs Bun before the Server unit-test job runs Bun package tests', () => {
    const serverWorkflow = readFileSync(
      join(workflowDir, 'ci-server.yaml'),
      'utf8',
    );
    const serverTest = serverWorkflow.slice(
      serverWorkflow.indexOf('  server-test:'),
      serverWorkflow.indexOf('  server-integration-test:'),
    );

    expect(serverTest).toContain('uses: oven-sh/setup-bun@v2');
    expect(serverTest).toContain('bun-version: 1.3.14');
    expect(serverTest.indexOf('uses: oven-sh/setup-bun@v2')).toBeLessThan(
      serverTest.indexOf('- name: Server / Run Tests'),
    );
  });

  test('allows enough time for Danger dependency installation and execution', () => {
    const utilsWorkflow = readFileSync(
      join(workflowDir, 'ci-utils.yaml'),
      'utf8',
    );
    const dangerJob = utilsWorkflow.slice(
      utilsWorkflow.indexOf('  danger-js:'),
      utilsWorkflow.indexOf('  congratulate:'),
    );

    expect(dangerJob).toContain('timeout-minutes: 10');
  });

  test('explicitly allowlists the API breaking-changes workflow write permissions', () => {
    const policy = readFileSync(
      join(repoRoot, 'packages/workspace/scripts/ci/check-github-workflows.cjs'),
      'utf8',
    );

    expect(policy).toContain('.github/workflows/ci-breaking-changes.yaml');
  });
});
