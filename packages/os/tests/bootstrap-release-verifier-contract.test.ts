import { execFile } from 'node:child_process';
import { createHash, generateKeyPairSync } from 'node:crypto';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createEd25519ChannelSigner,
  type ChannelManifestPayload,
} from '../scripts/lib/distribution/release-channels';

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

const verifierSource = (): string => {
  const bootstrap = readFileSync(
    resolve(import.meta.dirname, '../scripts/bootstrap.sh'),
    'utf8',
  );
  const heredocStart = "cat > \"$verifier\" <<'BUN'\n";
  const sourceStart = bootstrap.indexOf(heredocStart);
  const sourceEnd = bootstrap.indexOf('\nBUN\n', sourceStart);
  expect(sourceStart).toBeGreaterThanOrEqual(0);
  expect(sourceEnd).toBeGreaterThan(sourceStart);
  return bootstrap.slice(sourceStart + heredocStart.length, sourceEnd);
};

const releaseFixture = () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const keyId = 'bootstrap-contract-key';
  const signer = createEd25519ChannelSigner({
    keyId,
    privateKeyPem: privateKey
      .export({ format: 'pem', type: 'pkcs8' })
      .toString(),
    publicKeyPem: publicKey
      .export({ format: 'pem', type: 'spki' })
      .toString(),
  });
  const archiveBytes = Buffer.from('bootstrap verifier archive fixture');
  const platformBundleId =
    `sha256:${createHash('sha256').update('platform-bundle').digest('hex')}`;
  const releaseSetId =
    `sha256:${createHash('sha256').update('release-set').digest('hex')}`;
  const archiveDigest =
    `sha256:${createHash('sha256').update(archiveBytes).digest('hex')}`;
  const payload: ChannelManifestPayload & { ignored?: undefined } = {
    ignored: undefined,
    version: '1.2.3',
    sourceCommit: 'a'.repeat(40),
    sourceChannel: 'beta',
    schemaVersion: 1,
    revision: 1,
    releaseFingerprint:
      `sha256:${createHash('sha256').update('release').digest('hex')}`,
    promotedAt: '2026-07-29T12:00:00.000Z',
    platforms: [{
      platform: process.platform,
      githubAssetName: 'runtime.tar.gz',
      cloudflareObjectKey: `bundles/${platformBundleId}/runtime.tar.gz`,
      bundleId: platformBundleId,
      archiveDigest,
      architecture: process.arch,
    }],
    kind: 'consuelo-os-channel-manifest',
    evidence: [{ reference: 'bootstrap-contract', kind: 'test' }],
    channel: 'stable',
    bundleId: releaseSetId,
  };
  return {
    archiveBytes,
    keyId,
    payload,
    platformBundleId,
    releaseSetId,
    signer,
  };
};

async function runVerifier(
  payload: ChannelManifestPayload,
  options: {
    activeState?: Record<string, unknown>;
  } = {},
): Promise<string> {
  const fixture = releaseFixture();
  const manifest = fixture.signer.sign(
    payload,
    '2026-07-29T12:00:01.000Z',
  );
  const selected = payload.platforms.find(
    (candidate) =>
      candidate.platform === process.platform &&
      candidate.architecture === process.arch,
  );
  const server = createServer((request, response) => {
    if (request.url === '/channels/stable.json') {
      const body = JSON.stringify(manifest);
      response.writeHead(200, {
        'content-length': Buffer.byteLength(body),
        'content-type': 'application/json',
      });
      response.end(body);
      return;
    }
    if (
      selected &&
      request.url === `/bundles/${String(selected.bundleId)}/runtime.tar.gz`
    ) {
      response.writeHead(200, {
        'content-length': fixture.archiveBytes.byteLength,
        'content-type': 'application/gzip',
      });
      response.end(fixture.archiveBytes);
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('fixture server did not bind a TCP port');
    }
    const stageDirectory = mkdtempSync(
      join(tmpdir(), 'consuelo-bootstrap-verifier-'),
    );
    temporaryDirectories.push(stageDirectory);
    const verifierPath = join(stageDirectory, 'verify-release.ts');
    const statePath = join(stageDirectory, 'active-channel.json');
    writeFileSync(verifierPath, verifierSource());
    if (options.activeState) {
      writeFileSync(
        statePath,
        `${JSON.stringify(options.activeState)}\n`,
        { mode: 0o600 },
      );
    }
    await execFileAsync('bun', [verifierPath], {
      env: {
        ...process.env,
        CONSUELO_RELEASE_BASE_URL: `http://127.0.0.1:${address.port}`,
        CONSUELO_RELEASE_CHANNEL: 'stable',
        CONSUELO_RELEASE_PUBLIC_KEYS_BASE64: Buffer.from(
          JSON.stringify({ [fixture.keyId]: fixture.signer.publicKeyPem }),
        ).toString('base64'),
        CONSUELO_RELEASE_STAGE_DIR: stageDirectory,
        CONSUELO_RELEASE_STATE_PATH: statePath,
      },
    });
    return stageDirectory;
  } finally {
    await new Promise<void>((resolveClose, reject) => {
      server.close((error) => error ? reject(error) : resolveClose());
    });
  }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('hosted bootstrap release verifier', () => {
  it('should accept library-canonical signed payloads when key ordering and undefined values differ', async () => {
    const fixture = releaseFixture();
    const stageDirectory = await runVerifier(fixture.payload);
    expect(readFileSync(join(stageDirectory, 'runtime.tar.gz'))).toEqual(
      fixture.archiveBytes,
    );
    expect(readFileSync(join(stageDirectory, 'bundle-id'), 'utf8')).toBe(
      `${fixture.platformBundleId}\n`,
    );
    expect(
      JSON.parse(
        readFileSync(join(stageDirectory, 'channel-state.json'), 'utf8'),
      ),
    ).toMatchObject({
      schemaVersion: 1,
      kind: 'consuelo-os-bootstrap-channel-state',
      channel: 'stable',
      revision: 1,
      bundleId: fixture.releaseSetId,
      platformBundleId: fixture.platformBundleId,
    });
  });

  it('should reject malformed signed release identity fields before download', async () => {
    const fixture = releaseFixture();
    const malformed = structuredClone(fixture.payload);
    Reflect.set(malformed.platforms[0], 'bundleId', 42);
    await expect(runVerifier(malformed)).rejects.toThrow(
      /runtime bundle ID is invalid/,
    );
  });

  it('should reject a signed channel manifest older than activated state', async () => {
    const fixture = releaseFixture();
    await expect(runVerifier(fixture.payload, {
      activeState: {
        schemaVersion: 1,
        kind: 'consuelo-os-bootstrap-channel-state',
        channel: 'stable',
        revision: 2,
        promotedAt: '2026-07-29T13:00:00.000Z',
        releaseFingerprint:
          `sha256:${createHash('sha256').update('newer').digest('hex')}`,
        bundleId:
          `sha256:${createHash('sha256').update('newer-set').digest('hex')}`,
        platformBundleId:
          `sha256:${createHash('sha256').update('newer-platform').digest('hex')}`,
      },
    })).rejects.toThrow(/older than the activated stable release/);
  });
});
