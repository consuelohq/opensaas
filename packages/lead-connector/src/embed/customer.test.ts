import { describe, expect, it } from 'bun:test';

import {
  createCustomerEntryApi,
  createCustomerEntryController,
  renderCustomerEntry,
  type CustomerEntrySnapshot,
} from './customer';

const snapshot: CustomerEntrySnapshot = {
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

describe('public customer callback surface', () => {
  it('reads the standard nested public API error envelope', async () => {
    const api = createCustomerEntryApi({
      baseUrl: 'https://calls.example.test',
      fetch: async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'CUSTOMER_CALLBACK_RATE_LIMITED',
              message: 'Too many callback requests',
              retryable: true,
            },
          }),
          { status: 429, headers: { 'content-type': 'application/json' } },
        ),
    });
    await expect(
      api.requestCallback('sales', {
        phoneNumber: '+15550100999',
        permissionAccepted: true,
        idempotencyKey: 'request-12345678',
        mode: 'immediate',
      }),
    ).rejects.toThrow('Too many callback requests');
  });

  it('shows direct calling and truthful callback promises without inventing an ETA', () => {
    const html = renderCustomerEntry({ phase: 'ready', snapshot, result: null, error: null });
    expect(html).toContain('href="tel:+15550100123"');
    expect(html).toContain('Request a callback');
    expect(html).toContain('as soon as staffed capacity permits');
    expect(html).toContain('Monday, 9:00 AM–10:00 AM EDT');
    expect(html).toContain('We can call you back during a staffed service window.');
    expect(html).toContain('name="permissionAccepted"');
    expect(html).not.toMatch(/\b\d+\s+minutes?\b/i);
    expect(html).toContain('No staff are available right now');
  });

  it('hides callback controls when the server says the capability is unavailable', () => {
    const html = renderCustomerEntry({
      phase: 'ready',
      snapshot: {
        ...snapshot,
        callback: { available: false, disclosure: null, serviceWindows: [] },
      },
      result: null,
      error: null,
    });
    expect(html).toContain('href="tel:+15550100123"');
    expect(html).not.toContain('data-form="customer-callback"');
    expect(html).not.toContain('Request a callback');
  });

  it('does not render an appointment as confirmed without provider evidence', () => {
    const requested = renderCustomerEntry({
      phase: 'ready',
      snapshot,
      error: null,
      result: {
        managementToken: 'opaque-token',
        callback: { status: 'scheduled' },
        booking: {
          status: 'requested',
          providerReference: null,
          evidenceReference: null,
        },
      },
    });
    expect(requested).toContain('Callback requested');
    expect(requested).not.toContain('Appointment confirmed');

    const confirmed = renderCustomerEntry({
      phase: 'ready',
      snapshot,
      error: null,
      result: {
        managementToken: 'opaque-token',
        callback: { status: 'scheduled' },
        booking: {
          status: 'confirmed',
          providerReference: 'provider-1',
          evidenceReference: 'evidence-1',
        },
      },
    });
    expect(confirmed).toContain('Appointment confirmed');
  });

  it('shows cancellation as pending until the server reaches terminal cancelled state', () => {
    const html = renderCustomerEntry({
      phase: 'ready',
      snapshot,
      error: null,
      result: {
        managementToken: 'opaque-token',
        callback: { status: 'cancel_pending' },
        booking: { status: 'unavailable' },
      },
    });
    expect(html).toContain('Cancellation pending');
    expect(html).not.toContain('Callback cancelled');
  });

  it('coalesces a double-submit onto one idempotent callback request', async () => {
    let requests = 0;
    let resolveRequest: ((value: unknown) => void) | undefined;
    const pending = new Promise<unknown>((resolve) => {
      resolveRequest = resolve;
    });
    const controller = createCustomerEntryController({
      publicId: 'sales',
      createIdempotencyKey: () => 'request-12345678',
      api: {
        load: async () => snapshot,
        requestCallback: async (_publicId, input) => {
          requests++;
          expect(input.idempotencyKey).toBe('request-12345678');
          return pending as never;
        },
        readCallback: async () => {
          throw new Error('not used');
        },
        rescheduleCallback: async () => {
          throw new Error('not used');
        },
        cancelCallback: async () => {
          throw new Error('not used');
        },
      },
    });
    await controller.load();
    const input = {
      phoneNumber: '+15550100999',
      permissionAccepted: true as const,
      mode: 'immediate' as const,
    };
    const first = controller.requestCallback(input);
    const second = controller.requestCallback(input);
    expect(requests).toBe(1);
    resolveRequest?.({
      managementToken: 'opaque-token',
      callback: { status: 'scheduled' },
      booking: { status: 'unavailable' },
    });
    await Promise.all([first, second]);
    expect(requests).toBe(1);
  });

  it('reuses the same idempotency key when an uncertain callback request is retried', async () => {
    const keys: string[] = [];
    let generated = 0;
    let attempts = 0;
    const controller = createCustomerEntryController({
      publicId: 'sales',
      createIdempotencyKey: () => `request-${++generated}-12345678`,
      api: {
        load: async () => snapshot,
        requestCallback: async (_publicId, input) => {
          keys.push(input.idempotencyKey);
          attempts++;
          if (attempts === 1) throw new Error('response lost after commit');
          return {
            managementToken: 'opaque-token',
            callback: { status: 'scheduled' },
            booking: { status: 'unavailable' as const },
          };
        },
        readCallback: async () => { throw new Error('not used'); },
        rescheduleCallback: async () => { throw new Error('not used'); },
        cancelCallback: async () => { throw new Error('not used'); },
      },
    });
    await controller.load();
    const input = {
      phoneNumber: '+15550100999',
      permissionAccepted: true as const,
      mode: 'immediate' as const,
    };
    await expect(controller.requestCallback(input)).rejects.toThrow('response lost');
    await controller.requestCallback(input);
    expect(keys).toEqual(['request-1-12345678', 'request-1-12345678']);
  });

  it('projects callback-management failures into customer state', async () => {
    const controller = createCustomerEntryController({
      publicId: 'sales',
      createIdempotencyKey: () => 'request-12345678',
      api: {
        load: async () => snapshot,
        requestCallback: async () => ({
          managementToken: 'opaque-token',
          callback: { status: 'scheduled' },
          booking: { status: 'unavailable' as const },
        }),
        readCallback: async () => { throw new Error('status temporarily unavailable'); },
        rescheduleCallback: async () => { throw new Error('not used'); },
        cancelCallback: async () => { throw new Error('not used'); },
      },
    });
    await controller.load();
    await controller.requestCallback({
      phoneNumber: '+15550100999',
      permissionAccepted: true,
      mode: 'immediate',
    });
    await expect(controller.readCallback()).rejects.toThrow('status temporarily unavailable');
    expect(controller.getState().error).toBe('status temporarily unavailable');
  });
});
