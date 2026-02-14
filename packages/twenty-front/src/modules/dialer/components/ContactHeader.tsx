import styled from '@emotion/styled';
import { css, keyframes } from '@emotion/react';
import { useRecoilValue } from 'recoil';

import { callStateAtom } from '@/dialer/states/callStateAtom';
import { isOnHoldState } from '@/dialer/states/isOnHoldState';
import { selectedContactState } from '@/dialer/states/selectedContactState';
import { type CallStatus } from '@/dialer/types/dialer';
import { formatDuration } from '@/dialer/utils/callDuration';
import { formatPhone } from '@/dialer/utils/phoneFormat';

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`;

type DisplayStatus = CallStatus | 'on-hold';

const STATUS_CONFIG: Record<
  DisplayStatus,
  { color: string; label: string; pulses: boolean }
> = {
  idle: { color: 'transparent', label: '', pulses: false },
  connecting: { color: '#eab308', label: 'Connecting...', pulses: true },
  ringing: { color: '#eab308', label: 'Ringing...', pulses: true },
  active: { color: '#22c55e', label: 'Connected', pulses: false },
  'on-hold': { color: '#f97316', label: 'On Hold', pulses: false },
  ended: { color: '#6b7280', label: 'Ended', pulses: false },
  failed: { color: '#ef4444', label: 'Failed', pulses: false },
};

// derive a consistent hue from a string
const hashColor = (id: string): string => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 55%, 45%)`;
};

const StyledContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledAvatarWrapper = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const StyledAvatar = styled.div<{ bgColor: string }>`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 600;
  font-size: ${({ theme }) => theme.font.size.md};
  background: ${({ bgColor }) => bgColor};
`;

const StyledStatusDot = styled.div<{ dotColor: string; pulses: boolean }>`
  position: absolute;
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid ${({ theme }) => theme.background.primary};
  background: ${({ dotColor }) => dotColor};
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
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

export const ContactHeader = () => {
  const callState = useRecoilValue(callStateAtom);
  const contact = useRecoilValue(selectedContactState);
  const isOnHold = useRecoilValue(isOnHoldState);

  const displayStatus: DisplayStatus =
    isOnHold && callState.status === 'active' ? 'on-hold' : callState.status;
  const config = STATUS_CONFIG[displayStatus];

  const showDuration =
    displayStatus === 'active' || displayStatus === 'on-hold';

  if (!contact) {
    return (
      <StyledContainer aria-label="No contact selected">
        <StyledAvatar bgColor="#374151">📞</StyledAvatar>
        <StyledInfo>
          <StyledName>Enter a number to call</StyledName>
        </StyledInfo>
      </StyledContainer>
    );
  }

  const initials = [contact.firstName, contact.lastName]
    .filter(Boolean)
    .map((n) => n!.charAt(0).toUpperCase())
    .join('');

  return (
    <StyledContainer aria-label={`Contact: ${contact.name ?? 'Unknown'}`}>
      <StyledAvatarWrapper>
        <StyledAvatar bgColor={hashColor(contact.id)}>
          {initials || '?'}
        </StyledAvatar>
        {config.label && (
          <StyledStatusDot
            dotColor={config.color}
            pulses={config.pulses}
            aria-label={config.label}
          />
        )}
      </StyledAvatarWrapper>
      <StyledInfo>
        <StyledName>{contact.name ?? 'Unknown'}</StyledName>
        {contact.company && <StyledDetail>{contact.company}</StyledDetail>}
        <StyledDetail>{formatPhone(contact.phone)}</StyledDetail>
        {config.label && (
          <StyledStatusLine>
            {config.label}
            {showDuration && ` • ${formatDuration(callState.duration)}`}
          </StyledStatusLine>
        )}
      </StyledInfo>
    </StyledContainer>
  );
};
