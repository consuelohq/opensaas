import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { useRecoilValue } from 'recoil';
import {
  IconList,
  IconPhoneCall,
  IconSettings,
  IconUser,
  IconX,
} from '@tabler/icons-react';

import { QueueAnalytics } from '@/dialer/components/QueueAnalytics';
import { QueueControls } from '@/dialer/components/QueueControls';
import { QueueSettingsModal } from '@/dialer/components/QueueSettingsModal';
import { useAutoDialer } from '@/dialer/hooks/useAutoDialer';
import {
  activeQueueState,
  currentQueueItemSelector,
  nextQueueItemSelector,
  parallelDialingSelector,
  queueProgressSelector,
} from '@/dialer/states/queueState';

// region styled

const StyledPanel = styled.div`
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  overflow: hidden;
`;

const StyledHeaderRow = styled.div`
  align-items: center;
  background: ${({ theme }) => theme.background.secondary};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
`;

const StyledHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledTitle = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledSettingsButton = styled.button`
  all: unset;
  cursor: pointer;
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledCategoryBadge = styled.span`
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: 999px;
  color: ${({ theme }) => theme.font.color.secondary};
  display: inline-flex;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
`;

const StyledStats = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  gap: ${({ theme }) => theme.spacing(1)};
  padding: 0 ${({ theme }) => theme.spacing(3)};
`;

const StyledProgressTrack = styled.div`
  height: 4px;
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: 2px;
  margin: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(3)};
  overflow: hidden;
`;

const StyledProgressFill = styled.div<{ width: number }>`
  background: ${({ theme }) => theme.color.blue};
  border-radius: 2px;
  height: 100%;
  transition: width 300ms ease;
  width: ${({ width }) => width}%;
`;

const StyledBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
`;

const StyledSectionLabel = styled.span`
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledContactCard = styled.div<{ compact?: boolean }>`
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(2)};
`;

const StyledContactName = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledContactDetail = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: 12px;
`;

const StyledAttemptBadge = styled.span`
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: 999px;
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: 11px;
  padding: 1px 6px;
`;

const StyledParallelStatus = styled.div`
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(2)};
`;

const StyledParallelHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledParallelCall = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: ${({ theme }) => theme.font.color.secondary};
  padding: 2px 0;
`;

const StyledCallStatus = styled.span<{ status: string }>`
  color: ${({ status, theme }) =>
    status === 'in-progress'
      ? (theme.color.green ?? '#16a34a')
      : theme.font.color.tertiary};
  font-size: 11px;
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

const StyledOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
`;

const StyledModal = styled.div`
  background: ${({ theme }) => theme.background.primary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  width: 360px;
  max-height: 80vh;
  overflow-y: auto;
`;

const StyledModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(3)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  font-size: ${({ theme }) => theme.font.size.md};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(3)};
`;

const StyledSettingRow = styled.label`
  align-items: center;
  color: ${({ theme }) => theme.font.color.primary};
  cursor: pointer;
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  justify-content: space-between;
`;

const StyledModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledModalButton = styled.button<{ accent?: boolean }>`
  all: unset;
  box-sizing: border-box;
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(3)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: 500;
  cursor: pointer;
  background: ${({ accent, theme }) =>
    accent ? theme.color.blue : theme.background.tertiary};
  color: ${({ accent, theme }) => (accent ? '#fff' : theme.font.color.primary)};
`;

const StyledNumberInput = styled.input`
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: 4px 8px;
  text-align: right;
  width: 64px;
`;

const StyledCountdown = styled.div`
  align-items: center;
  background: ${({ theme }) => theme.background.secondary};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
`;

const StyledCountdownNumber = styled.span`
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
  min-width: 20px;
  text-align: center;
`;

const StyledCancelButton = styled.button`
  all: unset;
  cursor: pointer;
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

// endregion

// sub-components

const ProgressBar = ({ value }: { value: number }) => (
  <StyledProgressTrack>
    <StyledProgressFill width={value} />
  </StyledProgressTrack>
);

const ParallelDialingStatus = () => {
  const parallelDialing = useRecoilValue(parallelDialingSelector);
  if (!parallel?.isActive) return null;

  return (
    <StyledParallelStatus>
      <StyledParallelHeader>
        <IconPhoneCall size={14} />
        Parallel Dialing
        <StyledCategoryBadge>
          {parallel.activeCalls.length} lines
        </StyledCategoryBadge>
      </StyledParallelHeader>
      {parallel.activeCalls.map((call) => (
        <StyledParallelCall key={call.callSid}>
          <span>{call.customerNumber}</span>
          <StyledCallStatus status={call.status}>
            {call.status === 'ringing' && '📞 Ringing'}
            {call.status === 'in-progress' && '✅ Connected'}
            {call.status === 'completed' && 'Done'}
            {call.status === 'failed' && 'Failed'}
          </StyledCallStatus>
        </StyledParallelCall>
      ))}
    </StyledParallelStatus>
  );
};

// main component

export const QueuePanel = () => {
  const { t } = useLingui();
  const activeQueue = useRecoilValue(activeQueueState);
  const currentQueueItem = useRecoilValue(currentQueueItemSelector);
  const nextQueueItem = useRecoilValue(nextQueueItemSelector);
  const queueProgress = useRecoilValue(queueProgressSelector);
  const [showSettings, setShowSettings] = useState(false);
  const { countdown, cancelAutoAdvance, isAutoAdvancing } = useAutoDialer();

  if (!queue) return null;

  return (
    <StyledPanel>
      {/* header */}
      <StyledHeaderRow>
        <StyledHeaderLeft>
          <IconList size={16} />
          <StyledTitle>{queue.name || 'Queue'}</StyledTitle>
          {queue.category !== 'all' && (
            <StyledCategoryBadge>{queue.category}</StyledCategoryBadge>
          )}
        </StyledHeaderLeft>
        <StyledSettingsButton
          onClick={() => setShowSettings(true)}
          aria-label="Queue settings"
        >
          <IconSettings size={16} />
        </StyledSettingsButton>
      </StyledHeaderRow>

      {/* stats + progress */}
      <StyledStats>
        <span>
          {progress?.completed ?? 0}/{progress?.total ?? 0} completed
        </span>
        <span>•</span>
        <span>{queue.aggregatedStats?.answerRatePercentage ?? 0}% connect</span>
      </StyledStats>
      <ProgressBar value={progress?.percentComplete ?? 0} />

      {/* analytics */}
      <QueueAnalytics />

      <StyledBody>
        {/* parallel dialing */}
        {queue.parallelDialingEnabled && <ParallelDialingStatus />}

        {/* current contact */}
        {currentItem ? (
          <>
            <StyledSectionLabel>{t`Now Calling`}</StyledSectionLabel>
            <StyledContactCard>
              <StyledContactName>
                <IconUser size={14} />
                {currentItem.contact.name ?? 'Unknown'}
                {currentItem.attempts > 1 && (
                  <StyledAttemptBadge>
                    Attempt {currentItem.attempts}/{queue.settings.maxAttempts}
                  </StyledAttemptBadge>
                )}
              </StyledContactName>
              {currentItem.contact.company && (
                <StyledContactDetail>
                  {currentItem.contact.company}
                </StyledContactDetail>
              )}
              <StyledContactDetail>
                {currentItem.contact.phone}
              </StyledContactDetail>
              {currentItem.contact.timezone && (
                <StyledContactDetail>
                  🕐 {currentItem.contact.timezone}
                </StyledContactDetail>
              )}
              {currentItem.contact.lastNote && (
                <StyledContactDetail>
                  📝 {currentItem.contact.lastNote}
                </StyledContactDetail>
              )}
            </StyledContactCard>
          </>
        ) : (
          <StyledEmpty>
            <IconList size={20} />
            <span>Queue complete!</span>
          </StyledEmpty>
        )}

        {/* next contact */}
        {nextItem && (
          <>
            <StyledSectionLabel>{t`Up Next`}</StyledSectionLabel>
            <StyledContactCard compact>
              <StyledContactName>
                <IconUser size={14} />
                {nextItem.contact.name ?? 'Unknown'}
              </StyledContactName>
              {nextItem.contact.company && (
                <StyledContactDetail>
                  {nextItem.contact.company}
                </StyledContactDetail>
              )}
            </StyledContactCard>
          </>
        )}
      </StyledBody>

      {/* auto-advance countdown */}
      {isAutoAdvancing && (
        <StyledCountdown>
          Next call in{' '}
          <StyledCountdownNumber>{countdown}</StyledCountdownNumber>s
          <StyledCancelButton
            onClick={cancelAutoAdvance}
            aria-label="Cancel auto-advance"
          >
            <IconX size={14} />
          </StyledCancelButton>
        </StyledCountdown>
      )}

      {/* controls */}
      <QueueControls />

      {/* settings modal */}
      {showSettings && (
        <QueueSettingsModal
          queue={queue}
          onClose={() => setShowSettings(false)}
        />
      )}
    </StyledPanel>
  );
};
