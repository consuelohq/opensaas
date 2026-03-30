import { renderHookWithRecoil } from '@/dialer/testing/renderWithRecoil';
import { useDialerHotkeys } from '@/dialer/hooks/useDialerHotkeys';

// mock useGlobalHotkeys — capture all registrations
const mockUseGlobalHotkeys = jest.fn();
jest.mock('@/ui/utilities/hotkey/hooks/useGlobalHotkeys', () => ({
  useGlobalHotkeys: (...args: unknown[]) => mockUseGlobalHotkeys(...args),
}));

describe('useDialerHotkeys', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should register all 7 hotkey bindings', () => {
    const callbacks = {
      onToggleSidebar: jest.fn(),
      onMuteToggle: jest.fn(),
      onHoldToggle: jest.fn(),
      onTransferToggle: jest.fn(),
      onEndCall: jest.fn(),
      onCallSelectedContact: jest.fn(),
      onToggleCallingMode: jest.fn(),
    };

    renderHookWithRecoil(() => useDialerHotkeys(callbacks));

    expect(mockUseGlobalHotkeys).toHaveBeenCalledTimes(7);
  });

  it('should register mod+d for sidebar toggle', () => {
    renderHookWithRecoil(() =>
      useDialerHotkeys({ onToggleSidebar: jest.fn() }),
    );

    const sidebarCall = mockUseGlobalHotkeys.mock.calls.find((c: unknown[]) => {
      const arg = c[0] as { keys: string[] };
      return arg.keys.includes('mod+d');
    });
    expect(sidebarCall).toBeDefined();
    expect(sidebarCall[0].containsModifier).toBe(true);
  });

  it('should register m for mute toggle', () => {
    renderHookWithRecoil(() => useDialerHotkeys({ onMuteToggle: jest.fn() }));

    const muteCall = mockUseGlobalHotkeys.mock.calls.find((c: unknown[]) => {
      const arg = c[0] as { keys: string[] };
      return arg.keys.includes('m');
    });
    expect(muteCall).toBeDefined();
    expect(muteCall[0].containsModifier).toBe(false);
  });

  it('should register Escape for end call', () => {
    renderHookWithRecoil(() => useDialerHotkeys({ onEndCall: jest.fn() }));

    const escCall = mockUseGlobalHotkeys.mock.calls.find((c: unknown[]) => {
      const arg = c[0] as { keys: string[] };
      return arg.keys.includes('Escape');
    });
    expect(escCall).toBeDefined();
  });

  it('should invoke callback when hotkey fires', () => {
    const onMuteToggle = jest.fn();
    renderHookWithRecoil(() => useDialerHotkeys({ onMuteToggle }));

    const muteCall = mockUseGlobalHotkeys.mock.calls.find((c: unknown[]) => {
      const arg = c[0] as { keys: string[] };
      return arg.keys.includes('m');
    });

    // invoke the registered callback
    muteCall[0].callback();
    expect(onMuteToggle).toHaveBeenCalledTimes(1);
  });

  it('should not throw when callback is undefined', () => {
    renderHookWithRecoil(() => useDialerHotkeys({}));

    // all callbacks are optional — invoking should not throw
    for (const call of mockUseGlobalHotkeys.mock.calls) {
      expect(() => call[0].callback()).not.toThrow();
    }
  });

  it('should register mod+shift+c for call selected contact', () => {
    renderHookWithRecoil(() =>
      useDialerHotkeys({ onCallSelectedContact: jest.fn() }),
    );

    const callContact = mockUseGlobalHotkeys.mock.calls.find((c: unknown[]) => {
      const arg = c[0] as { keys: string[] };
      return arg.keys.includes('mod+shift+c');
    });
    expect(callContact).toBeDefined();
    expect(callContact[0].containsModifier).toBe(true);
  });
});
