import { CoachingPanel } from '@/dialer/components/CoachingPanel';
import { ContactHeader } from '@/dialer/components/ContactHeader';
import { InCallControls } from '@/dialer/components/InCallControls';
import { ScriptAssistPanel } from '@/dialer/components/ScriptAssistPanel';
import { callAssistModeState } from '@/dialer/states/callAssistModeState';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import {
  coachingErrorState,
  coachingLoadingState,
  talkingPointsState,
} from '@/dialer/states/coachingState';
import styled from '@emotion/styled';
import { t } from '@lingui/core/macro';
import { useRecoilValue } from 'recoil';

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

export const OpportunityCallCoachingTab = () => {
  const callState = useRecoilValue(callStateAtom);
  const assistMode = useRecoilValue(callAssistModeState);
  const talkingPoints = useRecoilValue(talkingPointsState);
  const coachingError = useRecoilValue(coachingErrorState);
  const coachingLoading = useRecoilValue(coachingLoadingState);

  return (
    <StyledContainer>
      <StyledMetaRow>
        <StyledBadge>{callState.status}</StyledBadge>
        <StyledBadge>
          {assistMode === 'script' ? t`Script mode` : t`AI coaching`}
        </StyledBadge>
      </StyledMetaRow>

      <ContactHeader />

      {assistMode === 'script' ? (
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
    </StyledContainer>
  );
};
