import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../../..');
const repoPath = (path: string): string => resolve(repoRoot, path);
const readRepoFile = (path: string): string => readFileSync(repoPath(path), 'utf8');

type PackageManifest = {
  license?: string;
  private?: boolean;
};

const readManifest = (path: string): PackageManifest =>
  JSON.parse(readRepoFile(path)) as PackageManifest;

const apachePackages = [
  'packages/agent/package.json',
  'packages/consuelo-core/package.json',
  'packages/consuelo-design/package.json',
  'packages/dialer-server/package.json',
  'packages/diff-cockpit/package.json',
  'packages/lead-connector/package.json',
  'packages/os/package.json',
  'packages/workspace/package.json',
];

const mitPackages = [
  'packages/analytics/package.json',
  'packages/api/package.json',
  'packages/chat-bot/package.json',
  'packages/cli/package.json',
  'packages/coaching/package.json',
  'packages/consuelo-website/package.json',
  'packages/contacts/package.json',
  'packages/dialer/package.json',
  'packages/logger/package.json',
  'packages/sdk/package.json',
];

describe('M5 Consuelo repository identity and licensing', () => {
  it('publishes a mixed-license map instead of a false blanket repository license', () => {
    const rootManifest = readManifest('package.json');
    const rootLicense = readRepoFile('LICENSE');
    const notice = readRepoFile('NOTICE');

    expect(rootManifest.license).toBe('SEE LICENSE IN LICENSE');
    expect(rootLicense).toContain('Repository licensing');
    expect(rootLicense).toContain('Apache-2.0');
    expect(rootLicense).toContain('AGPL-3.0');
    expect(rootLicense).toContain('NOTICE');
    expect(rootLicense).toContain('does not relicense');
    expect(notice).toContain('Consuelo Inc.');
    expect(notice).toContain('Open Design contributors');
    expect(notice).toContain('Oxygenna');
    expect(notice).toContain('Twenty');
    expect(existsSync(repoPath('LICENSES/Apache-2.0.txt'))).toBe(true);
    expect(existsSync(repoPath('LICENSES/AGPL-3.0.txt'))).toBe(true);
    expect(existsSync(repoPath('LICENSES/MIT.txt'))).toBe(true);
  });

  it('uses Apache-2.0 for clearly Consuelo-owned package surfaces', () => {
    for (const path of apachePackages) {
      expect(readManifest(path).license, path).toBe('Apache-2.0');
    }
  });

  it('preserves package-level MIT licensing where it is already the applicable license', () => {
    for (const path of mitPackages) {
      expect(readManifest(path).license, path).toBe('MIT');
    }

    expect(readRepoFile('packages/consuelo-website/LICENSE')).toContain(
      'Copyright (c) 2024 Oxygenna',
    );
  });

  it('preserves the vendored Open Design Apache attribution', () => {
    expect(readRepoFile('packages/consuelo-design/UPSTREAM.md')).toContain(
      'Open Design declares `Apache-2.0`',
    );
    expect(
      readRepoFile('packages/consuelo-design/upstream/open-design/LICENSE'),
    ).toContain('Copyright 2026 Open Design contributors');
  });

  it('uses Consuelo-specific public repository policy documents', () => {
    const security = readRepoFile('.github/SECURITY.md');
    const contributing = readRepoFile('.github/CONTRIBUTING.md');
    const codeOfConduct = readRepoFile('.github/CODE_OF_CONDUCT.md');

    expect(security).toContain('Consuelo');
    expect(security).not.toContain('twenty.com');
    expect(security).not.toContain('Twenty');

    expect(contributing).toContain('Contributing to Consuelo');
    expect(contributing).not.toContain('twentyhq/twenty');
    expect(contributing).not.toContain('docs.twenty.com');
    expect(contributing).not.toContain('Twenty');

    expect(codeOfConduct).toContain("Consuelo's Pledge");
    expect(codeOfConduct).not.toContain("Twenty's");
  });

  it('describes the actual license boundary in the root README', () => {
    const readme = readRepoFile('README.md');

    expect(readme).toContain('Apache-2.0');
    expect(readme).toContain('NOTICE');
    expect(readme).not.toContain('Consuelo OS is MIT licensed.');
  });
});
