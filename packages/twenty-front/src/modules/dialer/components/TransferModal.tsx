import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import { useCallback, useState } from 'react';
import { IconPhone, IconX } from 'twenty-ui/display';

import { type TransferType } from '@/dialer/types/dialer';
import {
  formatPhone,
  stripNonDigits,
  toE164,
} from '@/dialer/utils/phoneFormat';

type TransferModalProps = {
  onTransfer: (to: string, type: TransferType) => void;
  onClose: () => void;
  isTransferring: boolean;
  error: string | null;
};

const StyledOverlay = styled.div`
  background: ${({ theme }) => theme.background.primary};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  inset: 0;
  padding: ${({ theme }) => theme.spacing(4)};
  position: absolute;
  z-index: 10;
`;

const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const StyledTitle = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: 14px;
  font-weight: 600;
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

const StyledInput = styled.input`
  width: 100%;
  padding: ${({ theme }) => theme.spacing(3)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.secondary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: 16px;
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme.color.blue};
  }

  &::placeholder {
    color: ${({ theme }) => theme.font.color.tertiary};
  }
`;

const StyledToggle = styled.div`
  display: flex;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
`;

const StyledToggleOption = styled.button<{ active: boolean }>`
  flex: 1;
  padding: ${({ theme }) => theme.spacing(2)};
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: background 120ms;
  background: ${({ active, theme }) =>
    active ? theme.color.blue : theme.background.secondary};
  color: ${({ active, theme }) =>
    active ? theme.font.color.inverted : theme.font.color.secondary};
`;

const StyledDescription = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.font.color.tertiary};
  line-height: 1.4;
`;

const StyledError = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.color.red};
  line-height: 1.4;
`;

const StyledTransferButton = styled.button<{ isDisabled: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.color.blue};
  color: ${({ theme }) => theme.font.color.inverted};
  font-size: 14px;
  font-weight: 500;
  cursor: ${({ isDisabled }) => (isDisabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ isDisabled }) => (isDisabled ? 0.5 : 1)};
  transition: background 120ms;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }
`;

const DESCRIPTIONS: Record<TransferType, ReturnType<typeof msg>> = {
  cold: msg`Immediately connects the customer to the new number. You will be disconnected.`,
  warm: msg`Puts the customer on hold while you speak with the new party first.`,
};

export const TransferModal = ({
  onTransfer,
  onClose,
  isTransferring,
  error,
}: TransferModalProps) => {
  const { t } = useLingui();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [transferType, setTransferType] = useState<TransferType>('warm');

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const digits = stripNonDigits(event.target.value);
      setPhoneNumber(formatPhone(digits));
    },
    [],
  );

  const handleClearError = useCallback(() => {
    setPhoneNumber('');
  }, []);

  const handleTransfer = useCallback(() => {
    if (isTransferring) return;

    const normalizedPhoneNumber = toE164(phoneNumber);

    if (normalizedPhoneNumber === null) return;

    onTransfer(normalizedPhoneNumber, transferType);
  }, [phoneNumber, transferType, isTransferring, onTransfer]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') handleTransfer();
      if (event.key === 'Escape') onClose();
    },
    [handleTransfer, onClose],
  );

  const digits = stripNonDigits(phoneNumber);
  const canTransfer = digits.length >= 10 && !isTransferring;

  return (
    <StyledOverlay>
      <StyledHeader>
        <StyledTitle>{t`Transfer Call`}</StyledTitle>
        <StyledCloseButton onClick={onClose} aria-label={t`Close transfer`}>
          <IconX size={18} />
        </StyledCloseButton>
      </StyledHeader>

      <StyledInput
        type="tel"
        placeholder={t`Enter phone number`}
        value={phoneNumber}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        autoFocus
      />

      {error && <StyledError>{error}</StyledError>}

      <StyledToggle>
        <StyledToggleOption
          active={transferType === 'warm'}
          onClick={() => setTransferType('warm')}
        >
          {t`Warm`}
        </StyledToggleOption>
        <StyledToggleOption
          active={transferType === 'cold'}
          onClick={() => setTransferType('cold')}
        >
          {t`Cold`}
        </StyledToggleOption>
      </StyledToggle>

      <StyledDescription>{t(DESCRIPTIONS[transferType])}</StyledDescription>

      <StyledTransferButton
        isDisabled={!canTransfer}
        onClick={handleTransfer}
        aria-label={t`Start transfer`}
      >
        <IconPhone size={16} />
        {isTransferring ? t`Transferring...` : t`Transfer`}
      </StyledTransferButton>
    </StyledOverlay>
  );
};
