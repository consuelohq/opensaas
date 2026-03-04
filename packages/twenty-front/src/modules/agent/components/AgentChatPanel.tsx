import styled from '@emotion/styled';
import { IconArrowUp, IconPlayerStop } from '@tabler/icons-react';
import { useEffect, useRef } from 'react';

import { useAgentChat } from '@/agent/hooks/useAgentChat';

import { toolRendererRegistry } from './renderers';

const StyledContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
`;

const StyledMessageList = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(4)} ${({ theme }) => theme.spacing(6)};
`;

const StyledMessage = styled.div<{ isUser: boolean }>`
  align-self: ${({ isUser }) => (isUser ? 'flex-end' : 'flex-start')};
  background: ${({ theme, isUser }) =>
    isUser
      ? theme.background.transparent.medium
      : theme.background.transparent.lighter};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.md};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  line-height: 1.6;
  max-width: 72%;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  white-space: pre-wrap;
  word-break: break-word;
`;

const StyledToolPartWrapper = styled.div`
  align-self: flex-start;
  max-width: 72%;
`;

const StyledInputArea = styled.form`
  align-items: center;
  border-top: 1px solid ${({ theme }) => theme.border.color.medium};
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)} ${({ theme }) => theme.spacing(6)};
`;

const StyledInput = styled.input`
  background: ${({ theme }) => theme.background.transparent.lighter};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  flex: 1;
  font-family: inherit;
  font-size: ${({ theme }) => theme.font.size.md};
  outline: none;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};

  &:focus {
    border-color: ${({ theme }) => theme.border.color.strong};
  }

  &::placeholder {
    color: ${({ theme }) => theme.font.color.tertiary};
  }
`;

const StyledSendButton = styled.button<{ disabled: boolean }>`
  align-items: center;
  background: ${({ theme, disabled }) =>
    disabled
      ? theme.background.transparent.light
      : theme.background.transparent.medium};
  border: 1px solid
    ${({ theme, disabled }) =>
      disabled ? theme.border.color.light : theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme, disabled }) =>
    disabled ? theme.font.color.extraLight : theme.font.color.primary};
  cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
  display: flex;
  height: 32px;
  justify-content: center;
  width: 32px;
`;

const StyledEmpty = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  flex: 1;
  font-size: ${({ theme }) => theme.font.size.lg};
  justify-content: center;
`;

const StyledLoadingDots = styled.div`
  align-self: flex-start;
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.md};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
`;

export const AgentChatPanel = () => {
  const { messages, input, setInput, handleSubmit, handleStop, isLoading } =
    useAgentChat();

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    handleSubmit();
  };

  const hasMessages = messages.length > 0;

  return (
    <StyledContainer>
      {hasMessages ? (
        <StyledMessageList>
          {messages.map((message) =>
            message.parts?.map((part, partIndex) => {
              if (part.type === 'text' && part.text) {
                return (
                  <StyledMessage
                    key={`${message.id}-${partIndex}`}
                    isUser={message.role === 'user'}
                  >
                    {part.text}
                  </StyledMessage>
                );
              }

              if (part.type === 'dynamic-tool') {
                const toolPart = part as {
                  type: 'dynamic-tool';
                  toolName: string;
                  state: string;
                  input: unknown;
                };
                const Renderer = toolRendererRegistry[toolPart.toolName];

                if (
                  Renderer &&
                  toolPart.input &&
                  toolPart.state !== 'input-streaming'
                ) {
                  return (
                    <StyledToolPartWrapper key={`${message.id}-${partIndex}`}>
                      <Renderer input={toolPart.input} />
                    </StyledToolPartWrapper>
                  );
                }
              }

              return null;
            }),
          )}
          {isLoading && <StyledLoadingDots>…</StyledLoadingDots>}
          <div ref={bottomRef} />
        </StyledMessageList>
      ) : (
        <StyledEmpty>Ask the Agent anything</StyledEmpty>
      )}
      <StyledInputArea onSubmit={onSubmit}>
        <StyledInput
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Message the Agent…"
          autoFocus
        />
        {isLoading ? (
          <StyledSendButton type="button" disabled={false} onClick={handleStop}>
            <IconPlayerStop size={16} />
          </StyledSendButton>
        ) : (
          <StyledSendButton type="submit" disabled={input.trim() === ''}>
            <IconArrowUp size={16} />
          </StyledSendButton>
        )}
      </StyledInputArea>
    </StyledContainer>
  );
};
