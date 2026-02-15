import { AudioDeviceSelector } from '@/dialer/components/AudioDeviceSelector';
import { CallButton } from '@/dialer/components/CallButton';
import { CallingModeToggle } from '@/dialer/components/CallingModeToggle';
import { CoachingPanel } from '@/dialer/components/CoachingPanel';
import { ContactHeader } from '@/dialer/components/ContactHeader';
import { DialPad } from '@/dialer/components/DialPad';
import { InCallControls } from '@/dialer/components/InCallControls';
import { LiveTranscript } from '@/dialer/components/LiveTranscript';
import { LocalPresenceIndicator } from '@/dialer/components/LocalPresenceIndicator';
import { PostCallSummary } from '@/dialer/components/PostCallSummary';
import { QuickActions } from '@/dialer/components/QuickActions';
import { useCoaching } from '@/dialer/hooks/useCoaching';
import { usePostCallAnalysis } from '@/dialer/hooks/usePostCallAnalysis';
import { useResetCoachingState } from '@/dialer/hooks/useResetCoachingState';
import { useTranscript } from '@/dialer/hooks/useTranscript';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import { dialerSidebarOpenState } from '@/dialer/states/dialerSidebarOpenState';
import styled from '@emotion/styled';
import { useRecoilValue } from 'recoil';

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
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(3)} ${({ theme }) => theme.spacing(4)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledTitle = styled.span`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)} ${({ theme }) => theme.spacing(4)};
  flex: 1;
  overflow-y: auto;
`;

const StyledFooter = styled.div`
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(4)};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
`;

export const DialerSidebar = () => {
  const isOpen = useRecoilValue(dialerSidebarOpenState);
  const callState = useRecoilValue(callStateAtom);
  const isInCall = callState.status !== 'idle';
  const { isLoading, talkingPoints, error: coachingError, retry: retryCoaching } = useCoaching();
  const { transcript, isConnected } = useTranscript();
  const { analysis, isAnalyzing, error: analysisError, retry: retryAnalysis } = usePostCallAnalysis();
  useResetCoachingState();

  return (
    <StyledSidebar isOpen={isOpen}>
      <StyledHeader>
        <StyledTitle>Dialer</StyledTitle>
        <CallingModeToggle />
      </StyledHeader>

      <StyledBody>
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
        {isInCall && (
          <LiveTranscript
            transcript={transcript}
            isConnected={isConnected}
          />
        )}
        <PostCallSummary analysis={analysis} isAnalyzing={isAnalyzing} error={analysisError} onRetry={retryAnalysis} />
      </StyledBody>

      <StyledFooter>
        <AudioDeviceSelector compact />
      </StyledFooter>
    </StyledSidebar>
  );
};
