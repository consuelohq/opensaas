import styled from '@emotion/styled';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { IconPhone, IconX } from '@tabler/icons-react';

import { availableCallerIdsState } from '@/dialer/states/availableCallerIdsState';
import { phoneNumberState } from '@/dialer/states/phoneNumberState';
import { selectedCallerIdState } from '@/dialer/states/selectedCallerIdState';
import { selectedContactState } from '@/dialer/states/selectedContactState';
import { formatPhone } from '@/dialer/utils/phoneFormat';

type DialConfirmationModalProps = {
  onClose: () => void;
  onConfirm: (callerId: string) => void;
};

// consistent hue from string (same as ContactHeader)
const hashColor = (id: string): string => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }

  return `hsl(${Math.abs(hash) % 360}, 55%, 45%)`;
};

const StyledOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: ${({ theme }) => theme.background.primary};
  z-index: 10;
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing(4)};
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const StyledTitle = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledCloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ theme }) => theme.font.color.tertiary};
  padding: 4px;
  display: flex;
  align-items: center;

  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledContactRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledAvatar = styled.div<{ bgColor: string }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 600;
  font-size: ${({ theme }) => theme.font.size.sm};
  background: ${({ bgColor }) => bgColor};
  flex-shrink: 0;
`;

const StyledContactInfo = styled.div`
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
`;

const StyledDivider = styled.hr`
  border: none;
  border-top: 1px solid ${({ theme }) => theme.border.color.medium};
  margin: 0;
`;

const StyledLabel = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledSelect = styled.select`
  width: 100%;
  padding: ${({ theme }) => theme.spacing(3)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.secondary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: 14px;
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme.color.blue};
  }
`;

const StyledActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: auto;
`;

const StyledCancelButton = styled.button`
  flex: 1;
  padding: ${({ theme }) => theme.spacing(3)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.secondary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
`;

const StyledConfirmButton = styled.button<{ isDisabled: boolean }>`
  flex: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: #22c55e;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: ${({ isDisabled }) => (isDisabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ isDisabled }) => (isDisabled ? 0.5 : 1)};

  &:hover:not(:disabled) {
    background: #16a34a;
  }
`;

export const DialConfirmationModal = ({
  onClose,
  onConfirm,
}: DialConfirmationModalProps) => {
  const contact = useRecoilValue(selectedContactState);
  const phoneNumber = useRecoilValue(phoneNumberState);
  const selectedCallerId = useRecoilValue(selectedCallerIdState);
  const availableCallerIds = useRecoilValue(availableCallerIdsState);

  const [callerId, setCallerId] = useState(
    selectedCallerId ?? availableCallerIds[0]?.phoneNumber ?? '',
  );

  const handleConfirm = useCallback(() => {
    if (!callerId) return;
    onConfirm(callerId);
  }, [callerId, onConfirm]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Enter') handleConfirm();
    };

    document.addEventListener('keydown', handler);

    return () => document.removeEventListener('keydown', handler);
  }, [onClose, handleConfirm]);

  const initials = contact
    ? [contact.firstName, contact.lastName]
        .filter(Boolean)
        .map((n) => n!.charAt(0).toUpperCase())
        .join('')
    : '?';

  const avatarColor = contact ? hashColor(contact.id) : '#374151';

  return (
    <StyledOverlay>
      <StyledHeader>
        <StyledTitle>Confirm Call</StyledTitle>
        <StyledCloseButton onClick={onClose} aria-label="Close">
          <IconX size={18} />
        </StyledCloseButton>
      </StyledHeader>

      <StyledContactRow>
        <StyledAvatar bgColor={avatarColor}>{initials}</StyledAvatar>
        <StyledContactInfo>
          <StyledName>{contact?.name ?? 'Unknown Number'}</StyledName>
          {contact?.company && <StyledDetail>{contact.company}</StyledDetail>}
          <StyledDetail>{formatPhone(phoneNumber)}</StyledDetail>
        </StyledContactInfo>
      </StyledContactRow>

      <StyledDivider />

      <div>
        <StyledLabel>Caller ID</StyledLabel>
        {availableCallerIds.length <= 1 ? (
          <StyledDetail>
            {availableCallerIds[0]
              ? `${formatPhone(availableCallerIds[0].phoneNumber)} — ${availableCallerIds[0].friendlyName}`
              : 'No caller IDs available'}
          </StyledDetail>
        ) : (
          <StyledSelect
            value={callerId}
            onChange={(e) => setCallerId(e.target.value)}
          >
            {availableCallerIds.map((option) => (
              <option key={option.phoneNumber} value={option.phoneNumber}>
                {formatPhone(option.phoneNumber)} — {option.friendlyName}
              </option>
            ))}
          </StyledSelect>
        )}
      </div>

      <StyledActions>
        <StyledCancelButton onClick={onClose}>Cancel</StyledCancelButton>
        <StyledConfirmButton
          isDisabled={!callerId}
          disabled={!callerId}
          onClick={handleConfirm}
        >
          <IconPhone size={16} />
          Call Now
        </StyledConfirmButton>
      </StyledActions>
    </StyledOverlay>
  );
};
