import { act, waitFor } from '@testing-library/react';
import { type MutableSnapshot } from 'recoil';

import { renderHookWithRecoil } from '@/dialer/testing/renderWithRecoil';
import { useTwilioDevice } from '@/dialer/hooks/useTwilioDevice';
import { twilioConfigStatusState } from '@/dialer/states/twilioConfigStatusState';

// mock @twilio/voice-sdk
const mockRegister = jest.fn().mockResolvedValue(undefined);
const mockDestroy = jest.fn();
const mockDeviceConnect = jest.fn();
const mockUpdateToken = jest.fn();
const mockDeviceOn = jest.fn();
const mockDeviceAudio = {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (DeviceMock as any).State = { Registered: 'registered' }; // HACK: twilio Device mock needs State enum
  return { Device: DeviceMock, Call: jest.fn() };
});

// mock authenticatedFetch
const mockFetch = jest.fn();
jest.mock('@/dialer/utils/authenticatedFetch', () => ({
  authenticatedFetch: (...args: unknown[]) => mockFetch(...args),
}));

// mock sentry
jest.mock('@sentry/react', () => ({
  captureException: jest.fn(),
}));

// mock useCallPersistence
jest.mock('@/dialer/hooks/useCallPersistence', () => ({
  useCallPersistence: () => ({
    persistCurrentCall: jest.fn(),
    clearPersistence: jest.fn(),
    getConferenceNameByCallSid: jest.fn().mockResolvedValue(null),
  }),
}));

// mock config
jest.mock('~/config', () => ({
  REACT_APP_SERVER_BASE_URL: 'http://localhost:3000',
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

describe('useTwilioDevice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockFetch.mockImplementation(tokenResponse);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return initial state before config is loaded', () => {
    const { result } = renderHookWithRecoil(() => useTwilioDevice());

    expect(result.current.isReady).toBe(false);
    expect(result.current.error).toBeNull();
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

  it('should set isReady when device fires registered event', async () => {
    const { result } = renderHookWithRecoil(() => useTwilioDevice(), {
      initializeState: configuredState,
    });

    await waitFor(() => {
      expect(mockDeviceOn).toHaveBeenCalled();
    });

    // find the 'registered' handler and call it
    const registeredCall = mockDeviceOn.mock.calls.find(
      (c: unknown[]) => c[0] === 'registered',
    );
    expect(registeredCall).toBeDefined();

    act(() => {
      registeredCall[1]();
    });

    expect(result.current.isReady).toBe(true);
  });

  it('should set error when device fires error event', async () => {
    const { result } = renderHookWithRecoil(() => useTwilioDevice(), {
      initializeState: configuredState,
    });

    await waitFor(() => {
      expect(mockDeviceOn).toHaveBeenCalled();
    });

    const errorCall = mockDeviceOn.mock.calls.find(
      (c: unknown[]) => c[0] === 'error',
    );
    expect(errorCall).toBeDefined();

    act(() => {
      errorCall[1]({ message: 'Connection lost', code: 31005 });
    });

    expect(result.current.isReady).toBe(false);
    expect(result.current.error).toBe('Connection lost');
  });

  it('should throw when connect is called without device', async () => {
    const { result } = renderHookWithRecoil(() => useTwilioDevice());

    await expect(
      result.current.connect({ To: '+15551234567', From: '+15559876543' }),
    ).rejects.toThrow('Device not initialized');
  });

  it('should set error when token fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHookWithRecoil(() => useTwilioDevice(), {
      initializeState: configuredState,
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
    });
  });

  it('should set error when token response has no token', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
    );

    const { result } = renderHookWithRecoil(() => useTwilioDevice(), {
      initializeState: configuredState,
    });

    await waitFor(() => {
      expect(result.current.error).toBe('No token in response');
    });
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

  it('should register tokenWillExpire handler', async () => {
    renderHookWithRecoil(() => useTwilioDevice(), {
      initializeState: configuredState,
    });

    await waitFor(() => {
      expect(mockDeviceOn).toHaveBeenCalled();
    });

    const tokenExpireCall = mockDeviceOn.mock.calls.find(
      (c: unknown[]) => c[0] === 'tokenWillExpire',
    );
    expect(tokenExpireCall).toBeDefined();
  });

  it('should handle incoming call event', async () => {
    renderHookWithRecoil(() => useTwilioDevice(), {
      initializeState: configuredState,
    });

    await waitFor(() => {
      expect(mockDeviceOn).toHaveBeenCalled();
    });

    const incomingCall = mockDeviceOn.mock.calls.find(
      (c: unknown[]) => c[0] === 'incoming',
    );
    expect(incomingCall).toBeDefined();
  });
});
