import '@testing-library/jest-dom';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { screen, fireEvent } from '@testing-library/react';
import type { Call } from '@twilio/voice-sdk';
import { type MutableSnapshot } from 'recoil';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

import { renderWithRecoil } from '@/dialer/testing/renderWithRecoil';
import { InCallControls } from '@/dialer/components/InCallControls';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import { activeCallState } from '@/dialer/states/activeCallState';
import { isMutedState } from '@/dialer/states/isMutedState';
import { messages } from '~/locales/generated/en';

i18n.load({
  [SOURCE_LOCALE]: messages,
});
i18n.activate(SOURCE_LOCALE);

// mock useCallTransfer
const mockInitiateTransfer = jest.fn();
const mockCompleteTransfer = jest.fn();
const mockCancelTransfer = jest.fn();
const mockToggleHold = jest.fn();
jest.mock('@/dialer/hooks/useCallTransfer', () => ({
  useCallTransfer: () => ({
    transferState: {
      status: 'idle',
      transferCallSid: null,
      conferenceSid: null,
      error: null,
    },
    holdError: null,
    initiateTransfer: mockInitiateTransfer,
    completeTransfer: mockCompleteTransfer,
    cancelTransfer: mockCancelTransfer,
    toggleHold: mockToggleHold,
  }),
}));

// mock useDialerHotkeys
jest.mock('@/dialer/hooks/useDialerHotkeys', () => ({
  useDialerHotkeys: jest.fn(),
}));

// mock useSnackBar
jest.mock('@/ui/feedback/snack-bar-manager/hooks/useSnackBar', () => ({
  useSnackBar: () => ({
    enqueueErrorSnackBar: jest.fn(),
    enqueueSnackBar: jest.fn(),
  }),
}));

// mock child components
jest.mock('@/dialer/components/DialPad', () => ({
  DialPad: () => <div data-testid="dial-pad">DialPad</div>,
}));

jest.mock('@/dialer/components/TransferModal', () => ({
  TransferModal: ({
    onTransfer,
    onClose,
  }: {
    onTransfer: (to: string, type: string) => void;
    onClose: () => void;
  }) => (
    <div data-testid="transfer-modal">
      <button onClick={() => onTransfer('+15559999999', 'cold')}>
        Transfer
      </button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

const mockMute = jest.fn();
const mockDisconnect = jest.fn();
const mockActiveCall = {
  mute: mockMute,
  disconnect: mockDisconnect,
  parameters: { CallSid: 'CA-test-123' },
};

const activeState = (snap: MutableSnapshot) => {
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

  snap.set(activeCallState, mockActiveCall as unknown as Call);
};

const renderInCallControls = (
  initializeState?: (snapshot: MutableSnapshot) => void,
) => {
  const controls = (
    <I18nProvider i18n={i18n}>
      <InCallControls />
    </I18nProvider>
  );

  return initializeState
    ? renderWithRecoil(controls, { initializeState })
    : renderWithRecoil(controls);
};

describe('InCallControls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when call status is idle', () => {
    const { container } = renderInCallControls();
    expect(container.firstChild).toBeNull();
  });

  it('should render control buttons when call is active', () => {
    renderInCallControls(activeState);

    expect(screen.getByLabelText('Mute')).toBeInTheDocument();
    expect(screen.getByLabelText('Hold')).toBeInTheDocument();
    expect(screen.getByLabelText('End call')).toBeInTheDocument();
    expect(screen.getByLabelText('Keypad')).toBeInTheDocument();
    expect(screen.getByLabelText('Transfer')).toBeInTheDocument();
  });

  it('should toggle mute when mute button is clicked', () => {
    renderInCallControls(activeState);

    fireEvent.click(screen.getByLabelText('Mute'));

    expect(mockMute).toHaveBeenCalledWith(true);
  });

  it('should disconnect call when end button is clicked', () => {
    renderInCallControls(activeState);

    fireEvent.click(screen.getByLabelText('End call'));

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('should show dial pad when keypad button is clicked', () => {
    renderInCallControls(activeState);

    expect(screen.queryByTestId('dial-pad')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Keypad'));

    expect(screen.getByTestId('dial-pad')).toBeInTheDocument();
  });

  it('should show transfer modal when transfer button is clicked', () => {
    renderInCallControls(activeState);

    expect(screen.queryByTestId('transfer-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Transfer'));

    expect(screen.getByTestId('transfer-modal')).toBeInTheDocument();
  });

  it('should render when call status is connecting', () => {
    const connectingState = (snap: MutableSnapshot) => {
      snap.set(callStateAtom, {
        status: 'connecting',
        callSid: null,
        duration: 0,
        startedAt: null,
        contact: null,
        callingMode: 'browser',
        fromNumber: null,
        parallelGroupId: null,
        transferId: null,
      });
    };

    renderInCallControls(connectingState);

    expect(screen.getByLabelText('End call')).toBeInTheDocument();
  });

  it('should show unmute label when already muted', () => {
    const mutedState = (snap: MutableSnapshot) => {
      activeState(snap);
      snap.set(isMutedState, true);
    };

    renderInCallControls(mutedState);

    expect(screen.getByLabelText('Unmute')).toBeInTheDocument();
  });
});
