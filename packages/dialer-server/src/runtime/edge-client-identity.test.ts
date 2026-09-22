import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'bun:test';

import { resolveTrustedClientAddress } from './edge-client-identity';

const secret = 'edge-proxy-secret-for-tests-0001';
const now = 1_789_742_400_000;
const signedRequest = (input: {
  clientAddress: string;
  timestamp?: number;
  signature?: string;
}) => {
  const timestamp = input.timestamp ?? now;
  const url = new URL(
    'https://dialer-origin.example.test/v1/inbound/customer/sales/callbacks?source=public',
  );
  const canonical = [
    'v1',
    String(timestamp),
    'POST',
    url.pathname + url.search,
    input.clientAddress,
  ].join('\n');
  const signature =
    input.signature ??
    createHmac('sha256', secret).update(canonical).digest('base64url');
  return new Request(url, {
    method: 'POST',
    headers: {
      'cf-connecting-ip': '192.0.2.9',
      'x-forwarded-for': '192.0.2.10',
      'x-real-ip': '192.0.2.11',
      'x-consuelo-edge-client-address': input.clientAddress,
      'x-consuelo-edge-client-timestamp': String(timestamp),
      'x-consuelo-edge-client-signature': signature,
    },
  });
};

describe('trusted edge client identity', () => {
  it('accepts a fresh HMAC-bound client identity from the edge', () => {
    expect(
      resolveTrustedClientAddress(
        signedRequest({ clientAddress: '203.0.113.44' }),
        '10.0.0.8',
        secret,
        () => now,
      ),
    ).toBe('203.0.113.44');
  });

  it('fails closed for unsigned or forged forwarding identity once edge trust is configured', () => {
    const request = new Request(
      'https://dialer-origin.example.test/v1/inbound/customer/sales/callbacks',
      {
        method: 'POST',
        headers: {
          'cf-connecting-ip': '203.0.113.44',
          'x-forwarded-for': '203.0.113.45',
          'x-real-ip': '203.0.113.46',
        },
      },
    );
    expect(resolveTrustedClientAddress(request, '10.0.0.8', secret, () => now)).toBeNull();
    expect(
      resolveTrustedClientAddress(
        signedRequest({ clientAddress: '203.0.113.44', signature: 'forged' }),
        '10.0.0.8',
        secret,
        () => now,
      ),
    ).toBeNull();
  });

  it('rejects stale signed identity instead of trusting replayed attribution', () => {
    expect(
      resolveTrustedClientAddress(
        signedRequest({ clientAddress: '203.0.113.44', timestamp: now - 120_000 }),
        '10.0.0.8',
        secret,
        () => now,
      ),
    ).toBeNull();
  });

  it('uses the observed socket peer only when edge trust is intentionally not configured', () => {
    expect(
      resolveTrustedClientAddress(
        new Request('https://dialer-origin.example.test/health'),
        '10.0.0.8',
        undefined,
        () => now,
      ),
    ).toBe('10.0.0.8');
  });
});
