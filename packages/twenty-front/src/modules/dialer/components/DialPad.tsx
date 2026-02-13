import styled from '@emotion/styled';
import { useCallback, useEffect, useRef } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

import { DIAL_PAD_KEYS } from '@/dialer/constants/dialerConstants';
import { useDTMF } from '@/dialer/hooks/useDTMF';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import { phoneNumberState } from '@/dialer/states/phoneNumberState';
import { type DialPadKey } from '@/dialer/types/dialer';
import {
  formatPhone,
  stripNonDigits,
} from '@/dialer/utils/phoneFormat';

type DialPadProps = {
  onCall?: (phoneNumber: string) => void;
};

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(2)};
  outline: none;
`;

const StyledInputRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledPhoneDisplay = styled.input`
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xl};
  font-variant-numeric: tabular-nums;
  text-align: center;
  pointer-events: none;
  caret-color: transparent;

  &::placeholder {
    color: ${({ theme }) => theme.font.color.light};
  }
`;

const StyledBackspace = styled.button<{ visible: boolean }>`
  background: none;
  border: none;
  color: ${({ theme }) => theme.font.color.secondary};
  cursor: pointer;
  font-size: 20px;
  padding: ${({ theme }) => theme.spacing(1)};
  visibility: ${({ visible }) => (visible ? 'visible' : 'hidden')};
  border-radius: ${({ theme }) => theme.border.radius.sm};

  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${({ theme }) => theme.spacing(3)};
  justify-items: center;
`;

const StyledKey = styled.button<{ disabled: boolean }>`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.primary};
  cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
  opacity: ${({ disabled }) => (disabled ? 0.4 : 1)};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: background 120ms;
  user-select: none;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.color.green};
    color: #fff;
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }
`;

const StyledDigit = styled.span`
  font-size: 22px;
  font-weight: ${({ theme }) => theme.font.weight.medium};
  line-height: 1;
`;

const StyledLetters = styled.span`
  font-size: 9px;
  letter-spacing: 1.5px;
  color: ${({ theme }) => theme.font.color.tertiary};
  line-height: 1;
  min-height: 11px;
`;

export const DialPad = ({ onCall }: DialPadProps) => {
  const [rawNumber, setRawNumber] = useRecoilState(phoneNumberState);
  const callState = useRecoilValue(callStateAtom);
  const { sendDigit } = useDTMF();
  const containerRef = useRef<HTMLDivElement>(null);

  const isCallActive = callState.status === 'active';
  const digits = stripNonDigits(rawNumber);
  const hasDigits = digits.length > 0;

  const handleKeyPress = useCallback(
    (key: DialPadKey) => {
      if (isCallActive) {
        sendDigit(key.digit);

        return;
      }
      navigator.vibrate?.(10);
      setRawNumber((previous) => previous + key.digit);
    },
    [isCallActive, sendDigit, setRawNumber],
  );

  const handleBackspace = useCallback(() => {
    setRawNumber((previous) => previous.slice(0, -1));
  }, [setRawNumber]);

  const handleClear = useCallback(() => {
    setRawNumber('');
  }, [setRawNumber]);

  // keyboard input
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key >= '0' && event.key <= '9') {
        handleKeyPress({ digit: event.key as DialPadKey['digit'], letters: '' });
      } else if (event.key === '*' || event.key === '#') {
        handleKeyPress({ digit: event.key, letters: '' });
      } else if (event.key === 'Backspace') {
        handleBackspace();
      } else if (event.key === 'Escape') {
        handleClear();
      } else if (event.key === 'Enter' && hasDigits && onCall) {
        onCall(rawNumber);
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyPress, handleBackspace, handleClear, hasDigits, rawNumber, onCall]);

  // auto-focus container for keyboard capture
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  return (
    <StyledContainer ref={containerRef} tabIndex={-1}>
      <StyledInputRow>
        <StyledPhoneDisplay
          value={hasDigits ? formatPhone(rawNumber) : ''}
          placeholder="Enter a number"
          readOnly
          aria-label="Phone number"
        />
        <StyledBackspace
          visible={hasDigits && !isCallActive}
          onClick={handleBackspace}
          onDoubleClick={handleClear}
          aria-label="Delete digit"
        >
          ⌫
        </StyledBackspace>
      </StyledInputRow>

      <StyledGrid role="group" aria-label="Dial pad">
        {DIAL_PAD_KEYS.map((key) => (
          <StyledKey
            key={key.digit}
            disabled={isCallActive && callState.status !== 'active'}
            onClick={() => handleKeyPress(key)}
            aria-label={
              key.letters
                ? `${key.digit}, ${key.letters}`
                : key.digit
            }
          >
            <StyledDigit>{key.digit}</StyledDigit>
            <StyledLetters>{key.letters}</StyledLetters>
          </StyledKey>
        ))}
      </StyledGrid>
    </StyledContainer>
  );
};
