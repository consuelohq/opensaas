import type {
  CheckoutObservability,
  CheckoutTelemetryEvent,
} from '../types';

const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';

type CreateCheckoutObservabilityInput = {
  posthogApiKey?: string;
  posthogHost?: string;
  sentryDsn?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  idFactory?: () => string;
  log?: (record: Record<string, unknown>) => void;
};

function posthogBatchUrl(host: string): string {
  const normalized = host.trim() || DEFAULT_POSTHOG_HOST;
  return new URL('/batch/', normalized.endsWith('/') ? normalized : `${normalized}/`).toString();
}

function safeEvent(event: CheckoutTelemetryEvent): Record<string, unknown> {
  return {
    event_name: event.name,
    synthetic: event.synthetic,
    ...(event.accountId ? { account_id: event.accountId } : {}),
    ...(event.checkoutId ? { checkout_id: event.checkoutId } : {}),
    ...(event.stripeSessionId ? { stripe_session_id: event.stripeSessionId } : {}),
    ...(event.planId ? { plan_id: event.planId } : {}),
    ...(event.pricingVersion ? { pricing_version: event.pricingVersion } : {}),
    ...(typeof event.monthlyPriceCents === 'number'
      ? { monthly_price_cents: event.monthlyPriceCents }
      : {}),
    ...(event.currency ? { currency: event.currency } : {}),
    ...(event.outcome ? { outcome: event.outcome } : {}),
    ...(event.errorCode ? { error_code: event.errorCode } : {}),
    ...(typeof event.durationMs === 'number' ? { duration_ms: event.durationMs } : {}),
    ...(event.cloudflareRayId ? { cf_ray: event.cloudflareRayId } : {}),
  };
}

function safeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
    .replace(
      /\b(?:authorization|access_token|refresh_token|token|secret|password|cookie|code|state|email)\s*[:=]\s*[^\s,;]+/gi,
      '[redacted]',
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .slice(0, 320) || 'checkout operation failed';
}

function sentryEnvelopeTarget(dsn: string): { url: string; dsn: string } | undefined {
  try {
    const parsed = new URL(dsn);
    const projectId = parsed.pathname.split('/').filter(Boolean).at(-1);
    if (!parsed.username || !projectId) return undefined;
    return {
      url: `${parsed.protocol}//${parsed.host}/api/${encodeURIComponent(projectId)}/envelope/`,
      dsn,
    };
  } catch {
    return undefined;
  }
}

function sentryEventId(value: string): string {
  return value.replace(/[^a-fA-F0-9]/g, '').slice(0, 32).padEnd(32, '0');
}

export function createCheckoutObservability(
  input: CreateCheckoutObservabilityInput,
): CheckoutObservability {
  const fetchImpl = input.fetchImpl ?? fetch;
  const now = input.now ?? Date.now;
  const idFactory = input.idFactory ?? (() => crypto.randomUUID().replace(/-/g, ''));
  const posthogApiKey = input.posthogApiKey?.trim();
  const posthogHost = input.posthogHost?.trim() || DEFAULT_POSTHOG_HOST;
  const sentry = input.sentryDsn?.trim()
    ? sentryEnvelopeTarget(input.sentryDsn.trim())
    : undefined;
  const log = input.log ?? ((record) => {
    console.log(JSON.stringify(record)); // eslint-disable-line no-console
  });

  return {
    async observe(event) {
      const eventId = idFactory();
      const projection = safeEvent(event);
      try {
        log({ event: 'consuelo.os.checkout', event_id: eventId, ...projection });
      } catch {
        // Observability never controls checkout behavior.
      }
      if (!posthogApiKey) return;
      try {
        const response = await fetchImpl(posthogBatchUrl(posthogHost), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            api_key: posthogApiKey,
            batch: [
              {
                event: `consuelo_os_${event.name}`,
                distinct_id: event.accountId ?? event.checkoutId ?? eventId,
                properties: { ...projection, $insert_id: eventId },
              },
            ],
          }),
        });
        if (!response.ok) throw new Error(`PostHog HTTP ${response.status}`);
      } catch {
        // Product analytics is advisory.
      }
    },

    async captureException(error, event) {
      if (!sentry) return;
      const eventId = sentryEventId(idFactory());
      const timestamp = new Date(now()).toISOString();
      const projection = safeEvent(event);
      const envelopeHeader = JSON.stringify({ event_id: eventId, sent_at: timestamp, dsn: sentry.dsn });
      const itemHeader = JSON.stringify({ type: 'event' });
      const payload = JSON.stringify({
        event_id: eventId,
        timestamp,
        platform: 'javascript',
        level: 'error',
        logger: 'consuelo.os.checkout',
        message: safeErrorMessage(error),
        tags: projection,
        extra: { checkout: projection },
      });
      try {
        const response = await fetchImpl(sentry.url, {
          method: 'POST',
          headers: { 'content-type': 'application/x-sentry-envelope' },
          body: `${envelopeHeader}\n${itemHeader}\n${payload}\n`,
        });
        if (!response.ok) throw new Error(`Sentry HTTP ${response.status}`);
      } catch {
        // Error reporting is advisory and must not change checkout behavior.
      }
    },
  };
}
