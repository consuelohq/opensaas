import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

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

describe('GitHub workflow policy', () => {
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

  test('invalidates dependency caches when workspace topology changes', () => {
    const action = readFileSync(
      join(repoRoot, '.github/actions/yarn-install/action.yaml'),
      'utf8',
    );

    expect(action).toContain('TOPOLOGY_HASH=');
    expect(action).toContain("git ls-files package.json yarn.lock .yarnrc.yml 'packages/*/package.json' 'packages/*/project.json'");
    expect(action).toContain("printf '%s\\t%s\\n'");
    expect(action).toContain('git hash-object "${file}"');
    expect(action).toContain('${TOPOLOGY_HASH}');
    expect(action).not.toContain("hashFiles('yarn.lock')");
  });

  test('explicitly allowlists the API breaking-changes workflow write permissions', () => {
    const policy = readFileSync(
      join(repoRoot, 'packages/workspace/scripts/ci/check-github-workflows.cjs'),
      'utf8',
    );

    expect(policy).toContain('.github/workflows/ci-breaking-changes.yaml');
  });
});
