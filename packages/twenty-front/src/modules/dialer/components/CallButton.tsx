import styled from '@emotion/styled';
import { useCallback } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { IconLoader, IconPhone, IconPhoneOff } from 'twenty-ui/display';
import { captureException } from '@sentry/react';
import { useLingui } from '@lingui/react/macro';

import { useStartDialerCall } from '@/dialer/hooks/useStartDialerCall';
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

const StyledSpinner = styled(IconLoader)`
  animation: spin 1s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

export const CallButton = () => {
  const { t } = useLingui();
  const { status: callStatus } = useRecoilValue(callStateAtom);
  const phoneNumber = useRecoilValue(phoneNumberState);
  const selectedCallerId = useRecoilValue(selectedCallerIdState);
  const availableCallerIds = useRecoilValue(availableCallerIdsState);
  const selectedContact = useRecoilValue(selectedContactState);
  const setSelectedCallerId = useSetRecoilState(selectedCallerIdState);
  const setCallError = useSetRecoilState(callErrorState);
  const setCallState = useSetRecoilState(callStateAtom);
  const { preferences } = useUserPreferences();
  const { startDialerCall } = useStartDialerCall();
  const { disconnect } = useTwilioDevice();

  const isConnecting = callStatus === 'connecting' || callStatus === 'ringing';
  const isActive = callStatus === 'active';
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
      const result = await startDialerCall({
        source: 'direct',
        selectionStrategy: 'single',
        requestedFanout: 1,
        targetPhone: phoneNumber,
        contactId: selectedContact?.id,
        callerIdNumber: manualCallerId ?? undefined,
      });
      const call = result.calls[0];
      const resolvedCallerId = call?.callerId;

      if (!call || !resolvedCallerId) {
        setCallError({
          reason: 'no_caller_id',
          message: t`No caller ID available. Add a phone number in Settings → Dialer.`,
          occurredAt: new Date(),
        });
        return;
      }

      setSelectedCallerId(resolvedCallerId);
      setCallState((previousCallState) => ({
        ...previousCallState,
        status: 'connecting',
        callSid: call.callSid,
        contact: selectedContact,
        fromNumber: resolvedCallerId,
        parallelGroupId: result.sessionId,
        startedAt: new Date(),
      }));
    } catch (err: unknown) {
      captureException(err, {
        extra: {
          context: 'CallButton.startDialerCall',
          contactId: selectedContact?.id,
          localPresenceEnabled,
        },
      });
      setCallState((previousCallState) => ({
        ...previousCallState,
        status: 'failed',
      }));
    }
  }, [
    isInCall,
    valid,
    hasCallerIdAvailable,
    localPresenceEnabled,
    defaultCallerId,
    phoneNumber,
    disconnect,
    setCallError,
    setCallState,
    setSelectedCallerId,
    startDialerCall,
    selectedContact,
    t,
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
