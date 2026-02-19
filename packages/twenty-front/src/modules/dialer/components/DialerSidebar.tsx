import { AudioDeviceSelector } from '@/dialer/components/AudioDeviceSelector';
import { CallButton } from '@/dialer/components/CallButton';
import { CoachingPanel } from '@/dialer/components/CoachingPanel';
import { ContactHeader } from '@/dialer/components/ContactHeader';
import { DialPad } from '@/dialer/components/DialPad';
import { InCallControls } from '@/dialer/components/InCallControls';
import { LiveTranscript } from '@/dialer/components/LiveTranscript';
import { LocalPresenceIndicator } from '@/dialer/components/LocalPresenceIndicator';
import { PostCallSummary } from '@/dialer/components/PostCallSummary';
import { QuickActions } from '@/dialer/components/QuickActions';
import { useAvailableCallerIds } from '@/dialer/hooks/useAvailableCallerIds';
import { useCallPersistence } from '@/dialer/hooks/useCallPersistence';
import { useCoaching } from '@/dialer/hooks/useCoaching';
import { usePostCallAnalysis } from '@/dialer/hooks/usePostCallAnalysis';
import { useResetCoachingState } from '@/dialer/hooks/useResetCoachingState';
import { useTranscript } from '@/dialer/hooks/useTranscript';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import { dialerSidebarOpenState } from '@/dialer/states/dialerSidebarOpenState';
import { reconnectPromptState } from '@/dialer/states/reconnectPromptState';
import { clearPersistedCallState } from '@/dialer/utils/callPersistence';
import styled from '@emotion/styled';
import { useRecoilValue, useSetRecoilState } from 'recoil';

const SIDEBAR_WIDTH = 380;

const StyledSidebar = styled.div<{ isOpen: boolean }>`
  width: ${SIDEBAR_WIDTH}px;
  min-width: ${SIDEBAR_WIDTH}px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.background.primary};
  border-left: 1px solid ${({ theme }) => theme.border.color.medium};
  overflow-y: auto;
  transform: translateX(${({ isOpen }) => (isOpen ? '0' : '100%')});
  margin-right: ${({ isOpen }) => (isOpen ? '0' : `-${SIDEBAR_WIDTH}px`)};
  transition:
    transform 200ms ease-out,
    margin-right 200ms ease-out;
`;

const StyledHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  justify-content: space-between;
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
  const isOpen = useRecoilValue(dialerSidebarOpenState);
  const callState = useRecoilValue(callStateAtom);
  const reconnectPrompt = useRecoilValue(reconnectPromptState);
  const setReconnectPrompt = useSetRecoilState(reconnectPromptState);
  const isInCall = callState.status !== 'idle';
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

  const handleReconnect = () => {
    // STUB: WebRTC reconnect not yet implemented (DEV-821)
    setReconnectPrompt(null);
  };

  const handleDismiss = () => {
    clearPersistedCallState();
    setReconnectPrompt(null);
  };

  return (
    <StyledSidebar isOpen={isOpen}>
      <StyledHeader>
        <StyledTitle>Mercury</StyledTitle>
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
        <ContactHeader />
        <LocalPresenceIndicator />
        <DialPad />
        <CallButton />
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
  );
};
