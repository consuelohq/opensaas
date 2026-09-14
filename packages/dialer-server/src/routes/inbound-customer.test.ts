import { describe, expect, it } from 'bun:test';

import { createInboundCustomerRoutes } from './inbound-customer';

const snapshot = {
  publicId: 'sales',
  phoneNumber: '+15550100123',
  timezone: 'America/New_York',
  staffAvailableNow: false,
  callback: {
    available: true,
    disclosure: 'We can call you back during a staffed service window.',
    serviceWindows: [
      {
        id: 'window-one',
        label: 'Monday, 9:00 AM–10:00 AM EDT',
        startsAt: '2026-09-14T13:00:00.000Z',
        endsAt: '2026-09-14T14:00:00.000Z',
      },
    ],
  },
};

const createApplication = () => {
  const calls: Array<{ operation: string; args: unknown[] }> = [];
  return {
    calls,
    application: {
      snapshot: async (...args: unknown[]) => {
        calls.push({ operation: 'snapshot', args });
        return snapshot;
      },
      requestCallback: async (...args: unknown[]) => {
        calls.push({ operation: 'requestCallback', args });
        return {
          callback: {
            status: 'scheduled',
            notBefore: '2026-09-14T13:00:00.000Z',
            deadline: '2026-09-14T14:00:00.000Z',
          },
          booking: { status: 'unavailable' },
          managementToken: 'opaque-management-token-123456',
        };
      },
      readCallback: async (...args: unknown[]) => {
        calls.push({ operation: 'readCallback', args });
        return { callback: { status: 'scheduled' }, booking: { status: 'unavailable' } };
      },
      rescheduleCallback: async (...args: unknown[]) => {
        calls.push({ operation: 'rescheduleCallback', args });
        return { callback: { status: 'scheduled' }, booking: { status: 'unavailable' } };
      },
      cancelCallback: async (...args: unknown[]) => {
        calls.push({ operation: 'cancelCallback', args });
        return { callback: { status: 'cancelled' }, booking: { status: 'cancelled' } };
      },
    },
  };
};

describe('public inbound customer routes', () => {
  it('serves a public snapshot without accepting internal authority from the browser', async () => {
    const fixture = createApplication();
    const routes = createInboundCustomerRoutes(fixture.application);
    const response = await routes.request('/v1/inbound/customer/sales');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(snapshot);
    expect(JSON.stringify(body)).not.toContain('workspace');
    expect(JSON.stringify(body)).not.toContain('numberId');
    expect(fixture.calls).toEqual([
      { operation: 'snapshot', args: ['sales'] },
    ]);
  });

  it('rejects forged internal authority and passes the edge client address to admission', async () => {
    const fixture = createApplication();
    const routes = createInboundCustomerRoutes(fixture.application);
    const validDomesticPhone = ['(828)', '555', '0123'].join(' ');

    const forged = await routes.request('/v1/inbound/customer/sales/callbacks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.10' },
      body: JSON.stringify({
        phoneNumber: validDomesticPhone,
        permissionAccepted: true,
        idempotencyKey: 'request-12345678',
        mode: 'immediate',
        workspaceId: 'forged-workspace',
      }),
    });
    expect(forged.status).toBe(400);
    expect(fixture.calls).toHaveLength(0);

    const accepted = await routes.request('/v1/inbound/customer/sales/callbacks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.10' },
      body: JSON.stringify({
        phoneNumber: validDomesticPhone,
        permissionAccepted: true,
        idempotencyKey: 'request-12345678',
        mode: 'immediate',
      }),
    });
    expect(accepted.status).toBe(201);
    expect(fixture.calls).toHaveLength(1);
    expect(fixture.calls[0]?.operation).toBe('requestCallback');
    expect(fixture.calls[0]?.args[0]).toBe('sales');
    expect(fixture.calls[0]?.args[1]).toBe('203.0.113.10');
  });

  it('normalizes a domestic formatted phone number before callback admission', async () => {
    const fixture = createApplication();
    const routes = createInboundCustomerRoutes(fixture.application);
    const response = await routes.request('/v1/inbound/customer/sales/callbacks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: '(828) 555-0123',
        permissionAccepted: true,
        idempotencyKey: 'request-12345678',
        mode: 'immediate',
      }),
    });
    expect(response.status).toBe(201);
    expect(fixture.calls[0]?.args[2]).toMatchObject({
      phoneNumber: '+18285550123',
    });
  });

  it('requires an opaque capability header for status, reschedule, and cancellation', async () => {
    const fixture = createApplication();
    const routes = createInboundCustomerRoutes(fixture.application);
    expect(
      (await routes.request('/v1/inbound/customer/sales/callbacks/status')).status,
    ).toBe(401);

    const status = await routes.request(
      '/v1/inbound/customer/sales/callbacks/status',
      { headers: { authorization: 'Callback opaque-management-token-123456' } },
    );
    expect(status.status).toBe(200);

    const reschedule = await routes.request(
      '/v1/inbound/customer/sales/callbacks/reschedule',
      {
        method: 'POST',
        headers: {
          authorization: 'Callback opaque-management-token-123456',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ serviceWindowId: 'window-one' }),
      },
    );
    expect(reschedule.status).toBe(200);

    const cancel = await routes.request(
      '/v1/inbound/customer/sales/callbacks/cancel',
      {
        method: 'POST',
        headers: {
          authorization: 'Callback opaque-management-token-123456',
          'content-type': 'application/json',
        },
        body: '{}',
      },
    );
    expect(cancel.status).toBe(200);
    expect(fixture.calls.map((call) => call.operation)).toEqual([
      'readCallback',
      'rescheduleCallback',
      'cancelCallback',
    ]);
  });
});
