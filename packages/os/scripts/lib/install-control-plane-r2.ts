import {
  INSTALL_TELEMETRY_RETENTION_DAYS,
  isInstallId,
  type InstallId,
} from './install-telemetry-contract';
import type { InstallControlPlaneRepository } from './install-control-plane';
import { redactDiagnosticValue } from './install-diagnostics';

export type InstallDiagnosticR2Bucket = {
  put(
    key: string,
    body: string | Uint8Array,
    options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  delete(key: string): Promise<unknown>;
};

export type InstallDiagnosticBundleStoreResult =
  | {
      stored: true;
      bundleId: string;
      createdAt: string;
      expiresAt: string;
    }
  | {
      stored: false;
      reason: 'successful_retention_disabled';
    };

export type InstallDiagnosticBundleStore = {
  put(bundle: {
    installId: InstallId;
    outcome: 'failed' | 'successful';
    diagnostic: unknown;
  }): Promise<InstallDiagnosticBundleStoreResult>;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function createBundleId(randomUuid: () => string): string {
  const uuid = randomUuid().trim().toLowerCase();
  if (!UUID_V4_PATTERN.test(uuid)) {
    throw new Error('diagnostic bundle id requires a UUID v4');
  }
  return `diag_${uuid}`;
}

function retentionDaysFor(
  outcome: 'failed' | 'successful',
  successfulRetentionDays: number,
): number {
  if (outcome === 'failed') {
    return INSTALL_TELEMETRY_RETENTION_DAYS.failedDiagnosticBundles;
  }
  return successfulRetentionDays;
}

function diagnosticStoreError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`install diagnostic bundle storage failed: ${message}`);
}

export function createInstallDiagnosticBundleStore(input: {
  bucket: InstallDiagnosticR2Bucket;
  repository: InstallControlPlaneRepository;
  successfulRetentionDays?: number;
  now?: () => number;
  randomUuid?: () => string;
}): InstallDiagnosticBundleStore {
  const successfulRetentionDays = input.successfulRetentionDays ?? 0;
  if (
    !Number.isInteger(successfulRetentionDays) ||
    successfulRetentionDays < 0 ||
    successfulRetentionDays >
      INSTALL_TELEMETRY_RETENTION_DAYS.successfulDiagnosticBundlesOptInMax
  ) {
    throw new Error(
      `successful diagnostic retention must be between 0 and ${INSTALL_TELEMETRY_RETENTION_DAYS.successfulDiagnosticBundlesOptInMax} days`,
    );
  }
  const now = input.now ?? (() => Date.now());
  const randomUuid = input.randomUuid ?? (() => globalThis.crypto.randomUUID());

  return {
    async put(bundle: {
      installId: InstallId;
      outcome: 'failed' | 'successful';
      diagnostic: unknown;
    }): Promise<InstallDiagnosticBundleStoreResult> {
      if (!isInstallId(bundle.installId)) {
        throw new Error('diagnostic bundle requires a valid install id');
      }
      const retentionDays = retentionDaysFor(
        bundle.outcome,
        successfulRetentionDays,
      );
      if (retentionDays === 0) {
        return { stored: false, reason: 'successful_retention_disabled' };
      }

      try {
        const createdAtMs = now();
        const existingInstall = await input.repository.getInstallDetail(bundle.installId, {
          nowMs: createdAtMs,
        });
        if (!existingInstall) {
          throw new Error('diagnostic bundle requires an existing install session');
        }
        const bundleId = createBundleId(randomUuid);
        const createdAt = new Date(createdAtMs).toISOString();
        const expiresAt = new Date(
          createdAtMs + retentionDays * DAY_MS,
        ).toISOString();
        const objectKey = `install-diagnostics/${bundle.outcome}/${bundle.installId}/${bundleId}.json`;
        const redacted = redactDiagnosticValue(bundle.diagnostic);
        const body = `${JSON.stringify(redacted)}\n`;

        await input.bucket.put(objectKey, body, {
          httpMetadata: { contentType: 'application/json' },
          customMetadata: {
            installId: bundle.installId,
            outcome: bundle.outcome,
            createdAt,
            expiresAt,
          },
        });

        try {
          await input.repository.recordDiagnosticBundle({
            bundleId,
            installId: bundle.installId,
            objectKey,
            outcome: bundle.outcome,
            createdAt,
            expiresAt,
          });
        } catch (error: unknown) {
          try {
            await input.bucket.delete(objectKey);
          } catch {
            // The canonical metadata write is authoritative. Cleanup is best effort.
          }
          throw error;
        }

        return { stored: true, bundleId, createdAt, expiresAt };
      } catch (error: unknown) {
        throw diagnosticStoreError(error);
      }
    },
  };
}
