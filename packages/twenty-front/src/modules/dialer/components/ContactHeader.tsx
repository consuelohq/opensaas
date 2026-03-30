import { css, keyframes, type Theme } from '@emotion/react';
import styled from '@emotion/styled';
import { useRecoilValue } from 'recoil';
import { useLingui, Trans } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';

import { useCallDuration } from '@/dialer/hooks/useCallDuration';
import { isOnHoldState } from '@/dialer/states/isOnHoldState';
import { phoneNumberState } from '@/dialer/states/phoneNumberState';
import { selectedContactState } from '@/dialer/states/selectedContactState';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import { type CallStatus } from '@/dialer/types/dialer';
import { formatDurationTimer } from '@/dialer/utils/callDuration';
import { formatPhone } from '@/dialer/utils/phoneFormat';
import { hashColor } from '@/dialer/utils/avatarColor';

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`;

type DisplayStatus = CallStatus | 'on-hold';

const STATUS_CONFIG: Record<
  DisplayStatus,
  {
    colorKey: 'transparent' | 'yellow' | 'green' | 'orange' | 'gray' | 'red';
    label: ReturnType<typeof msg> | null;
    pulses: boolean;
  }
> = {
  idle: { colorKey: 'transparent', label: null, pulses: false },
  connecting: { colorKey: 'yellow', label: msg`Connecting...`, pulses: true },
  ringing: { colorKey: 'yellow', label: msg`Ringing...`, pulses: true },
  active: { colorKey: 'green', label: msg`Connected`, pulses: false },
  'on-hold': { colorKey: 'orange', label: msg`On Hold`, pulses: false },
  ended: { colorKey: 'gray', label: msg`Ended`, pulses: false },
  failed: { colorKey: 'red', label: msg`Failed`, pulses: false },
};

const getStatusColor = (theme: Theme, colorKey: string): string => {
  switch (colorKey) {
    case 'yellow':
      return theme.color.yellow;
    case 'green':
      return theme.color.green;
    case 'orange':
      return theme.color.orange;
    case 'gray':
      return theme.color.gray;
    case 'red':
      return theme.color.red;
    default:
      return 'transparent';
  }
};

// derive a consistent hue from a string

const StyledContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledAvatarWrapper = styled.div`
  flex-shrink: 0;
  position: relative;
`;

const StyledAvatar = styled.div<{ bgColor: string }>`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.font.color.inverted};
  font-weight: 600;
  font-size: ${({ theme }) => theme.font.size.md};
  background: ${({ bgColor }) => bgColor};
`;

const StyledStatusDot = styled.div<{ colorKey: string; pulses: boolean }>`
  position: absolute;
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid ${({ theme }) => theme.background.primary};
  background: ${({ theme, colorKey }) => getStatusColor(theme, colorKey)};
  ${({ pulses }) =>
    pulses &&
    css`
      animation: ${pulse} 1.5s ease-in-out infinite;
    `}
`;

const StyledInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const StyledName = styled.span`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledDetail = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledStatusLine = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

export const ContactHeader = () => {
  const { i18n, t } = useLingui();
  const callState = useRecoilValue(callStateAtom);
  const selectedContact = useRecoilValue(selectedContactState);
  const isOnHold = useRecoilValue(isOnHoldState);
  const phoneNumber = useRecoilValue(phoneNumberState);
  const duration = useCallDuration();

  const displayStatus: DisplayStatus =
    isOnHold && callState.status === 'active' ? 'on-hold' : callState.status;
  const config = STATUS_CONFIG[displayStatus];

  const showDuration =
    displayStatus === 'active' || displayStatus === 'on-hold';

  if (!selectedContact) {
    return (
      <StyledContainer aria-label={t`No contact selected`}>
        <StyledInfo>
          <StyledName>
            {phoneNumber ? (
              formatPhone(phoneNumber)
            ) : (
              <Trans>Enter a number to call</Trans>
            )}
          </StyledName>
        </StyledInfo>
      </StyledContainer>
    );
  }

  const initials = [selectedContact.firstName, selectedContact.lastName]
    .filter(Boolean)
    .map((n) => n!.charAt(0).toUpperCase())
    .join('');

  const label = config.label ? i18n._(config.label) : null;
  const contactName = selectedContact.name ?? t`Unknown`;

  return (
    <StyledContainer aria-label={t`Contact: ${contactName}`}>
      <StyledAvatarWrapper>
        <StyledAvatar bgColor={hashColor(selectedContact.id)}>
          {initials || '?'}
        </StyledAvatar>
        {label && (
          <StyledStatusDot
            colorKey={config.colorKey}
            pulses={config.pulses}
            aria-label={label}
          />
        )}
      </StyledAvatarWrapper>
      <StyledInfo>
        <StyledName>
          {selectedContact.name ?? <Trans>Unknown</Trans>}
        </StyledName>
        {selectedContact.company && (
          <StyledDetail>{selectedContact.company}</StyledDetail>
        )}
        <StyledDetail>{formatPhone(selectedContact.phone)}</StyledDetail>
        {label && (
          <StyledStatusLine>
            {label}
            {showDuration && ` • ${formatDurationTimer(duration)}`}
          </StyledStatusLine>
        )}
      </StyledInfo>
    </StyledContainer>
  );
};
