import styled from '@emotion/styled';
import { useCallback, useState } from 'react';
import { IconPhone, IconSearch, IconX } from '@tabler/icons-react';

import { useSearchAvailableNumbers } from '@/dialer/hooks/useSearchAvailableNumbers';
import { useProvisionNumber } from '@/dialer/hooks/useProvisionNumber';
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
  max-height: 480px;
  padding: ${({ theme }) => theme.spacing(4)};
  width: 400px;
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
  font-size: 13px;
  opacity: ${({ isDisabled }) => (isDisabled ? 0.5 : 1)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};

  &:hover:not(:disabled) {
    opacity: 0.9;
  }
`;

const StyledResultsList = styled.div`
  display: flex;
  flex-direction: column;
  max-height: 280px;
  overflow-y: auto;
`;

const StyledResultRow = styled.button`
  align-items: center;
  background: transparent;
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  cursor: pointer;
  display: flex;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  text-align: left;
  width: 100%;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${({ theme }) => theme.background.transparent.lighter};
  }
`;

const StyledResultInfo = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
`;

const StyledResultNumber = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: 14px;
`;

const StyledResultLocation = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: 12px;
`;

const StyledGetButton = styled.button<{ isDisabled: boolean }>`
  background: ${({ theme }) => theme.color.blue};
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: #fff;
  cursor: ${({ isDisabled }) => (isDisabled ? 'not-allowed' : 'pointer')};
  font-size: 12px;
  opacity: ${({ isDisabled }) => (isDisabled ? 0.5 : 1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
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

export const AddPhoneNumberModal = ({
  onClose,
  onProvisioned,
}: AddPhoneNumberModalProps) => {
  const [areaCode, setAreaCode] = useState('');
  const [provisioningSid, setProvisioningSid] = useState<string | null>(null);
  const { available, isSearching, error: searchError, search } = useSearchAvailableNumbers();
  const { isProvisioning, error: provisionError, provision } = useProvisionNumber();

  const canSearch = /^\d{3}$/.test(areaCode) && !isSearching;

  const handleSearch = useCallback(() => {
    if (canSearch) {
      search(areaCode);
    }
  }, [canSearch, areaCode, search]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') handleSearch();
      if (event.key === 'Escape') onClose();
    },
    [handleSearch, onClose],
  );

  const handleProvision = useCallback(
    async (number: AvailableNumberOption) => {
      setProvisioningSid(number.phoneNumber);
      const result = await provision(number.areaCode, number.phoneNumber);
      if (result.success) {
        onProvisioned();
        onClose();
      }
      setProvisioningSid(null);
    },
    [provision, onProvisioned, onClose],
  );

  const handleAreaCodeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const digits = event.target.value.replace(/\D/g, '').slice(0, 3);
      setAreaCode(digits);
    },
    [],
  );

  const error = searchError ?? provisionError;

  return (
    <StyledOverlay>
      <StyledHeader>
        <StyledTitle>Add Phone Number</StyledTitle>
        <StyledCloseButton onClick={onClose} aria-label="Close">
          <IconX size={18} />
        </StyledCloseButton>
      </StyledHeader>

      <StyledSearchRow>
        <StyledInput
          type="tel"
          placeholder="Area code (e.g. 415)"
          value={areaCode}
          onChange={handleAreaCodeChange}
          onKeyDown={handleKeyDown}
          maxLength={3}
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
        {available.length === 0 && !isSearching && areaCode.length === 3 && !error && (
          <StyledEmpty>No numbers found for area code {areaCode}</StyledEmpty>
        )}
        {available.map((number) => {
          const isThisProvisioning = isProvisioning && provisioningSid === number.phoneNumber;
          return (
            <StyledResultRow key={number.phoneNumber} onClick={() => handleProvision(number)}>
              <IconPhone size={14} />
              <StyledResultInfo>
                <StyledResultNumber>{number.phoneNumber}</StyledResultNumber>
                {(number.city ?? number.state) && (
                  <StyledResultLocation>
                    {[number.city, number.state].filter(Boolean).join(', ')}
                  </StyledResultLocation>
                )}
              </StyledResultInfo>
              <StyledGetButton
                isDisabled={isProvisioning}
                onClick={(event) => {
                  event.stopPropagation();
                  handleProvision(number);
                }}
              >
                {isThisProvisioning ? 'Getting...' : 'Get'}
              </StyledGetButton>
            </StyledResultRow>
          );
        })}
      </StyledResultsList>
    </StyledOverlay>
  );
};
