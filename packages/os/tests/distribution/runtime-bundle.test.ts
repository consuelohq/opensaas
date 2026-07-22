import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  RUNTIME_BUNDLE_BUILDER_ENTRYPOINT,
  RUNTIME_BUNDLE_INTEGRATION_SCRIPT_KEYS,
  buildRuntimeBundle,
  classifyRuntimeBundlePath,
  computeReleaseFingerprint,
  containsMachineSpecificAbsolutePath,
  inspectRuntimeBundleArchive,
  verifyRuntimeBundleArchive,
  type RuntimeBundleBuildOptions,
} from '../../scripts/lib/distribution/runtime-bundle';

const fixtureRoots: string[] = [];

const requiredFixtureFiles: Record<string, string> = {
  'package.json': '{"name":"@consuelo/os-fixture","private":true}\n',
  'bun.lock': 'fixture-lock\n',
  'scripts/os.ts': 'export const osFixture = true;\n',
  'scripts/server/main.ts': 'export const serverFixture = true;\n',
  'scripts/lib/install-state.ts': 'export const installFixture = true;\n',
  'manifests/generated/tool.manifest.json': '{"version":1,"kind":"consuelo-os-tool-manifest","tools":[]}\n',
  'manifests/generated/core.manifest.json': '{"version":1,"kind":"consuelo-os-core-manifest","tools":[]}\n',
  'hooks/dispatcher.js': 'export const dispatch = () => undefined;\n',
  'steering/system_prompt.md': '# Fixture system prompt\n',
  'steering/decision.md': '# Fixture decision process\n',
  'streams/tools/AGENTS.md': '# Fixture tools stream\n',
  'skills/task/SKILL.md': '# Fixture task skill\n',
  'skills/task/skill.json': '{"name":"task","entrypoint":"SKILL.md"}\n',
};

function writeFixtureFile(root: string, relativePath: string, content: string, mode = 0o644): void {
  const target = join(root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  chmodSync(target, mode);
}

function createFixture(extraFiles: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'consuelo-runtime-bundle-'));
  fixtureRoots.push(root);
  for (const [relativePath, content] of Object.entries({
    ...requiredFixtureFiles,
    ...extraFiles,
  })) {
    writeFixtureFile(root, relativePath, content);
  }
  return root;
}

function buildOptions(sourceRoot: string, overrides: Partial<RuntimeBundleBuildOptions> = {}): RuntimeBundleBuildOptions {
  return {
    architecture: 'arm64',
    minimumUpdaterVersion: '0.1.0',
    platform: 'darwin',
    sourceCommit: '0123456789abcdef0123456789abcdef01234567',
    sourceRoot,
    version: '1.2.3',
    ...overrides,
  };
}

afterEach(() => {
  for (const root of fixtureRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe('runtime bundle contract', () => {
  it('defines the integration entrypoint and package-script keys without wiring shared scripts', () => {
    expect(RUNTIME_BUNDLE_BUILDER_ENTRYPOINT).toBe('scripts/build-runtime-bundle.ts');
    expect(RUNTIME_BUNDLE_INTEGRATION_SCRIPT_KEYS).toEqual({
      build: 'runtime-bundle:build',
      fingerprint: 'runtime-bundle:fingerprint',
      verify: 'runtime-bundle:verify',
    });
  });

  it('builds native production dependencies in a disposable container stage', () => {
    const packageRoot = resolve(import.meta.dirname, '../..');
    const dockerfile = readFileSync(join(packageRoot, 'Dockerfile'), 'utf8');

    expect(dockerfile).toContain('FROM oven/bun:1-slim AS runtime-dependencies');
    expect(dockerfile).toContain('python3 make g++');
    expect(dockerfile).toContain('ARG TARGETARCH\n');
    expect(dockerfile).not.toContain('ARG TARGETARCH=unknown');
    expect(dockerfile).toContain(
      'COPY --from=runtime-dependencies /app/node_modules ./node_modules',
    );
    expect(dockerfile.match(/apt-get install/g)).toHaveLength(1);
  });

  it('publishes a versioned JSON Schema for later channel and updater workers', () => {
    const packageRoot = resolve(import.meta.dirname, '../..');
    const schema = JSON.parse(readFileSync(
      join(packageRoot, 'scripts/lib/distribution/runtime-bundle.schema.json'),
      'utf8',
    )) as {
      $defs: { file: { properties: { role: { enum: string[] } } } };
      $id: string;
      properties: {
        schemaVersion: { const: number };
      };
      required: string[];
    };

    expect(schema.$id).toBe('https://consuelohq.com/schemas/runtime-bundle.v1.json');
    expect(schema.properties.schemaVersion.const).toBe(1);
    expect(schema.$defs.file.properties.role.enum).toEqual([
      'runtime',
      'managed-skill',
      'managed-tool',
      'managed-site-template',
      'platform-adapter',
      'customer-provider',
    ]);
    expect(schema.required).toEqual(expect.arrayContaining([
      'architecture',
      'bundleId',
      'files',
      'migrations',
      'minimumUpdaterVersion',
      'platform',
      'provenance',
      'releaseFingerprint',
      'signature',
      'sourceCommit',
      'version',
    ]));
  });

  it('runs fingerprint, build, and verify through the direct Bun entrypoint', () => {
    const root = createFixture();
    const packageRoot = resolve(import.meta.dirname, '../..');
    const entrypoint = join(packageRoot, RUNTIME_BUNDLE_BUILDER_ENTRYPOINT);
    const archivePath = join(root, 'output', 'runtime-bundle.tar.gz');

    const fingerprint = spawnSync(
      'bun',
      [entrypoint, 'fingerprint', '--source-root', root],
      { encoding: 'utf8' },
    );
    expect(fingerprint.status).toBe(0);
    expect(JSON.parse(fingerprint.stdout)).toMatchObject({
      files: expect.any(Array),
      releaseFingerprint: expect.stringMatching(/^sha256:/),
    });

    const missingVersion = spawnSync(
      'bun',
      [
        entrypoint, 'build',
        '--source-root', root,
        '--source-commit', 'fixture-source',
        '--minimum-updater-version', '0.1.0',
        '--output', archivePath,
      ],
      { encoding: 'utf8' },
    );
    expect(missingVersion.status).toBe(1);
    expect(JSON.parse(missingVersion.stderr)).toEqual({
      error: '--version is required',
      ok: false,
    });

    const build = spawnSync(
      'bun',
      [
        entrypoint, 'build',
        '--source-root', root,
        '--version', '2.3.4',
        '--source-commit', 'fixture-source',
        '--platform', 'darwin',
        '--architecture', 'arm64',
        '--minimum-updater-version', '0.1.0',
        '--output', archivePath,
      ],
      { encoding: 'utf8' },
    );
    expect(build.status).toBe(0);
    expect(existsSync(archivePath)).toBe(true);
    expect(JSON.parse(build.stdout)).toMatchObject({
      fileCount: Object.keys(requiredFixtureFiles).length,
      outputPath: archivePath,
      version: '2.3.4',
    });

    const verify = spawnSync(
      'bun',
      [entrypoint, 'verify', '--archive', archivePath],
      { encoding: 'utf8' },
    );
    expect(verify.status).toBe(0);
    expect(JSON.parse(verify.stdout)).toMatchObject({
      archivePath,
      fileCount: Object.keys(requiredFixtureFiles).length,
      valid: true,
      version: '2.3.4',
    });
  });

  it('fails when a required runtime input is missing', async () => {
    const root = createFixture();
    rmSync(join(root, 'scripts/server/main.ts'));

    await expect(buildRuntimeBundle(buildOptions(root))).rejects.toThrow(
      'required runtime input is missing: scripts/server/main.ts',
    );
  });

  it('fails closed when an operator-only file is explicitly requested', async () => {
    const root = createFixture({
      'scripts/seed-workspace-edge-route.ts': 'export const routeSeed = true;\n',
    });

    expect(classifyRuntimeBundlePath('scripts/seed-workspace-edge-route.ts')).toBe('operator-only');
    expect(classifyRuntimeBundlePath('tools/filesystem/handler.ts')).toBe('managed-tool');
    expect(classifyRuntimeBundlePath('tools/filesystem/manifest.ts')).toBe('source-only');
    expect(classifyRuntimeBundlePath('tools/filesystem/schema.ts')).toBe('source-only');
    expect(classifyRuntimeBundlePath('tools/filesystem/handler.test.ts')).toBe('test-only');
    expect(classifyRuntimeBundlePath('manifests/manifest.config.ts')).toBe('source-only');
    expect(classifyRuntimeBundlePath('manifests/schemas/tool-manifest.schema.json')).toBe('source-only');
    expect(classifyRuntimeBundlePath('manifests/generated/tool.manifest.json')).toBe('managed-tool');
    expect(classifyRuntimeBundlePath('workflows/workflows.ts')).toBe('source-only');
    expect(classifyRuntimeBundlePath('workflows/generated/workflow-bundles.json')).toBe('managed-tool');
    expect(classifyRuntimeBundlePath('tests/audit/fixtures/script-parity-classifications.json')).toBe('test-only');
    await expect(
      buildRuntimeBundle(buildOptions(root, {
        includePaths: [
          ...Object.keys(requiredFixtureFiles),
          'scripts/seed-workspace-edge-route.ts',
        ],
      })),
    ).rejects.toThrow(
      'operator-only content cannot enter a runtime bundle: scripts/seed-workspace-edge-route.ts',
    );
  });

  it('fails when an explicitly requested file has no classification', async () => {
    const root = createFixture({ 'mystery.bin': 'unclassified\n' });

    await expect(
      buildRuntimeBundle(buildOptions(root, {
        includePaths: [...Object.keys(requiredFixtureFiles), 'mystery.bin'],
      })),
    ).rejects.toThrow('unclassified runtime-bundle path: mystery.bin');
  });

  it('rejects machine-specific absolute paths and internal fixture hosts', async () => {
    const absoluteRoot = createFixture({
      'scripts/lib/leak.ts': "export const path = '/Users/alice/Dev/opensaas';\n",
    });
    await expect(buildRuntimeBundle(buildOptions(absoluteRoot))).rejects.toThrow(
      'machine-specific absolute path found in scripts/lib/leak.ts',
    );

    const hostRoot = createFixture({
      'scripts/lib/host.ts': "export const host = 'os-dist-worker-123.consuelohq.com';\n",
    });
    await expect(buildRuntimeBundle(buildOptions(hostRoot))).rejects.toThrow(
      'known internal test host found in scripts/lib/host.ts',
    );
  });

  it('requires a boundary after the source root when detecting embedded paths', async () => {
    const root = createFixture();
    writeFixtureFile(root, 'bun.lock', `https://registry.example.test${root}-map\n`);

    await expect(buildRuntimeBundle(buildOptions(root))).resolves.toMatchObject({
      manifest: { version: '1.2.3' },
    });

    writeFixtureFile(root, 'scripts/lib/leak.ts', `export const path = '${root}/secret';\n`);
    await expect(buildRuntimeBundle(buildOptions(root))).rejects.toThrow(
      'machine-specific absolute path found in scripts/lib/leak.ts',
    );
  });

  it('applies source-root boundaries consistently on Unix and Windows paths', () => {
    const cases = [
      { root: '/tmp/runtime-bundle', separator: '/' },
      { root: 'C:\\Users\\runner\\AppData\\Local\\Temp\\runtime-bundle', separator: '\\' },
    ];

    for (const { root, separator } of cases) {
      expect(containsMachineSpecificAbsolutePath(
        `https://registry.example.test${root}-map`,
        root,
      )).toBe(false);
      expect(containsMachineSpecificAbsolutePath(
        `export const path = '${root}${separator}secret';`,
        root,
      )).toBe(true);
    }
  });

  it('keeps the release fingerprint stable across allocated versions', async () => {
    const root = createFixture({
      'scripts/railway-logs.js': 'export const railwayCustomerCapability = true;\n',
    });

    expect(classifyRuntimeBundlePath('scripts/railway-logs.js')).toBe('customer-provider');
    const first = await computeReleaseFingerprint({ sourceRoot: root });
    const versionOne = await buildRuntimeBundle(buildOptions(root, { version: '1.2.3' }));
    const versionTwo = await buildRuntimeBundle(buildOptions(root, { version: '1.2.4' }));

    expect(versionOne.manifest.releaseFingerprint).toBe(first.releaseFingerprint);
    expect(versionTwo.manifest.releaseFingerprint).toBe(first.releaseFingerprint);
    expect(versionOne.manifest.version).toBe('1.2.3');
    expect(versionTwo.manifest.version).toBe('1.2.4');
    expect(versionOne.manifest.bundleId).not.toBe(versionTwo.manifest.bundleId);
  });

  it('produces byte-identical archives with deterministic ordering', async () => {
    const root = createFixture({
      'scripts/z-last.ts': 'export const z = true;\n',
      'scripts/a-first.ts': 'export const a = true;\n',
    });

    const first = await buildRuntimeBundle(buildOptions(root));
    const second = await buildRuntimeBundle(buildOptions(root));

    expect(first.archiveDigest).toBe(second.archiveDigest);
    expect(Buffer.compare(first.archiveBytes, second.archiveBytes)).toBe(0);
    expect(first.manifest.files.map((file) => file.path)).toEqual(
      [...first.manifest.files.map((file) => file.path)].sort(),
    );
    expect(first.manifest.version).toBe('1.2.3');
    expect(first.manifest.provenance).toEqual({
      builder: '@consuelo/os/runtime-bundle',
      builderVersion: 1,
      reproducible: true,
      source: 'classified-source-tree',
    });
  });

  it('detects payload digest drift and manifest/archive mismatch', async () => {
    const root = createFixture();
    const built = await buildRuntimeBundle(buildOptions(root));
    const inspected = inspectRuntimeBundleArchive(built.archiveBytes);

    expect(() => verifyRuntimeBundleArchive(built.archiveBytes)).not.toThrow();

    const driftedEntries = inspected.entries.map((entry) =>
      entry.path === 'scripts/os.ts'
        ? { ...entry, bytes: Buffer.from('tampered\n') }
        : entry,
    );
    expect(() => verifyRuntimeBundleArchive(driftedEntries)).toThrow(
      'runtime bundle digest mismatch for scripts/os.ts',
    );

    const missingEntries = inspected.entries.filter((entry) => entry.path !== 'hooks/dispatcher.js');
    expect(() => verifyRuntimeBundleArchive(missingEntries)).toThrow(
      'runtime bundle archive is missing hooks/dispatcher.js',
    );
  });

  it('fails when two declared authoritative customer tool manifests disagree', async () => {
    const root = createFixture({
      'manifests/tool-manifest-copy.json': '{"version":1,"kind":"consuelo-os-tool-manifest","tools":[{"name":"different"}]}\n',
    });

    await expect(
      buildRuntimeBundle(buildOptions(root, {
        authoritativeToolManifestPaths: [
          'manifests/generated/tool.manifest.json',
          'manifests/tool-manifest-copy.json',
        ],
      })),
    ).rejects.toThrow('authoritative customer tool manifests disagree');
  });

  it('builds the real customer closure twice with clean-host inventory parity', async () => {
    const packageRoot = resolve(import.meta.dirname, '../..');
    const first = await buildRuntimeBundle(buildOptions(packageRoot, {
      architecture: process.arch,
      platform: process.platform,
      sourceCommit: 'fixture-current-source-commit',
      version: '0.0.0-fixture.1',
    }));
    const second = await buildRuntimeBundle(buildOptions(packageRoot, {
      architecture: process.arch,
      platform: process.platform,
      sourceCommit: 'fixture-current-source-commit',
      version: '0.0.0-fixture.1',
    }));

    expect(first.archiveDigest).toBe(second.archiveDigest);
    expect(first.manifest.files.length).toBeGreaterThan(300);
    expect(first.manifest.files.some((file) => file.path === 'scripts/railway-logs.js')).toBe(true);
    expect(first.manifest.files.some((file) => file.path.startsWith('scripts/testing/'))).toBe(false);
    expect(first.manifest.files.some((file) => file.path.startsWith('operator/'))).toBe(false);
    expect(first.excludedCounts['operator-only']).toBeGreaterThan(0);
    expect(first.excludedCounts['test-only']).toBeGreaterThan(0);
    const archive = inspectRuntimeBundleArchive(first.archiveBytes);
    const bundledSteering = archive.entries.find(
      (entry) => entry.path === 'steering/system_prompt.md',
    );
    expect(bundledSteering?.bytes.toString('utf8')).toContain('/Users/.../Dev/opensaas');
    expect(bundledSteering?.bytes.toString('utf8')).not.toContain('/Users/kokayi/');
    expect(readFileSync(join(packageRoot, 'Dockerfile'), 'utf8')).toContain(
      'scripts/build-runtime-bundle.ts',
    );
    expect(() => verifyRuntimeBundleArchive(first.archiveBytes)).not.toThrow();
  });
});
