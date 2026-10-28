import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as signBytes,
} from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

import {
  canonicalBundleSignatureJson,
  releaseSetIdForBundles,
  type BundleSignaturePayload,
  type DevPublicationInput,
  type PlatformBundlePublication,
  type ReleaseEvidence,
} from './lib/distribution/release-channels';
import {
  verifyRuntimeBundleArchive,
} from './lib/distribution/runtime-bundle';

type ParsedArguments = {
  flags: Map<string, string[]>;
};

function parseArguments(argv: string[]): ParsedArguments {
  const flags = new Map<string, string[]>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`unexpected argument: ${token}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${token}`);
    const key = token.slice(2);
    flags.set(key, [...(flags.get(key) ?? []), value]);
    index += 1;
  }
  return { flags };
}

function values(parsed: ParsedArguments, name: string): string[] {
  return parsed.flags.get(name) ?? [];
}

function optional(parsed: ParsedArguments, name: string): string | undefined {
  return values(parsed, name).at(-1);
}

function required(parsed: ParsedArguments, name: string): string {
  const value = optional(parsed, name)?.trim();
  if (!value) throw new Error(`--${name} is required`);
  return value;
}

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`missing release signing credential ${name}`);
  return value;
}

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function parsePlatformArchive(value: string): {
  architecture: string;
  archivePath: string;
  platform: string;
} {
  const separator = value.indexOf('=');
  if (separator < 1 || separator === value.length - 1) {
    throw new Error('--archive must use platform-architecture=/absolute/archive/path');
  }
  const identity = value.slice(0, separator);
  const architectureSeparator = identity.lastIndexOf('-');
  if (architectureSeparator < 1 || architectureSeparator === identity.length - 1) {
    throw new Error(`invalid platform identity: ${identity}`);
  }
  return {
    architecture: identity.slice(architectureSeparator + 1),
    archivePath: resolve(value.slice(separator + 1)),
    platform: identity.slice(0, architectureSeparator),
  };
}

function parseEvidence(value: string): ReleaseEvidence {
  const separator = value.indexOf('=');
  if (separator < 1 || separator === value.length - 1) {
    throw new Error('--evidence must use kind=reference');
  }
  return {
    kind: value.slice(0, separator),
    reference: value.slice(separator + 1),
  };
}

function main(argv: string[]): void {
  const parsed = parseArguments(argv);
  const version = required(parsed, 'version');
  const releaseFingerprint = required(parsed, 'fingerprint');
  const sourceCommit = required(parsed, 'source-commit');
  const outputPath = resolve(required(parsed, 'output'));
  const signatureDirectory = resolve(required(parsed, 'signature-directory'));
  const keyId = requiredEnvironmentValue('CONSUELO_OS_RELEASE_SIGNING_KEY_ID');
  const privateKeyPem = requiredEnvironmentValue('CONSUELO_OS_RELEASE_SIGNING_PRIVATE_KEY');
  const publicKeyPem = requiredEnvironmentValue('CONSUELO_OS_RELEASE_SIGNING_PUBLIC_KEY');
  const privateKey = createPrivateKey(privateKeyPem);
  const publicKey = createPublicKey(publicKeyPem);
  if (privateKey.asymmetricKeyType !== 'ed25519' || publicKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('release publication requires Ed25519 signing keys');
  }

  const archiveInputs = values(parsed, 'archive').map(parsePlatformArchive);
  if (archiveInputs.length === 0) throw new Error('at least one --archive is required');
  mkdirSync(signatureDirectory, { recursive: true });

  const bundles: PlatformBundlePublication[] = archiveInputs.map((archiveInput) => {
    const archiveBytes = readFileSync(archiveInput.archivePath);
    const manifest = verifyRuntimeBundleArchive(archiveBytes);
    const identity = `${archiveInput.platform}-${archiveInput.architecture}`;
    if (manifest.platform !== archiveInput.platform || manifest.architecture !== archiveInput.architecture) {
      throw new Error(`runtime bundle platform identity mismatch for ${identity}`);
    }
    if (manifest.version !== version) {
      throw new Error(`runtime bundle version mismatch for ${identity}`);
    }
    if (manifest.releaseFingerprint !== releaseFingerprint) {
      throw new Error(`runtime bundle release fingerprint mismatch for ${identity}`);
    }
    if (manifest.sourceCommit !== sourceCommit) {
      throw new Error(`runtime bundle source commit mismatch for ${identity}`);
    }

    const archiveDigest = sha256(archiveBytes);
    const payload: BundleSignaturePayload = {
      architecture: manifest.architecture,
      archiveDigest,
      bundleId: manifest.bundleId,
      ...(manifest.capabilities ? { capabilities: [...manifest.capabilities] } : {}),
      platform: manifest.platform,
      releaseFingerprint,
      sourceCommit,
      version,
    };
    const signature = signBytes(
      null,
      Buffer.from(canonicalBundleSignatureJson(payload)),
      privateKey,
    ).toString('base64url');
    const signaturePath = resolve(
      signatureDirectory,
      `${basename(archiveInput.archivePath)}.sig`,
    );
    writeFileSync(signaturePath, `${JSON.stringify({
      algorithm: 'ed25519',
      keyId,
      payload,
      signature,
    }, null, 2)}\n`, { mode: 0o600 });
    const assetName = `consuelo-os-${version}-${identity}.tar.gz`;

    return {
      architecture: manifest.architecture,
      archiveDigest,
      archivePath: archiveInput.archivePath,
      bundleId: manifest.bundleId,
      cloudflare: {
        digest: archiveDigest,
        objectKey: `bundles/${manifest.bundleId}/${assetName}`,
      },
      github: {
        assetName,
        digest: archiveDigest,
      },
      manifest: {
        architecture: manifest.architecture,
        bundleId: manifest.bundleId,
        ...(manifest.capabilities ? { capabilities: [...manifest.capabilities] } : {}),
        platform: manifest.platform,
        releaseFingerprint,
        schemaVersion: manifest.schemaVersion,
        sourceCommit,
        version,
      },
      platform: manifest.platform,
      signature: {
        algorithm: 'ed25519',
        keyId,
        signature,
      },
      signaturePath,
    };
  });

  const bundleId = releaseSetIdForBundles(bundles);
  const evidence = values(parsed, 'evidence').map(parseEvidence);
  if (evidence.length === 0) throw new Error('at least one --evidence is required');
  const publication: DevPublicationInput = {
    approvedVersion: version,
    bundleId,
    bundleSigningPublicKeys: { [keyId]: publicKeyPem },
    bundles,
    channel: 'dev',
    evidence,
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
      tag: `consuelo-os-v${version}`,
      version,
    },
    releaseFingerprint,
    sourceCommit,
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(publication, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({
    bundleId,
    bundleCount: bundles.length,
    outputPath,
    releaseFingerprint,
    version,
  })}\n`);
}

if (import.meta.main) {
  try {
    main(process.argv.slice(2));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${JSON.stringify({ error: message, ok: false })}\n`);
    process.exitCode = 1;
  }
}
