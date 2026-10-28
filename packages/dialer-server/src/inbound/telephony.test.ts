import { describe, expect, it } from 'bun:test';
import { createHmac } from 'node:crypto';
import { createInboundRoutes } from '../routes/inbound';
import {
  waitingTwiml,
  screeningTwiml,
  conferenceTwiml,
} from './telephony-twiml';

describe('inbound transport boundaries', () => {
  it('keeps callback language hidden unless the number has an active policy', () => {
    const disabled = waitingTwiml('https://voice.example/wait', true);
    expect(disabled).toContain('<Gather');
    expect(disabled).toContain('<Redirect');
    expect(disabled).not.toContain('request a callback');
    const enabled = waitingTwiml(
      'https://voice.example/wait',
      true,
      false,
      'We can call you back & keep your place.',
    );
    expect(enabled).toContain('We can call you back &amp; keep your place.');
    expect(enabled).toContain('Press 1 to request a callback.');
    expect(enabled).not.toContain('<Number');
    expect(enabled).not.toContain('<Record');
  });
  it('requires explicit phone acceptance before joining media', () => {
    const xml = screeningTwiml('https://voice.example/accept?a=1&b=2', 'phone');
    expect(xml).toContain('Press 1');
    expect(xml).toContain('a=1&amp;b=2');
    expect(xml).not.toContain('<Conference');
  });
  it('does not label conference membership as audio proof', () => {
    const xml = conferenceTwiml(
      'request-one',
      'https://voice.example/events',
      'rep',
    );
    expect(xml).toContain('endConferenceOnExit="true"');
    expect(xml).not.toContain('record=');
  });
  it('rejects unsigned requests before application admission', async () => {
    let called = false;
    const routes = createInboundRoutes({
      publicUrl: 'https://voice.example',
      authToken: 'test-secret',
      handle: async () => {
        called = true;
        return '<Response/>';
      },
    });
    const response = await routes.request(
      '/webhooks/twilio/inbound/number-one',
      { method: 'POST', body: 'CallSid=caller' },
    );
    expect(response.status).toBe(401);
    expect(called).toBe(false);
  });
  it('verifies the configured public URL, ignoring forged forwarding headers', async () => {
    const path = '/webhooks/twilio/inbound/number-one';
    const params = { AccountSid: 'account', CallSid: 'caller' };
    const signature = createHmac('sha1', 'test-secret')
      .update('https://voice.example' + path + 'AccountSidaccountCallSidcaller')
      .digest('base64');
    const routes = createInboundRoutes({
      publicUrl: 'https://voice.example',
      authToken: 'test-secret',
      handle: async (_id, _action, facts) => {
        expect(facts).toEqual(params);
        return '<Response/>';
      },
    });
    const response = await routes.request(path, {
      method: 'POST',
      body: new URLSearchParams(params),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-twilio-signature': signature,
        'x-forwarded-host': 'attacker.example',
      },
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('<Response/>');
  });
});
