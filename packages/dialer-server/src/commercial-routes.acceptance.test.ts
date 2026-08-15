import { describe, expect, it, mock } from 'bun:test';
import { Effect } from 'effect';
import { Hono } from 'hono';

import type { DialerIdentity as Identity } from './contracts';

const identity: Identity = {
  workspaceId: 'workspace-one',
  userId: 'user-one',
  role: 'admin',
};

const boot = async () => {
  const module = await import('./routes/commercial.ts');
  const dependencies = {
    catalog: mock(() =>
      Effect.succeed({
        plans: { standard: { priceCents: 14900 } },
        trial: { includedMinutes: 30 },
      }),
    ),
    dashboard: mock((current: Identity) =>
      Effect.succeed({
        workspaceId: current.workspaceId,
        seats: [],
        numbers: [],
        usage: { connectedMinutes: 0 },
      }),
    ),
    createCheckout: mock((_identity: Identity, _body: unknown) =>
      Effect.succeed({
        id: 'cs_checkout_one',
        url: 'https://checkout.stripe.test/session-one',
      }),
    ),
    createBillingPortal: mock((_identity: Identity) =>
      Effect.succeed({
        id: 'bps_portal_one',
        url: 'https://billing.stripe.test/session-one',
      }),
    ),
    previewBillingChange: mock((_identity: Identity, _body: unknown) =>
      Effect.succeed({
        amountDue: 4200,
        currency: 'usd',
        prorationDate: 1_786_000_000,
      }),
    ),
    applyBillingChange: mock((_identity: Identity, _body: unknown) =>
      Effect.succeed({ updated: true, pendingWebhook: true }),
    ),
    updateTeam: mock((_identity: Identity, _body: unknown) =>
      Effect.succeed({ updated: true }),
    ),
    assignNumber: mock((_identity: Identity, _body: unknown) =>
      Effect.succeed({ assigned: true }),
    ),
    searchNumbers: mock((_identity: Identity, _body: unknown) =>
      Effect.succeed({ numbers: [] }),
    ),
    provisionNumber: mock((_identity: Identity, _body: unknown) =>
      Effect.succeed({ provisioned: true }),
    ),
    releaseNumber: mock((_identity: Identity, _body: unknown) =>
      Effect.succeed({ released: true }),
    ),
    processStripeWebhook: mock(() =>
      Effect.succeed({ received: true as const, duplicate: false }),
    ),
    processInstallationUninstall: mock(() =>
      Effect.succeed({ duplicate: false, cancellationScheduled: true }),
    ),
    recordProviderCompletion: mock(() => Effect.succeed(null)),
  };
  const app = new Hono<{ Variables: { identity: Identity } }>();
  app.use('/v1/*', async (context, next) => {
    context.set('identity', identity);
    await next();
  });
  app.route('/', module.createCommercialRoutes(dependencies));
  return { app, dependencies };
};

describe('commercial HTTP routes', () => {
  it('returns a secret-free catalog and tenant-bound admin dashboard', async () => {
    const { app, dependencies } = await boot();
    const catalogResponse = await app.request('/v1/commercial/catalog');
    const dashboardResponse = await app.request('/v1/commercial/admin');

    expect(catalogResponse.status).toBe(200);
    expect(JSON.stringify(await catalogResponse.json())).not.toContain(
      'stripePriceId',
    );
    expect(dashboardResponse.status).toBe(200);
    expect(await dashboardResponse.json()).toEqual(
      expect.objectContaining({ workspaceId: 'workspace-one' }),
    );
    expect(dependencies.dashboard).toHaveBeenCalledWith(identity);
  });

  it('provides explicit team and number mutation routes without accepting tenant IDs from the body', async () => {
    const { app, dependencies } = await boot();
    const teamResponse = await app.request('/v1/commercial/team', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workspaceId: 'attacker-workspace',
        assignments: [{ userId: 'user-two', planCode: 'power' }],
      }),
    });
    const numberResponse = await app.request('/v1/commercial/numbers/assign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workspaceId: 'attacker-workspace',
        userId: 'user-one',
        phoneNumber: '+15550100001',
      }),
    });

    expect(teamResponse.status).toBe(200);
    expect(numberResponse.status).toBe(200);
    expect(dependencies.updateTeam.mock.calls[0]?.[0]).toEqual(identity);
    expect(dependencies.assignNumber.mock.calls[0]?.[0]).toEqual(identity);
  });

  it('binds hosted billing, proration preview, and confirmed subscription changes to the authenticated workspace', async () => {
    const { app, dependencies } = await boot();
    const attackerBody = {
      workspaceId: 'attacker-workspace',
      payerId: 'attacker-payer',
      quantities: { single: 2, standard: 1, power: 0, additionalNumber: 1 },
      returnUrl: 'https://attacker.test/steal',
      prorationDate: 1_786_000_000,
    };
    const checkout = await app.request('/v1/commercial/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(attackerBody),
    });
    const portal = await app.request('/v1/commercial/billing/portal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(attackerBody),
    });
    const preview = await app.request('/v1/commercial/billing/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(attackerBody),
    });
    const apply = await app.request('/v1/commercial/billing/apply', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(attackerBody),
    });

    expect([checkout.status, portal.status, preview.status, apply.status]).toEqual([
      200, 200, 200, 200,
    ]);
    expect(dependencies.createCheckout).toHaveBeenCalledWith(identity, attackerBody);
    expect(dependencies.createBillingPortal).toHaveBeenCalledWith(identity, attackerBody);
    expect(dependencies.previewBillingChange).toHaveBeenCalledWith(identity, attackerBody);
    expect(dependencies.applyBillingChange).toHaveBeenCalledWith(identity, attackerBody);
  });

  it('normalizes typed application failures into the project error envelope', async () => {
    const module = await import('./routes/commercial.ts');
    const app = new Hono<{ Variables: { identity: Identity } }>();
    app.use('/v1/*', async (context, next) => {
      context.set('identity', { ...identity, role: 'user' });
      await next();
    });
    app.route(
      '/',
      module.createCommercialRoutes({
        catalog: () => Effect.succeed({}),
        dashboard: () => Effect.succeed({}),
        createCheckout: () => Effect.succeed({ id: 'cs', url: 'https://example.test' }),
        createBillingPortal: () => Effect.succeed({ id: 'bps', url: 'https://example.test' }),
        previewBillingChange: () =>
          Effect.succeed({ amountDue: 0, currency: 'usd', prorationDate: 1 }),
        applyBillingChange: () =>
          Effect.succeed({ updated: true, pendingWebhook: true }),
        updateTeam: () => Effect.fail(new Error('FORBIDDEN')),
        assignNumber: () => Effect.fail(new Error('NUMBER_LIMIT_REACHED')),
        searchNumbers: () => Effect.succeed({ numbers: [] }),
        provisionNumber: () => Effect.succeed({ provisioned: true }),
        releaseNumber: () => Effect.succeed({ released: true }),
        processStripeWebhook: () =>
          Effect.succeed({ received: true as const, duplicate: false }),
        processInstallationUninstall: () =>
          Effect.succeed({ duplicate: false, cancellationScheduled: false }),
        recordProviderCompletion: () => Effect.succeed(null),
      }),
    );

    const response = await app.request('/v1/commercial/team', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    const body = (await response.json()) as {
      error?: { code?: string; message?: string };
    };

    expect(response.status).toBe(403);
    expect(body.error?.code).toBe('FORBIDDEN');
    expect(body.error?.message).toBeString();
  });
});
