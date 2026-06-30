import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  const proc = Bun.spawnSync({
    cmd: ['bun', scriptPath, '--skip-build', '--json'],
    cwd: websiteDir,
    env: {
      ...process.env,
      CI: '',
      GITHUB_ACTIONS: '',
      CLOUDFLARE_API_TOKEN: '',
      CLOUDFLARE_ACCOUNT_ID: '',
      ...env,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  return {
    exitCode: proc.exitCode,
    stdout: new TextDecoder().decode(proc.stdout),
    stderr: new TextDecoder().decode(proc.stderr),
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

test('GitHub Actions workflow accepts canonical and fallback Cloudflare secret names', () => {
  const workflow = readFileSync(join(repoRoot, '.github/workflows/consuelo-website-deploy.yaml'), 'utf8');

  expect(workflow).toContain('CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID || secrets.CF_ACCOUNT_ID }}');
  expect(workflow).toContain('CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN || secrets.CLOUDFLARE_PAGES_API_TOKEN || secrets.CF_API_TOKEN }}');
});

