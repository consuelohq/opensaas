import { useCallerIdSelection } from '@/dialer/hooks/useCallerIdSelection';
import { formatPhone } from '@/dialer/utils/phoneFormat';
import styled from '@emotion/styled';
import { IconMapPin, IconPhone } from '@tabler/icons-react';
import { useState } from 'react';

const StyledContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1.5)};
  padding: ${({ theme }) => theme.spacing(1.5)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.tertiary};
  cursor: pointer;
  position: relative;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};

  &:hover {
    background: ${({ theme }) => theme.background.quaternary};
  }
`;

const StyledLocalBadge = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.color.green};
  background: ${({ theme }) => theme.background.transparent.green};
  padding: 1px ${({ theme }) => theme.spacing(1)};
  border-radius: ${({ theme }) => theme.border.radius.pill};
`;

const StyledDropdown = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: ${({ theme }) => theme.spacing(0.5)};
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  box-shadow: ${({ theme }) => theme.boxShadow.strong};
  z-index: 10;
  max-height: 200px;
  overflow-y: auto;
`;

const StyledOption = styled.div<{ isSelected: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1.5)};
  padding: ${({ theme }) => theme.spacing(1.5)} ${({ theme }) => theme.spacing(2)};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.sm};
  background: ${({ isSelected, theme }) =>
    isSelected ? theme.background.tertiary : 'transparent'};

  &:hover {
    background: ${({ theme }) => theme.background.quaternary};
  }
`;

const StyledLabel = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  margin-right: ${({ theme }) => theme.spacing(0.5)};
`;

export const LocalPresenceIndicator = () => {
  const { selectedCallerId, setSelectedCallerId, availableNumbers, isLocalMatch } =
    useCallerIdSelection();
  const [isOpen, setIsOpen] = useState(false);

  if (!selectedCallerId || availableNumbers.length === 0) return null;

  const selected = availableNumbers.find(
    (n) => n.phoneNumber === selectedCallerId,
  );

  return (
    <StyledContainer onClick={() => setIsOpen(!isOpen)}>
      <IconPhone size={14} />
      <StyledLabel>From:</StyledLabel>
      <span>{selected ? formatPhone(selected.phoneNumber) : formatPhone(selectedCallerId)}</span>
      {isLocalMatch && (
        <StyledLocalBadge>
          <IconMapPin size={10} style={{ marginRight: 2, verticalAlign: -1 }} />
          Local
        </StyledLocalBadge>
      )}
      {isOpen && availableNumbers.length > 1 && (
        <StyledDropdown>
          {availableNumbers.map((option) => (
            <StyledOption
              key={option.phoneNumber}
              isSelected={option.phoneNumber === selectedCallerId}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedCallerId(option.phoneNumber);
                setIsOpen(false);
              }}
            >
              {formatPhone(option.phoneNumber)}
              {option.friendlyName && (
                <StyledLabel>— {option.friendlyName}</StyledLabel>
              )}
            </StyledOption>
          ))}
        </StyledDropdown>
      )}
    </StyledContainer>
  );
};
