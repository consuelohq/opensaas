import type {
  InstallControlPlaneRepository,
} from './install-control-plane';
import type {
  InstallTelemetryEvent,
  InstallTelemetryEventName,
} from './install-telemetry-contract';

export type InstallObservabilityMetadata = {
  cloudflareRayId?: string;
};

export type InstallTelemetryObserver = {
  observe(
    event: InstallTelemetryEvent,
    metadata?: InstallObservabilityMetadata,
  ): Promise<void>;
};

type CreateDeviceAuthorityInstallObservabilityInput = {
  repository: InstallControlPlaneRepository;
  posthogApiKey?: string;
  posthogHost?: string;
  fetchImpl?: typeof fetch;
  log?: (record: Record<string, unknown>) => void;
  now?: () => number;
};

const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';

function posthogEventName(
  name: InstallTelemetryEventName,
): string | undefined {
  switch (name) {
    case 'install.started':
      return 'consuelo_os_install_started';
    case 'install.identity.bound':
      return 'consuelo_os_device_authorized';
    case 'install.completed':
      return 'consuelo_os_install_completed';
    case 'install.failed':
      return 'consuelo_os_install_failed';
    default:
      return undefined;
  }
}

function safeProjection(
  event: InstallTelemetryEvent,
  metadata?: InstallObservabilityMetadata,
): Record<string, unknown> {
  return {
    install_id: event.installId,
    event_id: event.eventId,
    event_name: event.name,
    producer: event.producer,
    stage: event.stage,
    outcome: event.outcome,
    sequence: event.sequence,
    ...(event.error
      ? {
          error_code: event.error.code,
          error_impact: event.error.impact,
        }
      : {}),
    ...(event.context ?? {}),
    ...(event.identity.state === 'canonical'
      ? {
          canonical_user_id: event.identity.userId,
          workspace_id: event.identity.workspaceId,
          ...(event.identity.nodeId ? { node_id: event.identity.nodeId } : {}),
        }
      : event.identity.nodeId
        ? { node_id: event.identity.nodeId }
        : {}),
    ...(metadata?.cloudflareRayId ? { cf_ray: metadata.cloudflareRayId } : {}),
  };
}

function validCloudflareRayId(value: string | undefined): string | undefined {
  const candidate = value?.trim();
  return candidate && /^[A-Za-z0-9-]{1,128}$/.test(candidate)
    ? candidate
    : undefined;
}

function posthogBatchUrl(host: string): string {
  const normalized = host.trim() || DEFAULT_POSTHOG_HOST;
  return new URL('/batch/', normalized.endsWith('/') ? normalized : `${normalized}/`).toString();
}

export function createDeviceAuthorityInstallObservability(
  input: CreateDeviceAuthorityInstallObservabilityInput,
): InstallTelemetryObserver {
  const fetchImpl = input.fetchImpl ?? fetch;
  const log = input.log ?? ((record) => {
    // Cloudflare Workers Logs is the platform sink for this structured JSON projection.
    console.log(JSON.stringify(record)); // eslint-disable-line no-console
  });
  const now = input.now ?? (() => Date.now());
  const posthogApiKey = input.posthogApiKey?.trim();
  const posthogHost = input.posthogHost ?? DEFAULT_POSTHOG_HOST;

  return {
    async observe(event, metadata) {
      const cloudflareRayId = validCloudflareRayId(metadata?.cloudflareRayId);
      const projection = safeProjection(
        event,
        cloudflareRayId ? { cloudflareRayId } : undefined,
      );
      try {
        log({ event: 'consuelo.os.install', ...projection });
      } catch {
        // Observability must never control install or authorization flow.
      }

      if (cloudflareRayId) {
        try {
          await input.repository.recordEvidence({
            installId: event.installId,
            kind: 'cloudflare',
            referenceId: cloudflareRayId,
            createdAt: new Date(now()).toISOString(),
          });
        } catch {
          // Evidence is advisory and must never change canonical install state.
        }
      }

      const productEvent = posthogEventName(event.name);
      if (!productEvent || !posthogApiKey) return;
      try {
        const response = await fetchImpl(posthogBatchUrl(posthogHost), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            api_key: posthogApiKey,
            batch: [
              {
                event: productEvent,
                distinct_id: event.installId,
                properties: {
                  ...projection,
                  $insert_id: event.eventId,
                },
              },
            ],
          }),
        });
        if (!response.ok) {
          throw new Error(`PostHog capture failed with HTTP ${response.status}`);
        }
      } catch {
        // Product analytics is a projection; D1 remains authoritative.
      }
    },
  };
}
