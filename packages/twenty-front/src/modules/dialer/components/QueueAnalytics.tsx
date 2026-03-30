import styled from '@emotion/styled';
import { useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import { IconDownload } from 'twenty-ui/display';
import { useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';

import { type QueueOutcome } from '@/dialer/types/queue';
import { useQueueAnalytics } from '@/dialer/hooks/useQueueAnalytics';
import { activeQueueState, queueItemsState } from '@/dialer/states/queueState';
import { formatDurationHuman } from '@/dialer/utils/analyticsCalculator';

// region styled

const StyledGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: 0 ${({ theme }) => theme.spacing(3)};
`;

const StyledCard = styled.div`
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing(2)};
`;

const StyledCardValue = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledCardLabel = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: 11px;
`;

const StyledOutcomeSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: 0 ${({ theme }) => theme.spacing(3)};
`;

const StyledOutcomeRow = styled.div`
  align-items: center;
  display: flex;
  font-size: 12px;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledOutcomeLabel = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  text-transform: capitalize;
  width: 90px;
`;

const StyledOutcomeTrack = styled.div`
  flex: 1;
  height: 8px;
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: 4px;
  overflow: hidden;
`;

const StyledOutcomeFill = styled.div<{ width: number; colorKey: string }>`
  background: ${({ theme, colorKey }) => {
    switch (colorKey) {
      case 'green':
        return theme.color.green;
      case 'blue':
        return theme.color.blue;
      case 'yellow':
        return theme.color.yellow;
      case 'red':
        return theme.color.red;
      case 'darkred':
        return theme.color.red;
      default:
        return theme.color.gray;
    }
  }};
  border-radius: 4px;
  height: 100%;
  transition: width 300ms ease;
  width: ${({ width }) => width}%;
`;

const StyledOutcomeCount = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: 11px;
  text-align: right;
  width: 24px;
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
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledSummaryDetail = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: 12px;
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

const OUTCOME_COLOR_KEYS: Record<
  QueueOutcome,
  'green' | 'blue' | 'yellow' | 'red' | 'gray' | 'darkred'
> = {
  connected: 'green',
  qualified: 'green',
  'callback-requested': 'blue',
  voicemail: 'yellow',
  busy: 'red',
  'no-answer': 'gray',
  'not-interested': 'gray',
  'wrong-number': 'red',
  dnc: 'darkred',
};

const OUTCOME_LABELS: Record<QueueOutcome, ReturnType<typeof msg>> = {
  connected: msg`Connected`,
  'no-answer': msg`No Answer`,
  voicemail: msg`Voicemail`,
  busy: msg`Busy`,
  'wrong-number': msg`Wrong #`,
  'callback-requested': msg`Callback`,
  'not-interested': msg`Not Int.`,
  qualified: msg`Qualified`,
  dnc: msg`DNC`,
};

// stat cards

const StatCards = () => {
  const { t } = useLingui();
  const { stats } = useQueueAnalytics();
  if (!stats) return null;

  const totalCalls =
    stats.answeredCount +
    stats.noAnswerCount +
    stats.busyCount +
    stats.voicemailCount;

  return (
    <StyledGrid>
      <StyledCard>
        <StyledCardValue>{totalCalls}</StyledCardValue>
        <StyledCardLabel>{t`Calls Made`}</StyledCardLabel>
      </StyledCard>
      <StyledCard>
        <StyledCardValue>{stats.answerRatePercentage}%</StyledCardValue>
        <StyledCardLabel>{t`Connect Rate`}</StyledCardLabel>
      </StyledCard>
      <StyledCard>
        <StyledCardValue>
          {formatDurationHuman(stats.avgCallDurationSeconds)}
        </StyledCardValue>
        <StyledCardLabel>{t`Avg Duration`}</StyledCardLabel>
      </StyledCard>
      <StyledCard>
        <StyledCardValue>{stats.callsPerHour}</StyledCardValue>
        <StyledCardLabel>{t`Calls/Hour`}</StyledCardLabel>
      </StyledCard>
    </StyledGrid>
  );
};

// outcome chart

const OutcomeChart = () => {
  const { t } = useLingui();
  const { outcomeBreakdown } = useQueueAnalytics();

  const entries = (
    Object.entries(outcomeBreakdown) as [QueueOutcome, number][]
  ).filter(([, count]) => count > 0);

  if (entries.length === 0) return null;

  const max = Math.max(...entries.map(([, c]) => c));

  return (
    <StyledOutcomeSection>
      {entries.map(([outcome, count]) => (
        <StyledOutcomeRow key={outcome}>
          <StyledOutcomeLabel>{t(OUTCOME_LABELS[outcome])}</StyledOutcomeLabel>
          <StyledOutcomeTrack>
            <StyledOutcomeFill
              width={max > 0 ? (count / max) * 100 : 0}
              colorKey={OUTCOME_COLOR_KEYS[outcome]}
            />
          </StyledOutcomeTrack>
          <StyledOutcomeCount>{count}</StyledOutcomeCount>
        </StyledOutcomeRow>
      ))}
    </StyledOutcomeSection>
  );
};

// session summary (shown when activeQueue completed)

const QueueSessionSummary = () => {
  const { t } = useLingui();
  const activeQueue = useRecoilValue(activeQueueState);
  const queueItems = useRecoilValue(queueItemsState);
  const { stats } = useQueueAnalytics();

  const handleExport = useCallback(() => {
    const header = 'Name,Phone,Company,Outcome,Duration (s),Attempts,Notes\n';
    const rows = queueItems.map((item) =>
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
    a.download = `activeQueue-${activeQueue?.id ?? 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [queueItems, activeQueue?.id]);

  if (activeQueue?.status !== 'completed' || !stats) return null;

  const totalCalls =
    stats.answeredCount +
    stats.noAnswerCount +
    stats.busyCount +
    stats.voicemailCount;

  return (
    <StyledSummary>
      <StyledSummaryTitle>{t`Queue Complete`}</StyledSummaryTitle>
      <StyledSummaryDetail>
        {totalCalls} calls · {stats.answerRatePercentage}% connected ·{' '}
        {formatDurationHuman(stats.totalTimeSeconds)} total
      </StyledSummaryDetail>
      <StyledExportButton onClick={handleExport}>
        <IconDownload size={14} />
        {t`Export CSV`}
      </StyledExportButton>
    </StyledSummary>
  );
};

// main component

export const QueueAnalytics = () => {
  const activeQueue = useRecoilValue(activeQueueState);
  if (!activeQueue || activeQueue.status === 'idle') return null;

  return (
    <>
      <StatCards />
      <OutcomeChart />
      {activeQueue.status === 'completed' && <QueueSessionSummary />}
    </>
  );
};
