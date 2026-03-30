import styled from '@emotion/styled';
import { useCallback, useEffect, useRef } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

import { DIAL_PAD_KEYS } from '@/dialer/constants/dialerConstants';
import { activeCallState } from '@/dialer/states/activeCallState';
import { phoneNumberState } from '@/dialer/states/phoneNumberState';
import { type DialPadKey } from '@/dialer/types/dialer';
import { formatPhone, stripNonDigits } from '@/dialer/utils/phoneFormat';

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
  width: clamp(44px, 10vh, 96px);
  aspect-ratio: 1;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.font.color.secondary};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  visibility: ${({ visible }) => (visible ? 'visible' : 'hidden')};
  transition: transform 75ms;

  &:hover {
    transform: scale(0.98);
    color: ${({ theme }) => theme.font.color.primary};
  }

  &:active {
    transform: scale(0.95);
  }
`;

const StyledGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: clamp(6px, 1.5vh, 20px);
  padding: 0 ${({ theme }) => theme.spacing(2)};
  justify-items: center;
`;

const StyledKey = styled.button<{ disabled: boolean }>`
  width: clamp(44px, 10vh, 96px);
  aspect-ratio: 1;
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
  transition: transform 75ms;
  user-select: none;

  &:hover:not(:disabled) {
    transform: scale(0.98);
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }
`;

const StyledDigit = styled.span`
  font-size: clamp(14px, 2.5vh, 30px);
  font-weight: ${({ theme }) => theme.font.weight.medium};
  line-height: 1;
`;

const StyledLetters = styled.span`
  font-size: clamp(8px, 1vh, 14px);
  letter-spacing: 1.5px;
  color: ${({ theme }) => theme.font.color.tertiary};
  line-height: 1;
  min-height: 11px;
  margin-top: 2px;
`;

export const DialPad = ({ onCall }: DialPadProps) => {
  const [phoneNumber, setPhoneNumber] = useRecoilState(phoneNumberState);
  const callStateAtom = useRecoilValue(callStateAtom);
  const activeCall = useRecoilValue(activeCallState);
  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCallActive = callState.status === 'active';
  const isDialDisabled =
    callState.status === 'connecting' || callState.status === 'ringing';
  const digits = stripNonDigits(rawNumber);
  const hasDigits = digits.length > 0;

  const handleKeyPress = useCallback(
    (key: DialPadKey) => {
      if (isDialDisabled) return;

      navigator.vibrate?.(10);

      if (isCallActive) {
        activeCall?.sendDigits(key.digit);

        return;
      }
      setRawNumber((previous) => previous + key.digit);
    },
    [isCallActive, isDialDisabled, activeCall, setRawNumber],
  );

  const handlePressStart = useCallback(
    (key: DialPadKey) => {
      if (key.digit === '0') {
        longPressTimerRef.current = setTimeout(() => {
          longPressTimerRef.current = null;
          if (isCallActive) {
            activeCall?.sendDigits('+');
          } else {
            setRawNumber((prev) => prev + '+');
          }
        }, 500);
      }
    },
    [isCallActive, activeCall, setRawNumber],
  );

  const handlePressEnd = useCallback(
    (key: DialPadKey) => {
      if (key.digit === '0' && longPressTimerRef.current !== null) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
        handleKeyPress(key);
      }
    },
    [handleKeyPress],
  );

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

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
        handleKeyPress({
          digit: event.key as DialPadKey['digit'],
          letters: '',
        });
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
  }, [
    handleKeyPress,
    handleBackspace,
    handleClear,
    hasDigits,
    rawNumber,
    onCall,
  ]);

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
      </StyledInputRow>

      <StyledGrid role="group" aria-label="Dial pad">
        {DIAL_PAD_KEYS.map((key) => (
          <StyledKey
            key={key.digit}
            disabled={isDialDisabled}
            onClick={key.digit === '0' ? undefined : () => handleKeyPress(key)}
            onMouseDown={
              key.digit === '0' ? () => handlePressStart(key) : undefined
            }
            onMouseUp={
              key.digit === '0' ? () => handlePressEnd(key) : undefined
            }
            onTouchStart={
              key.digit === '0' ? () => handlePressStart(key) : undefined
            }
            onTouchEnd={
              key.digit === '0' ? () => handlePressEnd(key) : undefined
            }
            aria-label={
              key.letters ? `${key.digit}, ${key.letters}` : key.digit
            }
          >
            <StyledDigit>{key.digit}</StyledDigit>
            <StyledLetters>{key.letters}</StyledLetters>
          </StyledKey>
        ))}
        <StyledBackspace
          visible={hasDigits && !isCallActive && !isDialDisabled}
          onClick={handleBackspace}
          onDoubleClick={handleClear}
          aria-label="Delete digit"
        >
          ⌫
        </StyledBackspace>
      </StyledGrid>
    </StyledContainer>
  );
};
