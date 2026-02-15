import styled from '@emotion/styled';
import { useCallback, useRef, useState } from 'react';
import { IconSend } from 'twenty-ui/display';

const StyledInputContainer = styled.div`
  display: flex;
  align-items: flex-end;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledTextarea = styled.textarea`
  flex: 1;
  resize: none;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(1.5)} ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-family: ${({ theme }) => theme.font.family};
  color: ${({ theme }) => theme.font.color.primary};
  background: ${({ theme }) => theme.background.primary};
  outline: none;
  max-height: 120px;
  line-height: 1.4;

  &::placeholder {
    color: ${({ theme }) => theme.font.color.tertiary};
  }

  &:focus {
    border-color: ${({ theme }) => theme.accent.primary};
  }
`;

const StyledSendButton = styled.button<{ disabled: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme, disabled }) =>
    disabled ? theme.background.tertiary : theme.accent.primary};
  color: ${({ theme, disabled }) =>
    disabled ? theme.font.color.tertiary : theme.grayScale.gray0};
  cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
  flex-shrink: 0;
`;

type AssistantMessageInputProps = {
  onSend: (text: string) => void;
  disabled?: boolean;
};

export const AssistantMessageInput = ({
  onSend,
  disabled = false,
}: AssistantMessageInputProps) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const isEmpty = value.trim().length === 0;

  return (
    <StyledInputContainer>
      <StyledTextarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder="Ask anything..."
        rows={1}
        disabled={disabled}
      />
      <StyledSendButton
        onClick={handleSend}
        disabled={disabled || isEmpty}
        type="button"
      >
        <IconSend size={16} />
      </StyledSendButton>
    </StyledInputContainer>
  );
};
