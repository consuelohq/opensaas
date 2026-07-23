import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../../../..');

function read(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

describe('Consuelo OS release-channel workflows', () => {
  it('keeps pull requests validation-only and publishes dev only from main', () => {
    const workflow = read('.github/workflows/consuelo-os-runtime-publish.yaml');

    expect(workflow).toContain('push:');
    expect(workflow).toContain('- main');
    expect(workflow).not.toContain('pull_request:');
    expect(workflow).toContain('contents: write');
    expect(workflow).toContain('deployments: write');
    expect(workflow).toContain('environment: consuelo-os-dev');
    expect(workflow).toContain('runtime-bundle:fingerprint');
    expect(workflow).toContain('release:channels -- publish');
    expect(workflow).toContain('--plan-only');
    expect(workflow).toContain('if: steps.plan.outputs.changed == \'true\'');
    expect(workflow).toContain('darwin-arm64');
    expect(workflow).toContain('linux-x64');
    expect(workflow).toContain('windows-x64');
    expect(workflow).toContain('CLOUDFLARE_OS_RELEASE_API_TOKEN');
    expect(workflow).toContain('CONSUELO_OS_RELEASE_SIGNING_PRIVATE_KEY');
    expect(workflow).not.toContain('release-state.json" \
            --remote \
            --file "${RELEASE_STATE_PATH}" || true');
    expect(workflow).toContain('No authoritative release state exists yet.');
    expect(workflow).toContain('Failed to restore authoritative release state.');
    expect(workflow).not.toContain('mapfile -t tags < <(');
    expect(workflow).toContain('.release/immutable-tags.txt');
    expect(workflow).toContain('actions/runs/${GITHUB_RUN_ID}');
    expect(workflow).toContain('--now \"${release_time}\"');
  });

  it('promotes only by manual dispatch through protected environments and never rebuilds', () => {
    const workflow = read('.github/workflows/consuelo-os-runtime-promote.yaml');

    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toContain('pull_request:');
    expect(workflow).not.toContain('push:');
    expect(workflow).toContain('environment: consuelo-os-${{ inputs.to }}');
    expect(workflow).toContain('release:channels -- promote');
    expect(workflow).toContain('--from "${{ inputs.from }}"');
    expect(workflow).toContain('--to "${{ inputs.to }}"');
    expect(workflow).toContain('--bundle "${{ inputs.bundle }}"');
    expect(workflow).toContain('--approval-evidence');
    expect(workflow).not.toContain('build-runtime-bundle');
    expect(workflow).not.toContain('runtime-bundle:build');
    expect(workflow).toContain('actions/runs/${GITHUB_RUN_ID}');
    expect(workflow).toContain('--now \"${release_time}\"');
  });

  it('provides a manual rollback path that also avoids rebuilding', () => {
    const workflow = read('.github/workflows/consuelo-os-runtime-rollback.yaml');

    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('environment: consuelo-os-${{ inputs.channel }}');
    expect(workflow).toContain('release:channels -- rollback-channel');
    expect(workflow).toContain('--channel "${{ inputs.channel }}"');
    expect(workflow).toContain('--bundle "${{ inputs.bundle }}"');
    expect(workflow).not.toContain('build-runtime-bundle');
    expect(workflow).toContain('actions/runs/${GITHUB_RUN_ID}');
    expect(workflow).toContain('--now \"${release_time}\"');
  });

  it('allowlists only the dedicated release workflows for write permissions', () => {
    const guard = read('packages/workspace/scripts/ci/check-github-workflows.cjs');

    expect(guard).toContain("'.github/workflows/consuelo-os-runtime-publish.yaml'");
    expect(guard).toContain("'.github/workflows/consuelo-os-runtime-promote.yaml'");
    expect(guard).toContain("'.github/workflows/consuelo-os-runtime-rollback.yaml'");
  });

  it('wires a Bun-owned release command and documents all supported operations', () => {
    const packageJson = JSON.parse(read('packages/os/package.json')) as {
      scripts: Record<string, string>;
    };
    const scriptsDoc = read('packages/os/SCRIPTS.md');
    const releaseDoc = read('packages/os/docs/distribution/release-channels.md');

    expect(packageJson.scripts['release:channels']).toBe('bun ./scripts/release-channels.ts');
    for (const command of ['publish', 'promote', 'inspect', 'rollback-channel']) {
      expect(scriptsDoc).toContain(command);
      expect(releaseDoc).toContain(command);
    }
    expect(releaseDoc).toContain('consuelo-os-dev');
    expect(releaseDoc).toContain('consuelo-os-canary');
    expect(releaseDoc).toContain('consuelo-os-beta');
    expect(releaseDoc).toContain('consuelo-os-stable');
    expect(releaseDoc).toContain('promotion never rebuilds');
  });
});
