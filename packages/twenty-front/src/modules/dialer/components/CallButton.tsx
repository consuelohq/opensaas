import styled from '@emotion/styled';
import { useCallback } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { IconPhone, IconPhoneOff } from 'twenty-ui/display';
import { IconLoader2 } from '@tabler/icons-react';
import { captureException } from '@sentry/react';
import { useLingui } from '@lingui/react/macro';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';
import { useTwilioDevice } from '@/dialer/hooks/useTwilioDevice';
import { phoneNumberState } from '@/dialer/states/phoneNumberState';
import { selectedCallerIdState } from '@/dialer/states/selectedCallerIdState';
import { availableCallerIdsState } from '@/dialer/states/availableCallerIdsState';
import { selectedContactState } from '@/dialer/states/selectedContactState';
import { callErrorState } from '@/dialer/states/callErrorState';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import { stripNonDigits } from '@/dialer/utils/phoneFormat';
import { useUserPreferences } from '@/settings/hooks/useUserPreferences';

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
  color: ${({ theme }) => theme.font.color.inverted};
  cursor: ${({ variant }) =>
    variant === 'disabled' ? 'not-allowed' : 'pointer'};
  opacity: ${({ variant }) => (variant === 'disabled' ? 0.5 : 1)};
  transition:
    background 120ms,
    transform 80ms;
  background: ${({ variant, theme }) =>
    variant === 'end'
      ? theme.color.red
      : variant === 'disabled'
        ? theme.color.gray
        : theme.color.green};

  &:hover:not(:disabled) {
    background: ${({ variant, theme }) =>
      variant === 'end'
        ? theme.color.red
        : variant === 'disabled'
          ? theme.color.gray
          : theme.color.green};
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
  const { t } = useLingui();
  const callState = useRecoilValue(callStateAtom);
  const phoneNumber = useRecoilValue(phoneNumberState);
  const selectedCallerId = useRecoilValue(selectedCallerIdState);
  const availableCallerIds = useRecoilValue(availableCallerIdsState);
  const selectedContact = useRecoilValue(selectedContactState);
  const setSelectedCallerId = useSetRecoilState(selectedCallerIdState);
  const setCallError = useSetRecoilState(callErrorState);
  const { preferences } = useUserPreferences();
  const { connect, disconnect } = useTwilioDevice();

  const isConnecting =
    callState.status === 'connecting' || callState.status === 'ringing';
  const isActive = callState.status === 'active';
  const isInCall = isConnecting || isActive;
  const valid = isValidNumber(phoneNumber);
  const localPresenceEnabled = preferences.dialer.localPresenceEnabled;
  const defaultCallerId =
    selectedCallerId ?? availableCallerIds[0]?.phoneNumber ?? null;
  const hasCallerIdAvailable = defaultCallerId !== null;

  const handleClick = useCallback(async () => {
    if (isInCall) {
      disconnect();

      return;
    }

    if (!valid || !hasCallerIdAvailable) {
      if (!hasCallerIdAvailable) {
        setCallError({
          reason: 'no_caller_id',
          message: t`No caller ID available. Add a phone number in Settings → Dialer.`,
          occurredAt: new Date(),
        });
      }
      return;
    }

    const manualCallerId = localPresenceEnabled ? undefined : defaultCallerId;

    try {
      const preflightRes = await authenticatedFetch(
        `${REACT_APP_SERVER_BASE_URL}/v1/voice/preflight`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callerId: manualCallerId,
            to: phoneNumber,
            localPresence: localPresenceEnabled,
          }),
        },
      );

      if (!preflightRes.ok) {
        if (preflightRes.status === 409) {
          setCallError({
            reason: 'caller_id_locked',
            message: t`Number in use by another agent`,
            occurredAt: new Date(),
          });
          return;
        }

        captureException(
          new Error(`Preflight failed: ${preflightRes.status}`),
          {
            extra: {
              status: preflightRes.status,
              callerId: manualCallerId,
              localPresenceEnabled,
            },
          },
        );

        if (!manualCallerId) {
          return;
        }
      }

      const preflightBody = preflightRes.ok
        ? ((await preflightRes.json()) as { callerId?: string })
        : null;
      const resolvedCallerId = preflightBody?.callerId ?? manualCallerId;

      if (!resolvedCallerId) {
        setCallError({
          reason: 'no_caller_id',
          message: t`No caller ID available. Add a phone number in Settings → Dialer.`,
          occurredAt: new Date(),
        });
        return;
      }

      setSelectedCallerId(resolvedCallerId);
      await connect({ To: phoneNumber, From: resolvedCallerId });
    } catch (err: unknown) {
      captureException(err, {
        extra: {
          // eslint-disable-next-line lingui/no-unlocalized-strings
          context: 'CallButton.connect',
          to: phoneNumber,
          from: manualCallerId,
          localPresenceEnabled,
        },
      });
      // connect failure already sets callState to 'failed' via useTwilioDevice
    }
  }, [
    isInCall,
    valid,
    hasCallerIdAvailable,
    localPresenceEnabled,
    defaultCallerId,
    phoneNumber,
    connect,
    disconnect,
    setCallError,
    setSelectedCallerId,
  ]);

  const isDisabled = !isInCall && (!valid || !hasCallerIdAvailable);
  const variant = isInCall ? 'end' : isDisabled ? 'disabled' : 'call';

  const firstName = selectedContact?.firstName;
  const label = isConnecting
    ? t`Connecting...`
    : isActive
      ? t`End Call`
      : firstName
        ? t`Call ${firstName}`
        : t`Call`;

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
