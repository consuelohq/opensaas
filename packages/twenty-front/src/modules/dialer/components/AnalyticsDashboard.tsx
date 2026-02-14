import styled from '@emotion/styled';
import { useEffect, useState } from 'react';

import {
  useCallAnalytics,
  type AnalyticsPeriod,
} from '@/dialer/hooks/useCallAnalytics';

// region styled

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const StyledTitle = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledSelect = styled.select`
  background: ${({ theme }) => theme.background.tertiary};
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xs};
  padding: ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(1)};
  cursor: pointer;
`;

const StyledCards = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing(1.5)};
`;

const StyledCard = styled.div`
  background: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(2)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.5)};
`;

const StyledCardValue = styled.span`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledCardLabel = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledBars = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledBarRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.5)};
`;

const StyledBarLabel = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledBarTrack = styled.div`
  height: 6px;
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: 3px;
  overflow: hidden;
`;

const StyledBarFill = styled.div<{ width: number; color: string }>`
  height: 100%;
  width: ${({ width }) => width}%;
  background: ${({ color }) => color};
  border-radius: 3px;
`;

const StyledLoading = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  padding: ${({ theme }) => theme.spacing(2)} 0;
`;

// endregion

const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

const OUTCOME_COLORS: Record<string, string> = {
  answered: '#22c55e',
  voicemail: '#eab308',
  'no answer': '#ef4444',
};

const DEFAULT_COLOR = '#6b7280';

const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const AnalyticsDashboard = () => {
  const { metrics, loading, fetchMetrics } = useCallAnalytics();
  const [period, setPeriod] = useState<AnalyticsPeriod>('week');

  useEffect(() => {
    void fetchMetrics(period);
  }, [period, fetchMetrics]);

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPeriod(e.target.value as AnalyticsPeriod);
  };

  const outcomeTotal = metrics
    ? Object.values(metrics.outcomeDistribution).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <StyledContainer>
      <StyledHeader>
        <StyledTitle>📊 Call Analytics</StyledTitle>
        <StyledSelect value={period} onChange={handlePeriodChange}>
          {PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </StyledSelect>
      </StyledHeader>

      {loading && <StyledLoading>Loading metrics…</StyledLoading>}

      {!loading && !metrics && (
        <StyledLoading>No analytics data available</StyledLoading>
      )}

      {!loading && metrics && (
        <>
          <StyledCards>
            <StyledCard>
              <StyledCardValue>{metrics.totalCalls}</StyledCardValue>
              <StyledCardLabel>Total Calls</StyledCardLabel>
            </StyledCard>
            <StyledCard>
              <StyledCardValue>
                {Math.round(metrics.answerRate * 100)}%
              </StyledCardValue>
              <StyledCardLabel>Answer Rate</StyledCardLabel>
            </StyledCard>
            <StyledCard>
              <StyledCardValue>
                {formatDuration(metrics.avgDuration)}
              </StyledCardValue>
              <StyledCardLabel>Avg Duration</StyledCardLabel>
            </StyledCard>
            <StyledCard>
              <StyledCardValue>{metrics.callsToday}</StyledCardValue>
              <StyledCardLabel>Today</StyledCardLabel>
            </StyledCard>
          </StyledCards>

          {outcomeTotal > 0 && (
            <StyledBars>
              <StyledCardLabel>Outcome Distribution</StyledCardLabel>
              {Object.entries(metrics.outcomeDistribution).map(
                ([label, count]) => (
                  <StyledBarRow key={label}>
                    <StyledBarLabel>
                      <span>{label}</span>
                      <span>{count}</span>
                    </StyledBarLabel>
                    <StyledBarTrack>
                      <StyledBarFill
                        width={(count / outcomeTotal) * 100}
                        color={
                          OUTCOME_COLORS[label.toLowerCase()] ?? DEFAULT_COLOR
                        }
                      />
                    </StyledBarTrack>
                  </StyledBarRow>
                ),
              )}
            </StyledBars>
          )}
        </>
      )}
    </StyledContainer>
  );
};
