import styled from '@emotion/styled';
import { useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import { IconLoader2, IconPhone, IconPhoneOff } from '@tabler/icons-react';

import { useTwilioDevice } from '@/dialer/hooks/useTwilioDevice';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import { phoneNumberState } from '@/dialer/states/phoneNumberState';
import { selectedCallerIdState } from '@/dialer/states/selectedCallerIdState';
import { availableCallerIdsState } from '@/dialer/states/availableCallerIdsState';
import { selectedContactState } from '@/dialer/states/selectedContactState';
import { stripNonDigits } from '@/dialer/utils/phoneFormat';

const isValidNumber = (phone: string): boolean => {
  const digits = stripNonDigits(phone);

  return digits.length >= 10 && digits.length <= 15;
};

const StyledButton = styled.button<{ variant: 'call' | 'end' | 'disabled' }>`
  width: 100%;
  height: 48px;
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.md};
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: #fff;
  cursor: ${({ variant }) => (variant === 'disabled' ? 'not-allowed' : 'pointer')};
  opacity: ${({ variant }) => (variant === 'disabled' ? 0.5 : 1)};
  transition: background 120ms, transform 80ms;
  background: ${({ variant }) =>
    variant === 'end' ? '#ef4444' : variant === 'disabled' ? '#9ca3af' : '#22c55e'};

  &:hover:not(:disabled) {
    background: ${({ variant }) =>
      variant === 'end' ? '#dc2626' : variant === 'disabled' ? '#9ca3af' : '#16a34a'};
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
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

export const CallButton = () => {
  const callState = useRecoilValue(callStateAtom);
  const rawNumber = useRecoilValue(phoneNumberState);
  const selectedCallerId = useRecoilValue(selectedCallerIdState);
  const availableCallerIds = useRecoilValue(availableCallerIdsState);
  const contact = useRecoilValue(selectedContactState);
  const { connect, disconnect } = useTwilioDevice();

  const isConnecting = callState.status === 'connecting' || callState.status === 'ringing';
  const isActive = callState.status === 'active';
  const isInCall = isConnecting || isActive;
  const valid = isValidNumber(rawNumber);
  const fromNumber = selectedCallerId ?? availableCallerIds[0]?.phoneNumber ?? null;

  const handleClick = useCallback(async () => {
    if (isInCall) {
      disconnect();

      return;
    }

    if (!valid || !fromNumber) return;

    try {
      await connect({ To: rawNumber, From: fromNumber });
    } catch (err: unknown) {
      // connect failure already sets callState to 'failed' via useTwilioDevice
    }
  }, [isInCall, valid, fromNumber, rawNumber, connect, disconnect]);

  const variant = isInCall ? 'end' : !valid ? 'disabled' : 'call';
  const isDisabled = !isInCall && !valid;

  const label = isConnecting
    ? 'Connecting...'
    : isActive
      ? 'End Call'
      : contact?.firstName
        ? `Call ${contact.firstName}`
        : 'Call';

  return (
    <StyledButton
      variant={variant}
      disabled={isDisabled}
      onClick={handleClick}
      aria-label={label}
      role="button"
    >
      {isConnecting ? (
        <StyledSpinner size={20} />
      ) : isActive ? (
        <IconPhoneOff size={20} />
      ) : (
        <IconPhone size={20} />
      )}
      {label}
    </StyledButton>
  );
};
