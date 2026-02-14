import styled from '@emotion/styled';
import { useCallback, useState } from 'react';
import {
  IconChartBar,
  IconChevronDown,
  IconChevronUp,
  IconLoader2,
  IconMinus,
  IconPlus,
} from '@tabler/icons-react';

import { type CallAnalytics, type MomentType } from '@/dialer/types/coaching';

const STORAGE_KEY = 'dialer_postcall_expanded';

interface PostCallSummaryProps {
  analysis: CallAnalytics | null;
  isAnalyzing: boolean;
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
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledContent = styled.div`
  padding: ${({ theme }) => theme.spacing(3)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  max-height: 40vh;
  overflow-y: auto;
`;

const StyledMetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(3)};
  flex-wrap: wrap;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledScoreBadge = styled.span<{ score: number }>`
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: ${({ score }) =>
    score >= 70 ? '#dcfce7' : score >= 40 ? '#fef9c3' : '#fee2e2'};
  color: ${({ score }) =>
    score >= 70 ? '#16a34a' : score >= 40 ? '#a16207' : '#dc2626'};
`;

const StyledSummaryText = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  line-height: 1.5;
`;

const StyledSectionLabel = styled.button`
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

const StyledMomentItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(1)} 0;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  line-height: 1.4;
`;

const StyledMomentIcon = styled.span`
  flex-shrink: 0;
`;

const StyledNextStepList = styled.ul`
  margin: 0;
  padding-left: ${({ theme }) => theme.spacing(4)};
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const StyledNextStepItem = styled.li`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  line-height: 1.4;
`;

const StyledSpinner = styled(IconLoader2)`
  animation: spin 1s linear infinite;
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
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

// endregion

const MOMENT_ICONS: Record<MomentType, string> = {
  interest: '💡',
  objection: '⚠️',
  commitment: '✅',
  question: '❓',
  concern: '😟',
};

const SENTIMENT_EMOJI: Record<string, string> = {
  positive: '😊',
  neutral: '😐',
  negative: '😞',
};

const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const PostCallSummary = ({
  analysis,
  isAnalyzing,
}: PostCallSummaryProps) => {
  const [isExpanded, setIsExpanded] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  const [momentsOpen, setMomentsOpen] = useState(false);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // noop
      }
      return next;
    });
  }, []);

  const renderContent = () => {
    if (isAnalyzing) {
      return (
        <StyledEmpty>
          <StyledSpinner size={20} />
          <span>Analyzing call...</span>
        </StyledEmpty>
      );
    }

    if (!analysis) return null;

    return (
      <>
        <StyledMetaRow>
          <span>Duration: {formatDuration(analysis.duration)}</span>
          <span>•</span>
          <span>
            Score: <StyledScoreBadge score={analysis.performanceScore}>{analysis.performanceScore}/100</StyledScoreBadge>
          </span>
          <span>•</span>
          <span>
            {SENTIMENT_EMOJI[analysis.sentiment.overall] ?? '😐'}{' '}
            {analysis.sentiment.overall} ({analysis.sentiment.trajectory})
          </span>
        </StyledMetaRow>

        <StyledSummaryText>{analysis.summary}</StyledSummaryText>

        {analysis.keyMoments.length > 0 && (
          <div>
            <StyledSectionLabel
              onClick={() => setMomentsOpen((prev) => !prev)}
              aria-expanded={momentsOpen}
            >
              {momentsOpen ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
              Key Moments ({analysis.keyMoments.length})
            </StyledSectionLabel>
            {momentsOpen &&
              analysis.keyMoments.map((moment, i) => (
                <StyledMomentItem key={i}>
                  <StyledMomentIcon>{MOMENT_ICONS[moment.type] ?? '•'}</StyledMomentIcon>
                  <span>{moment.text}</span>
                </StyledMomentItem>
              ))}
          </div>
        )}

        {analysis.nextSteps.length > 0 && (
          <div>
            <StyledSectionLabel as="span" style={{ cursor: 'default' }}>
              Next Steps
            </StyledSectionLabel>
            <StyledNextStepList>
              {analysis.nextSteps.map((step, i) => (
                <StyledNextStepItem key={i}>{step}</StyledNextStepItem>
              ))}
            </StyledNextStepList>
          </div>
        )}
      </>
    );
  };

  // only render when there's something to show
  if (!isAnalyzing && !analysis) return null;

  return (
    <StyledPanel>
      <StyledHeader onClick={toggleExpanded} aria-expanded={isExpanded}>
        <StyledHeaderLeft>
          <IconChartBar size={16} />
          <StyledHeaderTitle>Call Summary</StyledHeaderTitle>
        </StyledHeaderLeft>
        {isExpanded ? <IconMinus size={14} /> : <IconPlus size={14} />}
      </StyledHeader>
      {isExpanded && <StyledContent>{renderContent()}</StyledContent>}
    </StyledPanel>
  );
};
