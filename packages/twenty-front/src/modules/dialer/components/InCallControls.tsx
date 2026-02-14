import styled from '@emotion/styled';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import {
  IconHash,
  IconMicrophone,
  IconMicrophoneOff,
  IconPhoneOff,
  IconPlayerPause,
  IconPlayerPlay,
  IconSwitchHorizontal,
} from '@tabler/icons-react';

import { DialPad } from '@/dialer/components/DialPad';
import { activeCallState } from '@/dialer/states/activeCallState';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import { isMutedState } from '@/dialer/states/isMutedState';
import { isOnHoldState } from '@/dialer/states/isOnHoldState';

const VISIBLE_STATUSES = new Set(['connecting', 'ringing', 'active']);

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(4)};
  background: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  width: 100%;
`;

const StyledButton = styled.button<{
  active?: boolean;
  danger?: boolean;
  isDisabled?: boolean;
}>`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ${({ isDisabled }) => (isDisabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ isDisabled }) => (isDisabled ? 0.5 : 1)};
  transition: background 120ms, transform 80ms;
  background: ${({ active, danger, theme }) =>
    danger
      ? '#ef4444'
      : active
        ? theme.color.blue
        : theme.background.tertiary};
  color: ${({ active, danger, theme }) =>
    active || danger ? '#fff' : theme.font.color.primary};

  &:hover:not(:disabled) {
    transform: scale(1.05);
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }
`;

const StyledLabel = styled.span`
  font-size: 10px;
  color: ${({ theme }) => theme.font.color.tertiary};
  text-align: center;
`;

const StyledButtonGroup = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`;

const StyledOverlay = styled.div`
  width: 100%;
`;

export const InCallControls = () => {
  const callState = useRecoilValue(callStateAtom);
  const activeCall = useRecoilValue(activeCallState);
  const [isMuted, setIsMuted] = useRecoilState(isMutedState);
  const [isOnHold, setIsOnHold] = useRecoilState(isOnHoldState);
  const [isDTMFOpen, setIsDTMFOpen] = useState(false);

  const isActive = callState.status === 'active';

  const handleMuteToggle = useCallback(() => {
    if (!activeCall) return;
    const next = !isMuted;
    activeCall.mute(next);
    setIsMuted(next);
  }, [activeCall, isMuted, setIsMuted]);

  const handleHoldToggle = useCallback(() => {
    // DEV-716: UI toggle only — server-side hold via TwiML in transfer task
    setIsOnHold((prev) => !prev);
  }, [setIsOnHold]);

  const handleEndCall = useCallback(() => {
    activeCall?.disconnect();
  }, [activeCall]);

  const handleDTMFToggle = useCallback(() => {
    setIsDTMFOpen((prev) => !prev);
  }, []);

  // keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.target instanceof HTMLTextAreaElement) return;

      switch (event.key.toLowerCase()) {
        case 'm':
          handleMuteToggle();
          break;
        case 'h':
          handleHoldToggle();
          break;
        case 'escape':
          handleEndCall();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleMuteToggle, handleHoldToggle, handleEndCall]);

  if (!VISIBLE_STATUSES.has(callState.status)) return null;

  return (
    <StyledContainer>
      <StyledBar>
        <StyledButtonGroup>
          <StyledButton
            active={isMuted}
            onClick={handleMuteToggle}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            aria-pressed={isMuted}
          >
            {isMuted ? (
              <IconMicrophoneOff size={20} />
            ) : (
              <IconMicrophone size={20} />
            )}
          </StyledButton>
          <StyledLabel>Mute</StyledLabel>
        </StyledButtonGroup>

        <StyledButtonGroup>
          <StyledButton
            active={isOnHold}
            onClick={handleHoldToggle}
            isDisabled={!isActive}
            aria-label={isOnHold ? 'Resume' : 'Hold'}
            aria-pressed={isOnHold}
          >
            {isOnHold ? (
              <IconPlayerPlay size={20} />
            ) : (
              <IconPlayerPause size={20} />
            )}
          </StyledButton>
          <StyledLabel>Hold</StyledLabel>
        </StyledButtonGroup>

        <StyledButtonGroup>
          <StyledButton
            danger
            onClick={handleEndCall}
            aria-label="End call"
          >
            <IconPhoneOff size={20} />
          </StyledButton>
          <StyledLabel>End</StyledLabel>
        </StyledButtonGroup>

        <StyledButtonGroup>
          <StyledButton
            active={isDTMFOpen}
            onClick={handleDTMFToggle}
            isDisabled={!isActive}
            aria-label="Keypad"
            aria-pressed={isDTMFOpen}
          >
            <IconHash size={20} />
          </StyledButton>
          <StyledLabel>Keypad</StyledLabel>
        </StyledButtonGroup>

        <StyledButtonGroup>
          <StyledButton
            isDisabled
            aria-label="Transfer"
          >
            <IconSwitchHorizontal size={20} />
          </StyledButton>
          <StyledLabel>Transfer</StyledLabel>
        </StyledButtonGroup>
      </StyledBar>

      {isDTMFOpen && isActive && (
        <StyledOverlay>
          <DialPad />
        </StyledOverlay>
      )}
    </StyledContainer>
  );
};
