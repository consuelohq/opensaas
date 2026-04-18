// Voice route tests — DEV-1200
// Tests all 19 routes in voice.ts with 3+ cases each

import type { RouteDefinition } from '../index';
import type { ApiRequest, ApiResponse } from '../../types';
import {
  createMockRequest,
  createAuthenticatedRequest,
  createMockResponse,
  executeHandler,
} from '../../testing/routeTestHelper';
import { fixtures } from '../../testing/fixtures';

// ---- module mocks (hoisted by jest) ----

jest.mock('../../services/redis', () => ({
  redisService: {
    getConferenceName: jest.fn(),
    setConferenceName: jest.fn(),
    deleteConferenceName: jest.fn(),
    getCustomerConferenceName: jest.fn(),
    setCustomerConferenceName: jest.fn(),
    getCallStatus: jest.fn(),
    setCallStatus: jest.fn(),
    getTransfer: jest.fn(),
    setTransfer: jest.fn(),
    getPrimaryNumber: jest.fn(),
    setPrimaryNumber: jest.fn(),
    deletePrimaryNumber: jest.fn(),
    getPhoneNumbersCache: jest.fn(),
    setPhoneNumbersCache: jest.fn(),
    getVoiceStatusCache: jest.fn(),
    setVoiceStatusCache: jest.fn(),
  },
}));

const mockDialerInstance = {
  getToken: jest.fn(),
  generateConferenceTwiml: jest.fn().mockReturnValue('<Response><Conference>conf</Conference></Response>'),
  addCustomerToConference: jest.fn().mockResolvedValue({ callSid: 'CA-cust-001' }),
  listNumbers: jest.fn().mockResolvedValue([]),
  searchAvailableNumbers: jest.fn().mockResolvedValue([]),
  provisionNumber: jest.fn(),
  releaseNumber: jest.fn(),
  initiateTransfer: jest.fn(),
  completeTransfer: jest.fn(),
  cancelTransfer: jest.fn(),
  holdParticipant: jest.fn(),
  muteParticipant: jest.fn(),
  listParticipants: jest.fn(),
  conference: { findConferenceSid: jest.fn() },
};

const mockLockServiceInstance = {
  acquireLock: jest.fn(),
  releaseLockByNumber: jest.fn(),
};

jest.mock('../../shared/dialer', () => ({
  getDialerForWorkspace: jest.fn(),
  sharedDialer: jest.fn(),
  sharedCallerIdLockService: jest.fn(),
}));

jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

jest.mock('@consuelo/logger', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('../../services/twilio-config', () => ({
  getWorkspaceTwilioConfig: jest.fn(),
  getDecryptedCredentials: jest.fn(),
  isHostedInstance: jest.fn().mockReturnValue(false),
}));

jest.mock('../../services/workspace-phone-numbers', () => ({
  findWorkspacePhoneNumberBySid: jest.fn(),
  getPhoneNumberEntitlement: jest.fn(),
  listWorkspacePhoneNumbers: jest.fn(),
  recordProvisionedPhoneNumber: jest.fn(),
  releaseWorkspacePhoneNumber: jest.fn(),
}));

jest.mock('../../services/phone-number-addons', () => ({
  createPhoneNumberAddonCheckout: jest.fn(),
}));

jest.mock('../../services/phone-number-recommendations', () => ({
  recommendPhoneNumbers: jest.fn(),
}));

jest.mock('twilio', () => ({
  validateRequest: jest.fn().mockReturnValue(true),
}));

jest.mock('node:crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('test-uuid-001'),
}));

// ---- import after mocks ----

import { voiceRoutes } from '../voice';
import { redisService } from '../../services/redis';
import { getDialerForWorkspace, sharedDialer, sharedCallerIdLockService } from '../../shared/dialer';
import { getWorkspaceTwilioConfig, getDecryptedCredentials, isHostedInstance } from '../../services/twilio-config';
import {
  findWorkspacePhoneNumberBySid,
  getPhoneNumberEntitlement,
  listWorkspacePhoneNumbers,
  recordProvisionedPhoneNumber,
  releaseWorkspacePhoneNumber,
} from '../../services/workspace-phone-numbers';
import { createPhoneNumberAddonCheckout } from '../../services/phone-number-addons';
import { recommendPhoneNumbers } from '../../services/phone-number-recommendations';

// typed references to mocked modules
const mockRedis = redisService as unknown as Record<string, jest.Mock>;
const mockDialer = mockDialerInstance;
const mockLockService = mockLockServiceInstance;
const mockTwilioConfig = {
  getWorkspaceTwilioConfig: getWorkspaceTwilioConfig as jest.Mock,
  getDecryptedCredentials: getDecryptedCredentials as jest.Mock,
  isHostedInstance: isHostedInstance as unknown as jest.Mock,
};
const mockWorkspacePhoneNumbers = {
  findWorkspacePhoneNumberBySid: findWorkspacePhoneNumberBySid as jest.Mock,
  getPhoneNumberEntitlement: getPhoneNumberEntitlement as jest.Mock,
  listWorkspacePhoneNumbers: listWorkspacePhoneNumbers as jest.Mock,
  recordProvisionedPhoneNumber: recordProvisionedPhoneNumber as jest.Mock,
  releaseWorkspacePhoneNumber: releaseWorkspacePhoneNumber as jest.Mock,
};
const mockPhoneNumberAddons = {
  createPhoneNumberAddonCheckout: createPhoneNumberAddonCheckout as jest.Mock,
};
const mockPhoneNumberRecommendations = {
  recommendPhoneNumbers: recommendPhoneNumbers as jest.Mock,
};

// wire up the dialer mocks
(getDialerForWorkspace as jest.Mock).mockResolvedValue(mockDialer);
(sharedDialer as unknown as jest.Mock).mockReturnValue(mockDialer);
(sharedCallerIdLockService as unknown as jest.Mock).mockReturnValue(mockLockService);

// ---- helpers ----

type Route = RouteDefinition;
let routes: Route[];

const findRoute = (method: string, path: string): Route => {
  const r = routes.find((rt) => rt.method === method && rt.path === path);
  if (!r) throw new Error(`Route not found: ${method} ${path}`);
  return r;
};

const exec = (route: Route, req?: Partial<ApiRequest>) =>
  executeHandler(route.handler, req);

const authReq = (overrides?: Partial<ApiRequest>) =>
  ({ ...createAuthenticatedRequest(overrides) });

const noAuthReq = (overrides?: Partial<ApiRequest>) =>
  ({ auth: undefined, ...overrides } as Partial<ApiRequest> & { auth: undefined });

// ---- setup ----

beforeAll(() => {
  process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
  routes = voiceRoutes();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRedis.getConferenceName.mockResolvedValue(null);
  mockRedis.setConferenceName.mockResolvedValue(undefined);
  mockRedis.deleteConferenceName.mockResolvedValue(undefined);
  mockRedis.getCustomerConferenceName.mockResolvedValue(null);
  mockRedis.setCustomerConferenceName.mockResolvedValue(undefined);
  mockRedis.getCallStatus.mockResolvedValue(null);
  mockRedis.setCallStatus.mockResolvedValue(undefined);
  mockRedis.getTransfer.mockResolvedValue(null);
  mockRedis.setTransfer.mockResolvedValue(undefined);
  mockRedis.getPrimaryNumber.mockResolvedValue(null);
  mockRedis.setPrimaryNumber.mockResolvedValue(undefined);
  mockRedis.deletePrimaryNumber.mockResolvedValue(undefined);
  mockRedis.getPhoneNumbersCache.mockResolvedValue(null);
  mockRedis.setPhoneNumbersCache.mockResolvedValue(undefined);
  mockRedis.getVoiceStatusCache.mockResolvedValue(null);
  mockRedis.setVoiceStatusCache.mockResolvedValue(undefined);
  mockWorkspacePhoneNumbers.getPhoneNumberEntitlement.mockResolvedValue({
    canProvision: true,
    includedSlots: 3,
    numberPackSlots: 0,
    remainingSlots: 3,
    singleNumberAddOnSlots: 0,
    totalSlots: 3,
    usedSlots: 0,
  });
  mockWorkspacePhoneNumbers.listWorkspacePhoneNumbers.mockResolvedValue([]);
  mockWorkspacePhoneNumbers.findWorkspacePhoneNumberBySid.mockResolvedValue({
    workspace_id: 'ws-test-001',
    phone_number: '+15551234567',
    friendly_name: 'Main',
    area_code: '555',
    twilio_sid: 'PN-001',
    ownership_type: 'included',
    status: 'active',
  });
  mockWorkspacePhoneNumbers.recordProvisionedPhoneNumber.mockResolvedValue(undefined);
  mockWorkspacePhoneNumbers.releaseWorkspacePhoneNumber.mockResolvedValue(undefined);
  mockPhoneNumberAddons.createPhoneNumberAddonCheckout.mockResolvedValue({
    url: 'https://checkout.stripe.test/session',
  });
  mockPhoneNumberRecommendations.recommendPhoneNumbers.mockResolvedValue([]);
});

// ============================================================
// GET /v1/phone-numbers
// ============================================================

describe('GET /v1/phone-numbers', () => {
  const route = () => findRoute('GET', '/v1/phone-numbers');

  it('returns phone numbers for authenticated user', async () => {
    mockDialer.listNumbers.mockResolvedValueOnce([
      { phoneNumber: '+15551234567', friendlyName: 'Main', twilioSid: 'PN-001' },
    ]);
    mockWorkspacePhoneNumbers.listWorkspacePhoneNumbers.mockResolvedValueOnce([
      {
        phoneNumber: '+15551234567',
        friendlyName: 'Main',
        areaCode: '555',
        isPrimary: false,
        ownershipType: 'included',
        twilioSid: 'PN-001',
        workspaceId: 'ws-test-001',
      },
    ]);
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      phoneNumbers: [
        expect.objectContaining({
          phoneNumber: '+15551234567',
          friendlyName: 'Main',
          ownershipType: 'included',
        }),
      ],
    });
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq());
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Auth required' } });
  });

  it('returns 500 on dialer error', async () => {
    mockDialer.listNumbers.mockRejectedValueOnce(new Error('twilio down'));
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(500);
    expect((res.body as { error: { code: string } }).error.code).toBe('PHONE_NUMBERS_ERROR');
  });
});

// ============================================================
// GET /v1/phone-numbers/available
// ============================================================

describe('GET /v1/phone-numbers/available', () => {
  const route = () => findRoute('GET', '/v1/phone-numbers/available');

  it('returns available numbers for valid area code', async () => {
    mockDialer.searchAvailableNumbers.mockResolvedValueOnce([{ phoneNumber: '+15551110000' }]);
    const res = await exec(route(), authReq({ query: { areaCode: '555' } }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ available: [{ phoneNumber: '+15551110000' }] });
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq({ query: { areaCode: '555' } }));
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for invalid area code', async () => {
    const res = await exec(route(), authReq({ query: { areaCode: 'abc' } }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_REQUEST');
  });

  it('returns 400 for missing area code', async () => {
    const res = await exec(route(), authReq({ query: {} }));
    expect(res.statusCode).toBe(400);
  });
});


// ============================================================
// POST /v1/phone-numbers/recommendations
// ============================================================

describe('POST /v1/phone-numbers/recommendations', () => {
  const route = () => findRoute('POST', '/v1/phone-numbers/recommendations');

  it('returns ranked recommendations', async () => {
    mockPhoneNumberRecommendations.recommendPhoneNumbers.mockResolvedValueOnce([
      { phoneNumber: '+14155550123', areaCode: '415', friendlyName: 'SF', reason: 'matched san francisco', score: 97 },
    ]);
    const res = await exec(route(), authReq({ body: { query: 'san francisco sales line' } }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      available: [expect.objectContaining({ phoneNumber: '+14155550123', score: 97 })],
    });
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq({ body: { query: 'miami' } }));
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for short query', async () => {
    const res = await exec(route(), authReq({ body: { query: 'a' } }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_REQUEST');
  });
});

// ============================================================
// POST /v1/phone-numbers/checkout
// ============================================================

describe('POST /v1/phone-numbers/checkout', () => {
  const route = () => findRoute('POST', '/v1/phone-numbers/checkout');

  it('creates checkout for extra phone number slot', async () => {
    const res = await exec(route(), authReq({ body: { quantity: 1 } }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ url: 'https://checkout.stripe.test/session' });
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq({ body: { quantity: 1 } }));
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for invalid quantity', async () => {
    const res = await exec(route(), authReq({ body: { quantity: 0 } }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_REQUEST');
  });
});

// ============================================================
// POST /v1/phone-numbers/provision
// ============================================================

describe('POST /v1/phone-numbers/provision', () => {
  const route = () => findRoute('POST', '/v1/phone-numbers/provision');

  it('provisions a number successfully', async () => {
    mockDialer.provisionNumber.mockResolvedValueOnce({ success: true, sid: 'PN-new', phoneNumber: '+15559990000', areaCode: '555' });
    mockDialer.listNumbers.mockResolvedValueOnce([{ twilioSid: 'PN-new' }]);
    const res = await exec(route(), authReq({ body: { areaCode: '555' } }));
    expect(res.statusCode).toBe(200);
    expect((res.body as { success: boolean }).success).toBe(true);
    expect(mockWorkspacePhoneNumbers.recordProvisionedPhoneNumber).toHaveBeenCalled();
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq({ body: { areaCode: '555' } }));
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when no areaCode or phoneNumber', async () => {
    const res = await exec(route(), authReq({ body: {} }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_REQUEST');
  });

  it('returns 400 when provision fails', async () => {
    mockDialer.provisionNumber.mockResolvedValueOnce({ success: false, error: 'No numbers available' });
    const res = await exec(route(), authReq({ body: { areaCode: '555' } }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('PROVISION_FAILED');
  });

  it('returns 400 when no phone number slots remain', async () => {
    mockWorkspacePhoneNumbers.getPhoneNumberEntitlement.mockResolvedValueOnce({
      canProvision: false,
      includedSlots: 3,
      numberPackSlots: 0,
      remainingSlots: 0,
      singleNumberAddOnSlots: 0,
      totalSlots: 3,
      usedSlots: 3,
    });
    const res = await exec(route(), authReq({ body: { areaCode: '555' } }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('PHONE_NUMBER_SLOT_REQUIRED');
  });

  it('releases the purchased number when db persistence fails', async () => {
    mockDialer.provisionNumber.mockResolvedValueOnce({
      success: true,
      sid: 'PN-new',
      phoneNumber: '+15559990000',
      areaCode: '555',
    });
    mockWorkspacePhoneNumbers.recordProvisionedPhoneNumber.mockRejectedValueOnce(
      new Error('db write failed'),
    );
    mockDialer.releaseNumber.mockResolvedValueOnce({ success: true });

    const res = await exec(route(), authReq({ body: { areaCode: '555' } }));

    expect(res.statusCode).toBe(500);
    expect((res.body as { error: { code: string } }).error.code).toBe(
      'PROVISION_ERROR',
    );
    expect(mockDialer.releaseNumber).toHaveBeenCalledWith('PN-new');
  });
});

// ============================================================
// PUT /v1/phone-numbers/:sid/primary
// ============================================================

describe('PUT /v1/phone-numbers/:sid/primary', () => {
  const route = () => findRoute('PUT', '/v1/phone-numbers/:sid/primary');

  it('sets primary number', async () => {
    const res = await exec(route(), authReq({ params: { sid: 'PN-001' } }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, primarySid: 'PN-001' });
    expect(mockRedis.setPrimaryNumber).toHaveBeenCalledWith('ws-test-001', 'PN-001');
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq({ params: { sid: 'PN-001' } }));
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for missing sid', async () => {
    const res = await exec(route(), authReq({ params: {} }));
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when number is not owned by workspace', async () => {
    mockWorkspacePhoneNumbers.findWorkspacePhoneNumberBySid.mockResolvedValueOnce(null);
    const res = await exec(route(), authReq({ params: { sid: 'PN-001' } }));
    expect(res.statusCode).toBe(404);
    expect((res.body as { error: { code: string } }).error.code).toBe('NUMBER_NOT_FOUND');
  });
});

// ============================================================
// DELETE /v1/phone-numbers/:sid
// ============================================================

describe('DELETE /v1/phone-numbers/:sid', () => {
  const route = () => findRoute('DELETE', '/v1/phone-numbers/:sid');

  it('releases a number', async () => {
    mockDialer.releaseNumber.mockResolvedValueOnce({ success: true });
    const res = await exec(route(), authReq({ params: { sid: 'PN-001' } }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq({ params: { sid: 'PN-001' } }));
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when release fails', async () => {
    mockDialer.releaseNumber.mockResolvedValueOnce({ success: false, error: 'Not found' });
    const res = await exec(route(), authReq({ params: { sid: 'PN-001' } }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('RELEASE_FAILED');
  });

  it('returns 404 when number is not owned by workspace', async () => {
    mockWorkspacePhoneNumbers.findWorkspacePhoneNumberBySid.mockResolvedValueOnce(null);
    const res = await exec(route(), authReq({ params: { sid: 'PN-001' } }));
    expect(res.statusCode).toBe(404);
    expect((res.body as { error: { code: string } }).error.code).toBe('NUMBER_NOT_FOUND');
  });

  it('clears primary if released number was primary', async () => {
    mockDialer.releaseNumber.mockResolvedValueOnce({ success: true });
    mockRedis.getPrimaryNumber.mockResolvedValueOnce('PN-001');
    const res = await exec(route(), authReq({ params: { sid: 'PN-001' } }));
    expect(res.statusCode).toBe(200);
    expect(mockRedis.deletePrimaryNumber).toHaveBeenCalledWith('ws-test-001');
  });
});

// ============================================================
// GET /v1/voice/token
// ============================================================

describe('GET /v1/voice/token', () => {
  const route = () => findRoute('GET', '/v1/voice/token');

  it('returns token for authenticated user', async () => {
    mockDialer.getToken.mockResolvedValueOnce({ token: 'jwt-token', identity: 'user-test-001' });
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ token: 'jwt-token', identity: 'user-test-001' });
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq());
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Auth required' } });
  });

  it('returns 500 on dialer error', async () => {
    mockDialer.getToken.mockRejectedValueOnce(new Error('token gen failed'));
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(500);
    expect((res.body as { error: { code: string } }).error.code).toBe('TOKEN_ERROR');
  });
});

// ============================================================
// POST /v1/voice/preflight
// ============================================================

describe('POST /v1/voice/preflight', () => {
  const route = () => findRoute('POST', '/v1/voice/preflight');

  it('acquires caller ID lock', async () => {
    mockLockService.acquireLock.mockResolvedValueOnce(true);
    const res = await exec(route(), authReq({ body: { callerId: '+15551234567' } }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, callerId: '+15551234567' });
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq({ body: { callerId: '+15551234567' } }));
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for missing callerId', async () => {
    const res = await exec(route(), authReq({ body: {} }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_REQUEST');
  });

  it('returns 409 when caller ID is locked', async () => {
    mockLockService.acquireLock.mockResolvedValueOnce(false);
    const res = await exec(route(), authReq({ body: { callerId: '+15551234567' } }));
    expect(res.statusCode).toBe(409);
    expect((res.body as { error: { code: string } }).error.code).toBe('CALLER_ID_LOCKED');
  });
});

// ============================================================
// POST /v1/voice/twiml
// ============================================================

describe('POST /v1/voice/twiml', () => {
  const route = () => findRoute('POST', '/v1/voice/twiml');

  it('returns TwiML for valid twilio request', async () => {
    const req = {
      auth: undefined,
      method: 'POST',
      path: '/v1/voice/twiml',
      headers: {
        'x-twilio-signature': 'valid-sig',
        'x-forwarded-proto': 'https',
        host: 'api.example.com',
      },
      body: { To: '+15551234567', From: '+15559876543', CallSid: 'CA-001' },
    } as Partial<ApiRequest>;
    const res = await exec(route(), req);
    expect(res.statusCode).toBe(200);
    expect(res.contentType).toBe('text/xml');
    expect(res.rawBody).toContain('Conference');
  });

  it('returns 401 for missing twilio signature', async () => {
    const req = {
      auth: undefined,
      method: 'POST',
      path: '/v1/voice/twiml',
      headers: {},
      body: { To: '+15551234567', From: '+15559876543', CallSid: 'CA-001' },
    } as Partial<ApiRequest>;
    const res = await exec(route(), req);
    expect(res.statusCode).toBe(401);
  });

  it('stores conference mapping in redis', async () => {
    const req = {
      auth: undefined,
      method: 'POST',
      path: '/v1/voice/twiml',
      headers: {
        'x-twilio-signature': 'valid-sig',
        'x-forwarded-proto': 'https',
        host: 'api.example.com',
      },
      body: { To: '+15551234567', From: '+15559876543', CallSid: 'CA-001' },
    } as Partial<ApiRequest>;
    await exec(route(), req);
    expect(mockRedis.setConferenceName).toHaveBeenCalledWith('CA-001', 'conf-test-uuid-001');
  });

  it('handles client: destinations without dialing customer', async () => {
    const req = {
      auth: undefined,
      method: 'POST',
      path: '/v1/voice/twiml',
      headers: {
        'x-twilio-signature': 'valid-sig',
        'x-forwarded-proto': 'https',
        host: 'api.example.com',
      },
      body: { To: 'client:agent-001', From: '+15559876543', CallSid: 'CA-002' },
    } as Partial<ApiRequest>;
    await exec(route(), req);
    expect(mockDialer.addCustomerToConference).not.toHaveBeenCalled();
  });
});

// ============================================================
// GET /v1/voice/active-call
// ============================================================

describe('GET /v1/voice/active-call', () => {
  const route = () => findRoute('GET', '/v1/voice/active-call');

  it('returns active conference info', async () => {
    mockDialer.conference.findConferenceSid.mockResolvedValueOnce('CF-active-001');
    const res = await exec(route(), authReq({ query: { conferenceName: 'conf-abc123' } }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ active: true, conferenceSid: 'CF-active-001' });
  });

  it('returns inactive when no conference found', async () => {
    mockDialer.conference.findConferenceSid.mockResolvedValueOnce(null);
    const res = await exec(route(), authReq({ query: { conferenceName: 'conf-abc123' } }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ active: false });
  });

  it('returns 400 for missing conferenceName', async () => {
    const res = await exec(route(), authReq({ query: {} }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_REQUEST');
  });

  it('returns 500 on service error', async () => {
    mockDialer.conference.findConferenceSid.mockRejectedValueOnce(new Error('twilio error'));
    const res = await exec(route(), authReq({ query: { conferenceName: 'conf-abc123' } }));
    expect(res.statusCode).toBe(500);
    expect((res.body as { error: { code: string } }).error.code).toBe('CHECK_FAILED');
  });
});

// ============================================================
// GET /v1/voice/status
// ============================================================

describe('GET /v1/voice/status', () => {
  const route = () => findRoute('GET', '/v1/voice/status');

  it('returns configured status when twilio is connected', async () => {
    mockTwilioConfig.getWorkspaceTwilioConfig.mockResolvedValueOnce({
      mode: 'byok',
      twimlAppSid: 'AP-001',
    });
    mockTwilioConfig.getDecryptedCredentials.mockReturnValueOnce({
      accountSid: 'AC-001',
      authToken: 'tok',
      twimlAppSid: 'AP-001',
    });
    mockDialer.listNumbers.mockResolvedValueOnce([{ phoneNumber: '+15551234567' }]);
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect((res.body as { configured: boolean }).configured).toBe(true);
    expect((res.body as { twilioConnected: boolean }).twilioConnected).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq());
    expect(res.statusCode).toBe(401);
  });

  it('returns unconfigured for missing config', async () => {
    mockTwilioConfig.getWorkspaceTwilioConfig.mockResolvedValueOnce(null);
    mockTwilioConfig.isHostedInstance.mockReturnValueOnce(false);
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect((res.body as { configured: boolean }).configured).toBe(false);
    expect((res.body as { mode: string }).mode).toBe('byok');
  });

  it('returns hosted mode for hosted instance without config', async () => {
    mockTwilioConfig.getWorkspaceTwilioConfig.mockResolvedValueOnce(null);
    mockTwilioConfig.isHostedInstance.mockReturnValueOnce(true);
    const res = await exec(route(), authReq());
    expect(res.statusCode).toBe(200);
    expect((res.body as { mode: string }).mode).toBe('hosted');
  });
});

// ============================================================
// GET /v1/voice/conference-by-call/:callSid
// ============================================================

describe('GET /v1/voice/conference-by-call/:callSid', () => {
  const route = () => findRoute('GET', '/v1/voice/conference-by-call/:callSid');

  it('returns conference name for valid callSid', async () => {
    mockRedis.getConferenceName.mockResolvedValueOnce('conf-abc123');
    const res = await exec(route(), authReq({ params: { callSid: 'CA-001' } }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ conferenceName: 'conf-abc123' });
  });

  it('returns 404 when no conference found', async () => {
    mockRedis.getConferenceName.mockResolvedValueOnce(null);
    const res = await exec(route(), authReq({ params: { callSid: 'CA-unknown' } }));
    expect(res.statusCode).toBe(404);
    expect((res.body as { error: { code: string } }).error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for missing callSid', async () => {
    const res = await exec(route(), authReq({ params: {} }));
    expect(res.statusCode).toBe(400);
  });

  it('returns 500 on redis error', async () => {
    mockRedis.getConferenceName.mockRejectedValueOnce(new Error('redis down'));
    const res = await exec(route(), authReq({ params: { callSid: 'CA-001' } }));
    expect(res.statusCode).toBe(500);
    expect((res.body as { error: { code: string } }).error.code).toBe('GET_FAILED');
  });
});

// ============================================================
// POST /v1/calls/transfer/:transferId/mute-customer
// ============================================================

describe('POST /v1/calls/transfer/:transferId/mute-customer', () => {
  const route = () => findRoute('POST', '/v1/calls/transfer/:transferId/mute-customer');

  const warmTransferRecord = {
    transferId: 'xfer-001',
    status: 'consulting',
    transferType: 'warm',
    recipientPhone: '+15555678901',
    conferenceName: 'conf-abc123',
    conferenceSid: 'CF-active-001',
    transferCallSid: 'CA-transfer-001',
    customerMuted: false,
    initiatedAt: '2026-01-01T00:00:00Z',
    connectedAt: null,
    completedAt: null,
  };

  it('mutes customer in warm transfer', async () => {
    mockRedis.getTransfer.mockResolvedValueOnce({ ...warmTransferRecord });
    mockDialer.listParticipants.mockResolvedValueOnce([
      { callSid: 'CA-cust-001', label: 'customer' },
    ]);
    const res = await exec(route(), authReq({
      params: { transferId: 'xfer-001' },
      body: { muted: true },
    }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ transferId: 'xfer-001', customerMuted: true });
    expect(mockDialer.muteParticipant).toHaveBeenCalledWith('CF-active-001', 'CA-cust-001', true);
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq({
      params: { transferId: 'xfer-001' },
      body: { muted: true },
    }));
    expect(res.statusCode).toBe(401);
  });

  it('returns 404 for unknown transfer', async () => {
    mockRedis.getTransfer.mockResolvedValueOnce(null);
    const res = await exec(route(), authReq({
      params: { transferId: 'xfer-unknown' },
      body: { muted: true },
    }));
    expect(res.statusCode).toBe(404);
    expect((res.body as { error: { code: string } }).error.code).toBe('TRANSFER_NOT_FOUND');
  });

  it('returns 400 for cold transfer', async () => {
    mockRedis.getTransfer.mockResolvedValueOnce({ ...warmTransferRecord, transferType: 'cold' });
    const res = await exec(route(), authReq({
      params: { transferId: 'xfer-001' },
      body: { muted: true },
    }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_TRANSFER_TYPE');
  });

  it('returns 400 for completed transfer', async () => {
    mockRedis.getTransfer.mockResolvedValueOnce({ ...warmTransferRecord, status: 'completed' });
    const res = await exec(route(), authReq({
      params: { transferId: 'xfer-001' },
      body: { muted: true },
    }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('TRANSFER_NOT_ACTIVE');
  });

  it('returns 400 for missing muted boolean', async () => {
    mockRedis.getTransfer.mockResolvedValueOnce({ ...warmTransferRecord });
    const res = await exec(route(), authReq({
      params: { transferId: 'xfer-001' },
      body: {},
    }));
    expect(res.statusCode).toBe(400);
  });
});

// ============================================================
// GET /v1/calls/transfer/:transferId/status
// ============================================================

describe('GET /v1/calls/transfer/:transferId/status', () => {
  const route = () => findRoute('GET', '/v1/calls/transfer/:transferId/status');

  const transferRecord = {
    transferId: 'xfer-001',
    status: 'consulting',
    transferType: 'warm',
    recipientPhone: '+15555678901',
    conferenceSid: 'CF-active-001',
    customerMuted: false,
    initiatedAt: '2026-01-01T00:00:00Z',
    connectedAt: null,
    completedAt: null,
  };

  it('returns transfer status', async () => {
    mockRedis.getTransfer.mockResolvedValueOnce(transferRecord);
    const res = await exec(route(), authReq({ params: { transferId: 'xfer-001' } }));
    expect(res.statusCode).toBe(200);
    expect((res.body as { transferId: string }).transferId).toBe('xfer-001');
    expect((res.body as { status: string }).status).toBe('consulting');
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq({ params: { transferId: 'xfer-001' } }));
    expect(res.statusCode).toBe(401);
  });

  it('returns 404 for unknown transfer', async () => {
    mockRedis.getTransfer.mockResolvedValueOnce(null);
    const res = await exec(route(), authReq({ params: { transferId: 'xfer-unknown' } }));
    expect(res.statusCode).toBe(404);
    expect((res.body as { error: { code: string } }).error.code).toBe('TRANSFER_NOT_FOUND');
  });

  it('returns 500 on redis error', async () => {
    mockRedis.getTransfer.mockRejectedValueOnce(new Error('redis down'));
    const res = await exec(route(), authReq({ params: { transferId: 'xfer-001' } }));
    expect(res.statusCode).toBe(500);
    expect((res.body as { error: { code: string } }).error.code).toBe('REDIS_ERROR');
  });
});

// ============================================================
// POST /v1/calls/:callSid/transfer
// ============================================================

describe('POST /v1/calls/:callSid/transfer', () => {
  const route = () => findRoute('POST', '/v1/calls/:callSid/transfer');

  it('initiates cold transfer', async () => {
    mockRedis.getConferenceName.mockResolvedValueOnce('conf-abc123');
    mockDialer.initiateTransfer.mockResolvedValueOnce({
      success: true,
      conferenceSid: 'CF-active-001',
      transferCallSid: 'CA-transfer-001',
    });
    const res = await exec(route(), authReq({
      params: { callSid: 'CA-001' },
      body: { to: '+15555678901', type: 'cold' },
    }));
    expect(res.statusCode).toBe(200);
    expect((res.body as { success: boolean }).success).toBe(true);
    expect((res.body as { transferId: string }).transferId).toBe('test-uuid-001');
  });

  it('initiates warm transfer', async () => {
    mockRedis.getConferenceName.mockResolvedValueOnce('conf-abc123');
    mockDialer.initiateTransfer.mockResolvedValueOnce({
      success: true,
      conferenceSid: 'CF-active-001',
      transferCallSid: 'CA-transfer-001',
    });
    const res = await exec(route(), authReq({
      params: { callSid: 'CA-001' },
      body: { to: '+15555678901', type: 'warm' },
    }));
    expect(res.statusCode).toBe(200);
    expect(mockRedis.setTransfer).toHaveBeenCalled();
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq({
      params: { callSid: 'CA-001' },
      body: { to: '+15555678901', type: 'cold' },
    }));
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for missing to or type', async () => {
    const res = await exec(route(), authReq({
      params: { callSid: 'CA-001' },
      body: { to: '+15555678901' },
    }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_REQUEST');
  });

  it('returns 404 when no conference found', async () => {
    mockRedis.getConferenceName.mockResolvedValueOnce(null);
    const res = await exec(route(), authReq({
      params: { callSid: 'CA-unknown' },
      body: { to: '+15555678901', type: 'cold' },
    }));
    expect(res.statusCode).toBe(404);
    expect((res.body as { error: { code: string } }).error.code).toBe('CONFERENCE_NOT_FOUND');
  });

  it('returns 500 when transfer fails', async () => {
    mockRedis.getConferenceName.mockResolvedValueOnce('conf-abc123');
    mockDialer.initiateTransfer.mockResolvedValueOnce({ success: false, error: 'Dial failed' });
    const res = await exec(route(), authReq({
      params: { callSid: 'CA-001' },
      body: { to: '+15555678901', type: 'cold' },
    }));
    expect(res.statusCode).toBe(500);
    expect((res.body as { error: { code: string } }).error.code).toBe('TRANSFER_FAILED');
  });
});

// ============================================================
// POST /v1/calls/:callSid/transfer/complete
// ============================================================

describe('POST /v1/calls/:callSid/transfer/complete', () => {
  const route = () => findRoute('POST', '/v1/calls/:callSid/transfer/complete');

  it('completes warm transfer', async () => {
    mockDialer.completeTransfer.mockResolvedValueOnce({ success: true });
    const res = await exec(route(), authReq({
      params: { callSid: 'CA-001' },
      body: { conferenceSid: 'CF-active-001', agentCallSid: 'CA-agent-001' },
    }));
    expect(res.statusCode).toBe(200);
    expect((res.body as { success: boolean }).success).toBe(true);
    expect(mockRedis.deleteConferenceName).toHaveBeenCalledWith('CA-001');
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq({
      params: { callSid: 'CA-001' },
      body: { conferenceSid: 'CF-active-001', agentCallSid: 'CA-agent-001' },
    }));
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for missing conferenceSid or agentCallSid', async () => {
    const res = await exec(route(), authReq({
      params: { callSid: 'CA-001' },
      body: { conferenceSid: 'CF-active-001' },
    }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_REQUEST');
  });

  it('returns 500 when complete fails', async () => {
    mockDialer.completeTransfer.mockResolvedValueOnce({ success: false, error: 'Not found' });
    const res = await exec(route(), authReq({
      params: { callSid: 'CA-001' },
      body: { conferenceSid: 'CF-active-001', agentCallSid: 'CA-agent-001' },
    }));
    expect(res.statusCode).toBe(500);
    expect((res.body as { error: { code: string } }).error.code).toBe('TRANSFER_FAILED');
  });
});

// ============================================================
// POST /v1/calls/:callSid/transfer/cancel
// ============================================================

describe('POST /v1/calls/:callSid/transfer/cancel', () => {
  const route = () => findRoute('POST', '/v1/calls/:callSid/transfer/cancel');

  it('cancels transfer', async () => {
    mockDialer.cancelTransfer.mockResolvedValueOnce({ success: true });
    const res = await exec(route(), authReq({
      params: { callSid: 'CA-001' },
      body: { conferenceSid: 'CF-active-001', transferCallSid: 'CA-transfer-001' },
    }));
    expect(res.statusCode).toBe(200);
    expect((res.body as { success: boolean }).success).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq({
      params: { callSid: 'CA-001' },
      body: { conferenceSid: 'CF-active-001', transferCallSid: 'CA-transfer-001' },
    }));
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for missing conferenceSid or transferCallSid', async () => {
    const res = await exec(route(), authReq({
      params: { callSid: 'CA-001' },
      body: { conferenceSid: 'CF-active-001' },
    }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_REQUEST');
  });

  it('returns 500 when cancel fails', async () => {
    mockDialer.cancelTransfer.mockResolvedValueOnce({ success: false, error: 'Not found' });
    const res = await exec(route(), authReq({
      params: { callSid: 'CA-001' },
      body: { conferenceSid: 'CF-active-001', transferCallSid: 'CA-transfer-001' },
    }));
    expect(res.statusCode).toBe(500);
    expect((res.body as { error: { code: string } }).error.code).toBe('TRANSFER_FAILED');
  });
});

// ============================================================
// POST /v1/calls/:callSid/hold
// ============================================================

describe('POST /v1/calls/:callSid/hold', () => {
  const route = () => findRoute('POST', '/v1/calls/:callSid/hold');

  it('toggles hold on customer', async () => {
    mockRedis.getConferenceName.mockResolvedValueOnce('conf-abc123');
    mockDialer.conference.findConferenceSid.mockResolvedValueOnce('CF-active-001');
    mockDialer.listParticipants.mockResolvedValueOnce([
      { callSid: 'CA-cust-001', label: 'customer' },
    ]);
    const res = await exec(route(), authReq({
      params: { callSid: 'CA-001' },
      body: { hold: true },
    }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, hold: true });
    expect(mockDialer.holdParticipant).toHaveBeenCalledWith('CF-active-001', 'CA-cust-001', true);
  });

  it('holds specific participant by callSid', async () => {
    mockRedis.getConferenceName.mockResolvedValueOnce('conf-abc123');
    mockDialer.conference.findConferenceSid.mockResolvedValueOnce('CF-active-001');
    const res = await exec(route(), authReq({
      params: { callSid: 'CA-001' },
      body: { hold: true, participantCallSid: 'CA-specific-001' },
    }));
    expect(res.statusCode).toBe(200);
    expect(mockDialer.holdParticipant).toHaveBeenCalledWith('CF-active-001', 'CA-specific-001', true);
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq({
      params: { callSid: 'CA-001' },
      body: { hold: true },
    }));
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for missing hold boolean', async () => {
    const res = await exec(route(), authReq({
      params: { callSid: 'CA-001' },
      body: {},
    }));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_REQUEST');
  });

  it('returns 404 when no conference found', async () => {
    mockRedis.getConferenceName.mockResolvedValueOnce(null);
    const res = await exec(route(), authReq({
      params: { callSid: 'CA-001' },
      body: { hold: true },
    }));
    expect(res.statusCode).toBe(404);
    expect((res.body as { error: { code: string } }).error.code).toBe('CONFERENCE_NOT_FOUND');
  });

  it('returns 404 when conference not in-progress', async () => {
    mockRedis.getConferenceName.mockResolvedValueOnce('conf-abc123');
    mockDialer.conference.findConferenceSid.mockResolvedValueOnce(null);
    const res = await exec(route(), authReq({
      params: { callSid: 'CA-001' },
      body: { hold: true },
    }));
    expect(res.statusCode).toBe(404);
  });
});

// ============================================================
// POST /v1/webhooks/status
// ============================================================

describe('POST /v1/webhooks/status', () => {
  const route = () => findRoute('POST', '/v1/webhooks/status');

  it('processes status callback and stores status', async () => {
    mockRedis.getCustomerConferenceName.mockResolvedValueOnce('conf-abc123');
    const req = {
      auth: undefined,
      method: 'POST',
      path: '/v1/webhooks/status',
      headers: {
        'x-twilio-signature': 'valid-sig',
        'x-forwarded-proto': 'https',
        host: 'api.example.com',
      },
      body: { CallSid: 'CA-cust-001', CallStatus: 'in-progress' },
    } as Partial<ApiRequest>;
    const res = await exec(route(), req);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(mockRedis.setCallStatus).toHaveBeenCalledWith('conf-abc123', 'in-progress');
  });

  it('returns 401 for missing twilio signature', async () => {
    const req = {
      auth: undefined,
      method: 'POST',
      path: '/v1/webhooks/status',
      headers: {},
      body: { CallSid: 'CA-001', CallStatus: 'completed' },
    } as Partial<ApiRequest>;
    const res = await exec(route(), req);
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for missing CallSid or CallStatus', async () => {
    const req = {
      auth: undefined,
      method: 'POST',
      path: '/v1/webhooks/status',
      headers: {
        'x-twilio-signature': 'valid-sig',
        'x-forwarded-proto': 'https',
        host: 'api.example.com',
      },
      body: { CallSid: 'CA-001' },
    } as Partial<ApiRequest>;
    const res = await exec(route(), req);
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_REQUEST');
  });
});

// ============================================================
// GET /v1/calls/status/:callSid
// ============================================================

describe('GET /v1/calls/status/:callSid', () => {
  const route = () => findRoute('GET', '/v1/calls/status/:callSid');

  it('returns call status', async () => {
    mockRedis.getConferenceName.mockResolvedValueOnce('conf-abc123');
    mockRedis.getCallStatus.mockResolvedValueOnce('in-progress');
    const res = await exec(route(), authReq({ params: { callSid: 'CA-001' } }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ callSid: 'CA-001', conferenceName: 'conf-abc123', status: 'in-progress' });
  });

  it('returns 401 without auth', async () => {
    const res = await exec(route(), noAuthReq({ params: { callSid: 'CA-001' } }));
    expect(res.statusCode).toBe(401);
  });

  it('returns 404 when no conference for call', async () => {
    mockRedis.getConferenceName.mockResolvedValueOnce(null);
    const res = await exec(route(), authReq({ params: { callSid: 'CA-unknown' } }));
    expect(res.statusCode).toBe(404);
    expect((res.body as { error: { code: string } }).error.code).toBe('CALL_NOT_FOUND');
  });

  it('returns unknown status when redis has no status', async () => {
    mockRedis.getConferenceName.mockResolvedValueOnce('conf-abc123');
    mockRedis.getCallStatus.mockResolvedValueOnce(null);
    const res = await exec(route(), authReq({ params: { callSid: 'CA-001' } }));
    expect(res.statusCode).toBe(200);
    expect((res.body as { status: string }).status).toBe('unknown');
  });

  it('returns 500 on redis error', async () => {
    mockRedis.getConferenceName.mockRejectedValueOnce(new Error('redis down'));
    const res = await exec(route(), authReq({ params: { callSid: 'CA-001' } }));
    expect(res.statusCode).toBe(500);
    expect((res.body as { error: { code: string } }).error.code).toBe('REDIS_ERROR');
  });
});
