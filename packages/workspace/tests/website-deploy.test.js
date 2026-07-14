import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '..', '..', '..');
const scriptPath = join(repoRoot, 'packages/workspace/scripts/website-deploy.js');
const websiteDir = join(repoRoot, 'packages/consuelo-website');
const tempDirs = [];

function makeFakeBunx() {
  const dir = mkdtempSync(join(tmpdir(), 'website-deploy-test-'));
  tempDirs.push(dir);
  const logPath = join(dir, 'bunx.log');
  const binPath = join(dir, 'bunx');
  writeFileSync(binPath, `#!/usr/bin/env bash
printf '%s\n' "$*" > ${JSON.stringify(logPath)}
printf '%s\n' '✨ Success! Uploaded 1 files.'
printf '%s\n' 'https://consuelo-website-test.pages.dev'
`, { mode: 0o755 });
  return { dir, logPath };
}

function runDeploy({ env = {} } = {}) {
  const proc = spawnSync('bun', [scriptPath, '--skip-build', '--json'], {
    cwd: websiteDir,
    env: {
      ...process.env,
      CI: '',
      GITHUB_ACTIONS: '',
      CLOUDFLARE_API_TOKEN: '',
      CLOUDFLARE_ACCOUNT_ID: '',
      ...env,
    },
    encoding: 'utf8',
  });

  return {
    exitCode: proc.status ?? 1,
    stdout: proc.stdout ?? '',
    stderr: proc.stderr ?? '',
  };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

describe('website-deploy cloudflare auth handling', () => {
  test('allows local deploys to use existing Wrangler auth when CLOUDFLARE_API_TOKEN is absent', () => {
    const fake = makeFakeBunx();
    const result = runDeploy({ env: { PATH: `${fake.dir}:${process.env.PATH ?? ''}` } });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('CLOUDFLARE_API_TOKEN is not set; using existing Wrangler auth if available.');
    expect(result.stdout).toContain('consuelo-website-test.pages.dev');
  });

  test('requires explicit token auth in GitHub Actions', () => {
    const fake = makeFakeBunx();
    const result = runDeploy({ env: { GITHUB_ACTIONS: 'true', PATH: `${fake.dir}:${process.env.PATH ?? ''}` } });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('CLOUDFLARE_API_TOKEN is required in CI');
    expect(result.stdout).not.toContain('consuelo-website-test.pages.dev');
  });
});

test('GitHub Actions production release uses dedicated Cloudflare credentials for website and OS', () => {
  const legacyWorkflowPath = join(repoRoot, '.github/workflows/consuelo-website-deploy.yaml');
  const workflowPath = join(repoRoot, '.github/workflows/consuelo-production-release.yaml');

  expect(existsSync(legacyWorkflowPath)).toBe(false);
  const workflow = readFileSync(workflowPath, 'utf8');

  expect(workflow).toContain('name: Consuelo Production Release');
  expect(workflow).toContain('branches: [main]');
  expect(workflow).not.toContain('paths:');
  expect(workflow).toContain('workflow_dispatch:');
  expect(workflow).toContain('- all');
  expect(workflow).toContain('- docs');
  expect(workflow).toContain('- website');
  expect(workflow).toContain('- os');
  expect(workflow.split('environment: consuelo / production')).toHaveLength(4);
  expect(workflow).toContain('needs: [deploy-docs, deploy-website]');
  expect(workflow).toContain("inputs.target == 'docs'");
  expect(workflow).toContain("inputs.target == 'website'");
  expect(workflow).toContain("inputs.target == 'os'");
  expect(workflow).toContain("needs.deploy-docs.result == 'success'");
  expect(workflow).toContain("needs.deploy-docs.result == 'skipped'");
  expect(workflow).toContain("needs.deploy-website.result == 'success'");
  expect(workflow).toContain("needs.deploy-website.result == 'skipped'");
  expect(workflow).toContain('bun run docs:deploy -- --json');
  expect(workflow).toContain('bun run website:deploy -- --branch main --json');
  expect(workflow).toContain('bun install --global wrangler@4.105.0');
  expect(workflow).toContain('bun run os:release');
  expect(workflow).toContain('Missing GitHub Actions variable CLOUDFLARE_ACCOUNT_ID');
  expect(workflow).toContain('Missing GitHub Actions secret CLOUDFLARE_PAGES_API_TOKEN');
  expect(workflow).toContain('Missing GitHub Actions secret CLOUDFLARE_OS_RELEASE_API_TOKEN');
  expect(workflow).toContain('CLOUDFLARE_ACCOUNT_ID: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}');
  expect(workflow).toContain('CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_PAGES_API_TOKEN }}');
  expect(workflow).toContain('CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_OS_RELEASE_API_TOKEN }}');
  expect(workflow).not.toContain('secrets.CLOUDFLARE_ACCOUNT_ID');
  expect(workflow).not.toContain('secrets.CLOUDFLARE_API_TOKEN');
  expect(workflow).not.toContain('CF_ACCOUNT_ID');
  expect(workflow).not.toContain('CF_API_TOKEN');
  expect(workflow).not.toContain('GITHUB_TOKEN');
});

