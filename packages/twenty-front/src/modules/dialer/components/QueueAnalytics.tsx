import styled from '@emotion/styled';
import { useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import { IconDownload } from '@tabler/icons-react';

import { type CallOutcome } from '@/dialer/types/queue';
import { useQueueAnalytics } from '@/dialer/hooks/useQueueAnalytics';
import {
  activeQueueState,
  queueItemsState,
} from '@/dialer/states/queueState';
import { formatDurationHuman } from '@/dialer/utils/analyticsCalculator';

// region styled

const StyledGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: 0 ${({ theme }) => theme.spacing(3)};
`;

const StyledCard = styled.div`
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing(2)};
  background: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledCardValue = styled.span`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledCardLabel = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledOutcomeSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: 0 ${({ theme }) => theme.spacing(3)};
`;

const StyledOutcomeRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  font-size: 12px;
`;

const StyledOutcomeLabel = styled.span`
  width: 90px;
  color: ${({ theme }) => theme.font.color.secondary};
  text-transform: capitalize;
`;

const StyledOutcomeTrack = styled.div`
  flex: 1;
  height: 8px;
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: 4px;
  overflow: hidden;
`;

const StyledOutcomeFill = styled.div<{ width: number; color: string }>`
  height: 100%;
  width: ${({ width }) => width}%;
  background: ${({ color }) => color};
  border-radius: 4px;
  transition: width 300ms ease;
`;

const StyledOutcomeCount = styled.span`
  width: 24px;
  text-align: right;
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: 11px;
`;

const StyledSummary = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
  text-align: center;
`;

const StyledSummaryTitle = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledSummaryDetail = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledExportButton = styled.button`
  all: unset;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  &:hover {
    background: ${({ theme }) => theme.border.color.medium};
  }
`;

// endregion

const OUTCOME_COLORS: Record<CallOutcome, string> = {
  'connected': '#16a34a',
  'qualified': '#22c55e',
  'callback-requested': '#3b82f6',
  'voicemail': '#f59e0b',
  'busy': '#ef4444',
  'no-answer': '#6b7280',
  'not-interested': '#9ca3af',
  'wrong-number': '#dc2626',
  'dnc': '#991b1b',
};

const OUTCOME_LABELS: Record<CallOutcome, string> = {
  'connected': 'Connected',
  'no-answer': 'No Answer',
  'voicemail': 'Voicemail',
  'busy': 'Busy',
  'wrong-number': 'Wrong #',
  'callback-requested': 'Callback',
  'not-interested': 'Not Int.',
  'qualified': 'Qualified',
  'dnc': 'DNC',
};

// stat cards

const StatCards = () => {
  const { stats } = useQueueAnalytics();
  if (!stats) return null;

  const totalCalls = stats.answeredCount + stats.noAnswerCount +
    stats.busyCount + stats.voicemailCount;

  return (
    <StyledGrid>
      <StyledCard>
        <StyledCardValue>{totalCalls}</StyledCardValue>
        <StyledCardLabel>Calls Made</StyledCardLabel>
      </StyledCard>
      <StyledCard>
        <StyledCardValue>{stats.answerRatePercentage}%</StyledCardValue>
        <StyledCardLabel>Connect Rate</StyledCardLabel>
      </StyledCard>
      <StyledCard>
        <StyledCardValue>
          {formatDurationHuman(stats.avgCallDurationSeconds)}
        </StyledCardValue>
        <StyledCardLabel>Avg Duration</StyledCardLabel>
      </StyledCard>
      <StyledCard>
        <StyledCardValue>{stats.callsPerHour}</StyledCardValue>
        <StyledCardLabel>Calls/Hour</StyledCardLabel>
      </StyledCard>
    </StyledGrid>
  );
};

// outcome chart

const OutcomeChart = () => {
  const { outcomeBreakdown } = useQueueAnalytics();

  const entries = (Object.entries(outcomeBreakdown) as [CallOutcome, number][])
    .filter(([, count]) => count > 0);

  if (entries.length === 0) return null;

  const max = Math.max(...entries.map(([, c]) => c));

  return (
    <StyledOutcomeSection>
      {entries.map(([outcome, count]) => (
        <StyledOutcomeRow key={outcome}>
          <StyledOutcomeLabel>
            {OUTCOME_LABELS[outcome]}
          </StyledOutcomeLabel>
          <StyledOutcomeTrack>
            <StyledOutcomeFill
              width={max > 0 ? (count / max) * 100 : 0}
              color={OUTCOME_COLORS[outcome]}
            />
          </StyledOutcomeTrack>
          <StyledOutcomeCount>{count}</StyledOutcomeCount>
        </StyledOutcomeRow>
      ))}
    </StyledOutcomeSection>
  );
};

// session summary (shown when queue completed)

const QueueSessionSummary = () => {
  const queue = useRecoilValue(activeQueueState);
  const items = useRecoilValue(queueItemsState);
  const { stats } = useQueueAnalytics();

  const handleExport = useCallback(() => {
    const header = 'Name,Phone,Company,Outcome,Duration (s),Attempts,Notes\n';
    const rows = items.map((item) =>
      [
        item.contact.name ?? '',
        item.contact.phone,
        item.contact.company ?? '',
        item.callOutcome ?? '',
        item.callDurationSeconds ?? '',
        item.attempts,
        (item.notes ?? '').replace(/,/g, ';'),
      ].join(','),
    );
    const csv = header + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `queue-${queue?.id ?? 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [items, queue?.id]);

  if (queue?.status !== 'completed' || !stats) return null;

  const totalCalls = stats.answeredCount + stats.noAnswerCount +
    stats.busyCount + stats.voicemailCount;

  return (
    <StyledSummary>
      <StyledSummaryTitle>Queue Complete</StyledSummaryTitle>
      <StyledSummaryDetail>
        {totalCalls} calls · {stats.answerRatePercentage}% connected ·{' '}
        {formatDurationHuman(stats.totalTimeSeconds)} total
      </StyledSummaryDetail>
      <StyledExportButton onClick={handleExport}>
        <IconDownload size={14} />
        Export CSV
      </StyledExportButton>
    </StyledSummary>
  );
};

// main component

export const QueueAnalytics = () => {
  const queue = useRecoilValue(activeQueueState);
  if (!queue || queue.status === 'idle') return null;

  return (
    <>
      <StatCards />
      <OutcomeChart />
      {queue.status === 'completed' && <QueueSessionSummary />}
    </>
  );
};
