import {
  assertRequiredCloudflareWorkerSecrets,
  configuredCloudflareWorkerSecretNames,
  CLOUDFLARE_WORKER_RELEASE_CONFIGS,
} from './cloudflare-worker-release-readiness';

export const REQUIRED_DEVICE_AUTHORITY_WORKER_SECRETS =
  CLOUDFLARE_WORKER_RELEASE_CONFIGS['os-device-authority'].requiredSecrets;

export const OPTIONAL_DEVICE_AUTHORITY_STRIPE_SECRETS = [
  'OS_STRIPE_SECRET_KEY',
  'OS_STRIPE_WEBHOOK_SECRET',
] as const;

export function assertRequiredDeviceAuthorityWorkerSecrets(input: unknown): void {
  assertRequiredCloudflareWorkerSecrets('os-device-authority', input);
  const configured = configuredCloudflareWorkerSecretNames(
    'os-device-authority',
    input,
  );
  const stripeConfigured = OPTIONAL_DEVICE_AUTHORITY_STRIPE_SECRETS.filter(
    (secret) => configured.has(secret),
  );
  if (
    stripeConfigured.length !== 0 &&
    stripeConfigured.length !== OPTIONAL_DEVICE_AUTHORITY_STRIPE_SECRETS.length
  ) {
    throw new Error(
      'Device authority Stripe billing secrets must be configured together: ' +
        OPTIONAL_DEVICE_AUTHORITY_STRIPE_SECRETS.join(', '),
    );
  }
}
