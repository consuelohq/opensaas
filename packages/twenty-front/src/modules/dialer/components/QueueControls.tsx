import styled from '@emotion/styled';
import { useState } from 'react';
import { useRecoilValue } from 'recoil';
import {
  IconBan,
  IconCalendar,
  IconDots,
  IconPhone,
  IconPhoneOff,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerStop,
  IconPlayerTrackNext,
  IconRefresh,
  IconThumbDown,
  IconMailbox,
  IconX,
} from '@tabler/icons-react';

import { activeQueueState } from '@/dialer/states/queueState';
import { useQueueControls } from '@/dialer/hooks/useQueueControls';
import { useGlobalHotkeys } from '@/ui/utilities/hotkey/hooks/useGlobalHotkeys';

// region styled

const StyledControls = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledButton = styled.button<{ danger?: boolean; accent?: boolean }>`
  all: unset;
  box-sizing: border-box;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  background: ${({ danger, accent, theme }) =>
    danger ? '#ef4444' : accent ? theme.color.blue : theme.background.tertiary};
  color: ${({ danger, accent, theme }) =>
    danger || accent ? '#fff' : theme.font.color.primary};
  &:hover {
    opacity: 0.85;
  }
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
  width: 320px;
`;

const StyledModalHeader = styled.div`
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
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledReasonButton = styled.button<{ selected?: boolean }>`
  all: unset;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  background: ${({ selected, theme }) =>
    selected ? theme.color.blue : theme.background.tertiary};
  color: ${({ selected, theme }) =>
    selected ? '#fff' : theme.font.color.primary};
  &:hover {
    opacity: 0.85;
  }
`;

const StyledCustomInput = styled.input`
  width: 100%;
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.secondary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
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

const StyledHint = styled.span`
  font-size: 10px;
  color: ${({ theme }) => theme.font.color.tertiary};
`;

// endregion

const SKIP_REASONS = [
  { value: 'no-answer', label: 'No Answer', Icon: IconPhoneOff },
  { value: 'voicemail', label: 'Voicemail', Icon: IconMailbox },
  { value: 'wrong-number', label: 'Wrong Number', Icon: IconX },
  { value: 'not-interested', label: 'Not Interested', Icon: IconThumbDown },
  { value: 'callback-requested', label: 'Callback', Icon: IconCalendar },
  { value: 'dnc', label: 'Do Not Call', Icon: IconBan },
  { value: 'other', label: 'Other', Icon: IconDots },
] as const;

// skip reason modal

const SkipReasonModal = ({
  onSkip,
  onClose,
}: {
  onSkip: (reason: string) => void;
  onClose: () => void;
}) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState('');

  const handleSkip = () => {
    const reason = selected === 'other' ? customReason : selected;
    onSkip(reason || 'Skipped');
  };

  return (
    <StyledOverlay onClick={onClose}>
      <StyledModal onClick={(e) => e.stopPropagation()}>
        <StyledModalHeader>Skip Reason</StyledModalHeader>
        <StyledModalBody>
          {SKIP_REASONS.map(({ value, label, Icon }) => (
            <StyledReasonButton
              key={value}
              selected={selected === value}
              onClick={() => setSelected(value)}
            >
              <Icon size={14} />
              {label}
            </StyledReasonButton>
          ))}
          {selected === 'other' && (
            <StyledCustomInput
              placeholder="Enter reason..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              autoFocus
            />
          )}
        </StyledModalBody>
        <StyledModalActions>
          <StyledModalButton onClick={onClose}>Cancel</StyledModalButton>
          <StyledModalButton accent onClick={handleSkip} disabled={!selected}>
            Skip
          </StyledModalButton>
        </StyledModalActions>
      </StyledModal>
    </StyledOverlay>
  );
};

// main component

export const QueueControls = () => {
  const queue = useRecoilValue(activeQueueState);
  const {
    startQueue,
    pauseQueue,
    resumeQueue,
    skipContact,
    endQueue,
    restartQueue,
    isActive,
    isPaused,
    canRestart,
  } = useQueueControls();
  const [showSkipModal, setShowSkipModal] = useState(false);

  // keyboard shortcuts
  useGlobalHotkeys({
    keys: [' '],
    callback: () => {
      if (isActive) pauseQueue();
      else if (isPaused) resumeQueue();
    },
    containsModifier: false,
    dependencies: [isActive, isPaused, pauseQueue, resumeQueue],
    options: { enableOnFormTags: false, enableOnContentEditable: false },
  });

  useGlobalHotkeys({
    keys: ['s'],
    callback: () => {
      if (isActive || isPaused) setShowSkipModal(true);
    },
    containsModifier: false,
    dependencies: [isActive, isPaused],
    options: { enableOnFormTags: false, enableOnContentEditable: false },
  });

  useGlobalHotkeys({
    keys: ['r'],
    callback: () => {
      if (canRestart) restartQueue();
    },
    containsModifier: false,
    dependencies: [canRestart, restartQueue],
    options: { enableOnFormTags: false, enableOnContentEditable: false },
  });

  if (!queue) return null;

  // idle — start button
  if (queue.status === 'idle') {
    return (
      <StyledControls>
        <StyledButton accent onClick={startQueue}>
          <IconPhone size={14} />
          Start Queue
        </StyledButton>
      </StyledControls>
    );
  }

  // completed/stopped — restart
  if (canRestart) {
    return (
      <StyledControls>
        <StyledButton accent onClick={restartQueue}>
          <IconRefresh size={14} />
          Restart Queue
          <StyledHint>(R)</StyledHint>
        </StyledButton>
      </StyledControls>
    );
  }

  // active/paused — full controls
  return (
    <>
      <StyledControls>
        <StyledButton onClick={() => setShowSkipModal(true)}>
          <IconPlayerTrackNext size={14} />
          Skip
          <StyledHint>(S)</StyledHint>
        </StyledButton>
        {isActive ? (
          <StyledButton onClick={pauseQueue}>
            <IconPlayerPause size={14} />
            Pause
          </StyledButton>
        ) : (
          <StyledButton accent onClick={resumeQueue}>
            <IconPlayerPlay size={14} />
            Resume
          </StyledButton>
        )}
        <StyledButton danger onClick={endQueue}>
          <IconPlayerStop size={14} />
          End
        </StyledButton>
      </StyledControls>

      {showSkipModal && (
        <SkipReasonModal
          onSkip={(reason) => {
            skipContact(reason);
            setShowSkipModal(false);
          }}
          onClose={() => setShowSkipModal(false)}
        />
      )}
    </>
  );
};
