import { CoachingPanel } from '@/dialer/components/CoachingPanel';
import { ContactHeader } from '@/dialer/components/ContactHeader';
import { InCallControls } from '@/dialer/components/InCallControls';
import { LiveTranscript } from '@/dialer/components/LiveTranscript';
import { PostCallSummary } from '@/dialer/components/PostCallSummary';
import { ScriptAssistPanel } from '@/dialer/components/ScriptAssistPanel';
import {
  analysisErrorState,
  coachingErrorState,
  coachingLoadingState,
  isAnalyzingState,
  postCallAnalysisState,
  talkingPointsState,
  transcriptConnectedState,
  transcriptState,
} from '@/dialer/states/coachingState';
import { callAssistModeState } from '@/dialer/states/callAssistModeState';
import { phoneNumberState } from '@/dialer/states/phoneNumberState';
import { selectedContactState } from '@/dialer/states/selectedContactState';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import styled from '@emotion/styled';
import { t } from '@lingui/core/macro';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { Button } from 'twenty-ui/input';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledMetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledBadge = styled.span`
  align-items: center;
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.rounded};
  color: ${({ theme }) => theme.font.color.secondary};
  display: inline-flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  padding: ${({ theme }) => `${theme.spacing(1)} ${theme.spacing(2)}`};
`;

const StyledMainGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(4)};
  grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.9fr);

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
`;

const StyledColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
`;

export const DialerHomeLivePanel = () => {
  const callState = useRecoilValue(callStateAtom);
  const callAssistMode = useRecoilValue(callAssistModeState);
  const talkingPoints = useRecoilValue(talkingPointsState);
  const coachingError = useRecoilValue(coachingErrorState);
  const coachingLoading = useRecoilValue(coachingLoadingState);
  const transcript = useRecoilValue(transcriptState);
  const transcriptConnected = useRecoilValue(transcriptConnectedState);
  const postCallAnalysis = useRecoilValue(postCallAnalysisState);
  const isAnalyzing = useRecoilValue(isAnalyzingState);
  const analysisError = useRecoilValue(analysisErrorState);

  const setCallState = useSetRecoilState(callStateAtom);
  const setPhoneNumber = useSetRecoilState(phoneNumberState);
  const setSelectedContact = useSetRecoilState(selectedContactState);
  const setTalkingPoints = useSetRecoilState(talkingPointsState);
  const setCoachingError = useSetRecoilState(coachingErrorState);
  const setTranscript = useSetRecoilState(transcriptState);
  const setTranscriptConnected = useSetRecoilState(transcriptConnectedState);
  const setAnalysis = useSetRecoilState(postCallAnalysisState);
  const setIsAnalyzing = useSetRecoilState(isAnalyzingState);
  const setAnalysisError = useSetRecoilState(analysisErrorState);

  const resetSession = () => {
    setCallState({
      status: 'idle',
      callSid: null,
      duration: 0,
      startedAt: null,
      contact: null,
      callingMode: 'browser',
      fromNumber: null,
      parallelGroupId: null,
      transferId: null,
    });
    setPhoneNumber('');
    setSelectedContact(null);
    setTalkingPoints(null);
    setCoachingError(null);
    setTranscript([]);
    setTranscriptConnected(false);
    setAnalysis(null);
    setIsAnalyzing(false);
    setAnalysisError(null);
  };

  return (
    <StyledContainer>
      <StyledMetaRow>
        <StyledBadge>{callState.status}</StyledBadge>
        <StyledBadge>
          {callAssistMode === 'script' ? t`Script mode` : t`AI coaching`}
        </StyledBadge>
        {callState.status === 'ended' && (
          <Button
            title={t`Start new call`}
            variant="secondary"
            onClick={resetSession}
          />
        )}
      </StyledMetaRow>

      <ContactHeader />

      <StyledMainGrid>
        <StyledColumn>
          {callAssistMode === 'script' ? (
            <ScriptAssistPanel />
          ) : (
            <CoachingPanel
              isLoading={coachingLoading}
              talkingPoints={talkingPoints}
              callStatus={callState.status}
              error={coachingError}
              onRetry={() => undefined}
            />
          )}

          <InCallControls />
        </StyledColumn>

        <StyledColumn>
          <LiveTranscript transcript={transcript} isConnected={transcriptConnected} />
          <PostCallSummary
            analysis={postCallAnalysis}
            isAnalyzing={isAnalyzing}
            error={analysisError}
            onRetry={() => undefined}
          />
        </StyledColumn>
      </StyledMainGrid>
    </StyledContainer>
  );
};
