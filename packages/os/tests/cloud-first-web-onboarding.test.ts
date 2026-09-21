import { describe, expect, it } from 'vitest';

import { createOsDeviceAuthorityHandler } from '../cloudflare/os-device-authority/src/app';
import { createCheckoutObservability } from '../cloudflare/os-device-authority/src/services/checkout-observability';
import { createMemoryDeviceGrantStore } from '../cloudflare/os-device-authority/src/stores';
import { hash } from '../cloudflare/os-device-authority/src/utils';
import { createMemoryInstallControlPlaneRepository } from '../scripts/lib/install-control-plane';
import type {
  ManagedCloudGcpRateCard,
  ManagedCloudPricingPolicy,
} from '../scripts/lib/managed-cloud-pricing';

const origin = 'https://os.consuelohq.com';
const nowMs = Date.parse('2026-08-14T09:00:00.000Z');
const dayMs = 24 * 60 * 60 * 1000;

type MemoryStore = ReturnType<typeof createMemoryDeviceGrantStore>;
type Repository = ReturnType<typeof createMemoryInstallControlPlaneRepository>;
type AuthorityHandler = (request: Request) => Promise<Response>;

type CloudTrialRecord = {
  accountId: string;
  workspaceId: string;
  planId: string;
  startedAt: number;
  endsAt: number;
};

type TrialReadableStore = MemoryStore & {
  byWorkspaceCloudTrial(workspaceId: string): Promise<CloudTrialRecord | undefined>;
};

const rateCard: ManagedCloudGcpRateCard = {
  provider: 'gcp',
  currency: 'USD',
  version: 'gcp-cloud-first-2026-08',
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
  pricingVersion: 'cloud-first-onboarding-test',
  targetGrossMarginBps: 4000,
  providerContingencyBps: 500,
  priceIncrementCents: 500,
  snapshotAllowanceGb: 20,
  includedNatProcessedGb: 10,
  includedEgressGb: 10,
  platformOperationsReserveMicros: 5_000_000,
};

type StripeRequestCapture = { url: string; headers: Headers; body: URLSearchParams };

function googleFetch(
  getNonce: () => string,
  stripeRequests: StripeRequestCapture[] = [],
): typeof fetch {
  return async (input, init) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    if (url === 'https://oauth2.googleapis.com/token') {
      return Response.json({ id_token: 'verified-google-id-token' });
    }
    if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) {
      return Response.json({
        aud: 'test-google-client-id',
        sub: 'google-cloud-first-123',
        email: 'new.user@example.com',
        email_verified: 'true',
        nonce: getNonce(),
      });
    }
    if (url === 'https://stripe.test/v1/checkout/sessions') {
      const body = new URLSearchParams(typeof init?.body === 'string' ? init.body : '');
      stripeRequests.push({ url, headers: new Headers(init?.headers), body });
      return Response.json({
        id: `cs_test_${body.get('metadata[plan_id]') ?? 'unknown'}`,
        object: 'checkout.session',
        mode: 'subscription',
        payment_status: 'unpaid',
        url: `https://checkout.stripe.test/${body.get('metadata[plan_id]') ?? 'unknown'}`,
      });
    }
    return Response.json({ error: 'unexpected_google_fetch' }, { status: 500 });
  };
}

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

function cookieValue(response: Response, name: string): string {
  const header = response.headers.get('set-cookie') ?? '';
  const match = header.match(new RegExp(`(?:^|,\\s*)${name}=([^;,]+)`));
  if (!match?.[1]) throw new Error(`missing cookie ${name}`);
  return decodeURIComponent(match[1]);
}

function authorityCookie(token: string): string {
  return `__Host-consuelo_os_authority=${encodeURIComponent(token)}`;
}

function form(values: Record<string, string>): RequestInit {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin,
    },
    body: new URLSearchParams(values).toString(),
  };
}

function createFixture(input: { pricing?: boolean; stripe?: boolean; checkoutObservability?: ReturnType<typeof createCheckoutObservability> } = {}): {
  store: MemoryStore;
  repository: Repository;
  handler: AuthorityHandler;
  nonce: { value: string };
  stripeRequests: StripeRequestCapture[];
} {
  const store = createMemoryDeviceGrantStore();
  const repository = createMemoryInstallControlPlaneRepository();
  const nonce = { value: '' };
  const stripeRequests: StripeRequestCapture[] = [];
  return {
    store,
    repository,
    nonce,
    stripeRequests,
    handler: createOsDeviceAuthorityHandler({
      store,
      installControlPlaneRepository: repository,
      origin,
      now: () => nowMs,
      googleOAuthClientId: 'test-google-client-id',
      googleOAuthClientSecret: 'test-google-client-secret',
      fetchImpl: googleFetch(() => nonce.value, stripeRequests),
      checkoutObservability: input.checkoutObservability,
      ...(input.pricing
        ? {
            managedCloudPricing: {
              policy: pricingPolicy,
              rateCards: { 'us-east1': rateCard },
            },
          }
        : {}),
      ...(input.stripe
        ? {
            stripeSecretKey: 'sk_test_os',
            stripeWebhookSecret: 'whsec_test_os',
            stripeApiBaseUrl: 'https://stripe.test/v1',
          }
        : {}),
    }),
  };
}

async function signup(input: {
  handler: AuthorityHandler;
  store: MemoryStore;
  nonce: { value: string };
}): Promise<{
  token: string;
  accountId: string;
  csrfToken: string;
  callback: Response;
  state: string;
}> {
  const start = await input.handler(
    new Request(`${origin}/login/google/start?purpose=web&intent=signup&return_to=/`),
  );
  expect(start.status).toBe(302);
  const google = new URL(start.headers.get('location') ?? '');
  const state = google.searchParams.get('state') ?? '';
  input.nonce.value = google.searchParams.get('nonce') ?? '';
  expect(state).toMatch(/^web_state_/);
  expect(input.nonce.value).toMatch(/^web_nonce_/);
  const storedState = (await input.store.byWebOAuthState(state)) as
    | { intent?: string }
    | undefined;
  expect(storedState?.intent).toBe('signup');

  const callback = await input.handler(
    new Request(
      `${origin}/login/google/callback?code=google-code&state=${encodeURIComponent(state)}`,
    ),
  );
  expect(callback.status).toBe(302);
  expect(callback.headers.get('set-cookie')).toContain('Max-Age=2592000');
  const token = cookieValue(callback, '__Host-consuelo_os_authority');
  const session = await input.store.byAuthoritySession(await hash(token));
  expect(session).toBeDefined();
  expect(session?.accountId).toMatch(/^user_[a-f0-9]{20}$/);
  expect(session?.accountId).not.toMatch(/^google:/);
  return {
    token,
    accountId: session?.accountId ?? '',
    csrfToken: session?.csrfToken ?? '',
    callback,
    state,
  };
}

describe('cloud-first web onboarding', () => {
  it('does not create a canonical account when an unknown user chooses Log in', async () => {
    const fixture = createFixture({ pricing: true });
    const start = await fixture.handler(
      new Request(`${origin}/login/google/start?purpose=web&intent=login&return_to=/`),
    );
    expect(start.status).toBe(302);
    const google = new URL(start.headers.get('location') ?? '');
    const state = google.searchParams.get('state') ?? '';
    fixture.nonce.value = google.searchParams.get('nonce') ?? '';

    const callback = await fixture.handler(
      new Request(
        `${origin}/login/google/callback?code=google-code&state=${encodeURIComponent(state)}`,
      ),
    );
    expect(callback.status).toBe(404);
    expect(await callback.text()).toContain('No Consuelo account found');
    await expect(
      fixture.repository.findCanonicalUsersByEmail('new.user@example.com'),
    ).resolves.toEqual([]);
  });

  it('reuses an existing account on signup and does not expose cloud-first creation to existing zero-workspace accounts', async () => {
    const fixture = createFixture({ pricing: true });
    await fixture.repository.upsertUser({
      userId: 'user_existing_local',
      email: 'new.user@example.com',
      workspaceIds: [],
      createdAt: '2026-08-01T12:00:00.000Z',
      updatedAt: new Date(nowMs).toISOString(),
    });
    const start = await fixture.handler(
      new Request(`${origin}/login/google/start?purpose=web&intent=signup&return_to=/`),
    );
    const google = new URL(start.headers.get('location') ?? '');
    const state = google.searchParams.get('state') ?? '';
    fixture.nonce.value = google.searchParams.get('nonce') ?? '';
    const callback = await fixture.handler(
      new Request(
        `${origin}/login/google/callback?code=google-code&state=${encodeURIComponent(state)}`,
      ),
    );
    expect(callback.status).toBe(302);
    const token = cookieValue(callback, '__Host-consuelo_os_authority');
    const session = await fixture.store.byAuthoritySession(await hash(token));
    expect(session?.accountId).toBe('user_existing_local');
    expect(session?.cloudOnboardingEligible).toBe(false);
    await expect(
      fixture.repository.findCanonicalUsersByEmail('new.user@example.com'),
    ).resolves.toHaveLength(1);

    const workspaces = await fixture.handler(
      new Request(`${origin}/auth/workspaces`, {
        headers: { cookie: authorityCookie(token) },
      }),
    );
    const html = await workspaces.text();
    expect(html).toContain('Your workspace is not available yet');
    expect(html).not.toContain('Create workspace');

    const attempt = await fixture.handler(
      new Request(origin + '/onboarding/workspace', {
        ...form({
          workspace_name: 'Should Not Exist',
          csrf_token: session?.csrfToken ?? '',
        }),
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          origin,
          cookie: authorityCookie(token),
        },
      }),
    );
    expect(attempt.status).toBe(403);
    await expect(
      fixture.store.byAccountWorkspace('user_existing_local'),
    ).resolves.toBeUndefined();
  });

  it('turns first Google sign-in into one canonical Consuelo user and keeps the browser login durable', async () => {
    const fixture = createFixture({ pricing: true });
    const signedUp = await signup(fixture);

    const users = await fixture.repository.findCanonicalUsersByEmail(
      'new.user@example.com',
    );
    expect(users).toHaveLength(1);
    expect(users[0]?.userId).toBe(signedUp.accountId);
    expect(users[0]?.userId).not.toMatch(/^google:/);

    const root = await fixture.handler(
      new Request(origin + '/', {
        headers: { cookie: authorityCookie(signedUp.token) },
      }),
    );
    expect(root.status).toBe(302);
    expect(new URL(root.headers.get('location') ?? '', origin).pathname).toBe(
      '/auth/workspaces',
    );
  });

  it('creates one named workspace, 14-day Standard trial, and idempotent server-priced cloud job', async () => {
    const fixture = createFixture({ pricing: true });
    const signedUp = await signup(fixture);
    const cookie = authorityCookie(signedUp.token);

    const workspaces = await fixture.handler(
      new Request(origin + '/auth/workspaces?return_to=/', {
        headers: { cookie },
      }),
    );
    expect(workspaces.status).toBe(200);
    const onboardingHtml = await workspaces.text();
    expect(onboardingHtml).toContain('Name your workspace');
    expect(onboardingHtml).toContain('14-day free trial');
    expect(onboardingHtml).toContain('Standard');
    expect(onboardingHtml).not.toMatch(
      /machineType|providerCost|grossMargin|e2-standard-2|enrollmentToken/i,
    );

    const forged = await fixture.handler(
      new Request(origin + '/onboarding/workspace', {
        ...form({
          workspace_name: 'Acme Research',
          csrf_token: signedUp.csrfToken,
        }),
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          origin: 'https://evil.example',
          cookie,
        },
      }),
    );
    expect(forged.status).toBe(403);

    const create = () =>
      fixture.handler(
        new Request(origin + '/onboarding/workspace', {
          ...form({
            workspace_name: 'Acme Research',
            csrf_token: signedUp.csrfToken,
          }),
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            origin,
            cookie,
          },
        }),
      );

    const first = await create();
    expect(first.status).toBe(302);
    const firstLocation = new URL(first.headers.get('location') ?? '', origin);
    expect(firstLocation.pathname).toBe('/onboarding/provisioning');
    const jobId = firstLocation.searchParams.get('job_id') ?? '';
    expect(jobId).toMatch(/^mcpj_/);

    const workspace = await fixture.store.byAccountWorkspace(signedUp.accountId);
    expect(workspace).toMatchObject({
      accountId: signedUp.accountId,
      displayName: 'Acme Research',
    });
    expect(workspace?.workspaceId).toMatch(/^workspace_[a-f0-9]{20}$/);
    expect(workspace?.workspaceSlug).toMatch(/^acme-research-[a-f0-9]{6}$/);
    expect(workspace?.workspaceHost).toBe(
      `${workspace?.workspaceSlug}.consuelohq.com`,
    );

    const membership = (
      await fixture.store.listWorkspaceMemberships(signedUp.accountId)
    )[0];
    expect(membership).toMatchObject({
      workspaceId: workspace?.workspaceId,
      workspaceHost: workspace?.workspaceHost,
      status: 'active',
    });

    const trial = await (
      fixture.store as TrialReadableStore
    ).byWorkspaceCloudTrial(workspace?.workspaceId ?? '');
    expect(trial).toMatchObject({
      accountId: signedUp.accountId,
      workspaceId: workspace?.workspaceId,
      planId: 'standard',
      startedAt: nowMs,
      endsAt: nowMs + 14 * dayMs,
    });

    const job = await fixture.store.byManagedCloudProvisioningJob(jobId);
    expect(job).toMatchObject({
      accountId: signedUp.accountId,
      workspaceId: workspace?.workspaceId,
      planId: 'standard',
      region: 'us-east1',
      pricingVersion: pricingPolicy.pricingVersion,
      status: 'requested',
    });
    expect(job?.monthlyPriceCents).toBeGreaterThan(0);

    const user = (
      await fixture.repository.findCanonicalUsersByEmail('new.user@example.com')
    )[0];
    expect(user?.workspaceMemberships).toEqual([
      expect.objectContaining({
        workspaceId: workspace?.workspaceId,
        verifiedAt: new Date(nowMs).toISOString(),
      }),
    ]);

    const duplicate = await create();
    expect(duplicate.status).toBe(302);
    const duplicateLocation = new URL(
      duplicate.headers.get('location') ?? '',
      origin,
    );
    expect(duplicateLocation.searchParams.get('job_id')).toBe(jobId);
    expect(await fixture.store.listWorkspaceMemberships(signedUp.accountId)).toHaveLength(1);

    const status = await fixture.handler(
      new Request(`${origin}/onboarding/status?job_id=${encodeURIComponent(jobId)}`, {
        headers: { cookie },
      }),
    );
    expect(status.status).toBe(200);
    const statusPayload = await status.json();
    expect(statusPayload).toMatchObject({
      job: { jobId, planId: 'standard', region: 'us-east1' },
      trial: { endsAt: nowMs + 14 * dayMs },
    });
    expect(JSON.stringify(statusPayload)).not.toMatch(
      /machineType|providerCost|landedCost|grossMargin|enrollment|secret|token/i,
    );
  });

  it('fails before workspace or trial persistence when managed-cloud pricing is unavailable', async () => {
    const fixture = createFixture();
    const signedUp = await signup(fixture);
    const response = await fixture.handler(
      new Request(origin + '/onboarding/workspace', {
        ...form({
          workspace_name: 'No Price Workspace',
          csrf_token: signedUp.csrfToken,
        }),
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          origin,
          cookie: authorityCookie(signedUp.token),
        },
      }),
    );

    expect(response.status).toBe(503);
    await expect(fixture.store.byAccountWorkspace(signedUp.accountId)).resolves.toBeUndefined();
    const user = (
      await fixture.repository.findCanonicalUsersByEmail('new.user@example.com')
    )[0];
    expect(user?.workspaceMemberships).toEqual([]);
  });

  it('repairs a partial workspace/trial commit when the provisioning job write fails once', async () => {
    const fixture = createFixture({ pricing: true });
    const signedUp = await signup(fixture);
    const cookie = authorityCookie(signedUp.token);
    const originalCreate = fixture.store.createManagedCloudProvisioningJob.bind(
      fixture.store,
    );
    let failOnce = true;
    fixture.store.createManagedCloudProvisioningJob = async (job) => {
      if (failOnce) {
        failOnce = false;
        throw new Error('transient provisioning store failure');
      }
      return originalCreate(job);
    };

    const submit = () =>
      fixture.handler(
        new Request(origin + '/onboarding/workspace', {
          ...form({
            workspace_name: 'Recovery Workspace',
            csrf_token: signedUp.csrfToken,
          }),
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            origin,
            cookie,
          },
        }),
      );

    const first = await submit();
    expect(first.status).toBe(503);
    const workspace = await fixture.store.byAccountWorkspace(signedUp.accountId);
    expect(workspace?.workspaceId).toBeTruthy();
    const trial = await fixture.store.byWorkspaceCloudTrial(
      workspace?.workspaceId ?? '',
    );
    expect(trial?.provisioningJobId).toMatch(/^mcpj_/);
    await expect(
      fixture.store.byManagedCloudProvisioningJob(
        trial?.provisioningJobId ?? '',
      ),
    ).resolves.toBeUndefined();

    const retry = await submit();
    expect(retry.status).toBe(302);
    const retryLocation = new URL(retry.headers.get('location') ?? '', origin);
    expect(retryLocation.searchParams.get('job_id')).toBe(
      trial?.provisioningJobId,
    );
    await expect(
      fixture.store.byManagedCloudProvisioningJob(
        trial?.provisioningJobId ?? '',
      ),
    ).resolves.toMatchObject({
      jobId: trial?.provisioningJobId,
      workspaceId: workspace?.workspaceId,
      planId: 'standard',
    });
  });

  it('renders selectable Standard and larger plan cards with server prices and paid CTA behavior', async () => {
    const fixture = createFixture({ pricing: true, stripe: true });
    const signedUp = await signup(fixture);
    const response = await fixture.handler(
      new Request(origin + '/auth/workspaces', {
        headers: { cookie: authorityCookie(signedUp.token) },
      }),
    );
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('name="plan_id"');
    expect(html).toContain('value="standard"');
    expect(html).toContain('value="performance"');
    expect(html).toContain('value="power"');
    expect(html).toContain('value="max"');
    expect(html).not.toContain('value="starter"');
    expect(html).toContain('2 vCPU · 8 GB');
    expect(html).toContain('4 vCPU · 16 GB');
    expect(html).toContain('8 vCPU · 32 GB');
    expect(html).toContain('16 vCPU · 64 GB');
    expect(html).toContain('14 days free');
    expect(html).toMatch(/\$\d+(?:\.\d{2})?\/mo/);
    expect(html).toContain('.plan-radio:checked + .plan-card');
    expect(html).toContain('Checkout and Create Workspace');
  });

  it('creates Stripe Checkout for a paid plan without creating workspace state before payment', async () => {
    const fixture = createFixture({ pricing: true, stripe: true });
    const signedUp = await signup(fixture);
    const cookie = authorityCookie(signedUp.token);
    const response = await fixture.handler(
      new Request(origin + '/onboarding/workspace', {
        ...form({
          workspace_name: 'Paid Workspace',
          plan_id: 'performance',
          csrf_token: signedUp.csrfToken,
        }),
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          origin,
          cookie,
        },
      }),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://checkout.stripe.test/performance');
    expect(fixture.stripeRequests).toHaveLength(1);
    const stripe = fixture.stripeRequests[0];
    expect(stripe?.headers.get('authorization')).toBe('Bearer sk_test_os');
    expect(stripe?.headers.get('idempotency-key')).toMatch(/^mcc_/);
    expect(stripe?.body.get('mode')).toBe('subscription');
    expect(stripe?.body.get('payment_method_types[0]')).toBe('card');
    expect(stripe?.body.get('metadata[account_id]')).toBe(signedUp.accountId);
    expect(stripe?.body.get('metadata[plan_id]')).toBe('performance');
    expect(Number(stripe?.body.get('line_items[0][price_data][unit_amount]'))).toBeGreaterThan(0);
    expect(stripe?.body.get('line_items[0][price_data][recurring][interval]')).toBe('month');
    await expect(fixture.store.byAccountWorkspace(signedUp.accountId)).resolves.toBeUndefined();
    await expect(fixture.store.listWorkspaceMemberships(signedUp.accountId)).resolves.toEqual([]);

    const sessionId = 'cs_test_performance';
    const success = await fixture.handler(
      new Request(`${origin}/onboarding/checkout/success?session_id=${sessionId}`, {
        headers: { cookie },
      }),
    );
    expect(success.status).toBe(200);
    expect(await success.text()).toContain('Confirming your payment');
    await expect(fixture.store.byAccountWorkspace(signedUp.accountId)).resolves.toBeUndefined();
  });

  it('fulfills one paid checkout only after a valid Stripe webhook and is idempotent', async () => {
    const posthogBodies: string[] = [];
    let posthogSequence = 0;
    const checkoutObservability = createCheckoutObservability({
      posthogApiKey: 'phc_checkout_test',
      posthogHost: 'https://posthog.test',
      fetchImpl: async (_input, init) => {
        posthogBodies.push(String(init?.body ?? ''));
        return new Response(null, { status: 200 });
      },
      idFactory: () => `evt_checkout_${++posthogSequence}`,
    });
    const fixture = createFixture({ pricing: true, stripe: true, checkoutObservability });
    const signedUp = await signup(fixture);
    const cookie = authorityCookie(signedUp.token);
    const checkout = await fixture.handler(
      new Request(origin + '/onboarding/workspace', {
        ...form({
          workspace_name: 'Paid Workspace',
          plan_id: 'performance',
          csrf_token: signedUp.csrfToken,
        }),
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          origin,
          cookie,
        },
      }),
    );
    expect(checkout.status).toBe(302);
    const stripe = fixture.stripeRequests[0];
    const checkoutId = stripe?.body.get('metadata[checkout_id]') ?? '';
    const amount = Number(stripe?.body.get('line_items[0][price_data][unit_amount]'));
    const pricingVersion = stripe?.body.get('metadata[pricing_version]') ?? '';
    expect(checkoutId).toMatch(/^mcc_/);

    const event = JSON.stringify({
      id: 'evt_paid_1',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_performance',
          object: 'checkout.session',
          mode: 'subscription',
          payment_status: 'paid',
          amount_total: amount,
          currency: 'usd',
          client_reference_id: checkoutId,
          customer: 'cus_paid_1',
          subscription: 'sub_paid_1',
          metadata: {
            checkout_id: checkoutId,
            account_id: signedUp.accountId,
            plan_id: 'performance',
            pricing_version: pricingVersion,
          },
        },
      },
    });
    const timestamp = Math.floor(nowMs / 1000);
    const signature = await stripeSignature('whsec_test_os', timestamp, event);
    const sendWebhook = () => fixture.handler(
      new Request(origin + '/webhooks/stripe', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': signature,
        },
        body: event,
      }),
    );

    const first = await sendWebhook();
    expect(first.status).toBe(200);
    const second = await sendWebhook();
    expect(second.status).toBe(200);
    const completionInsertIds = posthogBodies
      .map((body) => JSON.parse(body) as { batch?: Array<{ event?: string; properties?: Record<string, unknown> }> })
      .flatMap((body) => body.batch ?? [])
      .filter((event) => event.event === 'consuelo_os_checkout_completed')
      .map((event) => event.properties?.$insert_id);
    expect(completionInsertIds).toEqual([
      'stripe:evt_paid_1:checkout_completed',
      'stripe:evt_paid_1:checkout_completed',
    ]);

    const status = await fixture.handler(
      new Request(`${origin}/onboarding/checkout/status?session_id=cs_test_performance`, {
        headers: { cookie },
      }),
    );
    expect(status.status).toBe(200);
    const payload = await status.json() as { status?: string; jobId?: string };
    expect(payload.status).toBe('paid');
    expect(payload.jobId).toMatch(/^mcpj_/);
    await expect(fixture.store.byManagedCloudProvisioningJob(payload.jobId ?? '')).resolves.toMatchObject({
      accountId: signedUp.accountId,
      planId: 'performance',
      monthlyPriceCents: amount,
      status: 'requested',
    });
    await expect(fixture.store.listWorkspaceMemberships(signedUp.accountId)).resolves.toHaveLength(1);
  });

  it('rejects a paid webhook whose amount does not match the server quote', async () => {
    const fixture = createFixture({ pricing: true, stripe: true });
    const signedUp = await signup(fixture);
    const cookie = authorityCookie(signedUp.token);
    await fixture.handler(
      new Request(origin + '/onboarding/workspace', {
        ...form({
          workspace_name: 'Quoted Workspace',
          plan_id: 'performance',
          csrf_token: signedUp.csrfToken,
        }),
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          origin,
          cookie,
        },
      }),
    );
    const stripe = fixture.stripeRequests[0];
    const checkoutId = stripe?.body.get('metadata[checkout_id]') ?? '';
    const amount = Number(stripe?.body.get('line_items[0][price_data][unit_amount]'));
    const pricingVersion = stripe?.body.get('metadata[pricing_version]') ?? '';
    const event = JSON.stringify({
      id: 'evt_wrong_amount',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_performance',
          mode: 'subscription',
          payment_status: 'paid',
          amount_total: amount + 500,
          currency: 'usd',
          client_reference_id: checkoutId,
          customer: 'cus_wrong',
          subscription: 'sub_wrong',
          metadata: {
            checkout_id: checkoutId,
            account_id: signedUp.accountId,
            plan_id: 'performance',
            pricing_version: pricingVersion,
          },
        },
      },
    });
    const timestamp = Math.floor(nowMs / 1000);
    const response = await fixture.handler(
      new Request(origin + '/webhooks/stripe', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': await stripeSignature('whsec_test_os', timestamp, event),
        },
        body: event,
      }),
    );
    expect(response.status).toBe(400);
    await expect(fixture.store.byAccountWorkspace(signedUp.accountId)).resolves.toBeUndefined();
    await expect(fixture.store.listWorkspaceMemberships(signedUp.accountId)).resolves.toEqual([]);
  });

  it('does not create a second live paid checkout while one is active', async () => {
    const fixture = createFixture({ pricing: true, stripe: true });
    const signedUp = await signup(fixture);
    const cookie = authorityCookie(signedUp.token);
    const submit = (planId: string) => fixture.handler(
      new Request(origin + '/onboarding/workspace', {
        ...form({
          workspace_name: 'Paid Workspace',
          plan_id: planId,
          csrf_token: signedUp.csrfToken,
        }),
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          origin,
          cookie,
        },
      }),
    );
    const first = await submit('performance');
    expect(first.status).toBe(302);
    const second = await submit('power');
    expect(second.status).toBe(409);
    expect(await second.text()).toContain('checkout is already in progress');
    expect(fixture.stripeRequests).toHaveLength(1);
  });

  it('rejects an invalid Stripe webhook without creating workspace state', async () => {
    const fixture = createFixture({ pricing: true, stripe: true });
    const signedUp = await signup(fixture);
    const event = JSON.stringify({ id: 'evt_bad', type: 'checkout.session.completed', data: { object: {} } });
    const response = await fixture.handler(
      new Request(origin + '/webhooks/stripe', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=bad' },
        body: event,
      }),
    );
    expect(response.status).toBe(400);
    await expect(fixture.store.byAccountWorkspace(signedUp.accountId)).resolves.toBeUndefined();
  });

  it('does not expose one account onboarding job through another authority session', async () => {
    const fixture = createFixture({ pricing: true });
    const signedUp = await signup(fixture);
    const cookie = authorityCookie(signedUp.token);
    const created = await fixture.handler(
      new Request(origin + '/onboarding/workspace', {
        ...form({
          workspace_name: 'Private Workspace',
          csrf_token: signedUp.csrfToken,
        }),
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          origin,
          cookie,
        },
      }),
    );
    const jobId = new URL(created.headers.get('location') ?? '', origin).searchParams.get('job_id') ?? '';

    const otherToken = 'was_other_authority_session';
    await fixture.store.putAuthoritySession({
      tokenHash: await hash(otherToken),
      accountId: 'user_other_123',
      email: 'other@example.com',
      csrfToken: 'csrf_other',
      issuedAt: nowMs,
      expiresAt: nowMs + 30 * dayMs,
    });
    const forbidden = await fixture.handler(
      new Request(`${origin}/onboarding/status?job_id=${encodeURIComponent(jobId)}`, {
        headers: { cookie: authorityCookie(otherToken) },
      }),
    );
    expect(forbidden.status).toBe(404);
  });
});
