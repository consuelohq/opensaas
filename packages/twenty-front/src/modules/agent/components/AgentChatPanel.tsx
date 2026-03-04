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
  gap: ${({ theme }) => theme.spacing(3)};
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(4)} ${({ theme }) => theme.spacing(6)};
`;

const StyledMessageBubble = styled.div<{ isUser: boolean }>`
  align-items: ${({ isUser }) => (isUser ? 'flex-end' : 'flex-start')};
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const StyledMessageText = styled.div<{ isUser: boolean }>`
  background: ${({ theme, isUser }) =>
    isUser ? theme.background.tertiary : theme.background.transparent};
  border-radius: ${({ theme, isUser }) =>
    isUser ? theme.border.radius.sm : '0'};
  color: ${({ theme, isUser }) =>
    isUser ? theme.font.color.secondary : theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ isUser }) => (isUser ? 500 : 400)};
  line-height: 1.5;
  max-width: 100%;
  padding: ${({ theme, isUser }) => (isUser ? theme.spacing(1, 2) : '0')};
  white-space: pre-wrap;
  width: fit-content;
  word-wrap: break-word;
  overflow-wrap: break-word;

  code {
    background: ${({ theme }) => theme.background.tertiary};
    border-radius: ${({ theme }) => theme.border.radius.sm};
    line-height: 1.4;
    max-width: 100%;
    overflow: auto;
    padding: ${({ theme }) => theme.spacing(1)};
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  pre {
    background: ${({ theme }) => theme.background.tertiary};
    border-radius: ${({ theme }) => theme.border.radius.sm};
    max-width: 100%;
    overflow-x: auto;
    padding: ${({ theme }) => theme.spacing(2)};

    code {
      background: none;
      border-radius: 0;
      padding: 0;
    }
  }
`;

const StyledToolPartWrapper = styled.div`
  align-self: flex-start;
  max-width: 100%;
`;

const StyledInputArea = styled.form`
  align-items: center;
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)} ${({ theme }) => theme.spacing(6)};
`;

const StyledInput = styled.input`
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.font.color.primary};
  flex: 1;
  font-family: inherit;
  font-size: ${({ theme }) => theme.font.size.md};
  outline: none;

  &::placeholder {
    color: ${({ theme }) => theme.font.color.tertiary};
  }
`;

const StyledSendButton = styled.button<{ disabled: boolean }>`
  align-items: center;
  background: ${({ theme, disabled }) =>
    disabled
      ? theme.background.transparent.light
      : theme.background.tertiary};
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme, disabled }) =>
    disabled ? theme.font.color.extraLight : theme.font.color.primary};
  cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
  display: flex;
  height: 28px;
  justify-content: center;
  width: 28px;
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
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.md};
  padding: ${({ theme }) => theme.spacing(1)} 0;
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
                const isUser = message.role === 'user';

                return (
                  <StyledMessageBubble
                    key={`${message.id}-${partIndex}`}
                    isUser={isUser}
                  >
                    <StyledMessageText isUser={isUser}>
                      {part.text}
                    </StyledMessageText>
                  </StyledMessageBubble>
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
            <IconPlayerStop size={14} />
          </StyledSendButton>
        ) : (
          <StyledSendButton type="submit" disabled={input.trim() === ''}>
            <IconArrowUp size={14} />
          </StyledSendButton>
        )}
      </StyledInputArea>
    </StyledContainer>
  );
};
