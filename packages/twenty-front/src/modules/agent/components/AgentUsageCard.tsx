import styled from '@emotion/styled';

import { useAgentUsage } from '@/agent/hooks/useAgentUsage';

// plan limits — will come from workspace config eventually
const PLAN_LIMITS: Record<string, number> = {
  'agent.llm.tokens': 1_000_000,
  'agent.sandbox.executions': 5_000,
  'agent.conversations': 10_000,
};

const METER_LABELS: Record<string, string> = {
  'agent.llm.tokens': 'LLM Tokens',
  'agent.sandbox.executions': 'Sandbox Runs',
  'agent.conversations': 'Conversations',
};

const StyledCard = styled.div`
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  padding: ${({ theme }) => theme.spacing(4)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledTitle = styled.h3`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  margin: 0;
`;

const StyledMeterRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledMeterHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const StyledMeterLabel = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledMeterValue = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledBarBackground = styled.div`
  height: 8px;
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: 4px;
  overflow: hidden;
`;

const StyledBarFill = styled.div<{ percentage: number; isHigh: boolean }>`
  height: 100%;
  width: ${({ percentage }) => Math.min(percentage, 100)}%;
  background: ${({ isHigh, theme }) =>
    isHigh ? theme.color.red : theme.color.blue};
  border-radius: 4px;
  transition: width 0.3s ease;
`;

const StyledPeriod = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
`;

const StyledLoadingText = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const formatNumber = (value: number): string => {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return value.toString();
};

export const AgentUsageCard = () => {
  const { summary, isLoading } = useAgentUsage();

  if (isLoading) {
    return (
      <StyledCard>
        <StyledTitle>Usage</StyledTitle>
        <StyledLoadingText>Loading usage data...</StyledLoadingText>
      </StyledCard>
    );
  }

  if (!summary) {
    return (
      <StyledCard>
        <StyledTitle>Usage</StyledTitle>
        <StyledLoadingText>No usage data available</StyledLoadingText>
      </StyledCard>
    );
  }

  const meterEntries = Object.entries(summary.meters) as [string, number][];

  return (
    <StyledCard>
      <StyledTitle>Usage</StyledTitle>
      {meterEntries.map(([meter, value]) => {
        const limit = PLAN_LIMITS[meter] ?? 0;
        const percentage = limit > 0 ? (value / limit) * 100 : 0;
        const label = METER_LABELS[meter] ?? meter;

        return (
          <StyledMeterRow key={meter}>
            <StyledMeterHeader>
              <StyledMeterLabel>{label}</StyledMeterLabel>
              <StyledMeterValue>
                {formatNumber(value)} / {formatNumber(limit)}
              </StyledMeterValue>
            </StyledMeterHeader>
            <StyledBarBackground>
              <StyledBarFill percentage={percentage} isHigh={percentage > 80} />
            </StyledBarBackground>
          </StyledMeterRow>
        );
      })}
      <StyledPeriod>
        {new Date(summary.periodStart).toLocaleDateString()} —{' '}
        {new Date(summary.periodEnd).toLocaleDateString()}
      </StyledPeriod>
    </StyledCard>
  );
};
