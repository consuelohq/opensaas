import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
  RUNTIME_BUNDLE_MANIFEST_PATH,
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
  'scripts/native-lifecycle-operation.ts':
    'export const nativeLifecycleOperationFixture = true;\n',
  'scripts/lib/install-state.ts': 'export const installFixture = true;\n',
  'scripts/managed-components.ts':
    'export const managedComponentsCliFixture = true;\n',
  'scripts/lib/managed-components.ts':
    'export const managedComponentsFixture = true;\n',
  'scripts/lib/managed-component-install.ts':
    'export const managedComponentInstallFixture = true;\n',
  'manifests/generated/tool.manifest.json':
    '{"version":1,"kind":"consuelo-os-tool-manifest","tools":[]}\n',
  'manifests/generated/core.manifest.json':
    '{"version":1,"kind":"consuelo-os-core-manifest","tools":[]}\n',
  'hooks/dispatcher.js': 'export const dispatch = () => undefined;\n',
  'steering/system_prompt.md': '# Fixture system prompt\n',
  'steering/decision.md': '# Fixture decision process\n',
  'streams/tools/AGENTS.md': '# Fixture tools stream\n',
  'skills/task/SKILL.md': '# Fixture task skill\n',
  'skills/task/skill.json': '{"name":"task","entrypoint":"SKILL.md"}\n',
};

const writeFixtureFile = (
  root: string,
  relativePath: string,
  content: string,
  mode = 0o644,
): void => {
  const target = join(root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  chmodSync(target, mode);
};

const createFixture = (extraFiles: Record<string, string> = {}): string => {
  const root = mkdtempSync(join(tmpdir(), 'consuelo-runtime-bundle-'));
  fixtureRoots.push(root);
  for (const [relativePath, content] of Object.entries({
    ...requiredFixtureFiles,
    ...extraFiles,
  })) {
    writeFixtureFile(root, relativePath, content);
  }
  return root;
};

const buildOptions = (
  sourceRoot: string,
  overrides: Partial<RuntimeBundleBuildOptions> = {},
): RuntimeBundleBuildOptions => {
  return {
    architecture: 'arm64',
    minimumUpdaterVersion: '0.1.0',
    platform: 'darwin',
    sourceCommit: '0123456789abcdef0123456789abcdef01234567',
    sourceRoot,
    version: '1.2.3',
    ...overrides,
  };
};

const canonicalizeBundleValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalizeBundleValue);
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (item !== undefined) output[key] = canonicalizeBundleValue(item);
    }
    return output;
  }
  return value;
};

const bundleIdForFixtureManifest = (manifest: unknown): string => {
  const canonicalJson = JSON.stringify(canonicalizeBundleValue(manifest));
  return `sha256:${createHash('sha256').update(canonicalJson).digest('hex')}`;
};

afterEach(() => {
  for (const root of fixtureRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe('runtime bundle contract', () => {
  it('defines the integration entrypoint and package-script keys without wiring shared scripts', () => {
    expect(RUNTIME_BUNDLE_BUILDER_ENTRYPOINT).toBe(
      'scripts/build-runtime-bundle.ts',
    );
    expect(RUNTIME_BUNDLE_INTEGRATION_SCRIPT_KEYS).toEqual({
      build: 'runtime-bundle:build',
      fingerprint: 'runtime-bundle:fingerprint',
      verify: 'runtime-bundle:verify',
    });
  });

  it('builds native production dependencies in a disposable container stage', () => {
    const packageRoot = resolve(import.meta.dirname, '../..');
    const dockerfile = readFileSync(join(packageRoot, 'Dockerfile'), 'utf8');

    expect(dockerfile).toContain(
      'FROM oven/bun:1-slim AS runtime-dependencies',
    );
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
    const schema = JSON.parse(
      readFileSync(
        join(
          packageRoot,
          'scripts/lib/distribution/runtime-bundle.schema.json',
        ),
        'utf8',
      ),
    ) as {
      $defs: { file: { properties: { role: { enum: string[] } } } };
      $id: string;
      properties: {
        schemaVersion: { const: number };
      };
      required: string[];
    };

    expect(schema.$id).toBe(
      'https://consuelohq.com/schemas/runtime-bundle.v1.json',
    );
    expect(schema.properties.schemaVersion.const).toBe(1);
    expect(schema.$defs.file.properties.role.enum).toEqual([
      'runtime',
      'managed-skill',
      'managed-tool',
      'managed-site-template',
      'platform-adapter',
      'customer-provider',
    ]);
    expect(schema.required).toEqual(
      expect.arrayContaining([
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
      ]),
    );
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
        entrypoint,
        'build',
        '--source-root',
        root,
        '--source-commit',
        'fixture-source',
        '--minimum-updater-version',
        '0.1.0',
        '--output',
        archivePath,
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
        entrypoint,
        'build',
        '--source-root',
        root,
        '--version',
        '2.3.4',
        '--source-commit',
        'fixture-source',
        '--platform',
        'darwin',
        '--architecture',
        'arm64',
        '--minimum-updater-version',
        '0.1.0',
        '--output',
        archivePath,
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
      'scripts/seed-workspace-edge-route.ts':
        'export const routeSeed = true;\n',
    });

    expect(
      classifyRuntimeBundlePath('scripts/seed-workspace-edge-route.ts'),
    ).toBe('operator-only');
    expect(classifyRuntimeBundlePath('tools/filesystem/handler.ts')).toBe(
      'managed-tool',
    );
    expect(
      classifyRuntimeBundlePath('tools/deployment-provider/service.ts'),
    ).toBe('customer-provider');
    expect(
      classifyRuntimeBundlePath('tools/deployment-provider/process.ts'),
    ).toBe('customer-provider');
    expect(
      classifyRuntimeBundlePath('tools/deployment-provider/types.ts'),
    ).toBe('customer-provider');
    expect(classifyRuntimeBundlePath('tools/filesystem/manifest.ts')).toBe(
      'source-only',
    );
    expect(classifyRuntimeBundlePath('tools/filesystem/schema.ts')).toBe(
      'source-only',
    );
    expect(classifyRuntimeBundlePath('tools/filesystem/handler.test.ts')).toBe(
      'test-only',
    );
    expect(
      classifyRuntimeBundlePath('tools/deployment-provider/testing.ts'),
    ).toBe('test-only');
    expect(
      classifyRuntimeBundlePath('tools/deployment-provider/vercel.md'),
    ).toBe('source-only');
    expect(classifyRuntimeBundlePath('tools/railway/README.md')).toBe(
      'source-only',
    );
    expect(classifyRuntimeBundlePath('manifests/manifest.config.ts')).toBe(
      'source-only',
    );
    expect(
      classifyRuntimeBundlePath('scripts/lib/distribution/runtime-bundle.ts'),
    ).toBe('runtime');
    expect(classifyRuntimeBundlePath('assets/consuelo-mark.png')).toBe(
      'runtime',
    );
    expect(
      classifyRuntimeBundlePath('manifests/schemas/tool-manifest.schema.json'),
    ).toBe('source-only');
    expect(
      classifyRuntimeBundlePath('manifests/generated/tool.manifest.json'),
    ).toBe('managed-tool');
    expect(classifyRuntimeBundlePath('workflows/workflows.ts')).toBe(
      'source-only',
    );
    expect(
      classifyRuntimeBundlePath('workflows/generated/workflow-bundles.json'),
    ).toBe('managed-tool');
    expect(
      classifyRuntimeBundlePath(
        'tests/audit/fixtures/script-parity-classifications.json',
      ),
    ).toBe('test-only');
    expect(classifyRuntimeBundlePath('scripts/bootstrap.ps1')).toBe(
      'platform-adapter',
    );
    expect(classifyRuntimeBundlePath('scripts/windows-platform.ts')).toBe(
      'platform-adapter',
    );
    expect(classifyRuntimeBundlePath('scripts/lib/windows-platform.ts')).toBe(
      'platform-adapter',
    );
    expect(classifyRuntimeBundlePath('native/windows-service/Program.cs')).toBe(
      'platform-adapter',
    );
    expect(
      classifyRuntimeBundlePath(
        'native/windows-service/Consuelo.Windows.Service.csproj',
      ),
    ).toBe('platform-adapter');
    expect(classifyRuntimeBundlePath('native/macos/Package.swift')).toBe(
      'platform-adapter',
    );
    expect(
      classifyRuntimeBundlePath(
        'native/macos/Sources/ConsueloMenuBarApp/main.swift',
      ),
    ).toBe('platform-adapter');
    expect(
      classifyRuntimeBundlePath(
        'native/macos/.build/arm64-apple-macosx/release/ConsueloMenuBarApp',
      ),
    ).toBe('source-only');
    await expect(
      buildRuntimeBundle(
        buildOptions(root, {
          includePaths: [
            ...Object.keys(requiredFixtureFiles),
            'scripts/seed-workspace-edge-route.ts',
          ],
        }),
      ),
    ).rejects.toThrow(
      'operator-only content cannot enter a runtime bundle: scripts/seed-workspace-edge-route.ts',
    );
  });

  it('excludes SwiftPM build products from default runtime discovery', async () => {
    const root = createFixture({
      'native/macos/Sources/ConsueloMenuBarApp/main.swift': 'import SwiftUI\n',
      'native/macos/.build/arm64-apple-macosx/release/ConsueloMenuBarApp':
        'host-specific generated binary\n',
    });

    const result = await computeReleaseFingerprint({ sourceRoot: root });
    const paths = result.files.map((file) => file.path);

    expect(paths).toContain(
      'native/macos/Sources/ConsueloMenuBarApp/main.swift',
    );
    expect(
      paths.some((filePath) => filePath.startsWith('native/macos/.build/')),
    ).toBe(false);
  });

  it('excludes generated Windows service build products from default runtime discovery', async () => {
    const root = createFixture({
      'native/windows-service/Program.cs': 'public static class Program {}\n',
      'native/windows-service/Consuelo.Windows.Service.csproj':
        '<Project Sdk="Microsoft.NET.Sdk.Worker" />\n',
    });
    writeFixtureFile(
      root,
      'native/windows-service/obj/x64/Release/Consuelo.Windows.Service.csproj.FileListAbsolute.txt',
      `${root}/native/windows-service/bin/x64/Release/Consuelo.Windows.Service.exe\n`,
    );
    writeFixtureFile(
      root,
      'native/windows-service/bin/x64/Release/Consuelo.Windows.Service.exe',
      'host-specific generated binary\n',
    );

    const result = await computeReleaseFingerprint({ sourceRoot: root });
    const paths = result.files.map((file) => file.path);

    expect(paths).toContain('native/windows-service/Program.cs');
    expect(paths).toContain(
      'native/windows-service/Consuelo.Windows.Service.csproj',
    );
    expect(
      paths.some(
        (filePath) =>
          filePath.startsWith('native/windows-service/obj/') ||
          filePath.startsWith('native/windows-service/bin/'),
      ),
    ).toBe(false);
  });

  it('classifies all customer deployment adapters separately from operator infrastructure', () => {
    for (const filePath of [
      'tools/deployment-provider/facade.ts',
      'tools/deployment-provider/service.ts',
      'tools/deployment-provider/process.ts',
      'tools/deployment-provider/types.ts',
      'tools/deployment-provider/errors.ts',
      'tools/deployment-provider/redaction.ts',
      'tools/deployment-provider/vercel.ts',
      'tools/deployment-provider/cloudflare.ts',
      'tools/deployment-provider/cloudflare-runner.ts',
      'tools/railway/adapter.ts',
      'tools/railway/service.ts',
      'tools/railway/cli.ts',
    ]) {
      expect(classifyRuntimeBundlePath(filePath), filePath).toBe(
        'customer-provider',
      );
    }

    for (const filePath of [
      'cloudflare/workspace-edge-router/src/index.ts',
      'operator/deploy-cloudflare.ts',
      'scripts/lib/platform-cloudflare-provisioning.ts',
      'scripts/lib/workspace-cloudflare-edge-router.ts',
    ]) {
      expect(classifyRuntimeBundlePath(filePath), filePath).toBe(
        'operator-only',
      );
    }
  });

  it('fails when an explicitly requested file has no classification', async () => {
    const root = createFixture({ 'mystery.bin': 'unclassified\n' });

    await expect(
      buildRuntimeBundle(
        buildOptions(root, {
          includePaths: [...Object.keys(requiredFixtureFiles), 'mystery.bin'],
        }),
      ),
    ).rejects.toThrow('unclassified runtime-bundle path: mystery.bin');
  });

  it('rejects machine-specific absolute paths and internal fixture hosts', async () => {
    const absoluteRoot = createFixture({
      'scripts/lib/leak.ts':
        "export const path = '/Users/alice/Dev/opensaas';\n",
    });
    await expect(
      buildRuntimeBundle(buildOptions(absoluteRoot)),
    ).rejects.toThrow(
      'machine-specific absolute path found in scripts/lib/leak.ts',
    );

    const hostRoot = createFixture({
      'scripts/lib/host.ts':
        "export const host = 'os-dist-worker-123.consuelohq.com';\n",
    });
    await expect(buildRuntimeBundle(buildOptions(hostRoot))).rejects.toThrow(
      'known internal test host found in scripts/lib/host.ts',
    );
  });

  it('requires a boundary after the source root when detecting embedded paths', async () => {
    const root = createFixture();
    writeFixtureFile(
      root,
      'bun.lock',
      `https://registry.example.test${root}-map\n`,
    );

    await expect(buildRuntimeBundle(buildOptions(root))).resolves.toMatchObject(
      {
        manifest: { version: '1.2.3' },
      },
    );

    writeFixtureFile(
      root,
      'scripts/lib/leak.ts',
      `export const path = '${root}/secret';\n`,
    );
    await expect(buildRuntimeBundle(buildOptions(root))).rejects.toThrow(
      'machine-specific absolute path found in scripts/lib/leak.ts',
    );
  });

  it('applies source-root boundaries consistently on Unix and Windows paths', () => {
    const cases = [
      { root: '/source', separator: '/' },
      { root: '/tmp/runtime-bundle', separator: '/' },
      {
        root: 'C:\\Users\\runner\\AppData\\Local\\Temp\\runtime-bundle',
        separator: '\\',
      },
    ];

    for (const { root, separator } of cases) {
      expect(
        containsMachineSpecificAbsolutePath(
          `https://registry.example.test${root}-map`,
          root,
        ),
      ).toBe(false);
      expect(
        containsMachineSpecificAbsolutePath(
          `export const path = '${root}${separator}secret';`,
          root,
        ),
      ).toBe(true);
    }
  });

  it('keeps the release fingerprint stable across allocated versions', async () => {
    const root = createFixture({
      'scripts/railway-logs.js':
        'export const railwayCustomerCapability = true;\n',
    });

    expect(classifyRuntimeBundlePath('scripts/railway-logs.js')).toBe(
      'source-only',
    );
    const first = await computeReleaseFingerprint({ sourceRoot: root });
    const versionOne = await buildRuntimeBundle(
      buildOptions(root, { version: '1.2.3' }),
    );
    const versionTwo = await buildRuntimeBundle(
      buildOptions(root, { version: '1.2.4' }),
    );

    expect(versionOne.manifest.releaseFingerprint).toBe(
      first.releaseFingerprint,
    );
    expect(versionTwo.manifest.releaseFingerprint).toBe(
      first.releaseFingerprint,
    );
    expect(versionOne.manifest.version).toBe('1.2.3');
    expect(versionTwo.manifest.version).toBe('1.2.4');
    expect(versionOne.manifest.bundleId).not.toBe(versionTwo.manifest.bundleId);
  });

  it('keeps the release fingerprint stable across POSIX and Windows source representations', async () => {
    const portableScript = '#!/usr/bin/env bash\necho portable\n';
    const posixRoot = createFixture({ 'scripts/portable.sh': portableScript });
    writeFixtureFile(posixRoot, 'scripts/portable.sh', portableScript, 0o755);

    const windowsRoot = createFixture({
      'scripts/portable.sh': portableScript.replaceAll('\n', '\r\n'),
    });
    for (const [relativePath, content] of Object.entries({
      ...requiredFixtureFiles,
      'scripts/portable.sh': portableScript,
    })) {
      writeFixtureFile(
        windowsRoot,
        relativePath,
        content.replaceAll('\n', '\r\n'),
        0o666,
      );
    }

    const posix = await computeReleaseFingerprint({ sourceRoot: posixRoot });
    const windows = await computeReleaseFingerprint({
      sourceRoot: windowsRoot,
    });

    expect(windows.releaseFingerprint).toBe(posix.releaseFingerprint);
    expect(
      posix.files.find((file) => file.path === 'scripts/os.ts')?.mode,
    ).toBe(0o644);
    expect(
      windows.files.find((file) => file.path === 'scripts/os.ts')?.mode,
    ).toBe(0o644);
    expect(
      posix.files.find((file) => file.path === 'scripts/portable.sh')?.mode,
    ).toBe(0o755);
    expect(
      windows.files.find((file) => file.path === 'scripts/portable.sh')?.mode,
    ).toBe(0o755);
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

    const missingEntries = inspected.entries.filter(
      (entry) => entry.path !== 'hooks/dispatcher.js',
    );
    expect(() => verifyRuntimeBundleArchive(missingEntries)).toThrow(
      'runtime bundle archive is missing hooks/dispatcher.js',
    );
  });

  it('rejects unsupported policy versions even when the bundle ID is recomputed', async () => {
    const root = createFixture();
    const built = await buildRuntimeBundle(buildOptions(root));
    const inspected = inspectRuntimeBundleArchive(built.archiveBytes);
    const { bundleId: _bundleId, ...manifestWithoutBundleId } =
      inspected.manifest;
    const unsupportedManifestWithoutBundleId = {
      ...manifestWithoutBundleId,
      policyVersion: 2,
    };
    const unsupportedManifest = {
      ...unsupportedManifestWithoutBundleId,
      bundleId: bundleIdForFixtureManifest(unsupportedManifestWithoutBundleId),
    };
    const unsupportedEntries = inspected.entries.map((entry) =>
      entry.path === RUNTIME_BUNDLE_MANIFEST_PATH
        ? {
            ...entry,
            bytes: Buffer.from(
              `${JSON.stringify(canonicalizeBundleValue(unsupportedManifest), null, 2)}\n`,
            ),
          }
        : entry,
    );

    expect(() => verifyRuntimeBundleArchive(unsupportedEntries)).toThrow(
      'unsupported runtime bundle policy version: 2',
    );
  });

  it('fails when two declared authoritative customer tool manifests disagree', async () => {
    const root = createFixture({
      'manifests/tool-manifest-copy.json':
        '{"version":1,"kind":"consuelo-os-tool-manifest","tools":[{"name":"different"}]}\n',
    });

    await expect(
      buildRuntimeBundle(
        buildOptions(root, {
          authoritativeToolManifestPaths: [
            'manifests/generated/tool.manifest.json',
            'manifests/tool-manifest-copy.json',
          ],
        }),
      ),
    ).rejects.toThrow('authoritative customer tool manifests disagree');
  });

  it('builds the real customer closure twice with clean-host inventory parity', async () => {
    const packageRoot = resolve(import.meta.dirname, '../..');
    const first = await buildRuntimeBundle(
      buildOptions(packageRoot, {
        architecture: process.arch,
        platform: process.platform,
        sourceCommit: 'fixture-current-source-commit',
        version: '0.0.0-fixture.1',
      }),
    );
    const second = await buildRuntimeBundle(
      buildOptions(packageRoot, {
        architecture: process.arch,
        platform: process.platform,
        sourceCommit: 'fixture-current-source-commit',
        version: '0.0.0-fixture.1',
      }),
    );

    expect(first.archiveDigest).toBe(second.archiveDigest);
    expect(first.manifest.files.length).toBeGreaterThan(300);
    expect(
      first.manifest.files.some(
        (file) => file.path === 'scripts/railway-logs.js',
      ),
    ).toBe(false);
    expect(
      first.manifest.files.some(
        (file) => file.path === 'scripts/railway-redeploy.js',
      ),
    ).toBe(false);
    expect(first.manifest.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'scripts/managed-components.ts',
          role: 'runtime',
        }),
        expect.objectContaining({
          path: 'scripts/lib/managed-components.ts',
          role: 'runtime',
        }),
        expect.objectContaining({
          path: 'scripts/lib/managed-component-install.ts',
          role: 'runtime',
        }),
        expect.objectContaining({
          path: 'scripts/lib/distribution/runtime-bundle.ts',
          role: 'runtime',
        }),
        expect.objectContaining({
          path: 'assets/consuelo-mark.png',
          role: 'runtime',
        }),
        expect.objectContaining({
          path: 'tools/deployment-provider/facade.ts',
          role: 'customer-provider',
        }),
        expect.objectContaining({
          path: 'tools/deployment-provider/service.ts',
          role: 'customer-provider',
        }),
        expect.objectContaining({
          path: 'tools/deployment-provider/vercel.ts',
          role: 'customer-provider',
        }),
        expect.objectContaining({
          path: 'tools/deployment-provider/cloudflare.ts',
          role: 'customer-provider',
        }),
        expect.objectContaining({
          path: 'tools/railway/adapter.ts',
          role: 'customer-provider',
        }),
      ]),
    );
    expect(
      first.manifest.files.some(
        (file) => file.path === 'tools/deployment-provider/testing.ts',
      ),
    ).toBe(false);
    expect(
      first.manifest.files.some((file) =>
        file.path.startsWith('scripts/testing/'),
      ),
    ).toBe(false);
    expect(
      first.manifest.files.some(
        (file) => file.path === 'scripts/release-channels.ts',
      ),
    ).toBe(false);
    expect(
      first.manifest.files.some(
        (file) => file.path === 'scripts/prepare-release-publication.ts',
      ),
    ).toBe(false);
    expect(
      first.manifest.files.some((file) => file.path.startsWith('operator/')),
    ).toBe(false);
    expect(
      first.manifest.files.some((file) => file.path.startsWith('cloudflare/')),
    ).toBe(false);
    expect(
      first.manifest.files.some(
        (file) =>
          file.path === 'scripts/lib/platform-cloudflare-provisioning.ts',
      ),
    ).toBe(false);
    expect(first.excludedCounts['operator-only']).toBeGreaterThan(0);
    expect(first.excludedCounts['test-only']).toBeGreaterThan(0);
    const archive = inspectRuntimeBundleArchive(first.archiveBytes);
    const runtimeRoot = mkdtempSync(
      join(tmpdir(), 'consuelo-runtime-bundle-smoke-'),
    );
    fixtureRoots.push(runtimeRoot);
    for (const entry of archive.entries) {
      const target = join(runtimeRoot, entry.path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, entry.bytes);
      chmodSync(target, entry.mode);
    }
    const lifecycleStatus = spawnSync(
      'bun',
      [
        join(runtimeRoot, 'scripts/lifecycle.ts'),
        'status',
        '--home',
        join(runtimeRoot, 'home'),
        '--json',
      ],
      { encoding: 'utf8' },
    );
    expect(lifecycleStatus.status, lifecycleStatus.stderr).toBe(0);
    expect(JSON.parse(lifecycleStatus.stdout)).toMatchObject({
      command: 'status',
      ok: true,
      result: { installState: 'no-install' },
    });
    const installedHome = join(runtimeRoot, 'installed-home');
    const cloudInstall = spawnSync(
      'bun',
      [
        join(runtimeRoot, 'scripts/install.ts'),
        '--yes',
        '--quiet',
        '--skip-daemons',
        '--mode',
        'cloud',
        '--home',
        installedHome,
        '--workspace-url',
        'fixture.consuelohq.com',
        '--workspace-slug',
        'fixture',
      ],
      { encoding: 'utf8' },
    );
    expect(cloudInstall.status, cloudInstall.stderr).toBe(0);
    expect(existsSync(join(installedHome, 'config.json'))).toBe(true);
    expect(existsSync(join(installedHome, 'operator'))).toBe(false);
    const bundledSteering = archive.entries.find(
      (entry) => entry.path === 'steering/system_prompt.md',
    );
    expect(bundledSteering?.bytes.toString('utf8')).toContain(
      '/Users/.../Dev/opensaas',
    );
    expect(bundledSteering?.bytes.toString('utf8')).not.toContain(
      '/Users/kokayi/',
    );
    expect(readFileSync(join(packageRoot, 'Dockerfile'), 'utf8')).toContain(
      'scripts/build-runtime-bundle.ts',
    );
    expect(() => verifyRuntimeBundleArchive(first.archiveBytes)).not.toThrow();
  }, 120_000);
});
