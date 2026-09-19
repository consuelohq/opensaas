import { describe, expect, it } from 'bun:test';

import { cancelConfirmedCallbackBooking } from './callbacks';

const request = {
  workspaceId: 'workspace',
  callbackId: 'callback',
  revision: 2,
  timezone: 'UTC',
  windowStart: '2026-09-19T14:00:00.000Z',
  windowEnd: '2026-09-19T15:00:00.000Z',
};

describe('callback calendar cancellation', () => {
  it('cancels a confirmed provider booking and requires cancelled evidence', async () => {
    const calls: unknown[] = [];
    const result = await cancelConfirmedCallbackBooking({
      booking: {
        status: 'confirmed',
        providerReference: 'provider-booking',
        evidenceReference: 'confirmed-evidence',
      },
      request,
      calendar: {
        book: async () => ({
          status: 'unavailable',
          providerReference: null,
          evidenceReference: null,
        }),
        cancel: async (input) => {
          calls.push(input);
          return {
            status: 'cancelled',
            providerReference: 'provider-booking',
            evidenceReference: 'cancel-evidence',
          };
        },
      },
    });

    expect(calls).toEqual([
      { ...request, providerReference: 'provider-booking' },
    ]);
    expect(result).toEqual({
      status: 'cancelled',
      providerReference: 'provider-booking',
      evidenceReference: 'cancel-evidence',
    });
  });

  it('fails closed when confirmed provider cancellation cannot be proven', async () => {
    const booking = {
      status: 'confirmed' as const,
      providerReference: 'provider-booking',
      evidenceReference: 'confirmed-evidence',
    };

    await expect(
      cancelConfirmedCallbackBooking({ booking, request }),
    ).rejects.toThrow('calendar adapter');

    await expect(
      cancelConfirmedCallbackBooking({
        booking,
        request,
        calendar: {
          book: async () => booking,
          cancel: async () => booking,
        },
      }),
    ).rejects.toThrow('cancelled');
  });

  it('does not call the provider for a non-confirmed booking', async () => {
    let cancelled = false;
    const booking = {
      status: 'unavailable' as const,
      providerReference: null,
      evidenceReference: null,
    };
    expect(
      await cancelConfirmedCallbackBooking({
        booking,
        request,
        calendar: {
          book: async () => booking,
          cancel: async () => {
            cancelled = true;
            return booking;
          },
        },
      }),
    ).toEqual(booking);
    expect(cancelled).toBe(false);
  });
});
