import { act, waitFor } from '@testing-library/react';
import { type MutableSnapshot } from 'recoil';

import { renderHookWithRecoil } from '@/dialer/testing/renderWithRecoil';
import { useCallTransfer } from '@/dialer/hooks/useCallTransfer';
import { callStateAtom } from '@/dialer/states/callStateAtom';

// mock authenticatedFetch
const mockFetch = jest.fn();
jest.mock('@/dialer/utils/authenticatedFetch', () => ({
  authenticatedFetch: (...args: unknown[]) => mockFetch(...args),
}));

jest.mock('@sentry/react', () => ({
  captureException: jest.fn(),
}));

jest.mock('~/config', () => ({
  REACT_APP_SERVER_BASE_URL: 'http://localhost:3000',
}));

const withActiveCall = (snap: MutableSnapshot) => {
  snap.set(callStateAtom, {
    status: 'active',
    callSid: 'CA-test-123',
    duration: 0,
    startedAt: new Date(),
    contact: null,
    callingMode: 'browser',
    fromNumber: '+15551234567',
    parallelGroupId: null,
    transferId: null,
  });
};

const jsonResponse = (data: Record<string, unknown>, ok = true) =>
  Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(ok ? data : { error: { message: 'Server error' } }),
  });

describe('useCallTransfer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return idle transfer state initially', () => {
    const { result } = renderHookWithRecoil(() => useCallTransfer(), {
      initializeState: withActiveCall,
    });

    expect(result.current.transferState.status).toBe('idle');
    expect(result.current.transferState.error).toBeNull();
    expect(result.current.holdError).toBeNull();
  });

  it('should initiate cold transfer and set completed status', async () => {
    mockFetch.mockImplementationOnce(() =>
      jsonResponse({ transferCallSid: 'CA-transfer-1', conferenceSid: 'CF-1' }),
    );

    const { result } = renderHookWithRecoil(() => useCallTransfer(), {
      initializeState: withActiveCall,
    });

    await act(async () => {
      await result.current.initiateTransfer('+15559999999', 'cold');
    });

    expect(result.current.transferState.status).toBe('completed');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/v1/calls/CA-test-123/transfer',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ to: '+15559999999', type: 'cold' }),
      }),
    );
  });

  it('should initiate warm transfer and set consulting status', async () => {
    mockFetch.mockImplementationOnce(() =>
      jsonResponse({
        transferCallSid: 'CA-transfer-2',
        conferenceSid: 'CF-2',
      }),
    );

    const { result } = renderHookWithRecoil(() => useCallTransfer(), {
      initializeState: withActiveCall,
    });

    await act(async () => {
      await result.current.initiateTransfer('+15559999999', 'warm');
    });

    expect(result.current.transferState.status).toBe('consulting');
    expect(result.current.transferState.conferenceSid).toBe('CF-2');
  });

  it('should complete warm transfer', async () => {
    // first initiate warm transfer
    mockFetch.mockImplementationOnce(() =>
      jsonResponse({
        transferCallSid: 'CA-transfer-3',
        conferenceSid: 'CF-3',
      }),
    );

    const { result } = renderHookWithRecoil(() => useCallTransfer(), {
      initializeState: withActiveCall,
    });

    await act(async () => {
      await result.current.initiateTransfer('+15559999999', 'warm');
    });

    // then complete
    mockFetch.mockImplementationOnce(() => jsonResponse({ success: true }));

    await act(async () => {
      await result.current.completeTransfer();
    });

    expect(result.current.transferState.status).toBe('completed');
    expect(result.current.transferState.conferenceSid).toBeNull();
  });

  it('should cancel warm transfer', async () => {
    mockFetch.mockImplementationOnce(() =>
      jsonResponse({
        transferCallSid: 'CA-transfer-4',
        conferenceSid: 'CF-4',
      }),
    );

    const { result } = renderHookWithRecoil(() => useCallTransfer(), {
      initializeState: withActiveCall,
    });

    await act(async () => {
      await result.current.initiateTransfer('+15559999999', 'warm');
    });

    mockFetch.mockImplementationOnce(() => jsonResponse({ success: true }));

    await act(async () => {
      await result.current.cancelTransfer();
    });

    expect(result.current.transferState.status).toBe('cancelled');
  });

  it('should toggle hold on', async () => {
    mockFetch.mockImplementationOnce(() => jsonResponse({ hold: true }));

    const { result } = renderHookWithRecoil(() => useCallTransfer(), {
      initializeState: withActiveCall,
    });

    await act(async () => {
      await result.current.toggleHold(true);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/v1/calls/CA-test-123/hold',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ hold: true }),
      }),
    );
    expect(result.current.holdError).toBeNull();
  });

  it('should set error on failed transfer', async () => {
    mockFetch.mockImplementationOnce(() => jsonResponse({}, false));

    const { result } = renderHookWithRecoil(() => useCallTransfer(), {
      initializeState: withActiveCall,
    });

    await act(async () => {
      await result.current.initiateTransfer('+15559999999', 'cold');
    });

    expect(result.current.transferState.status).toBe('failed');
    expect(result.current.transferState.error).toBe('Server error');
  });

  it('should set holdError on failed hold toggle', async () => {
    mockFetch.mockImplementationOnce(() => jsonResponse({}, false));

    const { result } = renderHookWithRecoil(() => useCallTransfer(), {
      initializeState: withActiveCall,
    });

    await act(async () => {
      await result.current.toggleHold(true);
    });

    expect(result.current.holdError).toBe('Server error');
  });

  it('should not initiate transfer without callSid', async () => {
    const { result } = renderHookWithRecoil(() => useCallTransfer());

    await act(async () => {
      await result.current.initiateTransfer('+15559999999', 'cold');
    });

    // should not have called fetch
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.transferState.status).toBe('idle');
  });
});
