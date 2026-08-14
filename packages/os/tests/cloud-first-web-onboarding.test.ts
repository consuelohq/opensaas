import { describe, expect, it } from 'vitest';

import { createOsDeviceAuthorityHandler } from '../cloudflare/os-device-authority/src/app';
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

function googleFetch(getNonce: () => string): typeof fetch {
  return async (input) => {
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
    return Response.json({ error: 'unexpected_google_fetch' }, { status: 500 });
  };
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

function createFixture(input: { pricing?: boolean } = {}): {
  store: MemoryStore;
  repository: Repository;
  handler: AuthorityHandler;
  nonce: { value: string };
} {
  const store = createMemoryDeviceGrantStore();
  const repository = createMemoryInstallControlPlaneRepository();
  const nonce = { value: '' };
  return {
    store,
    repository,
    nonce,
    handler: createOsDeviceAuthorityHandler({
      store,
      installControlPlaneRepository: repository,
      origin,
      now: () => nowMs,
      googleOAuthClientId: 'test-google-client-id',
      googleOAuthClientSecret: 'test-google-client-secret',
      fetchImpl: googleFetch(() => nonce.value),
      ...(input.pricing
        ? {
            managedCloudPricing: {
              policy: pricingPolicy,
              rateCards: { 'us-east1': rateCard },
            },
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
