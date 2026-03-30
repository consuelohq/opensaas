import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
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
} from 'twenty-ui/display';

import { activeQueueState } from '@/dialer/states/queueState';
import { useQueueControls } from '@/dialer/hooks/useQueueControls';
import { useGlobalHotkeys } from '@/ui/utilities/hotkey/hooks/useGlobalHotkeys';

// region styled

const StyledControls = styled.div`
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
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
    danger
      ? theme.color.red
      : accent
        ? theme.color.blue
        : theme.background.tertiary};
  color: ${({ danger, accent, theme }) =>
    danger || accent ? theme.font.color.inverted : theme.font.color.primary};
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
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  padding: ${({ theme }) => theme.spacing(3)};
`;

const StyledModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
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
    selected ? theme.font.color.inverted : theme.font.color.primary};
  &:hover {
    opacity: 0.85;
  }
`;

const StyledCustomInput = styled.input`
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => theme.spacing(2)};
  width: 100%;
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
    accent ? theme.font.color.inverted : theme.font.color.primary};
`;

const StyledHint = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: 10px;
`;

// endregion

const SKIP_REASONS = [
  { value: 'no-answer', label: msg`No Answer`, Icon: IconPhoneOff },
  { value: 'voicemail', label: msg`Voicemail`, Icon: IconMailbox },
  { value: 'wrong-number', label: msg`Wrong Number`, Icon: IconX },
  { value: 'not-interested', label: msg`Not Interested`, Icon: IconThumbDown },
  { value: 'callback-requested', label: msg`Callback`, Icon: IconCalendar },
  { value: 'dnc', label: msg`Do Not Call`, Icon: IconBan },
  { value: 'other', label: msg`Other`, Icon: IconDots },
] as const;

// skip reason modal

const SkipReasonModal = ({
  onSkip,
  onClose,
}: {
  onSkip: (reason: string) => void;
  onClose: () => void;
}) => {
  const { t } = useLingui();
  const [selected, setSelected] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState('');

  const handleSkip = () => {
    const reason = selected === 'other' ? customReason : selected;
    onSkip(reason || 'Skipped');
  };

  return (
    <StyledOverlay onClick={onClose}>
      <StyledModal onClick={(e) => e.stopPropagation()}>
        <StyledModalHeader>{t`Skip Reason`}</StyledModalHeader>
        <StyledModalBody>
          {SKIP_REASONS.map(({ value, label, Icon }) => (
            <StyledReasonButton
              key={value}
              selected={selected === value}
              onClick={() => setSelected(value)}
            >
              <Icon size={14} />
              {t(label)}
            </StyledReasonButton>
          ))}
          {selected === 'other' && (
            <StyledCustomInput
              placeholder={t`Enter reason...`}
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              autoFocus
            />
          )}
        </StyledModalBody>
        <StyledModalActions>
          <StyledModalButton onClick={onClose}>{t`Cancel`}</StyledModalButton>
          <StyledModalButton accent onClick={handleSkip} disabled={!selected}>
            {t`Skip`}
          </StyledModalButton>
        </StyledModalActions>
      </StyledModal>
    </StyledOverlay>
  );
};

// main component

export const QueueControls = () => {
  const { t } = useLingui();
  const activeQueue = useRecoilValue(activeQueueState);
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

  if (!activeQueue) return null;

  // idle — start button
  if (activeQueue.status === 'idle') {
    return (
      <StyledControls>
        <StyledButton accent onClick={startQueue}>
          <IconPhone size={14} />
          {t`Start Queue`}
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
          {t`Restart Queue`}
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
          {t`Skip`}
          <StyledHint>(S)</StyledHint>
        </StyledButton>
        {isActive ? (
          <StyledButton onClick={pauseQueue}>
            <IconPlayerPause size={14} />
            {t`Pause`}
          </StyledButton>
        ) : (
          <StyledButton accent onClick={resumeQueue}>
            <IconPlayerPlay size={14} />
            {t`Resume`}
          </StyledButton>
        )}
        <StyledButton danger onClick={endQueue}>
          <IconPlayerStop size={14} />
          {t`End`}
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
