const FIXTURE_SIGNING_KEY = 'consuelo-os-public-distribution-fixture-v1';

export type DistributionFailurePhase =
  | 'activation'
  | 'download'
  | 'health'
  | 'migration'
  | 'rollback'
  | 'verification';

export type DistributionInstallFixtureName =
  | 'corrupted-current-link'
  | 'current-install'
  | 'interrupted-install'
  | 'modified-managed-content'
  | 'no-install'
  | 'n-minus-one-install';

export type DistributionInstallFixture = {
  currentBundle: string | null;
  interruptedDownload: boolean;
  managedContentModified: boolean;
  previousBundle: string | null;
  validCurrentLink: boolean;
};

export const distributionInstallFixtures: Record<
  DistributionInstallFixtureName,
  DistributionInstallFixture
> = {
  'corrupted-current-link': {
    currentBundle: 'bundle-current',
    interruptedDownload: false,
    managedContentModified: false,
    previousBundle: 'bundle-previous',
    validCurrentLink: false,
  },
  'current-install': {
    currentBundle: 'bundle-current',
    interruptedDownload: false,
    managedContentModified: false,
    previousBundle: 'bundle-previous',
    validCurrentLink: true,
  },
  'interrupted-install': {
    currentBundle: 'bundle-previous',
    interruptedDownload: true,
    managedContentModified: false,
    previousBundle: null,
    validCurrentLink: true,
  },
  'modified-managed-content': {
    currentBundle: 'bundle-current',
    interruptedDownload: false,
    managedContentModified: true,
    previousBundle: 'bundle-previous',
    validCurrentLink: true,
  },
  'no-install': {
    currentBundle: null,
    interruptedDownload: false,
    managedContentModified: false,
    previousBundle: null,
    validCurrentLink: true,
  },
  'n-minus-one-install': {
    currentBundle: 'bundle-previous',
    interruptedDownload: false,
    managedContentModified: false,
    previousBundle: null,
    validCurrentLink: true,
  },
};

export type FixtureRuntimeManifest = {
  bundleDigest: string;
  channel: 'beta' | 'canary' | 'dev' | 'stable';
  schemaVersion: 1;
  version: string;
};

export type SignedFixtureManifest = {
  payload: FixtureRuntimeManifest;
  signature: string;
};

function stableManifestJson(manifest: FixtureRuntimeManifest): string {
  return JSON.stringify({
    bundleDigest: manifest.bundleDigest,
    channel: manifest.channel,
    schemaVersion: manifest.schemaVersion,
    version: manifest.version,
  });
}

function fixtureSigningKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(FIXTURE_SIGNING_KEY),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign', 'verify'],
  );
}

export async function signFixtureManifest(
  payload: FixtureRuntimeManifest,
): Promise<SignedFixtureManifest> {
  try {
    const signature = await crypto.subtle.sign(
      'HMAC',
      await fixtureSigningKey(),
      new TextEncoder().encode(stableManifestJson(payload)),
    );

    return {
      payload,
      signature: Buffer.from(signature).toString('base64url'),
    };
  } catch (error: unknown) {
    throw new Error('Failed to sign the distribution fixture manifest.', {
      cause: error,
    });
  }
}

export async function verifyFixtureManifest(
  manifest: SignedFixtureManifest,
): Promise<boolean> {
  try {
    return await crypto.subtle.verify(
      'HMAC',
      await fixtureSigningKey(),
      Buffer.from(manifest.signature, 'base64url'),
      new TextEncoder().encode(stableManifestJson(manifest.payload)),
    );
  } catch (error: unknown) {
    throw new Error('Failed to verify the distribution fixture manifest.', {
      cause: error,
    });
  }
}

export class DistributionFailureInjector {
  constructor(private readonly phases = new Set<DistributionFailurePhase>()) {}

  failAt(phase: DistributionFailurePhase): this {
    this.phases.add(phase);
    return this;
  }

  throwIfInjected(phase: DistributionFailurePhase): void {
    if (this.phases.has(phase)) {
      throw new Error(`Injected distribution failure at ${phase}.`);
    }
  }
}
