import { describe, expect, it } from 'vitest';

import { createOsDeviceAuthorityHandler } from '../cloudflare/os-device-authority/src/app';
import { createCheckoutObservability } from '../cloudflare/os-device-authority/src/services/checkout-observability';
import {
  SyntheticCheckoutError,
  handleSyntheticStripeWebhook,
  readSyntheticCheckoutSession,
  startSyntheticStripeCheckout,
} from '../cloudflare/os-device-authority/src/services/synthetic-checkout';
import { createMemoryDeviceGrantStore } from '../cloudflare/os-device-authority/src/stores';
import { hash } from '../cloudflare/os-device-authority/src/utils';
import type { DeviceAuthorityRuntime } from '../cloudflare/os-device-authority/src/types';
import type {
  ManagedCloudGcpRateCard,
  ManagedCloudPricingPolicy,
} from '../scripts/lib/managed-cloud-pricing';

const nowMs = Date.parse('2026-08-15T02:00:00.000Z');

const rateCard: ManagedCloudGcpRateCard = {
  provider: 'gcp',
  currency: 'USD',
  version: 'synthetic-test-rate-card',
  effectiveAt: '2026-08-01T00:00:00.000Z',
  region: 'us-east1',
  rates: {
    computeHourlyMicrosByPlan: {
      starter: 20_000,
      standard: 40_000,
      performance: 80_000,
      power: 160_000,
      max: 320_000,
    },
    balancedDiskGbMonthMicros: 100_000,
    snapshotGbMonthMicros: 20_000,
    natGatewayHourlyMicros: 1_000,
    natDataProcessingGbMicros: 50_000,
    egressGbMicros: 100_000,
  },
};

const pricingPolicy: ManagedCloudPricingPolicy = {
  pricingVersion: 'synthetic-checkout-test',
  targetGrossMarginBps: 4000,
  providerContingencyBps: 500,
  priceIncrementCents: 500,
  snapshotAllowanceGb: 20,
  includedNatProcessedGb: 10,
  includedEgressGb: 10,
  platformOperationsReserveMicros: 5_000_000,
};

async function stripeSignature(secret: string, timestamp: number, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)),
  );
  const hex = Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `t=${timestamp},v1=${hex}`;
}

describe('managed cloud checkout observability', () => {
  it('projects checkout events to PostHog without email, secrets, or raw payloads', async () => {
    const requests: Array<{ url: string; body: string }> = [];
    const observer = createCheckoutObservability({
      posthogApiKey: 'phc_public_capture_key',
      posthogHost: 'https://posthog.test',
      fetchImpl: async (input, init) => {
        requests.push({
          url: typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url,
          body: String(init?.body ?? ''),
        });
        return new Response(null, { status: 200 });
      },
      now: () => nowMs,
      idFactory: () => 'evt_checkout_observe_1',
    });

    await observer.observe({
      name: 'checkout_session_created',
      accountId: 'user_opaque_123',
      checkoutId: 'mcc_opaque_456',
      planId: 'performance',
      pricingVersion: 'pricing-v1',
      monthlyPriceCents: 12_500,
      currency: 'USD',
      synthetic: false,
      outcome: 'success',
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe('https://posthog.test/batch/');
    const body = JSON.parse(requests[0]?.body ?? '{}') as Record<string, unknown>;
    expect(JSON.stringify(body)).toContain('consuelo_os_checkout_session_created');
    expect(JSON.stringify(body)).toContain('user_opaque_123');
    expect(JSON.stringify(body)).toContain('performance');
    expect(JSON.stringify(body)).not.toContain('example.com');
    expect(JSON.stringify(body)).not.toContain('sk_');
    expect(JSON.stringify(body)).not.toContain('whsec_');
  });

  it('sends a redacted checkout exception envelope to Sentry', async () => {
    const requests: Array<{ url: string; body: string }> = [];
    const observer = createCheckoutObservability({
      sentryDsn: 'https://public@example.ingest.sentry.io/42',
      fetchImpl: async (input, init) => {
        requests.push({
          url: typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url,
          body: String(init?.body ?? ''),
        });
        return new Response(null, { status: 200 });
      },
      now: () => nowMs,
      idFactory: () => '0123456789abcdef0123456789abcdef',
    });

    await observer.captureException(
      new Error('authorization=Bearer super-secret-token email=user@example.com'),
      {
        name: 'checkout_failed',
        accountId: 'user_opaque_123',
        checkoutId: 'mcc_opaque_456',
        planId: 'power',
        synthetic: false,
        outcome: 'error',
        errorCode: 'BILLING_UNAVAILABLE',
      },
    );

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe('https://example.ingest.sentry.io/api/42/envelope/');
    const body = requests[0]?.body ?? '';
    expect(body).toContain('BILLING_UNAVAILABLE');
    expect(body).toContain('user_opaque_123');
    expect(body).not.toContain('super-secret-token');
    expect(body).not.toContain('user@example.com');
  });
});

describe('synthetic Stripe checkout', () => {
  const makeRuntime = (fetchImpl: typeof fetch): DeviceAuthorityRuntime => ({
    store: createMemoryDeviceGrantStore(),
    origin: 'https://os.consuelohq.com',
    now: () => nowMs,
    fetchImpl,
    managedCloudPricing: {
      policy: pricingPolicy,
      rateCards: { 'us-east1': rateCard },
    },
    stripeSecretKey: 'rk_live_must_not_be_used',
    stripeWebhookSecret: 'whsec_live_must_not_be_used',
    stripeSyntheticSecretKey: 'rk_test_synthetic',
    stripeSyntheticWebhookSecret: 'whsec_synthetic',
    stripeSyntheticAccountIds: 'user_internal_123',
  });

  it('uses sandbox credentials and production return routes for an allowlisted account', async () => {
    const requests: Array<{ url: string; authorization: string; body: URLSearchParams }> = [];
    const runtime = makeRuntime(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const body = new URLSearchParams(String(init?.body ?? ''));
      requests.push({ url, authorization: new Headers(init?.headers).get('authorization') ?? '', body });
      return Response.json({
        id: 'cs_test_synthetic_123',
        object: 'checkout.session',
        mode: 'subscription',
        payment_status: 'unpaid',
        url: 'https://checkout.stripe.test/c/pay/cs_test_synthetic_123',
      });
    });

    const checkout = await startSyntheticStripeCheckout({
      runtime,
      accountId: 'user_internal_123',
      planId: 'performance',
    });

    expect(checkout.sessionId).toBe('cs_test_synthetic_123');
    expect(checkout.url).toContain('checkout.stripe.test');
    expect(requests).toHaveLength(1);
    expect(requests[0]?.authorization).toBe('Bearer rk_test_synthetic');
    expect(requests[0]?.authorization).not.toContain('rk_live');
    expect(requests[0]?.body.get('metadata[synthetic]')).toBe('true');
    expect(requests[0]?.body.get('metadata[plan_id]')).toBe('performance');
    expect(requests[0]?.body.get('success_url')).toContain('/auth/synthetic/checkout/result');
  });

  it('rejects non-allowlisted accounts before contacting Stripe', async () => {
    let calls = 0;
    const runtime = makeRuntime(async () => {
      calls += 1;
      return Response.json({});
    });
    await expect(startSyntheticStripeCheckout({
      runtime,
      accountId: 'user_normal_999',
      planId: 'performance',
    })).rejects.toMatchObject<SyntheticCheckoutError>({ code: 'SYNTHETIC_FORBIDDEN', status: 404 });
    expect(calls).toBe(0);
  });

  it('reads a sandbox Checkout result without consulting the live key', async () => {
    const authorizations: string[] = [];
    const runtime = makeRuntime(async (_input, init) => {
      authorizations.push(new Headers(init?.headers).get('authorization') ?? '');
      return Response.json({
        id: 'cs_test_synthetic_123',
        payment_status: 'paid',
        status: 'complete',
        metadata: {
          synthetic: 'true',
          synthetic_account_id: 'user_internal_123',
          plan_id: 'performance',
          run_id: 'syn_run_123',
        },
      });
    });
    const result = await readSyntheticCheckoutSession({
      runtime,
      accountId: 'user_internal_123',
      sessionId: 'cs_test_synthetic_123',
    });
    expect(result).toMatchObject({ paymentStatus: 'paid', status: 'complete', planId: 'performance' });
    expect(authorizations).toEqual(['Bearer rk_test_synthetic']);
  });

  it('accepts a signed sandbox completion without creating workspace or provisioning state', async () => {
    const runtime = makeRuntime(async () => Response.json({}));
    const posthogBodies: string[] = [];
    let posthogSequence = 0;
    runtime.checkoutObservability = createCheckoutObservability({
      posthogApiKey: 'phc_synthetic_checkout_test',
      posthogHost: 'https://posthog.test',
      fetchImpl: async (_input, init) => {
        posthogBodies.push(String(init?.body ?? ''));
        return new Response(null, { status: 200 });
      },
      idFactory: () => `evt_synthetic_${++posthogSequence}`,
    });
    const event = JSON.stringify({
      id: 'evt_synthetic_paid_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_synthetic_123',
          mode: 'subscription',
          payment_status: 'paid',
          amount_total: 12_500,
          currency: 'usd',
          metadata: {
            synthetic: 'true',
            synthetic_account_id: 'user_internal_123',
            plan_id: 'performance',
            run_id: 'syn_run_123',
          },
        },
      },
    });
    const timestamp = Math.floor(nowMs / 1000);
    const result = await handleSyntheticStripeWebhook({
      runtime,
      rawBody: event,
      signatureHeader: await stripeSignature('whsec_synthetic', timestamp, event),
    });
    expect(result).toMatchObject({ handled: true, paymentStatus: 'paid', planId: 'performance' });
    const retry = await handleSyntheticStripeWebhook({
      runtime,
      rawBody: event,
      signatureHeader: await stripeSignature('whsec_synthetic', timestamp, event),
    });
    expect(retry).toMatchObject({ handled: true, paymentStatus: 'paid', planId: 'performance' });
    const completionInsertIds = posthogBodies
      .map((body) => JSON.parse(body) as { batch?: Array<{ event?: string; properties?: Record<string, unknown> }> })
      .flatMap((body) => body.batch ?? [])
      .filter((item) => item.event === 'consuelo_os_checkout_synthetic_completed')
      .map((item) => item.properties?.$insert_id);
    expect(completionInsertIds).toEqual([
      'stripe:evt_synthetic_paid_1:checkout_synthetic_completed',
      'stripe:evt_synthetic_paid_1:checkout_synthetic_completed',
    ]);
    await expect(runtime.store.byAccountWorkspace('user_internal_123')).resolves.toBeUndefined();
    await expect(runtime.store.listWorkspaceMemberships('user_internal_123')).resolves.toEqual([]);
    await expect(runtime.store.claimNextManagedCloudProvisioningJob({
      leaseId: 'lease_synthetic_probe',
      nowMs,
      leaseExpiresAt: nowMs + 60_000,
      enrollmentNonce: 'nonce_synthetic_probe',
      enrollmentExpiresAt: nowMs + 60_000,
    })).resolves.toEqual({ status: 'empty' });
  });
});


describe('synthetic checkout routes', () => {
  it('requires an allowlisted authority session and CSRF before opening Stripe sandbox', async () => {
    const store = createMemoryDeviceGrantStore();
    const stripeRequests: Array<{ authorization: string; body: URLSearchParams }> = [];
    const token = 'was_internal_synthetic';
    const csrfToken = 'csrf_internal_synthetic';
    await store.putAuthoritySession({
      tokenHash: await hash(token),
      accountId: 'user_internal_123',
      email: 'internal@example.com',
      csrfToken,
      issuedAt: nowMs,
      expiresAt: nowMs + 86_400_000,
    });
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin: 'https://os.consuelohq.com',
      now: () => nowMs,
      managedCloudPricing: {
        policy: pricingPolicy,
        rateCards: { 'us-east1': rateCard },
      },
      stripeSyntheticSecretKey: 'rk_test_synthetic',
      stripeSyntheticWebhookSecret: 'whsec_synthetic',
      stripeSyntheticAccountIds: 'user_internal_123',
      fetchImpl: async (_input, init) => {
        stripeRequests.push({
          authorization: new Headers(init?.headers).get('authorization') ?? '',
          body: new URLSearchParams(String(init?.body ?? '')),
        });
        return Response.json({
          id: 'cs_test_route_123',
          url: 'https://checkout.stripe.test/c/pay/cs_test_route_123',
        });
      },
    });

    const page = await handler(new Request('https://os.consuelohq.com/auth/synthetic/checkout', {
      headers: { cookie: `__Host-consuelo_os_authority=${token}` },
    }));
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('Internal synthetic lane');

    const csrfFailure = await handler(new Request('https://os.consuelohq.com/auth/synthetic/checkout/start', {
      method: 'POST',
      headers: {
        cookie: `__Host-consuelo_os_authority=${token}`,
        origin: 'https://os.consuelohq.com',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ plan_id: 'performance', csrf_token: 'wrong' }).toString(),
    }));
    expect(csrfFailure.status).toBe(403);
    expect(stripeRequests).toHaveLength(0);

    const started = await handler(new Request('https://os.consuelohq.com/auth/synthetic/checkout/start', {
      method: 'POST',
      headers: {
        cookie: `__Host-consuelo_os_authority=${token}`,
        origin: 'https://os.consuelohq.com',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ plan_id: 'performance', csrf_token: csrfToken }).toString(),
    }));
    expect(started.status).toBe(302);
    expect(started.headers.get('location')).toContain('checkout.stripe.test');
    expect(stripeRequests).toHaveLength(1);
    expect(stripeRequests[0]?.authorization).toBe('Bearer rk_test_synthetic');
  });

  it('allows a legacy authority account through an active allowlisted workspace membership', async () => {
    const store = createMemoryDeviceGrantStore();
    const token = 'was_internal_workspace_synthetic';
    await store.putAuthoritySession({
      tokenHash: await hash(token),
      accountId: 'google:legacy-internal-user',
      email: 'internal@example.com',
      csrfToken: 'csrf_internal_workspace_synthetic',
      issuedAt: nowMs,
      expiresAt: nowMs + 86_400_000,
    });
    await store.putAccountWorkspace({
      accountId: 'google:legacy-internal-user',
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      workspaceHost: 'internal.consuelohq.com',
      updatedAt: nowMs,
    });
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin: 'https://os.consuelohq.com',
      now: () => nowMs,
      managedCloudPricing: {
        policy: pricingPolicy,
        rateCards: { 'us-east1': rateCard },
      },
      stripeSyntheticSecretKey: 'rk_test_synthetic',
      stripeSyntheticWebhookSecret: 'whsec_synthetic',
      stripeSyntheticWorkspaceIds: 'workspace_internal',
    });

    const response = await handler(new Request('https://os.consuelohq.com/auth/synthetic/checkout', {
      headers: { cookie: `__Host-consuelo_os_authority=${token}` },
    }));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Internal synthetic lane');
  });

  it('returns 404 for a valid authority session that is not allowlisted', async () => {
    const store = createMemoryDeviceGrantStore();
    const token = 'was_normal_account';
    await store.putAuthoritySession({
      tokenHash: await hash(token),
      accountId: 'user_normal_999',
      email: 'normal@example.com',
      csrfToken: 'csrf_normal',
      issuedAt: nowMs,
      expiresAt: nowMs + 86_400_000,
    });
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin: 'https://os.consuelohq.com',
      now: () => nowMs,
      managedCloudPricing: {
        policy: pricingPolicy,
        rateCards: { 'us-east1': rateCard },
      },
      stripeSyntheticSecretKey: 'rk_test_synthetic',
      stripeSyntheticWebhookSecret: 'whsec_synthetic',
      stripeSyntheticAccountIds: 'user_internal_123',
      stripeSyntheticWorkspaceIds: 'workspace_internal',
    });
    const response = await handler(new Request('https://os.consuelohq.com/auth/synthetic/checkout', {
      headers: { cookie: `__Host-consuelo_os_authority=${token}` },
    }));
    expect(response.status).toBe(404);
  });
});
