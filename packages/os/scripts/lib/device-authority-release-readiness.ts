export const REQUIRED_DEVICE_AUTHORITY_WORKER_SECRETS = [
  'CLOUDFLARE_API_TOKEN',
] as const;

type WorkerSecretMetadata = {
  name?: unknown;
};

function parseWorkerSecretMetadata(input: unknown): WorkerSecretMetadata[] {
  let value = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input) as unknown;
    } catch {
      throw new Error('Device authority secret list response was not valid JSON');
    }
  }

  if (Array.isArray(value)) return value as WorkerSecretMetadata[];
  if (
    value &&
    typeof value === 'object' &&
    Array.isArray((value as { secrets?: unknown }).secrets)
  ) {
    return (value as { secrets: WorkerSecretMetadata[] }).secrets;
  }
  throw new Error('Device authority secret list response was not an array');
}

export function assertRequiredDeviceAuthorityWorkerSecrets(input: unknown): void {
  const configured = new Set(
    parseWorkerSecretMetadata(input)
      .map((secret) => typeof secret.name === 'string' ? secret.name.trim() : '')
      .filter(Boolean),
  );

  for (const requiredSecret of REQUIRED_DEVICE_AUTHORITY_WORKER_SECRETS) {
    if (!configured.has(requiredSecret)) {
      throw new Error(
        `Device authority secret ${requiredSecret} is not configured`,
      );
    }
  }
}
