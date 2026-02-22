import styled from '@emotion/styled';
import { IconArrowUp, IconPlayerStop } from '@tabler/icons-react';
import { useEffect, useRef } from 'react';

import { useAgentChat } from '@/agent/hooks/useAgentChat';

import { toolRendererRegistry } from './renderers';

const StyledContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const StyledMessageList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(4)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledMessage = styled.div<{ isUser: boolean }>`
  max-width: 80%;
  align-self: ${({ isUser }) => (isUser ? 'flex-end' : 'flex-start')};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border-radius: ${({ theme }) => theme.border.radius.md};
  background: ${({ theme, isUser }) =>
    isUser ? theme.color.blue : theme.background.secondary};
  color: ${({ theme, isUser }) =>
    isUser ? theme.font.color.inverted : theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
`;

const StyledToolPartWrapper = styled.div`
  max-width: 80%;
  align-self: flex-start;
`;

const StyledInputArea = styled.form`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)} ${({ theme }) => theme.spacing(4)};
  border-top: 1px solid ${({ theme }) => theme.border.color.medium};
`;

const StyledInput = styled.input`
  flex: 1;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.transparent.lighter};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-family: inherit;
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme.color.blue};
  }

  &::placeholder {
    color: ${({ theme }) => theme.font.color.tertiary};
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
    disabled ? theme.background.transparent.light : theme.color.blue};
  color: ${({ theme, disabled }) =>
    disabled ? theme.font.color.tertiary : theme.font.color.inverted};
  cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
`;

const StyledEmpty = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

const StyledLoadingDots = styled.div`
  align-self: flex-start;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

export const AgentChatPanel = () => {
  const {
    messages,
    input,
    setInput,
    handleSubmit,
    handleStop,
    isLoading,
  } = useAgentChat();

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
                    <StyledToolPartWrapper
                      key={`${message.id}-${partIndex}`}
                    >
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
        <StyledEmpty>Ask Consuelo anything</StyledEmpty>
      )}
      <StyledInputArea onSubmit={onSubmit}>
        <StyledInput
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Message Consuelo…"
          autoFocus
        />
        {isLoading ? (
          <StyledSendButton
            type="button"
            disabled={false}
            onClick={handleStop}
          >
            <IconPlayerStop size={16} />
          </StyledSendButton>
        ) : (
          <StyledSendButton
            type="submit"
            disabled={input.trim() === ''}
          >
            <IconArrowUp size={16} />
          </StyledSendButton>
        )}
      </StyledInputArea>
    </StyledContainer>
  );
};
