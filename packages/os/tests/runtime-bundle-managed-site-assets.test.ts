import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  classifyRuntimeBundlePath,
  computeReleaseFingerprint,
  containsMachineSpecificAbsolutePath,
} from '../scripts/lib/distribution/runtime-bundle';

const V38_ASSETS = [
  'assets/vendor/observability-traces-v38/base.css',
  'assets/vendor/observability-traces-v38/gsap.js',
  'assets/vendor/observability-traces-v38/inspector.css',
  'assets/vendor/observability-traces-v38/inspector.js',
  'assets/vendor/observability-traces-v38/mobile.css',
  'assets/vendor/observability-traces-v38/scroll.js',
  'assets/vendor/observability-traces-v38/table-overview.js',
  'assets/vendor/observability-traces-v38/template.html',
] as const;

const OS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('runtime bundle managed Trace Burn assets', () => {
  it('classifies the OS-owned v38 asset closure as managed site templates', () => {
    for (const path of V38_ASSETS) {
      expect(classifyRuntimeBundlePath(path)).toBe('managed-site-template');
    }
  });

  it('ships a portable v38 browser runtime without build-machine paths', () => {
    const runtime = readFileSync(
      resolve(OS_ROOT, 'assets/vendor/observability-traces-v38/inspector.js'),
      'utf8',
    );

    expect(containsMachineSpecificAbsolutePath(runtime, OS_ROOT)).toBe(false);
  });

  it('includes the OS-owned v38 asset closure in the real customer release fingerprint', async () => {
    const release = await computeReleaseFingerprint({ sourceRoot: OS_ROOT });
    const byPath = new Map(release.files.map((file) => [file.path, file]));

    for (const path of V38_ASSETS) {
      expect(byPath.get(path)).toMatchObject({
        path,
        role: 'managed-site-template',
      });
    }
  });
});
