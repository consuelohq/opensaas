import styled from '@emotion/styled';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import {
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerStop,
  IconRefresh,
} from '@tabler/icons-react';
import { captureException } from '@sentry/react';

import { recordStoreFamilySelector } from '@/object-record/record-store/states/selectors/recordStoreFamilySelector';
import { useQueueOperations } from '@/dialer/hooks/useQueueOperations';
import { useQueueStats } from '@/dialer/hooks/useQueueStats';
import { formatDurationTimer } from '@/dialer/utils/callDuration';

// region types

type ListStatus = 'IDLE' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | null;

type ListRecordQueueControlsProps = {
  recordId: string;
};

// region styled

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  IDLE: { bg: '#e5e7eb', text: '#374151' },
  ACTIVE: { bg: '#d1fae5', text: '#065f46' },
  PAUSED: { bg: '#fef3c7', text: '#92400e' },
  COMPLETED: { bg: '#e0f2fe', text: '#0c4a6e' },
};

const StyledContainer = styled.div`
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledTopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const StyledBadge = styled.span<{ status: string }>`
  align-items: center;
  background: ${({ status }) => STATUS_COLORS[status]?.bg ?? '#e5e7eb'};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ status }) => STATUS_COLORS[status]?.text ?? '#374151'};
  display: inline-flex;
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
`;

const StyledButtons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledButton = styled.button<{ variant?: 'danger' | 'accent' }>`
  all: unset;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: 500;
  cursor: pointer;
  background: ${({ variant, theme }) =>
    variant === 'danger'
      ? '#ef4444'
      : variant === 'accent'
        ? theme.color.blue
        : theme.background.tertiary};
  color: ${({ variant, theme }) =>
    variant === 'danger' || variant === 'accent'
      ? '#fff'
      : theme.font.color.primary};
  &:hover {
    opacity: 0.85;
  }
`;

const StyledProgressBar = styled.div`
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: 3px;
  height: 6px;
  overflow: hidden;
  width: 100%;
`;

const StyledProgressFill = styled.div<{ percent: number }>`
  background: ${({ theme }) => theme.color.blue};
  height: 100%;
  transition: width 0.3s ease;
  width: ${({ percent }) => percent}%;
`;

const StyledStats = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(4)};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledStat = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const StyledStatLabel = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledStatValue = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

// endregion

export const ListRecordQueueControls = ({
  recordId,
}: ListRecordQueueControlsProps) => {
  const listStatus = useRecoilValue<ListStatus>(
    recordStoreFamilySelector({
      recordId,
      fieldName: 'listStatus',
    }),
  );

  const sessionStartedAt = useRecoilValue<string | null>(
    recordStoreFamilySelector({
      recordId,
      fieldName: 'sessionStartedAt',
    }),
  );

  const currentIndex = useRecoilValue<number | null>(
    recordStoreFamilySelector({
      recordId,
      fieldName: 'currentIndex',
    }),
  );

  const { startQueue, pauseQueue, resumeQueue, completeQueue } =
    useQueueOperations();
  const stats = useQueueStats(recordId);

  // elapsed time timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (listStatus === 'ACTIVE' && sessionStartedAt) {
      const startTime = new Date(sessionStartedAt).getTime();

      const tick = () => {
        setElapsedSeconds(Math.round((Date.now() - startTime) / 1000));
      };

      tick();
      intervalRef.current = setInterval(tick, 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return undefined;
  }, [listStatus, sessionStartedAt]);

  const handleStart = useCallback(async () => {
    try {
      await startQueue(recordId);
    } catch (err: unknown) {
      captureException(err, {
        extra: { context: 'ListRecordQueueControls.handleStart', recordId },
      });
    }
  }, [startQueue, recordId]);

  const handlePause = useCallback(async () => {
    try {
      await pauseQueue(recordId);
    } catch (err: unknown) {
      captureException(err, {
        extra: { context: 'ListRecordQueueControls.handlePause', recordId },
      });
    }
  }, [pauseQueue, recordId]);

  const handleResume = useCallback(async () => {
    try {
      await resumeQueue(recordId);
    } catch (err: unknown) {
      captureException(err, {
        extra: { context: 'ListRecordQueueControls.handleResume', recordId },
      });
    }
  }, [resumeQueue, recordId]);

  const handleStop = useCallback(async () => {
    try {
      await completeQueue(recordId);
    } catch (err: unknown) {
      captureException(err, {
        extra: { context: 'ListRecordQueueControls.handleStop', recordId },
      });
    }
  }, [completeQueue, recordId]);

  const handleRestart = useCallback(async () => {
    try {
      await startQueue(recordId);
    } catch (err: unknown) {
      captureException(err, {
        extra: { context: 'ListRecordQueueControls.handleRestart', recordId },
      });
    }
  }, [startQueue, recordId]);

  const status = listStatus ?? 'IDLE';
  const progressPercent =
    stats.totalMembers > 0
      ? Math.round((stats.completed / stats.totalMembers) * 100)
      : 0;

  return (
    <StyledContainer>
      <StyledTopRow>
        <StyledBadge status={status}>{status}</StyledBadge>
        <StyledButtons>
          {status === 'IDLE' && (
            <StyledButton variant="accent" onClick={handleStart}>
              <IconPlayerPlay size={14} />
              Start Queue
            </StyledButton>
          )}
          {status === 'ACTIVE' && (
            <>
              <StyledButton onClick={handlePause}>
                <IconPlayerPause size={14} />
                Pause
              </StyledButton>
              <StyledButton variant="danger" onClick={handleStop}>
                <IconPlayerStop size={14} />
                Stop
              </StyledButton>
            </>
          )}
          {status === 'PAUSED' && (
            <>
              <StyledButton variant="accent" onClick={handleResume}>
                <IconPlayerPlay size={14} />
                Resume
              </StyledButton>
              <StyledButton variant="danger" onClick={handleStop}>
                <IconPlayerStop size={14} />
                Stop
              </StyledButton>
            </>
          )}
          {status === 'COMPLETED' && (
            <StyledButton variant="accent" onClick={handleRestart}>
              <IconRefresh size={14} />
              Restart
            </StyledButton>
          )}
        </StyledButtons>
      </StyledTopRow>

      <StyledProgressBar>
        <StyledProgressFill percent={progressPercent} />
      </StyledProgressBar>

      <StyledStats>
        <StyledStat>
          <StyledStatLabel>Progress</StyledStatLabel>
          <StyledStatValue>
            {stats.completed} / {stats.totalMembers}
          </StyledStatValue>
        </StyledStat>
        <StyledStat>
          <StyledStatLabel>Answer Rate</StyledStatLabel>
          <StyledStatValue>{stats.answerRate}%</StyledStatValue>
        </StyledStat>
        <StyledStat>
          <StyledStatLabel>Avg Duration</StyledStatLabel>
          <StyledStatValue>
            {formatDurationTimer(stats.avgDuration)}
          </StyledStatValue>
        </StyledStat>
        {(listStatus === 'ACTIVE' || listStatus === 'PAUSED') &&
          currentIndex !== null && (
            <StyledStat>
              <StyledStatLabel>Current Contact</StyledStatLabel>
              <StyledStatValue>
                {currentIndex + 1} of {stats.totalMembers}
              </StyledStatValue>
            </StyledStat>
          )}
        {listStatus === 'ACTIVE' && (
          <StyledStat>
            <StyledStatLabel>Elapsed</StyledStatLabel>
            <StyledStatValue>
              {formatDurationTimer(elapsedSeconds)}
            </StyledStatValue>
          </StyledStat>
        )}
      </StyledStats>
    </StyledContainer>
  );
};
