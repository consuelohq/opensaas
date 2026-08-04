import { describe, expect, it } from 'bun:test';

import {
  TWILIO_TEST_FROM_NUMBER,
  buildProviderGroupOptions,
  describeProviderModeEvidence,
  resolveProviderCallerId,
  resolveTwilioProviderCredentials,
} from './twilio-provider-mode';

const environment = {
  TWILIO_ACCOUNT_SID: 'AC_live_fixture',
  TWILIO_AUTH_TOKEN: 'live-token',
  TWILIO_TEST_ACCOUNT_SID: 'AC_test_fixture',
  TWILIO_TEST_AUTH_TOKEN: 'test-token',
};

describe('Twilio provider test mode', () => {
  it('selects test credentials without exposing the live credential pair', () => {
    expect(
      resolveTwilioProviderCredentials(environment, 'twilio-test'),
    ).toEqual({
      accountSid: 'AC_test_fixture',
      authToken: 'test-token',
    });
    expect(resolveTwilioProviderCredentials(environment, 'live')).toEqual({
      accountSid: 'AC_live_fixture',
      authToken: 'live-token',
    });
  });

  it('requires and preserves the exact no-carrier Twilio test From number', () => {
    expect(() => resolveProviderCallerId('twilio-test', undefined)).toThrow(
      'Provider test mode requires an explicit caller ID',
    );
    expect(() =>
      resolveProviderCallerId('twilio-test', '+15005550007'),
    ).toThrow('Provider test mode requires the Twilio test caller ID');
    expect(
      resolveProviderCallerId('twilio-test', TWILIO_TEST_FROM_NUMBER),
    ).toBe(TWILIO_TEST_FROM_NUMBER);
  });

  it('passes the magic From number unchanged into the provider group request', () => {
    const request = buildProviderGroupOptions(
      {
        sessionId: 'session-test',
        workspaceId: 'workspace-test',
        queueId: 'queue-test',
        userId: 'user-test',
        targets: [{ contactId: 'contact-test', phone: '+15550100000' }],
        callerIds: [TWILIO_TEST_FROM_NUMBER],
      },
      'https://dialer.example.test',
    );

    expect(request.fromNumbers).toEqual([TWILIO_TEST_FROM_NUMBER]);
    expect(request.dialerSessionId).toBe('session-test');
    expect(request.statusCallbackUrl).toBe(
      'https://dialer.example.test/webhooks/twilio/status',
    );
    expect(request.customerTwimlUrl).toBe(
      'https://dialer.example.test/webhooks/twilio/customer-twiml',
    );
  });

  it('does not claim carrier delivery or callbacks for test credentials', () => {
    expect(describeProviderModeEvidence('twilio-test')).toEqual({
      carrierCallExpected: false,
      callbacksExpected: false,
    });
  });
});
