// Mock @twilio/voice-sdk Device for frontend unit tests
// Covers: Device lifecycle, Call events, audio device selection

type MockFn = jest.Mock;
type EventHandler = (...args: unknown[]) => void;

export interface MockTwilioCall {
  sid: string;
  parameters: Record<string, string>;
  status: () => string;
  mute: MockFn;
  isMuted: () => boolean;
  sendDigits: MockFn;
  disconnect: MockFn;
  on: MockFn;
  off: MockFn;
  removeAllListeners: MockFn;
}

export interface MockTwilioDevice {
  state: string;
  token: string | null;
  register: MockFn;
  unregister: MockFn;
  connect: MockFn;
  disconnectAll: MockFn;
  updateToken: MockFn;
  destroy: MockFn;
  on: MockFn;
  off: MockFn;
  removeAllListeners: MockFn;
  audio: {
    availableInputDevices: Map<string, { deviceId: string; label: string }>;
    availableOutputDevices: Map<string, { deviceId: string; label: string }>;
    setInputDevice: MockFn;
    speakerDevices: { set: MockFn; get: MockFn };
    ringtoneDevices: { set: MockFn; get: MockFn };
  };
  // test helpers — not part of real SDK
  _simulateEvent: (event: string, ...args: unknown[]) => void;
  _handlers: Map<string, EventHandler[]>;
}

export function createMockCall(overrides?: Partial<MockTwilioCall>): MockTwilioCall {
  const handlers = new Map<string, EventHandler[]>();
  let muted = false;

  const call: MockTwilioCall = {
    sid: 'CA-mock-001',
    parameters: { CallSid: 'CA-mock-001', To: '+15551234567' },
    status: () => 'open',
    mute: jest.fn().mockImplementation((shouldMute?: boolean) => {
      muted = shouldMute ?? !muted;
    }),
    isMuted: () => muted,
    sendDigits: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn().mockImplementation((event: string, handler: EventHandler) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
      return call;
    }),
    off: jest.fn().mockImplementation((event: string, handler: EventHandler) => {
      const list = handlers.get(event) ?? [];
      handlers.set(event, list.filter((h) => h !== handler));
      return call;
    }),
    removeAllListeners: jest.fn().mockImplementation(() => {
      handlers.clear();
      return call;
    }),
    ...overrides,
  };

  return call;
}

export function createMockDevice(): MockTwilioDevice {
  const handlers = new Map<string, EventHandler[]>();
  const mockCall = createMockCall();

  const device: MockTwilioDevice = {
    state: 'unregistered',
    token: null,
    register: jest.fn().mockImplementation(() => {
      device.state = 'registered';
      return Promise.resolve();
    }),
    unregister: jest.fn().mockImplementation(() => {
      device.state = 'unregistered';
      return Promise.resolve();
    }),
    connect: jest.fn().mockResolvedValue(mockCall),
    disconnectAll: jest.fn(),
    updateToken: jest.fn().mockImplementation((newToken: string) => {
      device.token = newToken;
    }),
    destroy: jest.fn().mockImplementation(() => {
      device.state = 'destroyed';
      handlers.clear();
    }),
    on: jest.fn().mockImplementation((event: string, handler: EventHandler) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
      return device;
    }),
    off: jest.fn().mockImplementation((event: string, handler: EventHandler) => {
      const list = handlers.get(event) ?? [];
      handlers.set(event, list.filter((h) => h !== handler));
      return device;
    }),
    removeAllListeners: jest.fn().mockImplementation(() => {
      handlers.clear();
      return device;
    }),
    audio: {
      availableInputDevices: new Map([
        ['default', { deviceId: 'default', label: 'Default Microphone' }],
      ]),
      availableOutputDevices: new Map([
        ['default', { deviceId: 'default', label: 'Default Speaker' }],
      ]),
      setInputDevice: jest.fn().mockResolvedValue(undefined),
      speakerDevices: {
        set: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockReturnValue(new Set(['default'])),
      },
      ringtoneDevices: {
        set: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockReturnValue(new Set(['default'])),
      },
    },
    _handlers: handlers,
    _simulateEvent: (event: string, ...args: unknown[]) => {
      const list = handlers.get(event) ?? [];
      for (const handler of list) handler(...args);
    },
  };

  return device;
}

// Mock the Device constructor
export const Device = jest.fn().mockImplementation(() => createMockDevice());

// Mock the Call class
export const Call = {
  State: {
    Connecting: 'connecting',
    Ringing: 'ringing',
    Open: 'open',
    Closed: 'closed',
  },
};
