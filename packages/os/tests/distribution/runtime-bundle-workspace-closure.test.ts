import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { computeReleaseFingerprint } from '../../scripts/lib/distribution/runtime-bundle';

const DIFF_COCKPIT_RUNTIME_PATH =
  'scripts/server/vendor/diff-cockpit.ts';

describe('runtime bundle workspace closure', () => {
  it('vendors the Diff Cockpit implementation into the standalone OS archive', async () => {
    const packageRoot = resolve(import.meta.dirname, '../..');
    const sourcePath = resolve(
      packageRoot,
      '../diff-cockpit/src/index.ts',
    );

    const fingerprint = await computeReleaseFingerprint({
      sourceRoot: packageRoot,
      vendoredSources: [
        {
          path: DIFF_COCKPIT_RUNTIME_PATH,
          sourcePath,
        },
      ],
    });
    const vendored = fingerprint.files.find(
      (file) => file.path === DIFF_COCKPIT_RUNTIME_PATH,
    );
    const source = readFileSync(sourcePath);

    expect(vendored).toMatchObject({
      digest: `sha256:${createHash('sha256').update(source).digest('hex')}`,
      path: DIFF_COCKPIT_RUNTIME_PATH,
      role: 'runtime',
      size: source.byteLength,
    });
  });

  it('wires the vendored source into publication and runtime imports', () => {
    const packageRoot = resolve(import.meta.dirname, '../..');
    const repositoryRoot = resolve(packageRoot, '../..');
    const workflow = readFileSync(
      resolve(
        repositoryRoot,
        '.github/workflows/consuelo-os-runtime-publish.yaml',
      ),
      'utf8',
    );
    const gateway = readFileSync(
      resolve(packageRoot, 'scripts/server/services/diffs-gateway.ts'),
      'utf8',
    );
    const vendoredSourceFlag =
      '--vendored-source "scripts/server/vendor/diff-cockpit.ts=../diff-cockpit/src/index.ts"';

    expect(workflow).toContain("- 'packages/diff-cockpit/**'");
    expect(workflow.match(/--vendored-source/g)).toHaveLength(2);
    expect(workflow).toContain(vendoredSourceFlag);
    expect(gateway).toContain("from '../vendor/diff-cockpit';");
    expect(gateway).not.toContain("from '../../../../diff-cockpit/src/index';");
  });
});
