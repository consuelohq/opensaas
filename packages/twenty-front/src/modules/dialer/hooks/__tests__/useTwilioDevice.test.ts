import { act, waitFor } from '@testing-library/react';
import { useRecoilValue, type MutableSnapshot } from 'recoil';

import { renderHookWithRecoil } from '@/dialer/testing/renderWithRecoil';
import { useTwilioDevice } from '@/dialer/hooks/useTwilioDevice';
import { callErrorState } from '@/dialer/states/callErrorState';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import { twilioConfigStatusState } from '@/dialer/states/twilioConfigStatusState';

type MockEventHandler = (...args: unknown[]) => void;

type MockCall = {
  on: jest.Mock;
  parameters: Record<string, string | undefined>;
  disconnect: jest.Mock;
  status: jest.Mock;
};

const deviceEventHandlers = new Map<string, MockEventHandler>();
const callEventHandlers = new Map<string, MockEventHandler>();

const createMockCall = (): MockCall => ({
  on: jest.fn((eventName: string, handler: MockEventHandler) => {
    callEventHandlers.set(eventName, handler);
  }),
  parameters: {},
  disconnect: jest.fn(),
  status: jest.fn(() => 'connecting'),
});

let mockCall = createMockCall();

const mockRegister = jest.fn().mockResolvedValue(undefined);
const mockDestroy = jest.fn();
const mockDeviceConnect = jest.fn(() => Promise.resolve(mockCall));
const mockUpdateToken = jest.fn();
const mockDeviceOn = jest.fn((eventName: string, handler: MockEventHandler) => {
  deviceEventHandlers.set(eventName, handler);
});
const mockDeviceAudio = {
  incoming: jest.fn(),
  outgoing: jest.fn(),
  disconnect: jest.fn(),
  setInputDevice: jest.fn().mockResolvedValue(undefined),
  speakerDevices: { set: jest.fn().mockResolvedValue(undefined) },
};

jest.mock('@twilio/voice-sdk', () => {
  const DeviceMock = jest.fn().mockImplementation(() => ({
    register: mockRegister,
    destroy: mockDestroy,
    connect: mockDeviceConnect,
    updateToken: mockUpdateToken,
    on: mockDeviceOn,
    audio: mockDeviceAudio,
    state: 'registered',
  }));

  (DeviceMock as any).State = { Registered: 'registered' }; // HACK: twilio Device mock needs State enum
  return { Device: DeviceMock, Call: jest.fn() };
});

const mockFetch = jest.fn();
jest.mock('@/dialer/utils/authenticatedFetch', () => ({
  authenticatedFetch: (...args: unknown[]) => mockFetch(...args),
}));

jest.mock('@sentry/react', () => ({
  captureException: jest.fn(),
}));

jest.mock('@/dialer/hooks/useCallPersistence', () => ({
  useCallPersistence: () => ({
    persistCurrentCall: jest.fn(),
    clearPersistence: jest.fn(),
    getConferenceNameByCallSid: jest.fn().mockResolvedValue(null),
  }),
}));

jest.mock('~/config', () => ({
  REACT_APP_SERVER_BASE_URL: 'http://localhost:3000',
}));

jest.mock('@/dialer/utils/notificationSounds', () => ({
  playCallConnectedSound: jest.fn(),
  playCallEndSound: jest.fn(),
  playDialingStartedSound: jest.fn(),
  playErrorSound: jest.fn(),
  playIncomingCallSound: jest.fn(),
}));

const configuredState = (snap: MutableSnapshot) => {
  snap.set(twilioConfigStatusState, {
    mode: 'hosted',
    configured: true,
    twilioConnected: true,
    hasPhoneNumbers: true,
    twimlAppConfigured: true,
    error: null,
  });
};

const tokenResponse = () =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ token: 'test-token-123' }),
  });

const setupMediaDevices = () => {
  Object.defineProperty(global.navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: jest.fn().mockResolvedValue({
        getTracks: () => [{ stop: jest.fn() }],
      }),
    },
  });
};

const emitCallEvent = async (eventName: string, payload?: unknown) => {
  const handler = callEventHandlers.get(eventName);

  expect(handler).toBeDefined();

  await act(async () => {
    handler?.(payload);
    await Promise.resolve();
  });
};

const renderUseTwilioDevice = () =>
  renderHookWithRecoil(
    () => ({
      twilio: useTwilioDevice(),
      callState: useRecoilValue(callStateAtom),
      callError: useRecoilValue(callErrorState),
    }),
    {
      initializeState: configuredState,
    },
  );

describe('useTwilioDevice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    deviceEventHandlers.clear();
    callEventHandlers.clear();
    mockCall = createMockCall();
    mockDeviceConnect.mockImplementation(() => Promise.resolve(mockCall));
    mockFetch.mockImplementation(tokenResponse);
    setupMediaDevices();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return initial state before config is loaded', () => {
    const { result } = renderHookWithRecoil(() => useTwilioDevice());

    expect(result.current.deviceReady).toBe(false);
    expect(result.current.deviceError).toBeNull();
    expect(result.current.activeCall).toBeNull();
    expect(result.current.reconnecting).toBe(false);
  });

  it('should not init device when config is not configured', () => {
    renderHookWithRecoil(() => useTwilioDevice());

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should fetch token and register device when configured', async () => {
    renderHookWithRecoil(() => useTwilioDevice(), {
      initializeState: configuredState,
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/voice/token',
      );
    });

    expect(mockRegister).toHaveBeenCalled();
  });

  it('should register the device lifecycle handlers when configured', async () => {
    renderHookWithRecoil(() => useTwilioDevice(), {
      initializeState: configuredState,
    });

    await waitFor(() => {
      expect(mockDeviceOn).toHaveBeenCalled();
    });

    expect(deviceEventHandlers.has('registered')).toBe(true);
    expect(deviceEventHandlers.has('unregistered')).toBe(true);
    expect(deviceEventHandlers.has('error')).toBe(true);
    expect(deviceEventHandlers.has('incoming')).toBe(true);
    expect(deviceEventHandlers.has('tokenWillExpire')).toBe(true);
  });

  it('should throw when connect is called without device', async () => {
    const { result } = renderHookWithRecoil(() => useTwilioDevice());

    await expect(
      result.current.connect({ To: '+15551234567', From: '+15559876543' }),
    ).rejects.toThrow('Device not initialized');
  });

  it('should bind outbound call handlers after connecting', async () => {
    const { result } = renderHookWithRecoil(() => useTwilioDevice(), {
      initializeState: configuredState,
    });

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled();
    });

    await act(async () => {
      const call = await result.current.connect({
        To: '+15551234567',
        From: '+15559876543',
      });

      expect(call).toBe(mockCall);
    });

    expect(callEventHandlers.has('ringing')).toBe(true);
    expect(callEventHandlers.has('error')).toBe(true);
    expect(callEventHandlers.has('disconnect')).toBe(true);
    expect(callEventHandlers.has('cancel')).toBe(true);
    expect(callEventHandlers.has('reject')).toBe(true);
  });

  it('should update outbound status to ringing when the call starts ringing', async () => {
    const { result } = renderUseTwilioDevice();

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.twilio.connect({
        To: '+15551234567',
        From: '+15559876543',
      });
    });

    mockCall.status.mockReturnValue('ringing');
    await emitCallEvent('ringing');

    await waitFor(() => {
      expect(result.current.callState.status).toBe('ringing');
      expect(result.current.callError).toBeNull();
    });
  });

  it('should mark the call as failed when Twilio emits a call error', async () => {
    const { result } = renderUseTwilioDevice();

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.twilio.connect({
        To: '+15551234567',
        From: '+15559876543',
      });
    });

    await emitCallEvent('error', { message: 'Recipient unavailable', code: 31003 });

    await waitFor(() => {
      expect(result.current.callState.status).toBe('failed');
      expect(result.current.callError?.reason).toBe('failed');
      expect(result.current.callError?.message).toBe('Recipient unavailable');
    });
  });

  it('should not register a device when token fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    renderHookWithRecoil(() => useTwilioDevice(), {
      initializeState: configuredState,
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('should not register a device when the token response has no token', async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
    );

    renderHookWithRecoil(() => useTwilioDevice(), {
      initializeState: configuredState,
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('should cleanup device on unmount', async () => {
    const { unmount } = renderHookWithRecoil(() => useTwilioDevice(), {
      initializeState: configuredState,
    });

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled();
    });

    unmount();

    expect(mockDestroy).toHaveBeenCalled();
  });
});
