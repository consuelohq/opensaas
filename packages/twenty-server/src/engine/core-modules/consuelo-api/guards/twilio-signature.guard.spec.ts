import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { TwilioSignatureGuard } from 'src/engine/core-modules/consuelo-api/guards/twilio-signature.guard';

jest.mock('twilio', () => ({
  validateRequest: jest.fn(),
  validateRequestWithBody: jest.fn(),
}));

type MockRequest = {
  headers: Record<string, string>;
  originalUrl: string;
  path: string;
  body: Record<string, string>;
  rawBody?: Buffer;
};

const twilio = jest.requireMock('twilio') as {
  validateRequest: jest.Mock;
  validateRequestWithBody: jest.Mock;
};

const createContext = (request: MockRequest): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  }) as unknown as ExecutionContext;

describe('TwilioSignatureGuard', () => {
  const originalTwilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
  });

  afterAll(() => {
    process.env.TWILIO_AUTH_TOKEN = originalTwilioAuthToken;
  });

  it('should validate form callbacks with parsed params when raw body exists', async () => {
    twilio.validateRequest.mockReturnValue(true);

    const request = {
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-forwarded-host': 'example.test',
        'x-forwarded-proto': 'https',
        'x-twilio-signature': 'signature',
      },
      originalUrl: '/api/v1/calls/parallel/status-callback',
      path: '/api/v1/calls/parallel/status-callback',
      body: {
        CallSid: 'CA_TEST',
        CallStatus: 'completed',
      },
      rawBody: Buffer.from('CallSid=CA_TEST&CallStatus=completed'),
    };

    await expect(
      new TwilioSignatureGuard().canActivate(createContext(request)),
    ).resolves.toBe(true);

    expect(twilio.validateRequest).toHaveBeenCalledWith(
      'test-auth-token',
      'signature',
      'https://example.test/api/v1/calls/parallel/status-callback',
      request.body,
    );
    expect(twilio.validateRequestWithBody).not.toHaveBeenCalled();
  });

  it('should validate json callbacks with raw body', async () => {
    twilio.validateRequestWithBody.mockReturnValue(true);

    const request = {
      headers: {
        'content-type': 'application/json',
        host: 'example.test',
        'x-twilio-signature': 'signature',
      },
      originalUrl: '/v1/webhooks/status',
      path: '/v1/webhooks/status',
      body: {
        CallSid: 'CA_TEST',
      },
      rawBody: Buffer.from('{"CallSid":"CA_TEST"}'),
    };

    await expect(
      new TwilioSignatureGuard().canActivate(createContext(request)),
    ).resolves.toBe(true);

    expect(twilio.validateRequestWithBody).toHaveBeenCalledWith(
      'test-auth-token',
      'signature',
      'https://example.test/v1/webhooks/status',
      '{"CallSid":"CA_TEST"}',
    );
    expect(twilio.validateRequest).not.toHaveBeenCalled();
  });

  it('should reject invalid Twilio signatures', async () => {
    twilio.validateRequest.mockReturnValue(false);

    const request = {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        host: 'example.test',
        'x-twilio-signature': 'signature',
      },
      originalUrl: '/api/v1/calls/parallel/status-callback',
      path: '/api/v1/calls/parallel/status-callback',
      body: {
        CallSid: 'CA_TEST',
      },
    };

    await expect(
      new TwilioSignatureGuard().canActivate(createContext(request)),
    ).rejects.toThrow(UnauthorizedException);
  });
});
