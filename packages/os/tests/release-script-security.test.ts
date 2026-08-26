import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('release script security boundary', () => {
  it('uses GitHub credential-store auth without reading or printing token secrets', () => {
    const release = readFileSync(resolve(root, 'scripts/release.ts'), 'utf8');
    const githubCli = readFileSync(resolve(root, 'scripts/lib/github-cli.ts'), 'utf8');
    const combined = `${release}\n${githubCli}`;

    expect(combined).not.toContain("['auth', 'token']");
    expect(combined).not.toContain('process.env.GITHUB_TOKEN');
    expect(combined).not.toContain('process.env.GH_TOKEN');
    expect(combined).not.toContain('CONSUELO_OS_RELEASE_SIGNING_PRIVATE_KEY');
    expect(combined).not.toContain('CLOUDFLARE_OS_RELEASE_API_TOKEN');
    expect(release).toContain('safeErrorText');
    expect(githubCli).toContain("['auth', 'status']");
  });

  it('keeps release promotion inside the existing GitHub Actions approval/signing workflow', () => {
    const release = readFileSync(resolve(root, 'scripts/release.ts'), 'utf8');
    expect(release).toContain('consuelo-os-runtime-promote.yaml');
    expect(release).toContain("'workflow'");
    expect(release).toContain("'run'");
    expect(release).toContain('RUNTIME_PROMOTE_WORKFLOW');
    expect(release).not.toContain('release:channels -- promote');
    expect(release).not.toContain('wrangler');
  });
});
