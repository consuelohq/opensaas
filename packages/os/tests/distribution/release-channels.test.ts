import { createHash, generateKeyPairSync, sign as signBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  CHANNEL_MANIFEST_SCHEMA_VERSION,
  canonicalBundleSignatureJson,
  RELEASE_TAG_PREFIX,
  StaleReleaseStateError,
  calculateNextReleaseVersion,
  createEd25519ChannelSigner,
  createEmptyReleaseState,
  inspectReleaseChannel,
  planDevPublication,
  promoteReleaseChannel,
  publishDevRelease,
  redactReleaseAuditValue,
  releaseSetIdForBundles,
  rollbackReleaseChannel,
  verifyReleaseStateConsensus,
  verifySignedChannelManifest,
  type PlatformBundlePublication,
  type ReleaseEvidence,
  type ReleaseState,
} from '../../scripts/lib/distribution/release-channels';
import { REQUIRED_RUNTIME_RECOVERY_CAPABILITIES } from '../../scripts/lib/distribution/runtime-bundle';

const SOURCE_COMMIT = '0123456789abcdef0123456789abcdef01234567';
const FINGERPRINT = `sha256:${'1'.repeat(64)}`;
const NEXT_FINGERPRINT = `sha256:${'2'.repeat(64)}`;
const NOW = '2026-07-23T00:00:00.000Z';

const BUNDLE_SIGNING_KEYS = generateKeyPairSync('ed25519');
const BUNDLE_PRIVATE_KEY = BUNDLE_SIGNING_KEYS.privateKey;
const BUNDLE_PUBLIC_KEY_PEM = BUNDLE_SIGNING_KEYS.publicKey.export({
  format: 'pem',
  type: 'spki',
}).toString();

function signer() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return createEd25519ChannelSigner({
    keyId: 'fixture-release-key-v1',
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
  });
}

function evidence(): ReleaseEvidence[] {
  return [
    { kind: 'ci', reference: 'https://github.com/consuelohq/opensaas/actions/runs/123' },
    { kind: 'tests', reference: 'vitest:distribution:passed' },
  ];
}

function bundle(
  platform: string,
  architecture: string,
  version = '1.2.3',
  releaseFingerprint = FINGERPRINT,
  sourceCommit = SOURCE_COMMIT,
): PlatformBundlePublication {
  const suffix = `${platform}-${architecture}`.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
  const identity = `${suffix}:${version}:${releaseFingerprint}:${sourceCommit}`;
  const archiveDigest = `sha256:${createHash('sha256').update(`archive:${identity}`).digest('hex')}`;
  const bundleId = `sha256:${createHash('sha256').update(`bundle:${identity}`).digest('hex')}`;
  const signaturePayload = {
    architecture,
    archiveDigest,
    bundleId,
    capabilities: [...REQUIRED_RUNTIME_RECOVERY_CAPABILITIES],
    platform,
    releaseFingerprint,
    sourceCommit,
    version,
  };
  return {
    architecture,
    archiveDigest,
    bundleId,
    cloudflare: {
      digest: archiveDigest,
      objectKey: `bundles/${bundleId}/${suffix}.tar.gz`,
    },
    github: {
      assetName: `consuelo-os-${version}-${suffix}.tar.gz`,
      digest: archiveDigest,
    },
    manifest: {
      architecture,
      bundleId,
      capabilities: [...REQUIRED_RUNTIME_RECOVERY_CAPABILITIES],
      platform,
      releaseFingerprint,
      schemaVersion: 1,
      sourceCommit,
      version,
    },
    platform,
    signature: {
      algorithm: 'ed25519',
      keyId: 'fixture-bundle-key-v1',
      signature: signBytes(
        null,
        Buffer.from(canonicalBundleSignatureJson(signaturePayload)),
        BUNDLE_PRIVATE_KEY,
      ).toString('base64url'),
    },
  };
}

function completeBundles(
  version = '1.2.3',
  releaseFingerprint = FINGERPRINT,
  sourceCommit = SOURCE_COMMIT,
): PlatformBundlePublication[] {
  return [
    bundle('darwin', 'arm64', version, releaseFingerprint, sourceCommit),
    bundle('linux', 'x64', version, releaseFingerprint, sourceCommit),
    bundle('windows', 'x64', version, releaseFingerprint, sourceCommit),
  ];
}

function publish(
  state: ReleaseState,
  options: {
    version?: string;
    releaseFingerprint?: string;
    sourceCommit?: string;
    now?: string;
    bundles?: PlatformBundlePublication[];
    immutableTags?: string[];
  } = {},
) {
  const version = options.version ?? '1.2.3';
  const releaseFingerprint = options.releaseFingerprint ?? FINGERPRINT;
  const sourceCommit = options.sourceCommit ?? SOURCE_COMMIT;
  const bundles = options.bundles ?? completeBundles(version, releaseFingerprint, sourceCommit);
  const bundleId = releaseSetIdForBundles(bundles);
  const channelSigner = signer();
  const input = {
    approvedVersion: version,
    bundleId,
    bundleSigningPublicKeys: {
      'fixture-bundle-key-v1': BUNDLE_PUBLIC_KEY_PEM,
    },
    bundles,
    channel: 'dev',
    evidence: evidence(),
    githubDeployment: {
      environment: 'consuelo-os-dev',
      releaseFingerprint,
      sourceCommit,
      version,
    },
    githubRelease: {
      prerelease: true,
      releaseFingerprint,
      sourceCommit,
      tag: `${RELEASE_TAG_PREFIX}${version}`,
      version,
    },
    releaseFingerprint,
    sourceCommit,
  } as const;
  const result = publishDevRelease(state, input, {
    immutableTags: options.immutableTags ?? [],
    now: options.now ?? NOW,
    signer: channelSigner,
  });
  return { ...result, input, signer: channelSigner };
}

describe('Consuelo OS release channels', () => {
  it('requires one explicit seed for the first release and defaults later changes to patch', () => {
    expect(() => calculateNextReleaseVersion({ immutableTags: [], intent: 'patch' })).toThrow(
      'first Consuelo OS release requires an explicit seed version',
    );
    expect(calculateNextReleaseVersion({
      immutableTags: [],
      intent: 'patch',
      seedVersion: '1.2.3',
    })).toBe('1.2.3');
    expect(calculateNextReleaseVersion({
      immutableTags: ['consuelo-os-v1.2.3', 'consuelo-os-v1.1.9'],
    })).toBe('1.2.4');
  });

  it('validates explicit minor and major release intent', () => {
    expect(calculateNextReleaseVersion({
      immutableTags: ['consuelo-os-v1.2.3'],
      intent: 'minor',
    })).toBe('1.3.0');
    expect(calculateNextReleaseVersion({
      immutableTags: ['consuelo-os-v1.2.3'],
      intent: 'major',
    })).toBe('2.0.0');
    expect(() => calculateNextReleaseVersion({
      immutableTags: ['consuelo-os-v1.2.3'],
      intent: 'banana' as 'major',
    })).toThrow('release intent must be patch, minor, or major');
  });

  it('records an unchanged runtime closure as a true no-op before build or publication', () => {
    const first = publish(createEmptyReleaseState()).state;
    const plan = planDevPublication(first, {
      immutableTags: Object.keys(first.tags),
      releaseFingerprint: FINGERPRINT,
      sourceCommit: 'different-commit-with-identical-runtime-closure',
    });

    expect(plan).toEqual({
      changed: false,
      noOp: true,
      reason: 'release fingerprint already published to dev',
      releaseFingerprint: FINGERPRINT,
    });
    expect(first.revision).toBe(1);
  });

  it('reuses the allocated version when the same source and fingerprint are retried', () => {
    const firstPlan = planDevPublication(createEmptyReleaseState(), {
      immutableTags: [],
      releaseFingerprint: FINGERPRINT,
      seedVersion: '1.2.3',
      sourceCommit: SOURCE_COMMIT,
    });
    expect(firstPlan).toMatchObject({ changed: true, version: '1.2.3' });

    const first = publish(createEmptyReleaseState());
    const retry = publishDevRelease(first.state, first.input, {
      now: '2026-07-23T01:00:00.000Z',
      signer: first.signer,
    });
    expect(retry.changed).toBe(false);
    expect(retry.idempotent).toBe(true);
    expect(retry.state).toEqual(first.state);
  });

  it('should honor remote immutable tags when provider writes outpace release state', () => {
    const state = publish(createEmptyReleaseState(), { version: '0.1.7' }).state;
    const next = {
      releaseFingerprint: `sha256:${'7'.repeat(64)}`,
      sourceCommit: 'partial-provider-recovery-commit',
      version: '0.1.9',
    };

    expect(() => publish(state, next)).toThrow('approved release version must be 0.1.8');
    expect(() => publish(state, {
      ...next,
      immutableTags: ['consuelo-os-v0.1.8', 'consuelo-os-v0.1.9'],
    })).toThrow('approved release version must be 0.1.10');
    const result = publish(state, {
      ...next,
      immutableTags: ['consuelo-os-v0.1.8'],
    });

    expect(result.state.tags['consuelo-os-v0.1.9']).toBe(result.input.bundleId);
  });

  it('keeps ephemeral archive paths out of durable release state', () => {
    const bundles = completeBundles().map((item, index) => ({
      ...item,
      archivePath: `/tmp/runtime-${index}.tar.gz`,
      signaturePath: `/tmp/runtime-${index}.tar.gz.sig`,
    }));
    const result = publish(createEmptyReleaseState(), { bundles });
    const serializedState = JSON.stringify(result.state);

    expect(serializedState).not.toContain('/tmp/runtime-');
    expect(result.artifacts).toEqual(Object.fromEntries(
      bundles.map((item) => [item.bundleId, {
        archivePath: item.archivePath,
        signaturePath: item.signaturePath,
      }]),
    ));
  });

  it('keeps runtime manifests, tag, Release, Deployment, and signed dev pointer in consensus', () => {
    const result = publish(createEmptyReleaseState());
    const inspected = inspectReleaseChannel(result.state, 'dev', {
      publicKeys: { [result.signer.keyId]: result.signer.publicKeyPem },
    });

    expect(inspected.manifest.payload).toMatchObject({
      bundleId: result.input.bundleId,
      channel: 'dev',
      releaseFingerprint: FINGERPRINT,
      sourceCommit: SOURCE_COMMIT,
      version: '1.2.3',
    });
    expect(result.state.tags['consuelo-os-v1.2.3']).toBe(result.input.bundleId);
    expect(result.state.githubReleases['consuelo-os-v1.2.3']).toMatchObject({
      bundleId: result.input.bundleId,
      version: '1.2.3',
    });
    expect(result.state.deployments.at(-1)).toMatchObject({
      bundleId: result.input.bundleId,
      environment: 'consuelo-os-dev',
      version: '1.2.3',
    });
    expect(() => verifyReleaseStateConsensus(result.state, result.input.bundleId)).not.toThrow();
  });

  it('rejects publication when a platform bundle lacks required recovery capabilities', () => {
    const bundles = completeBundles();
    bundles[0] = {
      ...bundles[0],
      manifest: {
        ...bundles[0].manifest,
        capabilities: REQUIRED_RUNTIME_RECOVERY_CAPABILITIES.slice(1),
      },
    };
    expect(() => publish(createEmptyReleaseState(), { bundles })).toThrow(
      'runtime bundle is missing required recovery capability',
    );
  });

  it('keeps channel schemaVersion independent from runtime SemVer', () => {
    const result = publish(createEmptyReleaseState(), { version: '42.7.9' });
    const manifest = result.state.channels.dev;
    expect(manifest?.payload.schemaVersion).toBe(CHANNEL_MANIFEST_SCHEMA_VERSION);
    expect(manifest?.payload.version).toBe('42.7.9');

    expect(() => publishDevRelease(createEmptyReleaseState(), {
      ...result.input,
      channelSchemaVersion: 2,
    }, {
      now: NOW,
      signer: result.signer,
    })).toThrow('channel schema version changes require an explicit format migration decision');
  });

  it('rejects publication when any platform is missing', () => {
    const bundles = completeBundles().filter((item) => item.platform !== 'windows');
    expect(() => publish(createEmptyReleaseState(), { bundles })).toThrow(
      'release is missing required platform windows-x64',
    );
  });

  it('requires GitHub and Cloudflare asset digests to match the built runtime bundle exactly', () => {
    const bundles = completeBundles();
    bundles[0] = {
      ...bundles[0],
      cloudflare: { ...bundles[0].cloudflare, digest: `sha256:${'f'.repeat(64)}` },
    };
    expect(() => publish(createEmptyReleaseState(), { bundles })).toThrow(
      'Cloudflare digest does not match built archive digest for darwin-arm64',
    );
  });

  it('rejects version, fingerprint, source, tag, Release, or Deployment disagreement', () => {
    const bundles = completeBundles();
    bundles[0] = {
      ...bundles[0],
      manifest: { ...bundles[0].manifest, version: '9.9.9' },
    };
    expect(() => publish(createEmptyReleaseState(), { bundles })).toThrow(
      'runtime bundle version mismatch for darwin-arm64',
    );
  });

  it('allows only dev -> canary -> beta -> stable and preserves bytes during promotion', () => {
    const dev = publish(createEmptyReleaseState());
    const canary = promoteReleaseChannel(dev.state, {
      bundleId: dev.input.bundleId,
      from: 'dev',
      to: 'canary',
    }, { now: NOW, signer: dev.signer });
    const beta = promoteReleaseChannel(canary.state, {
      bundleId: dev.input.bundleId,
      from: 'canary',
      to: 'beta',
    }, { now: NOW, signer: dev.signer });
    const stable = promoteReleaseChannel(beta.state, {
      approval: { approved: true, actor: 'release-manager', evidence: 'github-environment:consuelo-os-stable' },
      bundleId: dev.input.bundleId,
      from: 'beta',
      to: 'stable',
    }, { now: NOW, signer: dev.signer });

    expect(stable.state.channels.stable?.payload.bundleId).toBe(dev.input.bundleId);
    expect(stable.state.channels.stable?.payload.platforms).toEqual(
      dev.state.channels.dev?.payload.platforms,
    );
    expect(stable.operations.some((operation) => operation.kind === 'rebuild-runtime-bundle')).toBe(false);
    expect(() => promoteReleaseChannel(dev.state, {
      bundleId: dev.input.bundleId,
      from: 'dev',
      to: 'beta',
    }, { now: NOW, signer: dev.signer })).toThrow('illegal channel transition: dev -> beta');
  });

  it('can promote an exact verified bundle from source-channel history after the source pointer advances', () => {
    const first = publish(createEmptyReleaseState());
    const second = publish(first.state, {
      version: '1.2.4',
      releaseFingerprint: NEXT_FINGERPRINT,
      sourceCommit: 'fedcba9876543210fedcba9876543210fedcba98',
      now: '2026-07-24T00:00:00.000Z',
    });

    const promoted = promoteReleaseChannel(second.state, {
      bundleId: first.input.bundleId,
      from: 'dev',
      to: 'canary',
    }, { now: '2026-07-24T01:00:00.000Z', signer: second.signer });

    expect(promoted.state.channels.canary?.payload).toMatchObject({
      bundleId: first.input.bundleId,
      sourceChannel: 'dev',
      version: '1.2.3',
    });
    expect(promoted.state.audit.at(-1)).toMatchObject({
      action: 'promote',
      bundleId: first.input.bundleId,
      fromChannel: 'dev',
    });
  });

  it('never turns historical-source promotion into an implicit rollback of the target channel', () => {
    const first = publish(createEmptyReleaseState());
    const firstCanary = promoteReleaseChannel(first.state, {
      bundleId: first.input.bundleId,
      from: 'dev',
      to: 'canary',
    }, { now: NOW, signer: first.signer });
    const second = publish(firstCanary.state, {
      version: '1.2.4',
      releaseFingerprint: NEXT_FINGERPRINT,
      sourceCommit: 'fedcba9876543210fedcba9876543210fedcba98',
      now: '2026-07-24T00:00:00.000Z',
    });
    const secondCanary = promoteReleaseChannel(second.state, {
      bundleId: second.input.bundleId,
      from: 'dev',
      to: 'canary',
    }, { now: '2026-07-24T00:10:00.000Z', signer: second.signer });

    expect(() => promoteReleaseChannel(secondCanary.state, {
      bundleId: first.input.bundleId,
      from: 'dev',
      to: 'canary',
    }, { now: '2026-07-24T01:00:00.000Z', signer: second.signer })).toThrow(
      'promotion would move canary backwards from 1.2.4 to 1.2.3; use rollback for an intentional downgrade',
    );
  });

  it('rejects a historical-source promotion when the exact bundle never occupied that source channel', () => {
    const first = publish(createEmptyReleaseState());
    const unrelatedBundle = `sha256:${'9'.repeat(64)}`;
    const tampered = structuredClone(first.state);
    tampered.releases[unrelatedBundle] = {
      ...tampered.releases[first.input.bundleId],
      bundleId: unrelatedBundle,
    };

    expect(() => promoteReleaseChannel(tampered, {
      bundleId: unrelatedBundle,
      from: 'dev',
      to: 'canary',
    }, { now: '2026-07-24T01:00:00.000Z', signer: first.signer })).toThrow(
      'verified immutable release does not exist in source channel dev history',
    );
  });

  it('requires explicit stable approval and a manual stable deployment environment', () => {
    const dev = publish(createEmptyReleaseState());
    const canary = promoteReleaseChannel(dev.state, {
      bundleId: dev.input.bundleId,
      from: 'dev',
      to: 'canary',
    }, { now: NOW, signer: dev.signer });
    const beta = promoteReleaseChannel(canary.state, {
      bundleId: dev.input.bundleId,
      from: 'canary',
      to: 'beta',
    }, { now: NOW, signer: dev.signer });

    expect(() => promoteReleaseChannel(beta.state, {
      bundleId: dev.input.bundleId,
      from: 'beta',
      to: 'stable',
    }, { now: NOW, signer: dev.signer })).toThrow(
      'stable promotion requires explicit approval evidence',
    );
  });

  it('makes exact repromotion idempotent and rejects stale concurrent mutations', () => {
    const dev = publish(createEmptyReleaseState());
    const first = promoteReleaseChannel(dev.state, {
      bundleId: dev.input.bundleId,
      expectedRevision: dev.state.revision,
      from: 'dev',
      to: 'canary',
    }, { now: NOW, signer: dev.signer });
    const retry = promoteReleaseChannel(first.state, {
      bundleId: dev.input.bundleId,
      from: 'dev',
      to: 'canary',
    }, { now: NOW, signer: dev.signer });

    expect(retry.changed).toBe(false);
    expect(retry.idempotent).toBe(true);
    expect(() => promoteReleaseChannel(first.state, {
      bundleId: dev.input.bundleId,
      expectedRevision: dev.state.revision,
      from: 'dev',
      to: 'canary',
    }, { now: NOW, signer: dev.signer })).toThrow(StaleReleaseStateError);
  });

  it('rolls a channel pointer back only to a previously verified immutable release', () => {
    const first = publish(createEmptyReleaseState());
    const firstCanary = promoteReleaseChannel(first.state, {
      bundleId: first.input.bundleId,
      from: 'dev',
      to: 'canary',
    }, { now: NOW, signer: first.signer });

    const second = publish(firstCanary.state, {
      version: '1.2.4',
      releaseFingerprint: NEXT_FINGERPRINT,
      sourceCommit: 'fedcba9876543210fedcba9876543210fedcba98',
      now: '2026-07-24T00:00:00.000Z',
    });
    const secondCanary = promoteReleaseChannel(second.state, {
      bundleId: second.input.bundleId,
      from: 'dev',
      to: 'canary',
    }, { now: '2026-07-24T00:00:00.000Z', signer: second.signer });

    const rolledBack = rollbackReleaseChannel(secondCanary.state, {
      bundleId: first.input.bundleId,
      channel: 'canary',
    }, { now: '2026-07-25T00:00:00.000Z', signer: second.signer });
    expect(rolledBack.state.channels.canary?.payload.bundleId).toBe(first.input.bundleId);
    expect(rolledBack.state.audit.at(-1)?.action).toBe('rollback');
    expect(() => rollbackReleaseChannel(secondCanary.state, {
      bundleId: `sha256:${'9'.repeat(64)}`,
      channel: 'canary',
    }, { now: NOW, signer: second.signer })).toThrow('verified immutable release does not exist');
  });

  it('rejects a tampered detached runtime-bundle signature', () => {
    const bundles = completeBundles();
    bundles[0] = {
      ...bundles[0],
      signature: { ...bundles[0].signature, signature: 'tampered-signature' },
    };
    expect(() => publish(createEmptyReleaseState(), { bundles })).toThrow(
      'runtime bundle signature verification failed for darwin-arm64',
    );
  });

  it('rejects promotion when the signed source-channel pointer was tampered', () => {
    const dev = publish(createEmptyReleaseState());
    const tamperedState = structuredClone(dev.state);
    tamperedState.channels.dev!.payload.version = '9.9.9';
    expect(() => promoteReleaseChannel(tamperedState, {
      bundleId: dev.input.bundleId,
      from: 'dev',
      to: 'canary',
    }, { now: NOW, signer: dev.signer })).toThrow(
      'source channel dev signature verification failed',
    );
  });

  it('detects tampered signed channel manifests', () => {
    const result = publish(createEmptyReleaseState());
    const manifest = result.state.channels.dev!;
    expect(verifySignedChannelManifest(manifest, {
      [result.signer.keyId]: result.signer.publicKeyPem,
    })).toBe(true);
    expect(verifySignedChannelManifest({
      ...manifest,
      payload: { ...manifest.payload, version: '9.9.9' },
    }, {
      [result.signer.keyId]: result.signer.publicKeyPem,
    })).toBe(false);
  });

  it('redacts representative secrets before audit/log serialization', () => {
    const secret = 'super-secret-token-value';
    const value = redactReleaseAuditValue({
      authorization: `Bearer ${secret}`,
      cloudflareApiToken: secret,
      githubToken: secret,
      nested: { safe: 'kept', secret },
    });
    const serialized = JSON.stringify(value);
    expect(serialized).not.toContain(secret);
    expect(value).toMatchObject({
      authorization: '[REDACTED]',
      cloudflareApiToken: '[REDACTED]',
      githubToken: '[REDACTED]',
      nested: { safe: 'kept', secret: '[REDACTED]' },
    });
  });
});
