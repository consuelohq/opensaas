import { describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import twilio from 'twilio';

import { createTwilioSignatureVerifier } from './twilio-signature';

const token = 'test-auth-token';
const publicOrigin = 'https://calls.example.test';
const path = '/webhooks/twilio/status?group=call%2Fone&value=a%20b';
const params = { CallSid: 'CA_TEST', CallStatus: 'completed' };
const formInput = (signedOrigin: string) => ({
  url: 'https://railway.internal.test' + path,
  signature: twilio.getExpectedTwilioSignature(
    token,
    signedOrigin + path,
    params,
  ),
  contentType: 'application/x-www-form-urlencoded',
  rawBody: new URLSearchParams(params).toString(),
  params,
});

describe('Twilio runtime signature authority', () => {
  it('uses the configured public origin and preserves encoded path/query through another proxy', async () => {
    expect(
      await createTwilioSignatureVerifier(
        token,
        publicOrigin,
      )(formInput(publicOrigin)),
    ).toBe(true);
  });

  it('rejects signatures for an upstream or spoofed authority when configured', async () => {
    const verify = createTwilioSignatureVerifier(token, publicOrigin);
    expect(await verify(formInput('https://railway.internal.test'))).toBe(
      false,
    );
    expect(await verify(formInput('https://attacker.example.test'))).toBe(
      false,
    );
    expect(
      await verify({
        ...formInput(publicOrigin),
        url: 'https://railway.internal.test/other?group=call%2Fone&value=a%20b',
      }),
    ).toBe(false);
  });

  it('retains JSON raw-body validation at the public authority', async () => {
    const rawBody = JSON.stringify(params);
    const query =
      '?bodySHA256=' + createHash('sha256').update(rawBody).digest('hex');
    const pathname = '/webhooks/twilio/status' + query;
    const input = {
      url: 'https://railway.internal.test' + pathname,
      signature: twilio.getExpectedTwilioSignature(
        token,
        publicOrigin + pathname,
        {},
      ),
      contentType: 'application/json',
      rawBody,
      params,
    };
    const verify = createTwilioSignatureVerifier(token, publicOrigin);
    expect(await verify(input)).toBe(true);
    expect(await verify({ ...input, rawBody: rawBody + ' ' })).toBe(false);
  });

  it('keeps request-derived authority for embedders without a configured public URL', async () => {
    expect(
      await createTwilioSignatureVerifier(token)(
        formInput('https://railway.internal.test'),
      ),
    ).toBe(true);
  });

  it('rejects a non-origin, credential-bearing or non-HTTPS public URL at configuration time', () => {
    for (const url of [
      'http://calls.example.test',
      'https://calls.example.test/path',
      'https://user:pass@calls.example.test',
      'https://calls.example.test?x=1',
      'invalid',
    ]) {
      expect(() => createTwilioSignatureVerifier(token, url)).toThrow();
    }
  });
});
