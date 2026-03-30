import { LiveTranscript } from '@/dialer/components/LiveTranscript';
import { PostCallSummary } from '@/dialer/components/PostCallSummary';
import { QueueAnalytics } from '@/dialer/components/QueueAnalytics';
import { RecordingPlayer } from '@/dialer/components/RecordingPlayer';
import { type OpportunityWrapUpState } from '@/dialer/hooks/useOpportunityQueueWorkspace';
import {
  analysisErrorState,
  isAnalyzingState,
  postCallAnalysisState,
  transcriptConnectedState,
  transcriptState,
} from '@/dialer/states/coachingState';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import styled from '@emotion/styled';
import { t } from '@lingui/core/macro';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { Button } from 'twenty-ui/input';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledRecordingCard = styled.div`
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: 1.5;
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledWrapUpCard = styled.div`
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledWrapUpTitle = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledDispositionGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledFooterActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

type OpportunityCallAnalyticsTabProps = {
  wrapUpState: OpportunityWrapUpState | null;
  onContinueList: (disposition: string) => void;
  onEndList: (disposition: string) => void;
};

const getAnsweredDispositions = () =>
  [
    { value: 'connected', label: t`Connected` },
    { value: 'follow-up', label: t`Follow up` },
    { value: 'not-interested', label: t`Not interested` },
    { value: 'voicemail', label: t`Voicemail` },
    { value: 'busy', label: t`Busy` },
    { value: 'no-answer', label: t`No answer` },
  ] as const;

export const OpportunityCallAnalyticsTab = ({
  wrapUpState,
  onContinueList,
  onEndList,
}: OpportunityCallAnalyticsTabProps) => {
  const transcript = useRecoilValue(transcriptState);
  const transcriptConnected = useRecoilValue(transcriptConnectedState);
  const postCallAnalysis = useRecoilValue(postCallAnalysisState);
  const isAnalyzing = useRecoilValue(isAnalyzingState);
  const analysisError = useRecoilValue(analysisErrorState);
  const callState = useRecoilValue(callStateAtom);
  const [selectedDisposition, setSelectedDisposition] = useState('connected');
  const answeredDispositions = getAnsweredDispositions();

  useEffect(() => {
    setSelectedDisposition('connected');
  }, [wrapUpState?.listMemberId]);

  return (
    <StyledContainer>
      {wrapUpState && (
        <StyledWrapUpCard>
          <StyledWrapUpTitle>{t`Wrap up this call`}</StyledWrapUpTitle>

          {wrapUpState.outcome === 'answered' ? (
            <>
              <StyledDispositionGrid>
                {answeredDispositions.map((disposition) => (
                  <Button
                    key={disposition.value}
                    title={disposition.label}
                    variant={
                      selectedDisposition === disposition.value
                        ? 'primary'
                        : 'secondary'
                    }
                    onClick={() => setSelectedDisposition(disposition.value)}
                  />
                ))}
              </StyledDispositionGrid>

              <StyledFooterActions>
                <Button
                  title={t`Continue list`}
                  onClick={() => onContinueList(selectedDisposition)}
                />
                <Button
                  title={t`End list`}
                  variant="secondary"
                  onClick={() => onEndList(selectedDisposition)}
                />
              </StyledFooterActions>
            </>
          ) : (
            <StyledRecordingCard>
              {t`No answer detected. The next call is being prepared automatically.`}
            </StyledRecordingCard>
          )}
        </StyledWrapUpCard>
      )}

      <QueueAnalytics />

      <PostCallSummary
        analysis={postCallAnalysis}
        isAnalyzing={isAnalyzing}
        error={analysisError}
      />

      <LiveTranscript transcript={transcript} isConnected={transcriptConnected} />

      <StyledRecordingCard>
        {callState.callSid ? (
          <RecordingPlayer
            callId={callState.callSid}
            duration={callState.duration}
          />
        ) : (
          t`Recording playback will appear here when a recording is available.`
        )}
      </StyledRecordingCard>
    </StyledContainer>
  );
};
