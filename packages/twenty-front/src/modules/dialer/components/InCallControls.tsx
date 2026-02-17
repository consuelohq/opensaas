import styled from '@emotion/styled';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import {
  IconAlertCircle,
  IconCheck,
  IconHash,
  IconMicrophone,
  IconMicrophoneOff,
  IconPhoneOff,
  IconPlayerPause,
  IconPlayerPlay,
  IconSwitchHorizontal,
  IconX,
} from '@tabler/icons-react';

import { DialPad } from '@/dialer/components/DialPad';
import { TransferModal } from '@/dialer/components/TransferModal';
import { useCallTransfer } from '@/dialer/hooks/useCallTransfer';
import { useDialerHotkeys } from '@/dialer/hooks/useDialerHotkeys';
import { activeCallState } from '@/dialer/states/activeCallState';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import { callErrorState } from '@/dialer/states/callErrorState';
import { isMutedState } from '@/dialer/states/isMutedState';
import { isOnHoldState } from '@/dialer/states/isOnHoldState';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

const VISIBLE_STATUSES = new Set(['connecting', 'ringing', 'active']);

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(3)};
  position: relative;
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
  transition:
    background 120ms,
    transform 80ms;
  background: ${({ active, danger, theme }) =>
    danger ? '#ef4444' : active ? theme.color.blue : theme.background.tertiary};
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

const StyledWarmBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(2)};
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  width: 100%;
`;

const StyledWarmLabel = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  flex: 1;
  font-size: 12px;
`;

const StyledSmallButton = styled.button<{ danger?: boolean }>`
  padding: 6px 12px;
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  background: ${({ danger, theme }) => (danger ? '#ef4444' : theme.color.blue)};
  color: #fff;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const StyledErrorBar = styled.div`
  align-items: center;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid #ef4444;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: #ef4444;
  display: flex;
  font-size: 12px;
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(2)};
  width: 100%;
`;

const StyledErrorIcon = styled(IconAlertCircle)`
  flex-shrink: 0;
`;

const StyledErrorText = styled.span`
  flex: 1;
  text-align: center;
`;

const StyledErrorDismiss = styled.button`
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  opacity: 0.7;
  &:hover {
    opacity: 1;
  }
`;

export const InCallControls = () => {
  const callState = useRecoilValue(callStateAtom);
  const activeCall = useRecoilValue(activeCallState);
  const [callError, setCallError] = useRecoilState(callErrorState);
  const [isMuted, setIsMuted] = useRecoilState(isMutedState);
  const [isOnHold, setIsOnHold] = useRecoilState(isOnHoldState);
  const [isDTMFOpen, setIsDTMFOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);

  const { enqueueErrorSnackBar } = useSnackBar();

  const {
    transferState,
    holdError,
    initiateTransfer,
    completeTransfer,
    cancelTransfer,
    toggleHold,
  } = useCallTransfer();

  const isActive = callState.status === 'active';
  const isConsulting = transferState.status === 'consulting';

  useEffect(() => {
    if (transferState.error) {
      enqueueErrorSnackBar({ message: transferState.error });
    }
  }, [transferState.error, enqueueErrorSnackBar]);

  useEffect(() => {
    if (holdError) {
      enqueueErrorSnackBar({ message: holdError });
    }
  }, [holdError, enqueueErrorSnackBar]);

  useEffect(() => {
    if (
      transferState.status === 'completed' ||
      transferState.status === 'cancelled'
    ) {
      setCallError(null);
    }
  }, [transferState.status, setCallError]);

  const handleDismissError = useCallback(() => {
    setCallError(null);
  }, [setCallError]);

  const handleMuteToggle = useCallback(() => {
    if (!activeCall) return;
    const next = !isMuted;
    activeCall.mute(next);
    setIsMuted(next);
  }, [activeCall, isMuted, setIsMuted]);

  const handleHoldToggle = useCallback(() => {
    const next = !isOnHold;
    toggleHold(next);
  }, [isOnHold, toggleHold]);

  const handleEndCall = useCallback(() => {
    activeCall?.disconnect();
  }, [activeCall]);

  const handleDTMFToggle = useCallback(() => {
    setIsDTMFOpen((prev) => !prev);
  }, []);

  const handleTransferToggle = useCallback(() => {
    setIsTransferOpen((prev) => !prev);
    setIsDTMFOpen(false);
  }, []);

  const handleTransfer = useCallback(
    (to: string, type: 'cold' | 'warm') => {
      initiateTransfer(to, type);
      if (type === 'cold') {
        setIsTransferOpen(false);
      }
    },
    [initiateTransfer],
  );

  // keyboard shortcuts via twenty's hotkey system
  useDialerHotkeys({
    onMuteToggle: handleMuteToggle,
    onHoldToggle: handleHoldToggle,
    onTransferToggle: handleTransferToggle,
    onEndCall: isTransferOpen ? () => setIsTransferOpen(false) : handleEndCall,
  });

  if (!VISIBLE_STATUSES.has(callState.status)) return null;

  return (
    <StyledContainer>
      {isConsulting && (
        <StyledWarmBar>
          <StyledWarmLabel>Consulting with transfer target...</StyledWarmLabel>
          <StyledSmallButton onClick={completeTransfer}>
            <IconCheck size={14} />
            Complete
          </StyledSmallButton>
          <StyledSmallButton danger onClick={cancelTransfer}>
            <IconX size={14} />
            Cancel
          </StyledSmallButton>
        </StyledWarmBar>
      )}

      {callError && (
        <StyledErrorBar>
          <StyledErrorIcon size={16} />
          <StyledErrorText>{callError.message}</StyledErrorText>
          <StyledErrorDismiss
            onClick={handleDismissError}
            aria-label="Dismiss error"
          >
            <IconX size={14} />
          </StyledErrorDismiss>
        </StyledErrorBar>
      )}

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
          <StyledButton danger onClick={handleEndCall} aria-label="End call">
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
            active={isTransferOpen}
            onClick={handleTransferToggle}
            isDisabled={!isActive}
            aria-label="Transfer"
            aria-pressed={isTransferOpen}
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

      {isTransferOpen && isActive && (
        <TransferModal
          onTransfer={handleTransfer}
          onClose={() => setIsTransferOpen(false)}
          isTransferring={transferState.status === 'initiating'}
          error={transferState.status === 'failed' ? transferState.error : null}
        />
      )}
    </StyledContainer>
  );
};
