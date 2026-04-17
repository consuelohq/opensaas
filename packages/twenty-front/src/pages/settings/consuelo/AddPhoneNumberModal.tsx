import styled from '@emotion/styled';
import { useCallback, useMemo, useState } from 'react';
import { IconMapPin, IconPhone, IconSearch, IconX } from '@tabler/icons-react';

import { useSearchAvailableNumbers } from '@/dialer/hooks/useSearchAvailableNumbers';
import { useProvisionNumber } from '@/dialer/hooks/useProvisionNumber';
import { usePhoneNumberCheckout } from '@/dialer/hooks/usePhoneNumberCheckout';
import { type AvailableNumberOption } from '@/dialer/types/dialer';

type AddPhoneNumberModalProps = {
  onClose: () => void;
  onProvisioned: () => void;
};

const StyledOverlay = styled.div`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  box-shadow: ${({ theme }) => theme.boxShadow.strong};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  max-height: 640px;
  padding: ${({ theme }) => theme.spacing(4)};
  width: 520px;
`;

const StyledHeader = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
`;

const StyledTitle = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: 14px;
  font-weight: 600;
`;

const StyledCloseButton = styled.button`
  align-items: center;
  background: none;
  border: none;
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;
  display: flex;
  padding: 4px;

  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledHint = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: 12px;
`;

const StyledSearchRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledInput = styled.input`
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  flex: 1;
  font-size: 14px;
  outline: none;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};

  &:focus {
    border-color: ${({ theme }) => theme.color.blue};
  }

  &::placeholder {
    color: ${({ theme }) => theme.font.color.tertiary};
  }
`;

const StyledSearchButton = styled.button<{ isDisabled: boolean }>`
  align-items: center;
  background: ${({ theme }) => theme.color.blue};
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: #fff;
  cursor: ${({ isDisabled }) => (isDisabled ? 'not-allowed' : 'pointer')};
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  opacity: ${({ isDisabled }) => (isDisabled ? 0.5 : 1)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
`;

const StyledResultsList = styled.div`
  display: flex;
  flex-direction: column;
  max-height: 320px;
  overflow-y: auto;
`;

const StyledResultRow = styled.button<{ isSelected: boolean }>`
  align-items: flex-start;
  background: ${({ isSelected, theme }) =>
    isSelected ? theme.background.transparent.light : 'transparent'};
  border: 1px solid
    ${({ isSelected, theme }) =>
      isSelected ? theme.color.blue : theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  cursor: pointer;
  display: flex;
  gap: ${({ theme }) => theme.spacing(3)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
  text-align: left;
  width: 100%;
`;

const StyledResultInfo = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledResultNumber = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: 14px;
  font-weight: 600;
`;

const StyledResultLocation = styled.span`
  align-items: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  display: inline-flex;
  font-size: 12px;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledResultReason = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: 12px;
`;

const StyledRadio = styled.span<{ isSelected: boolean }>`
  background: ${({ isSelected, theme }) =>
    isSelected ? theme.color.blue : 'transparent'};
  border: 1px solid
    ${({ isSelected, theme }) =>
      isSelected ? theme.color.blue : theme.border.color.medium};
  border-radius: 999px;
  flex-shrink: 0;
  height: 16px;
  margin-top: 2px;
  width: 16px;
`;

const StyledFooter = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledBuyButton = styled.button<{ isDisabled: boolean }>`
  background: ${({ theme }) => theme.color.blue};
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: #fff;
  cursor: ${({ isDisabled }) => (isDisabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ isDisabled }) => (isDisabled ? 0.5 : 1)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
`;

const StyledError = styled.span`
  color: #ef4444;
  font-size: 12px;
`;

const StyledEmpty = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: 13px;
  padding: ${({ theme }) => theme.spacing(3)};
  text-align: center;
`;

const formatLocation = (number: AvailableNumberOption): string => {
  return [number.city, number.state, number.region].filter(Boolean).join(', ');
};

export const AddPhoneNumberModal = ({
  onClose,
  onProvisioned,
}: AddPhoneNumberModalProps) => {
  const [query, setQuery] = useState('');
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string | null>(
    null,
  );
  const { available, isSearching, error: searchError, search } =
    useSearchAvailableNumbers();
  const { isProvisioning, error: provisionError, provision } =
    useProvisionNumber();
  const {
    createCheckout,
    error: checkoutError,
    isCreatingCheckout,
  } = usePhoneNumberCheckout();

  const selectedNumber = useMemo(() => {
    return available.find((number) => number.phoneNumber === selectedPhoneNumber);
  }, [available, selectedPhoneNumber]);

  const canSearch = query.trim().length >= 2 && !isSearching;
  const isBusy = isProvisioning || isCreatingCheckout;
  const canBuy = selectedNumber !== undefined && !isBusy;

  const handleSearch = useCallback(() => {
    if (!canSearch) {
      return;
    }

    void search(query.trim());
  }, [canSearch, query, search]);

  const handleBuy = useCallback(async () => {
    if (!selectedNumber) {
      return;
    }

    const result = await provision(
      selectedNumber.areaCode,
      selectedNumber.phoneNumber,
    );

    if (result.success) {
      onProvisioned();
      onClose();
      return;
    }

    if (result.code === 'PHONE_NUMBER_SLOT_REQUIRED') {
      const checkout = await createCheckout();
      if (checkout.url) {
        window.location.href = checkout.url;
      }
    }
  }, [createCheckout, onClose, onProvisioned, provision, selectedNumber]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        handleSearch();
      }

      if (event.key === 'Escape') {
        onClose();
      }
    },
    [handleSearch, onClose],
  );

  const error = searchError ?? provisionError ?? checkoutError;

  return (
    <StyledOverlay>
      <StyledHeader>
        <StyledTitle>Add Phone Number</StyledTitle>
        <StyledCloseButton onClick={onClose} aria-label="Close">
          <IconX size={18} />
        </StyledCloseButton>
      </StyledHeader>

      <StyledHint>
        Search by city, state, market, or area code. We will rank the best
        matches and buy one number when you confirm.
      </StyledHint>

      <StyledSearchRow>
        <StyledInput
          type="text"
          placeholder="e.g. miami sales line or 415"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <StyledSearchButton
          isDisabled={!canSearch}
          onClick={handleSearch}
          aria-label="Search available numbers"
        >
          <IconSearch size={14} />
          {isSearching ? 'Searching...' : 'Search'}
        </StyledSearchButton>
      </StyledSearchRow>

      {error && <StyledError>{error}</StyledError>}

      <StyledResultsList>
        {available.length === 0 && query.trim().length >= 2 && !isSearching && !error ? (
          <StyledEmpty>No matching numbers found. Try a different market.</StyledEmpty>
        ) : null}

        {available.map((number) => {
          const isSelected = number.phoneNumber === selectedPhoneNumber;
          const location = formatLocation(number);

          return (
            <StyledResultRow
              key={number.phoneNumber}
              isSelected={isSelected}
              onClick={() => setSelectedPhoneNumber(number.phoneNumber)}
            >
              <StyledRadio isSelected={isSelected} />
              <StyledResultInfo>
                <StyledResultNumber>{number.phoneNumber}</StyledResultNumber>
                {location.length > 0 ? (
                  <StyledResultLocation>
                    <IconMapPin size={12} />
                    {location}
                  </StyledResultLocation>
                ) : null}
                {number.reason ? (
                  <StyledResultReason>{number.reason}</StyledResultReason>
                ) : null}
              </StyledResultInfo>
              <IconPhone size={14} />
            </StyledResultRow>
          );
        })}
      </StyledResultsList>

      <StyledFooter>
        <StyledHint>
          {selectedNumber
            ? `Selected ${selectedNumber.phoneNumber}`
            : 'Choose one number to continue'}
        </StyledHint>
        <StyledBuyButton isDisabled={!canBuy} onClick={() => void handleBuy()}>
          {isProvisioning
            ? 'Buying number...'
            : isCreatingCheckout
              ? 'Opening checkout...'
              : 'Buy Selected Number'}
        </StyledBuyButton>
      </StyledFooter>
    </StyledOverlay>
  );
};
