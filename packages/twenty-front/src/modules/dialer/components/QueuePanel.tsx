import styled from '@emotion/styled';
import { useCallback, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import {
  IconList,
  IconPhoneCall,
  IconSettings,
  IconUser,
  IconX,
} from '@tabler/icons-react';

import { type CallQueue, type QueueSettings } from '@/dialer/types/queue';
import { QueueControls } from '@/dialer/components/QueueControls';
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  background: ${({ theme }) => theme.background.secondary};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledTitle = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
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
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  background: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledStats = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: 0 ${({ theme }) => theme.spacing(3)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledProgressTrack = styled.div`
  height: 4px;
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: 2px;
  margin: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(3)};
  overflow: hidden;
`;

const StyledProgressFill = styled.div<{ width: number }>`
  height: 100%;
  width: ${({ width }) => width}%;
  background: ${({ theme }) => theme.color.blue};
  border-radius: 2px;
  transition: width 300ms ease;
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
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(2)};
  background: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.light};
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
  font-size: 12px;
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledAttemptBadge = styled.span`
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 999px;
  background: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledParallelStatus = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(2)};
  background: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.light};
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
  font-size: 11px;
  color: ${({ status, theme }) =>
    status === 'in-progress'
      ? theme.color.green ?? '#16a34a'
      : theme.font.color.tertiary};
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
  padding: ${({ theme }) => theme.spacing(3)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledSettingRow = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  cursor: pointer;
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
  color: ${({ accent, theme }) =>
    accent ? '#fff' : theme.font.color.primary};
`;

const StyledNumberInput = styled.input`
  width: 64px;
  padding: 4px 8px;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.secondary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  text-align: right;
`;

const StyledCountdown = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  background: ${({ theme }) => theme.background.secondary};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
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
  const parallel = useRecoilValue(parallelDialingSelector);
  if (!parallel?.isActive) return null;

  return (
    <StyledParallelStatus>
      <StyledParallelHeader>
        <IconPhoneCall size={14} />
        Parallel Dialing
        <StyledCategoryBadge>{parallel.activeCalls.length} lines</StyledCategoryBadge>
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

const QueueSettingsModal = ({
  queue,
  onClose,
}: {
  queue: CallQueue;
  onClose: () => void;
}) => {
  const [settings, setSettings] = useState<QueueSettings>(queue.settings);
  const [, setQueue] = useRecoilState(activeQueueState);

  const update = useCallback(
    <TKey extends keyof QueueSettings>(key: TKey, value: QueueSettings[TKey]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSave = useCallback(() => {
    setQueue((prev) => (prev ? { ...prev, settings } : null));
    onClose();
  }, [settings, setQueue, onClose]);

  return (
    <StyledOverlay onClick={onClose}>
      <StyledModal onClick={(e) => e.stopPropagation()}>
        <StyledModalHeader>Queue Settings</StyledModalHeader>
        <StyledModalBody>
          <StyledSettingRow>
            Auto-advance
            <input
              type="checkbox"
              checked={settings.autoAdvance}
              onChange={(e) => update('autoAdvance', e.target.checked)}
            />
          </StyledSettingRow>
          <StyledSettingRow>
            Auto-advance delay (ms)
            <StyledNumberInput
              type="number"
              value={settings.autoAdvanceDelay}
              onChange={(e) =>
                update('autoAdvanceDelay', Number(e.target.value))
              }
            />
          </StyledSettingRow>
          <StyledSettingRow>
            Skip no-answer
            <input
              type="checkbox"
              checked={settings.skipNoAnswer}
              onChange={(e) => update('skipNoAnswer', e.target.checked)}
            />
          </StyledSettingRow>
          <StyledSettingRow>
            Max attempts
            <StyledNumberInput
              type="number"
              value={settings.maxAttempts}
              onChange={(e) => update('maxAttempts', Number(e.target.value))}
            />
          </StyledSettingRow>
          <StyledSettingRow>
            Call timeout (s)
            <StyledNumberInput
              type="number"
              value={settings.callTimeout}
              onChange={(e) => update('callTimeout', Number(e.target.value))}
            />
          </StyledSettingRow>
          <StyledSettingRow>
            Auto-skip voicemail
            <input
              type="checkbox"
              checked={settings.autoSkipVoicemail}
              onChange={(e) => update('autoSkipVoicemail', e.target.checked)}
            />
          </StyledSettingRow>
          {settings.autoSkipVoicemail && (
            <StyledSettingRow>
              Voicemail skip delay (ms)
              <StyledNumberInput
                type="number"
                value={settings.voicemailSkipDelay}
                onChange={(e) =>
                  update('voicemailSkipDelay', Number(e.target.value))
                }
              />
            </StyledSettingRow>
          )}
          <StyledSettingRow>
            Parallel dialing
            <input
              type="checkbox"
              checked={settings.parallelDialingEnabled}
              onChange={(e) =>
                update('parallelDialingEnabled', e.target.checked)
              }
            />
          </StyledSettingRow>
          {settings.parallelDialingEnabled && (
            <>
              <StyledSettingRow>
                Max parallel lines
                <StyledNumberInput
                  type="number"
                  value={settings.parallelDialingMaxLines}
                  onChange={(e) =>
                    update('parallelDialingMaxLines', Number(e.target.value))
                  }
                />
              </StyledSettingRow>
              <StyledSettingRow>
                Cooldown between batches (ms)
                <StyledNumberInput
                  type="number"
                  value={settings.parallelDialingCooldown}
                  onChange={(e) =>
                    update('parallelDialingCooldown', Number(e.target.value))
                  }
                />
              </StyledSettingRow>
            </>
          )}
        </StyledModalBody>
        <StyledModalActions>
          <StyledModalButton onClick={onClose}>Cancel</StyledModalButton>
          <StyledModalButton accent onClick={handleSave}>
            Save
          </StyledModalButton>
        </StyledModalActions>
      </StyledModal>
    </StyledOverlay>
  );
};

// main component

export const QueuePanel = () => {
  const queue = useRecoilValue(activeQueueState);
  const currentItem = useRecoilValue(currentQueueItemSelector);
  const nextItem = useRecoilValue(nextQueueItemSelector);
  const progress = useRecoilValue(queueProgressSelector);
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
        <span>
          {queue.aggregatedStats?.answerRatePercentage ?? 0}% connect
        </span>
      </StyledStats>
      <ProgressBar value={progress?.percentComplete ?? 0} />

      <StyledBody>
        {/* parallel dialing */}
        {queue.parallelDialingEnabled && <ParallelDialingStatus />}

        {/* current contact */}
        {currentItem ? (
          <>
            <StyledSectionLabel>Now Calling</StyledSectionLabel>
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
            <StyledSectionLabel>Up Next</StyledSectionLabel>
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
          Next call in <StyledCountdownNumber>{countdown}</StyledCountdownNumber>s
          <StyledCancelButton onClick={cancelAutoAdvance} aria-label="Cancel auto-advance">
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
