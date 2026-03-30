import styled from '@emotion/styled';
import { useCallback, useState } from 'react';
import {
  IconAlertTriangle,
  IconChevronDown,
  IconChevronUp,
  IconMinus,
  IconPlus,
  IconTargetArrow,
} from 'twenty-ui/display';
import { IconBulb, IconLoader2 } from '@tabler/icons-react';
import { useLingui } from '@lingui/react/macro';

import { type CallStatus } from '@/dialer/types/dialer';
import {
  COACHING_EMPTY_MESSAGES,
  type TalkingPoints,
} from '@/dialer/types/coaching';

const STORAGE_KEY = 'dialer_coaching_expanded';

interface CoachingPanelProps {
  isLoading: boolean;
  talkingPoints: TalkingPoints | null;
  callStatus: CallStatus;
  error: string | null;
  onRetry?: () => void;
}

// region styled

const StyledPanel = styled.div`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  overflow: hidden;
`;

const StyledHeader = styled.button`
  all: unset;
  box-sizing: border-box;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  background: ${({ theme }) => theme.background.secondary};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.background.tertiary};
  }
`;

const StyledHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledHeaderTitle = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledContent = styled.div`
  padding: ${({ theme }) => theme.spacing(3)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  max-height: 40vh;
  overflow-y: auto;
  aria-live: polite;
`;

const StyledBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  background: ${({ theme }) => theme.background.transparent.green};
  color: ${({ theme }) => theme.color.green};
`;

const StyledPointCard = styled.div`
  align-items: flex-start;
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)};
`;

const StyledNumber = styled.span`
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  background: ${({ theme }) => theme.color.green};
  color: ${({ theme }) => theme.font.color.inverted};
`;

const StyledPointText = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  line-height: 1.4;
`;

const StyledSectionToggle = styled.button`
  all: unset;
  box-sizing: border-box;
  width: 100%;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.secondary};

  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledQuestionList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: ${({ theme }) => theme.spacing(1)} 0 0;
  padding-left: ${({ theme }) => theme.spacing(4)};
`;

const StyledQuestionItem = styled.li`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  line-height: 1.4;
`;

const StyledObjectionCard = styled.div`
  padding: ${({ theme }) => theme.spacing(2)};
  background: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const StyledObjectionLabel = styled.span`
  font-size: 11px;
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.tertiary};
  text-transform: uppercase;
`;

const StyledObjectionText = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  line-height: 1.4;
`;

const StyledEmpty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(4)} 0;
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  text-align: center;
`;

const StyledSpinner = styled(IconLoader2)`
  animation: spin 1s linear infinite;
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const StyledRetryButton = styled.button`
  all: unset;
  box-sizing: border-box;
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(3)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.background.tertiary};
  }

  &:focus-visible {
    outline: 2px solid blue;
    outline-offset: 2px;
  }
`;

const StyledSkeleton = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledSkeletonBar = styled.div<{ width?: string; height?: string }>`
  width: ${({ width }) => width ?? '100%'};
  height: ${({ height }) => height ?? '20px'};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.tertiary};
  animation: pulse 1.5s ease-in-out infinite;
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
`;

// endregion

const LoadingSkeleton = () => (
  <StyledSkeleton>
    <StyledSkeletonBar width="120px" height="24px" />
    <StyledSkeletonBar height="56px" />
    <StyledSkeletonBar height="56px" />
    <StyledSkeletonBar height="56px" />
  </StyledSkeleton>
);

export const CoachingPanel = ({
  isLoading,
  talkingPoints,
  callStatus,
  error,
  onRetry,
}: CoachingPanelProps) => {
  const { t } = useLingui();
  const [isExpanded, setIsExpanded] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return true;
    }
  });
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [objectionsOpen, setObjectionsOpen] = useState(false);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // noop — DEV-723
      }
      return next;
    });
  }, []);

  const hasPoints = talkingPoints && talkingPoints.details.length > 0;
  const hasQuestions =
    talkingPoints &&
    talkingPoints.clarifying_questions &&
    talkingPoints.clarifying_questions.length > 0;
  const hasObjections =
    talkingPoints &&
    talkingPoints.objection_responses &&
    talkingPoints.objection_responses.length > 0;

  const renderContent = () => {
    if (isLoading) {
      return <LoadingSkeleton />;
    }

    // W8: show error state with retry button
    if (error) {
      return (
        <StyledEmpty>
          <IconAlertTriangle size={20} />
          <span>{error}</span>
          {onRetry && (
            <StyledRetryButton onClick={onRetry}>{t`Retry`}</StyledRetryButton>
          )}
        </StyledEmpty>
      );
    }

    if (!hasPoints) {
      const message = COACHING_EMPTY_MESSAGES[callStatus];
      const showSpinner = callStatus === 'active';

      return (
        <StyledEmpty>
          {showSpinner ? <StyledSpinner size={20} /> : <IconBulb size={20} />}
          <span>{message ? t(message) : t`No coaching available`}</span>
        </StyledEmpty>
      );
    }

    return (
      <>
        {talkingPoints.product_or_option_name && (
          <StyledBadge>{talkingPoints.product_or_option_name}</StyledBadge>
        )}

        {talkingPoints.details.map((point, index) => (
          <StyledPointCard key={index}>
            <StyledNumber>{index + 1}</StyledNumber>
            <StyledPointText>{point}</StyledPointText>
          </StyledPointCard>
        ))}

        {hasQuestions && (
          <div>
            <StyledSectionToggle
              onClick={() => setQuestionsOpen((prev) => !prev)}
              aria-expanded={questionsOpen}
            >
              {questionsOpen ? (
                <IconChevronUp size={14} />
              ) : (
                <IconChevronDown size={14} />
              )}
              {t`Clarifying Questions`} (
              {talkingPoints.clarifying_questions.length})
            </StyledSectionToggle>
            {questionsOpen && (
              <StyledQuestionList>
                {talkingPoints.clarifying_questions.map((q, i) => (
                  <StyledQuestionItem key={i}>{q}</StyledQuestionItem>
                ))}
              </StyledQuestionList>
            )}
          </div>
        )}

        {hasObjections && (
          <div>
            <StyledSectionToggle
              onClick={() => setObjectionsOpen((prev) => !prev)}
              aria-expanded={objectionsOpen}
            >
              {objectionsOpen ? (
                <IconChevronUp size={14} />
              ) : (
                <IconChevronDown size={14} />
              )}
              {t`Objection Handling`} (
              {talkingPoints.objection_responses.length})
            </StyledSectionToggle>
            {objectionsOpen &&
              talkingPoints.objection_responses.map((item, i) => (
                <StyledObjectionCard key={i}>
                  <StyledObjectionLabel>{t`Objection`}</StyledObjectionLabel>
                  <StyledObjectionText>{item.objection}</StyledObjectionText>
                  <StyledObjectionLabel>{t`Response`}</StyledObjectionLabel>
                  <StyledObjectionText>{item.response}</StyledObjectionText>
                </StyledObjectionCard>
              ))}
          </div>
        )}
      </>
    );
  };

  return (
    <StyledPanel>
      <StyledHeader onClick={toggleExpanded} aria-expanded={isExpanded}>
        <StyledHeaderLeft>
          <IconTargetArrow size={16} />
          <StyledHeaderTitle>{t`AI Coaching`}</StyledHeaderTitle>
        </StyledHeaderLeft>
        {isExpanded ? <IconMinus size={14} /> : <IconPlus size={14} />}
      </StyledHeader>
      {isExpanded && <StyledContent>{renderContent()}</StyledContent>}
    </StyledPanel>
  );
};
