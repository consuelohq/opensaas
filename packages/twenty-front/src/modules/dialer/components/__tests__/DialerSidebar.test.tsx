import '@testing-library/jest-dom';
import { screen } from '@testing-library/react';
import { type MutableSnapshot } from 'recoil';

import { renderWithRecoil } from '@/dialer/testing/renderWithRecoil';
import { DialerSidebar } from '@/dialer/components/DialerSidebar';
import { dialerSidebarOpenState } from '@/dialer/states/dialerSidebarOpenState';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import { reconnectPromptState } from '@/dialer/states/reconnectPromptState';

// mock all child components to isolate sidebar logic
jest.mock('@/dialer/components/AudioDeviceSelector', () => ({
  AudioDeviceSelector: () => <div data-testid="audio-device-selector" />,
}));
jest.mock('@/dialer/components/CallButton', () => ({
  CallButton: () => <div data-testid="call-button" />,
}));
jest.mock('@/dialer/components/CoachingPanel', () => ({
  CoachingPanel: () => <div data-testid="coaching-panel" />,
}));
jest.mock('@/dialer/components/ContactHeader', () => ({
  ContactHeader: () => <div data-testid="contact-header" />,
}));
jest.mock('@/dialer/components/DialPad', () => ({
  DialPad: () => <div data-testid="dial-pad" />,
}));
jest.mock('@/dialer/components/FirstCallPrompt', () => ({
  FirstCallPrompt: () => <div data-testid="first-call-prompt" />,
}));
jest.mock('@/dialer/components/InCallControls', () => ({
  InCallControls: () => <div data-testid="in-call-controls" />,
}));
jest.mock('@/dialer/components/LiveTranscript', () => ({
  LiveTranscript: () => <div data-testid="live-transcript" />,
}));
jest.mock('@/dialer/components/LocalPresenceIndicator', () => ({
  LocalPresenceIndicator: () => <div data-testid="local-presence" />,
}));
jest.mock('@/dialer/components/PostCallSummary', () => ({
  PostCallSummary: () => <div data-testid="post-call-summary" />,
}));
jest.mock('@/dialer/components/QuickActions', () => ({
  QuickActions: () => <div data-testid="quick-actions" />,
}));
jest.mock('@/dialer/components/TwilioConfigStatus', () => ({
  TwilioConfigStatus: () => <div data-testid="twilio-config-status" />,
}));

// mock hooks
jest.mock('@/dialer/hooks/useAvailableCallerIds', () => ({
  useAvailableCallerIds: jest.fn(),
}));
jest.mock('@/dialer/hooks/useCallPersistence', () => ({
  useCallPersistence: jest.fn(),
}));
jest.mock('@/dialer/hooks/useTwilioConfigStatus', () => ({
  useTwilioConfigStatus: () => ({
    status: {
      configured: true,
      mode: 'hosted',
      twilioConnected: true,
      hasPhoneNumbers: true,
      twimlAppConfigured: true,
      error: null,
    },
    isLoading: false,
    error: null,
  }),
}));
jest.mock('@/dialer/hooks/useFirstCallFlow', () => ({
  useFirstCallFlow: () => ({ flowState: 'hidden' }),
}));
jest.mock('@/dialer/hooks/useCoaching', () => ({
  useCoaching: () => ({
    isLoading: false,
    talkingPoints: [],
    error: null,
    retry: jest.fn(),
  }),
}));
jest.mock('@/dialer/hooks/useTranscript', () => ({
  useTranscript: () => ({ transcript: [], isConnected: false }),
}));
jest.mock('@/dialer/hooks/usePostCallAnalysis', () => ({
  usePostCallAnalysis: () => ({
    analysis: null,
    isAnalyzing: false,
    error: null,
    retry: jest.fn(),
  }),
}));
jest.mock('@/dialer/hooks/useResetCoachingState', () => ({
  useResetCoachingState: jest.fn(),
}));
jest.mock('@/dialer/utils/callPersistence', () => ({
  clearPersistedCallState: jest.fn(),
}));

jest.mock('~/config', () => ({
  REACT_APP_SERVER_BASE_URL: 'http://localhost:3000',
}));

const defaultCallState = {
  status: 'idle' as const,
  callSid: null,
  duration: 0,
  startedAt: null,
  contact: null,
  callingMode: 'browser' as const,
  fromNumber: null,
  parallelGroupId: null,
  transferId: null,
};

describe('DialerSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with zero width when sidebar is closed', () => {
    renderWithRecoil(<DialerSidebar />);

    expect(screen.getByText('Dialer')).toBeInTheDocument();
  });

  it('should show dial pad and call button when idle and configured', () => {
    const openState = (snap: MutableSnapshot) => {
      snap.set(dialerSidebarOpenState, true);
    };

    renderWithRecoil(<DialerSidebar />, { initializeState: openState });

    expect(screen.getByTestId('dial-pad')).toBeInTheDocument();
    expect(screen.getByTestId('call-button')).toBeInTheDocument();
    expect(screen.getByTestId('contact-header')).toBeInTheDocument();
  });

  it('should show in-call controls when call is active', () => {
    const inCallState = (snap: MutableSnapshot) => {
      snap.set(dialerSidebarOpenState, true);
      snap.set(callStateAtom, {
        ...defaultCallState,
        status: 'active',
        callSid: 'CA-123',
      });
    };

    renderWithRecoil(<DialerSidebar />, { initializeState: inCallState });

    expect(screen.getByTestId('in-call-controls')).toBeInTheDocument();
    expect(screen.getByTestId('quick-actions')).toBeInTheDocument();
  });

  it('should not show in-call controls when idle', () => {
    const idleState = (snap: MutableSnapshot) => {
      snap.set(dialerSidebarOpenState, true);
    };

    renderWithRecoil(<DialerSidebar />, { initializeState: idleState });

    expect(screen.queryByTestId('in-call-controls')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quick-actions')).not.toBeInTheDocument();
  });

  it('should show reconnect banner when reconnect prompt is visible', () => {
    const reconnectState = (snap: MutableSnapshot) => {
      snap.set(dialerSidebarOpenState, true);
      snap.set(reconnectPromptState, {
        visible: true,
        conferenceName: 'conf-123',
        callSid: 'CA-123',
      });
    };

    renderWithRecoil(<DialerSidebar />, { initializeState: reconnectState });

    expect(
      screen.getByText('Active call detected. Reconnect?'),
    ).toBeInTheDocument();
    expect(screen.getByText('Reconnect')).toBeInTheDocument();
    expect(screen.getByText('Dismiss')).toBeInTheDocument();
  });

  it('should always show audio device selector in footer', () => {
    const openState = (snap: MutableSnapshot) => {
      snap.set(dialerSidebarOpenState, true);
    };

    renderWithRecoil(<DialerSidebar />, { initializeState: openState });

    expect(screen.getByTestId('audio-device-selector')).toBeInTheDocument();
  });
});
