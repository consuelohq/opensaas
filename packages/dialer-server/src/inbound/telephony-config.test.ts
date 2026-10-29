import { describe, expect, it } from 'bun:test';

import { parseTelephonyConfig } from './telephony-config';

const config = (numbers: unknown[]) =>
  JSON.stringify({ schemaVersion: 1, numbers, endpoints: [] });

const number = (overrides: Record<string, unknown> = {}) => ({
  numberId: 'number-one',
  workspaceId: 'workspace-one',
  queueId: 'queue-one',
  did: '+15550100123',
  enabled: true,
  maxActiveRequests: 10,
  callback: null,
  voicemail: null,
  customerEntry: {
    publicId: 'sales',
    rateWindowMilliseconds: 60_000,
    maxRequestsPerClient: 3,
    maxRequestsPerNumber: 30,
  },
  ...overrides,
});

describe('inbound telephony customer-entry configuration', () => {
  it('defaults and bounds the phone offer budget independently of browser capacity policy', () => {
    const base = JSON.parse(config([number()]));
    expect(parseTelephonyConfig(JSON.stringify(base), 'AC-account').phoneOfferMilliseconds).toBe(40_000);
    for (const phoneOfferMilliseconds of [25_000, 80_000]) {
      expect(parseTelephonyConfig(JSON.stringify({ ...base, phoneOfferMilliseconds }), 'AC-account').phoneOfferMilliseconds).toBe(phoneOfferMilliseconds);
    }
    for (const phoneOfferMilliseconds of [0, 12_000, 24_999, 80_001, 30_000.5, '40000', null]) {
      expect(() => parseTelephonyConfig(JSON.stringify({ ...base, phoneOfferMilliseconds }), 'AC-account')).toThrow();
    }
  });

  it('requires explicit public identity and abuse bounds', () => {
    const parsed = parseTelephonyConfig(config([number()]), 'AC-account');
    expect(parsed.numbers[0]?.customerEntry).toEqual({
      publicId: 'sales',
      rateWindowMilliseconds: 60_000,
      maxRequestsPerClient: 3,
      maxRequestsPerNumber: 30,
    });

    expect(() =>
      parseTelephonyConfig(
        config([
          number({
            customerEntry: { publicId: 'sales' },
          }),
        ]),
        'AC-account',
      ),
    ).toThrow();
  });

  it('rejects ambiguous public ids across inbound numbers', () => {
    expect(() =>
      parseTelephonyConfig(
        config([
          number(),
          number({
            numberId: 'number-two',
            workspaceId: 'workspace-two',
            queueId: 'queue-two',
            did: '+15550100124',
          }),
        ]),
        'AC-account',
      ),
    ).toThrow('Ambiguous telephony configuration');
  });

  it('keeps customer entry opt-in and fail-closed by default', () => {
    const parsed = parseTelephonyConfig(
      config([number({ customerEntry: null })]),
      'AC-account',
    );
    expect(parsed.numbers[0]?.customerEntry).toBeNull();
  });
});
