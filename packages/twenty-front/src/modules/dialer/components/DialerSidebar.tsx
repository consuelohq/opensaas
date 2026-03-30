import { AudioDeviceSelector } from '@/dialer/components/AudioDeviceSelector';
import { CallButton } from '@/dialer/components/CallButton';
import { CoachingPanel } from '@/dialer/components/CoachingPanel';
import { ContactHeader } from '@/dialer/components/ContactHeader';
import { DialPad } from '@/dialer/components/DialPad';
import { FirstCallPrompt } from '@/dialer/components/FirstCallPrompt';
import { InCallControls } from '@/dialer/components/InCallControls';
import { LiveTranscript } from '@/dialer/components/LiveTranscript';
import { LocalPresenceIndicator } from '@/dialer/components/LocalPresenceIndicator';
import { PostCallSummary } from '@/dialer/components/PostCallSummary';
import { QuickActions } from '@/dialer/components/QuickActions';
import { TwilioConfigStatus } from '@/dialer/components/TwilioConfigStatus';
import { useAvailableCallerIds } from '@/dialer/hooks/useAvailableCallerIds';
import { useCallPersistence } from '@/dialer/hooks/useCallPersistence';
import { useCoaching } from '@/dialer/hooks/useCoaching';
import { useFirstCallFlow } from '@/dialer/hooks/useFirstCallFlow';
import { usePostCallAnalysis } from '@/dialer/hooks/usePostCallAnalysis';
import { useResetCoachingState } from '@/dialer/hooks/useResetCoachingState';
import { useTranscript } from '@/dialer/hooks/useTranscript';
import { useTwilioConfigStatus } from '@/dialer/hooks/useTwilioConfigStatus';
import { dialerSidebarOpenState } from '@/dialer/states/dialerSidebarOpenState';
import { reconnectPromptState } from '@/dialer/states/reconnectPromptState';
import { clearPersistedCallState } from '@/dialer/utils/callPersistence';
import { PAGE_BAR_MIN_HEIGHT } from '@/ui/layout/page/constants/PageBarMinHeight';
import { RootStackingContextZIndices } from '@/ui/layout/constants/RootStackingContextZIndices';
import { useGlobalHotkeys } from '@/ui/utilities/hotkey/hooks/useGlobalHotkeys';
import styled from '@emotion/styled';
import { useRecoilValue, useSetRecoilState } from 'recoil';

const SIDEBAR_WIDTH = 380;

const StyledSidePanelWrapper = styled.div<{ isOpen: boolean }>`
  flex-shrink: 0;
  min-width: 0;
  overflow: hidden;
  width: ${({ isOpen }) => (isOpen ? `${SIDEBAR_WIDTH}px` : '0px')};
  transition: width ${({ theme }) => theme.animation.duration.normal}s;
`;

const StyledSidebar = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.background.primary};
  border-left: 1px solid ${({ theme }) => theme.border.color.medium};
  overflow-y: auto;
  position: relative;
  box-sizing: border-box;
  z-index: ${RootStackingContextZIndices.CommandMenu - 1};
`;

const StyledHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  justify-content: space-between;
  min-height: ${PAGE_BAR_MIN_HEIGHT}px;
  padding: ${({ theme }) => theme.spacing(3)} ${({ theme }) => theme.spacing(4)};
`;

const StyledTitle = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledBody = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(3)} ${({ theme }) => theme.spacing(4)};
`;

const StyledFooter = styled.div`
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(4)};
`;

const StyledReconnectBanner = styled.div`
  background: ${({ theme }) => theme.background.tertiary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
`;

const StyledReconnectText = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledReconnectButtons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledReconnectButton = styled.button`
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  cursor: pointer;
  flex: 1;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  transition: background 120ms;
`;

const StyledReconnectPrimary = styled(StyledReconnectButton)`
  background: ${({ theme }) => theme.color.green10};
  color: ${({ theme }) => theme.color.green1};

  &:hover {
    background: ${({ theme }) => theme.color.green11};
  }
`;

const StyledReconnectSecondary = styled(StyledReconnectButton)`
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  color: ${({ theme }) => theme.font.color.secondary};

  &:hover {
    background: ${({ theme }) => theme.background.tertiary};
  }
`;

export const DialerSidebar = () => {
  useAvailableCallerIds();
  useCallPersistence();
  const { status: configStatus } = useTwilioConfigStatus();
  const dialerSidebarOpen = useRecoilValue(dialerSidebarOpenState);
  const setDialerSidebarOpen = useSetRecoilState(dialerSidebarOpenState);
  const callStateAtom = useRecoilValue(callStateAtom);
  const reconnectPrompt = useRecoilValue(reconnectPromptState);
  const { flowState } = useFirstCallFlow();
  const setReconnectPrompt = useSetRecoilState(reconnectPromptState);
  const isInCall = callState.status !== 'idle';
  const isConfigured = configStatus?.configured ?? false;
  const {
    isLoading,
    talkingPoints,
    error: coachingError,
    retry: retryCoaching,
  } = useCoaching();
  const { transcript, isConnected } = useTranscript();
  const {
    analysis,
    isAnalyzing,
    error: analysisError,
    retry: retryAnalysis,
  } = usePostCallAnalysis();
  useResetCoachingState();

  // esc closes dialer sidebar when not in a call
  useGlobalHotkeys({
    keys: ['Escape'],
    callback: () => {
      if (dialerSidebarOpen && !isInCall) {
        setDialerSidebarOpen(false);
      }
    },
    containsModifier: false,
    dependencies: [dialerSidebarOpen, isInCall, setDialerSidebarOpen],
  });

  const handleReconnect = () => {
    // STUB: WebRTC reconnect not yet implemented (DEV-821)
    setReconnectPrompt(null);
  };

  const handleDismiss = () => {
    clearPersistedCallState();
    setReconnectPrompt(null);
  };

  return (
    <StyledSidePanelWrapper isOpen={dialerSidebarOpen}>
      <StyledSidebar>
        <StyledHeader>
          <StyledTitle>Dialer</StyledTitle>
        </StyledHeader>

        <StyledBody>
          {reconnectPrompt?.visible && (
            <StyledReconnectBanner>
              <StyledReconnectText>
                Active call detected. Reconnect?
              </StyledReconnectText>
              <StyledReconnectButtons>
                <StyledReconnectPrimary onClick={handleReconnect}>
                  Reconnect
                </StyledReconnectPrimary>
                <StyledReconnectSecondary onClick={handleDismiss}>
                  Dismiss
                </StyledReconnectSecondary>
              </StyledReconnectButtons>
            </StyledReconnectBanner>
          )}
          <TwilioConfigStatus />
          {isConfigured && flowState !== 'hidden' && (
            <FirstCallPrompt
              variant={flowState === 'congrats' ? 'congrats' : 'prompt'}
            />
          )}
          {isConfigured && (
            <>
              <ContactHeader />
              <LocalPresenceIndicator />
              <DialPad />
              <CallButton />
            </>
          )}
          {isInCall && <InCallControls />}
          {isInCall && <QuickActions />}
          <CoachingPanel
            isLoading={isLoading}
            talkingPoints={talkingPoints}
            callStatus={callState.status}
            error={coachingError}
            onRetry={retryCoaching}
          />
          {transcript.length > 0 && (
            <LiveTranscript transcript={transcript} isConnected={isConnected} />
          )}
          <PostCallSummary
            analysis={analysis}
            isAnalyzing={isAnalyzing}
            error={analysisError}
            onRetry={retryAnalysis}
          />
        </StyledBody>

        <StyledFooter>
          <AudioDeviceSelector compact />
        </StyledFooter>
      </StyledSidebar>
    </StyledSidePanelWrapper>
  );
};
