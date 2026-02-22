import styled from '@emotion/styled';
import { useState } from 'react';

type AutomationRun = {
  id: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  triggerPayload: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
};

type AutomationHistoryTableProps = {
  runs: AutomationRun[];
  isLoading: boolean;
};

const STATUS_COLORS: Record<string, string> = {
  success: '#16a34a',
  failure: '#dc2626',
  running: '#2563eb',
  pending: '#6b7280',
  skipped: '#ca8a04',
};

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  max-height: 400px;
  overflow-y: auto;
`;

const StyledRow = styled.div<{ isExpanded: boolean }>`
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.background.transparent.lighter};
  }
`;

const StyledRowContent = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(1.5)} ${({ theme }) => theme.spacing(2)};
`;

const StyledBadge = styled.span<{ color: string }>`
  background: ${({ color }) => color}20;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ color }) => color};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  padding: 2px 8px;
`;

const StyledCell = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  min-width: 0;
`;

const StyledTriggerCell = styled(StyledCell)`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledExpandedContent = styled.div`
  background: ${({ theme }) => theme.background.transparent.lighter};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => theme.spacing(2)};
`;

const StyledPre = styled.pre`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  font-family: monospace;
  font-size: ${({ theme }) => theme.font.size.xs};
  margin: ${({ theme }) => theme.spacing(1)} 0 0;
  max-height: 200px;
  overflow: auto;
  padding: ${({ theme }) => theme.spacing(1.5)};
  white-space: pre-wrap;
  word-break: break-all;
`;

const StyledLabel = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledEmpty = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => theme.spacing(4)};
  text-align: center;
`;

const formatDuration = (ms: number | null): string => {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);

  if (seconds < 60) return `${seconds}s`;

  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

const formatTime = (dateString: string | null): string => {
  if (!dateString) return '—';

  return new Date(dateString).toLocaleString();
};

const triggerSummary = (
  payload: Record<string, unknown> | null,
): string => {
  if (!payload) return '—';
  const type = payload.type;

  if (typeof type === 'string') return type;

  return Object.keys(payload).join(', ') || '—';
};

export const AutomationHistoryTable = ({
  runs,
  isLoading,
}: AutomationHistoryTableProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleRowClick = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (isLoading && runs.length === 0) {
    return <StyledEmpty>Loading…</StyledEmpty>;
  }

  if (runs.length === 0) {
    return <StyledEmpty>No runs yet</StyledEmpty>;
  }

  return (
    <StyledContainer>
      {runs.map((run) => {
        const isExpanded = expandedId === run.id;

        return (
          <StyledRow
            key={run.id}
            isExpanded={isExpanded}
            onClick={() => handleRowClick(run.id)}
          >
            <StyledRowContent>
              <StyledBadge color={STATUS_COLORS[run.status] ?? '#6b7280'}>
                {run.status}
              </StyledBadge>
              <StyledCell>{formatTime(run.startedAt)}</StyledCell>
              <StyledCell>{formatDuration(run.durationMs)}</StyledCell>
              <StyledTriggerCell>
                {triggerSummary(run.triggerPayload)}
              </StyledTriggerCell>
            </StyledRowContent>
            {isExpanded && (
              <StyledExpandedContent>
                {run.error && (
                  <>
                    <StyledLabel>Error</StyledLabel>
                    <StyledPre>{run.error}</StyledPre>
                  </>
                )}
                {run.result && (
                  <>
                    <StyledLabel>Result</StyledLabel>
                    <StyledPre>
                      {JSON.stringify(run.result, null, 2)}
                    </StyledPre>
                  </>
                )}
                {!run.error && !run.result && (
                  <StyledLabel>No details available</StyledLabel>
                )}
              </StyledExpandedContent>
            )}
          </StyledRow>
        );
      })}
    </StyledContainer>
  );
};
