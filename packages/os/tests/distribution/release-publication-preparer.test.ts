import { spawnSync } from 'node:child_process';
import { generateKeyPairSync, verify as verifyBytes } from 'node:crypto';
import {
  chmodSync,
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
  canonicalBundleSignatureJson,
  releaseSetIdForBundles,
  type BundleSignaturePayload,
  type DevPublicationInput,
} from '../../scripts/lib/distribution/release-channels';
import { buildRuntimeBundle } from '../../scripts/lib/distribution/runtime-bundle';

const roots: string[] = [];
const SOURCE_COMMIT = '0123456789abcdef0123456789abcdef01234567';

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'consuelo-release-prepare-'));
  roots.push(root);
  return root;
}

function writeFixtureFile(root: string, relativePath: string, content: string): void {
  const target = join(root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  chmodSync(target, 0o644);
}

function createRuntimeSource(root: string): string {
  const sourceRoot = join(root, 'source');
  const files: Record<string, string> = {
    'package.json': '{"name":"@consuelo/os-fixture","private":true}\n',
    'bun.lock': 'fixture-lock\n',
    'scripts/os.ts': 'export const osFixture = true;\n',
    'scripts/native-lifecycle-operation.ts':
      'export const nativeLifecycleOperationFixture = true;\n',
    'scripts/server/main.ts': 'export const serverFixture = true;\n',
    'scripts/lib/install-state.ts': 'export const installFixture = true;\n',
    'scripts/managed-components.ts': 'export const managedComponentsCliFixture = true;\n',
    'scripts/lib/managed-components.ts': 'export const managedComponentsFixture = true;\n',
    'scripts/lib/managed-component-install.ts': 'export const managedComponentInstallFixture = true;\n',
    'manifests/generated/tool.manifest.json': '{"version":1,"kind":"consuelo-os-tool-manifest","tools":[]}\n',
    'manifests/generated/core.manifest.json': '{"version":1,"kind":"consuelo-os-core-manifest","tools":[]}\n',
    'hooks/dispatcher.js': 'export const dispatch = () => undefined;\n',
    'steering/system_prompt.md': '# Fixture system prompt\n',
    'steering/root-agent-instructions.md': '# Fixture root agent instructions\n',
    'steering/decision.md': '# Fixture decision process\n',
    'streams/tools/AGENTS.md': '# Fixture tools stream\n',
    'streams/dialer/AGENTS.md': '# Fixture dialer stream\n',
    'skills/task/SKILL.md': '# Fixture task skill\n',
    'skills/task/skill.json': '{"name":"task","entrypoint":"SKILL.md"}\n',
  };
  for (const [path, content] of Object.entries(files)) writeFixtureFile(sourceRoot, path, content);
  return sourceRoot;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('release publication preparer', () => {
  it('verifies three platform archives and emits one signed publication input', async () => {
    const root = tempRoot();
    const sourceRoot = createRuntimeSource(root);
    const archiveDirectory = join(root, 'archives');
    mkdirSync(archiveDirectory, { recursive: true });
    const targets = [
      { architecture: 'arm64', platform: 'darwin' },
      { architecture: 'x64', platform: 'linux' },
      { architecture: 'x64', platform: 'windows' },
    ] as const;
    let releaseFingerprint = '';
    for (const target of targets) {
      const outputPath = join(archiveDirectory, `${target.platform}-${target.architecture}.tar.gz`);
      const result = await buildRuntimeBundle({
        ...target,
        minimumUpdaterVersion: '0.1.0',
        outputPath,
        sourceCommit: SOURCE_COMMIT,
        sourceRoot,
        version: '1.2.3',
      });
      releaseFingerprint ||= result.manifest.releaseFingerprint;
      expect(result.manifest.releaseFingerprint).toBe(releaseFingerprint);
    }

    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const outputPath = join(root, 'publication.json');
    const signatureDirectory = join(root, 'signatures');
    const scriptPath = resolve(import.meta.dirname, '../../scripts/prepare-release-publication.ts');
    const result = spawnSync('bun', [
      scriptPath,
      '--archive', `darwin-arm64=${join(archiveDirectory, 'darwin-arm64.tar.gz')}`,
      '--archive', `linux-x64=${join(archiveDirectory, 'linux-x64.tar.gz')}`,
      '--archive', `windows-x64=${join(archiveDirectory, 'windows-x64.tar.gz')}`,
      '--version', '1.2.3',
      '--fingerprint', releaseFingerprint,
      '--source-commit', SOURCE_COMMIT,
      '--evidence', 'ci=https://github.com/consuelohq/opensaas/actions/runs/123',
      '--evidence', 'tests=distribution:passed',
      '--signature-directory', signatureDirectory,
      '--output', outputPath,
    ], {
      encoding: 'utf8',
      env: {
        ...process.env,
        CONSUELO_OS_RELEASE_SIGNING_KEY_ID: 'fixture-release-key-v1',
        CONSUELO_OS_RELEASE_SIGNING_PRIVATE_KEY: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
        CONSUELO_OS_RELEASE_SIGNING_PUBLIC_KEY: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
      },
    });

    expect(result.status, result.stderr).toBe(0);
    const publication = JSON.parse(readFileSync(outputPath, 'utf8')) as DevPublicationInput;
    expect(publication.approvedVersion).toBe('1.2.3');
    expect(publication.releaseFingerprint).toBe(releaseFingerprint);
    expect(publication.bundles.map((bundle) => `${bundle.platform}-${bundle.architecture}`)).toEqual([
      'darwin-arm64',
      'linux-x64',
      'windows-x64',
    ]);
    expect(publication.bundleId).toBe(releaseSetIdForBundles(publication.bundles));
    expect(publication.bundleSigningPublicKeys).toEqual({
      'fixture-release-key-v1': publicKey.export({ format: 'pem', type: 'spki' }).toString(),
    });

    for (const bundle of publication.bundles) {
      const payload: BundleSignaturePayload = {
        architecture: bundle.architecture,
        archiveDigest: bundle.archiveDigest,
        bundleId: bundle.bundleId,
        platform: bundle.platform,
        releaseFingerprint: bundle.manifest.releaseFingerprint,
        sourceCommit: bundle.manifest.sourceCommit,
        version: bundle.manifest.version,
      };
      expect(verifyBytes(
        null,
        Buffer.from(canonicalBundleSignatureJson(payload)),
        publicKey,
        Buffer.from(bundle.signature.signature, 'base64url'),
      )).toBe(true);
      expect(readFileSync(bundle.signaturePath!, 'utf8')).toContain(bundle.signature.signature);
    }
  });
});
