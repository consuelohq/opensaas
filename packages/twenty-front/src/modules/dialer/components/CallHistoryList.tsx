import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useSetRecoilState } from 'recoil';
// eslint-disable-next-line no-restricted-imports -- twenty-ui module resolution broken (DEV-788)
import {
  IconFileText,
  IconHistory,
  IconLoader2,
  IconPhone,
  IconPlayerPlay,
  IconRefresh,
} from '@tabler/icons-react';

import { useCallHistory } from '@/dialer/hooks/useCallHistory';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import {
  type CallHistoryItem,
  type HistoryCallOutcome,
} from '@/dialer/types/history';
import { formatDuration } from '@/dialer/utils/callDuration';
import { formatPhone } from '@/dialer/utils/phoneFormat';

/* eslint-disable twenty/no-hardcoded-colors, lingui/no-unlocalized-strings */
const OUTCOME_COLORS: Record<string, string> = {
  connected: '#22c55e',
  interested: '#22c55e',
  voicemail: '#eab308',
  'no-answer': '#f97316',
  no_answer: '#f97316',
  busy: '#f97316',
  'wrong-number': '#ef4444',
  wrong_number: '#ef4444',
  dnc: '#ef4444',
  not_interested: '#6b7280',
  'not-interested': '#6b7280',
  callback_scheduled: '#3b82f6',
  'callback-requested': '#3b82f6',
  qualified: '#22c55e',
  other: '#6b7280',
};

const OUTCOME_LABELS: Record<string, string> = {
  connected: 'Answered',
  interested: 'Interested',
  voicemail: 'Voicemail',
  'no-answer': 'No Answer',
  no_answer: 'No Answer',
  busy: 'Busy',
  'wrong-number': 'Wrong Number',
  wrong_number: 'Wrong Number',
  dnc: 'DNC',
  not_interested: 'Not Interested',
  'not-interested': 'Not Interested',
  callback_scheduled: 'Callback',
  'callback-requested': 'Callback',
  qualified: 'Qualified',
  other: 'Other',
};

const DEFAULT_OUTCOME_COLOR = '#6b7280';
/* eslint-enable twenty/no-hardcoded-colors, lingui/no-unlocalized-strings */

const getOutcomeColor = (outcome: HistoryCallOutcome | null): string =>
  OUTCOME_COLORS[outcome ?? ''] ?? DEFAULT_OUTCOME_COLOR;

const getOutcomeLabel = (outcome: HistoryCallOutcome | null): string =>
  OUTCOME_LABELS[outcome ?? ''] ?? outcome ?? 'Unknown';

// date grouping helpers
const getDateLabel = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const callDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor(
    (today.getTime() - callDay.getTime()) / 86_400_000,
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  });
};

const formatTime = (dateString: string): string =>
  new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    hour12: true,
    minute: '2-digit',
  });

const groupByDate = (
  calls: CallHistoryItem[],
): Array<{ label: string; items: CallHistoryItem[] }> => {
  const groups = new Map<string, CallHistoryItem[]>();
  for (const call of calls) {
    const label = getDateLabel(call.startTime);
    const existing = groups.get(label);
    if (existing !== undefined) {
      existing.push(call);
    } else {
      groups.set(label, [call]);
    }
  }
  return Array.from(groups, ([label, items]) => ({ label, items }));
};

// region styled

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
`;

const StyledGroupHeader = styled.div`
  background: ${({ theme }) => theme.background.secondary};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: 11px;
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  letter-spacing: 0.5px;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  position: sticky;
  text-transform: uppercase;
  top: 0;
  z-index: 1;
`;

const StyledCallRow = styled.div`
  align-items: center;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  cursor: pointer;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};

  &:hover {
    background: ${({ theme }) => theme.background.tertiary};
  }
`;

const StyledCallInfo = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const StyledCallName = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledCallMeta = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: 12px;
`;

const StyledOutcomeBadge = styled.span<{ badgeColor: string }>`
  align-items: center;
  background: ${({ badgeColor }) => `${badgeColor}1a`};
  border-radius: 999px;
  color: ${({ badgeColor }) => badgeColor};
  display: inline-flex;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
`;

const StyledActions = styled.div`
  align-items: center;
  display: flex;
  flex-shrink: 0;
  gap: 4px;
`;

const StyledActionButton = styled.button`
  all: unset;
  align-items: center;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  box-sizing: border-box;
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;
  display: flex;
  height: 28px;
  justify-content: center;
  width: 28px;

  &:hover {
    background: ${({ theme }) => theme.background.tertiary};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledOutcomeDot = styled.span<{ dotColor: string }>`
  background: ${({ dotColor }) => dotColor};
  border-radius: 50%;
  flex-shrink: 0;
  height: 8px;
  width: 8px;
`;

const StyledEmpty = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  flex-direction: column;
  font-size: ${({ theme }) => theme.font.size.sm};
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(6)} 0;
  text-align: center;
`;

const StyledErrorBanner = styled.div`
  align-items: center;
  background: ${({ theme }) => theme.background.danger};
  color: ${({ theme }) => theme.font.color.danger};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
`;

const StyledRetryButton = styled.button`
  all: unset;
  align-items: center;
  cursor: pointer;
  display: flex;
  font-size: 12px;
  font-weight: 500;
  gap: 4px;

  &:hover {
    opacity: 0.8;
  }
`;

const StyledSkeleton = styled.div`
  display: flex;
  flex-direction: column;
`;

const StyledSkeletonRow = styled.div`
  align-items: center;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
`;

const StyledSkeletonBar = styled.div<{ width?: string; height?: string }>`
  animation: pulse 1.5s ease-in-out infinite;
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  height: ${({ height }) => height ?? '14px'};
  width: ${({ width }) => width ?? '100%'};
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

const StyledSpinner = styled(IconLoader2)`
  animation: spin 1s linear infinite;
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const StyledSkeletonInfo = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
`;

// endregion

const LoadingSkeleton = () => (
  <StyledSkeleton>
    {Array.from({ length: 6 }, (_, i) => (
      <StyledSkeletonRow key={i}>
        <StyledSkeletonBar width="8px" height="8px" />
        <StyledSkeletonInfo>
          <StyledSkeletonBar width="60%" />
          <StyledSkeletonBar width="40%" height="12px" />
        </StyledSkeletonInfo>
        <StyledSkeletonBar width="60px" height="20px" />
      </StyledSkeletonRow>
    ))}
  </StyledSkeleton>
);

export const CallHistoryList = () => {
  const { t } = useLingui();
  const { callHistory, historyLoading, historyError, refresh } =
    useCallHistory();
  const setCallState = useSetRecoilState(callStateAtom);

  const handleRedial = (call: CallHistoryItem) => {
    setCallState((prev) => ({
      ...prev,
      status: 'connecting',
      contact: call.contact
        ? {
            id: call.contact.id,
            name: call.contact.name,
            firstName: null,
            lastName: null,
            company: call.contact.company,
            phone: call.customerNumber,
            email: null,
            avatarUrl: call.contact.avatarUrl,
          }
        : null,
    }));
  };

  if (historyLoading && callHistory.length === 0) {
    return (
      <StyledContainer>
        <LoadingSkeleton />
      </StyledContainer>
    );
  }

  if (historyError !== null && callHistory.length === 0) {
    return (
      <StyledContainer>
        <StyledErrorBanner>
          <span>{historyError}</span>
          <StyledRetryButton onClick={refresh}>
            <IconRefresh size={14} /> {t`Retry`}
          </StyledRetryButton>
        </StyledErrorBanner>
      </StyledContainer>
    );
  }

  if (callHistory.length === 0) {
    return (
      <StyledContainer>
        <StyledEmpty>
          <IconHistory size={24} />
          <span>{t`No Call History`}</span>
          <span>{t`Your recent calls will appear here`}</span>
        </StyledEmpty>
      </StyledContainer>
    );
  }

  const groups = groupByDate(callHistory);

  return (
    <StyledContainer>
      {historyError !== null && (
        <StyledErrorBanner>
          <span>{historyError}</span>
          <StyledRetryButton onClick={refresh}>
            <IconRefresh size={14} /> {t`Retry`}
          </StyledRetryButton>
        </StyledErrorBanner>
      )}
      {historyLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 4 }}>
          <StyledSpinner size={14} />
        </div>
      )}
      {groups.map((group) => (
        <div key={group.label}>
          <StyledGroupHeader>{group.label}</StyledGroupHeader>
          {group.items.map((call) => {
            const color = getOutcomeColor(call.outcome);
            const label = getOutcomeLabel(call.outcome);
            return (
              <StyledCallRow key={call.id}>
                <StyledOutcomeDot dotColor={color} />
                <StyledCallInfo>
                  <StyledCallName>
                    {call.contact?.name ?? formatPhone(call.customerNumber)}
                  </StyledCallName>
                  <StyledCallMeta>
                    {formatTime(call.startTime)}
                    {call.duration !== null &&
                      ` · ${formatDuration(call.duration)}`}
                    {call.contact?.name !== undefined &&
                      call.contact?.name !== null &&
                      ` · ${formatPhone(call.customerNumber)}`}
                  </StyledCallMeta>
                </StyledCallInfo>
                <StyledOutcomeBadge badgeColor={color}>
                  {label}
                </StyledOutcomeBadge>
                <StyledActions>
                  {call.hasRecording && (
                    <StyledActionButton
                      aria-label={t`Play recording`}
                      title={t`Play recording`}
                    >
                      <IconPlayerPlay size={14} />
                    </StyledActionButton>
                  )}
                  {call.hasTranscript && (
                    <StyledActionButton
                      aria-label={t`View transcript`}
                      title={t`View transcript`}
                    >
                      <IconFileText size={14} />
                    </StyledActionButton>
                  )}
                  <StyledActionButton
                    aria-label={t`Redial`}
                    onClick={() => handleRedial(call)}
                    title={t`Redial`}
                  >
                    <IconPhone size={14} />
                  </StyledActionButton>
                </StyledActions>
              </StyledCallRow>
            );
          })}
        </div>
      ))}
    </StyledContainer>
  );
};
