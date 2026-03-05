// Mock twilio SDK for unit tests
// Covers: client factory, conferences, participants, calls

type MockFn = jest.Mock;

export interface MockParticipant {
  callSid: string;
  conferenceSid: string;
  label: string;
  hold: boolean;
  muted: boolean;
  status: string;
  update: MockFn;
  remove: MockFn;
}

export interface MockConference {
  sid: string;
  friendlyName: string;
  status: string;
  participants: {
    list: MockFn;
    get: (callSid: string) => { fetch: MockFn; update: MockFn; remove: MockFn };
  };
  update: MockFn;
}

export interface MockCall {
  sid: string;
  status: string;
  to: string;
  from: string;
  update: MockFn;
  fetch: MockFn;
}

export interface MockTwilioClient {
  conferences: {
    list: MockFn;
    get: (sid: string) => MockConference;
  };
  calls: {
    create: MockFn;
    get: (sid: string) => { fetch: MockFn; update: MockFn };
  };
  tokens: {
    create: MockFn;
  };
  incomingPhoneNumbers: {
    list: MockFn;
    create: MockFn;
    get: (sid: string) => { fetch: MockFn; update: MockFn; remove: MockFn };
  };
  availablePhoneNumbers: (country: string) => {
    local: { list: MockFn };
  };
}

export const createMockParticipant = (
  overrides?: Partial<MockParticipant>,
): MockParticipant => ({
  callSid: 'CA-participant-001',
  conferenceSid: 'CF-test-001',
  label: 'agent',
  hold: false,
  muted: false,
  status: 'connected',
  update: jest.fn(),
  remove: jest.fn(),
  ...overrides,
});

export const createMockConference = (
  overrides?: Partial<Pick<MockConference, 'sid' | 'friendlyName' | 'status'>>,
): MockConference => {
  const participants = new Map<string, MockParticipant>();

  return {
    sid: 'CF-test-001',
    friendlyName: 'conf-test-001',
    status: 'in-progress',
    ...overrides,
    participants: {
      list: jest.fn().mockResolvedValue([...participants.values()]),
      get: (callSid: string) => ({
        fetch: jest.fn().mockResolvedValue(
          participants.get(callSid) ?? createMockParticipant({ callSid }),
        ),
        update: jest.fn().mockResolvedValue({}),
        remove: jest.fn().mockResolvedValue(undefined),
      }),
    },
    update: jest.fn(),
  };
};

export const createMockCall = (overrides?: Partial<MockCall>): MockCall => ({
  sid: 'CA-test-001',
  status: 'in-progress',
  to: '+15551234567',
  from: '+15559876543',
  update: jest.fn(),
  fetch: jest.fn(),
  ...overrides,
});

export const createMockTwilioClient = (): MockTwilioClient => {
  const conferences = new Map<string, MockConference>();
  const defaultConference = createMockConference();

  return {
    conferences: {
      list: jest.fn().mockResolvedValue([defaultConference]),
      get: (sid: string) => conferences.get(sid) ?? defaultConference,
    },
    calls: {
      create: jest.fn().mockResolvedValue(createMockCall()),
      get: (sid: string) => ({
        fetch: jest.fn().mockResolvedValue(createMockCall({ sid })),
        update: jest.fn().mockResolvedValue({}),
      }),
    },
    tokens: {
      create: jest.fn().mockResolvedValue({ token: 'test-placeholder-value' }),
    },
    incomingPhoneNumbers: {
      list: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({
        sid: 'PN-test-001',
        phoneNumber: '+15551234567',
      }),
      get: (sid: string) => ({
        fetch: jest.fn().mockResolvedValue({ sid, phoneNumber: '+15551234567' }),
        update: jest.fn().mockResolvedValue({}),
        remove: jest.fn().mockResolvedValue(undefined),
      }),
    },
    availablePhoneNumbers: (_country: string) => ({
      local: {
        list: jest.fn().mockResolvedValue([]),
      },
    }),
  };
};

// Default export mimics `import twilio from 'twilio'` — returns a factory
const twilioFactory = jest.fn().mockReturnValue(createMockTwilioClient());

// Attach validateRequest for webhook signature validation
(twilioFactory as unknown as Record<string, unknown>).validateRequest = jest
  .fn()
  .mockReturnValue(true);

export default twilioFactory;
export { twilioFactory as twilio };
export const validateRequest = (
  twilioFactory as unknown as Record<string, MockFn>
).validateRequest;
