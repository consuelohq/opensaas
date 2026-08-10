import {
  assertRequiredCloudflareWorkerSecrets,
  CLOUDFLARE_WORKER_RELEASE_CONFIGS,
} from './cloudflare-worker-release-readiness';

export const REQUIRED_DEVICE_AUTHORITY_WORKER_SECRETS =
  CLOUDFLARE_WORKER_RELEASE_CONFIGS['os-device-authority'].requiredSecrets;

export function assertRequiredDeviceAuthorityWorkerSecrets(input: unknown): void {
  assertRequiredCloudflareWorkerSecrets('os-device-authority', input);
}
