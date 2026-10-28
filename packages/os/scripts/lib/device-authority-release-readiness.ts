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

export const OPTIONAL_DEVICE_AUTHORITY_SYNTHETIC_STRIPE_SECRETS = [
  'OS_STRIPE_SYNTHETIC_SECRET_KEY',
  'OS_STRIPE_SYNTHETIC_WEBHOOK_SECRET',
] as const;

export const OPTIONAL_DEVICE_AUTHORITY_SYNTHETIC_STRIPE_ALLOWLISTS = [
  'OS_STRIPE_SYNTHETIC_ACCOUNT_IDS',
  'OS_STRIPE_SYNTHETIC_WORKSPACE_IDS',
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
  const syntheticStripeConfigured = OPTIONAL_DEVICE_AUTHORITY_SYNTHETIC_STRIPE_SECRETS.filter(
    (secret) => configured.has(secret),
  );
  const syntheticStripeAllowlists = OPTIONAL_DEVICE_AUTHORITY_SYNTHETIC_STRIPE_ALLOWLISTS.filter(
    (secret) => configured.has(secret),
  );
  if (
    (syntheticStripeConfigured.length !== 0 || syntheticStripeAllowlists.length !== 0) &&
    (syntheticStripeConfigured.length !== OPTIONAL_DEVICE_AUTHORITY_SYNTHETIC_STRIPE_SECRETS.length ||
      syntheticStripeAllowlists.length === 0)
  ) {
    throw new Error(
      'Device authority synthetic Stripe testing requires both Stripe secrets and at least one allowlist: ' +
        OPTIONAL_DEVICE_AUTHORITY_SYNTHETIC_STRIPE_ALLOWLISTS.join(' or '),
    );
  }
}
