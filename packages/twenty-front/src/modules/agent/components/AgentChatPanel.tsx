import styled from '@emotion/styled';
import { IconArrowUp, IconPlayerStop } from '@tabler/icons-react';
import { lazy, Suspense, useEffect, useRef } from 'react';
import type { ComponentProps } from 'react';
import type { Streamdown } from 'streamdown';

import { useAgentChat } from '@/agent/hooks/useAgentChat';

import { toolRendererRegistry } from './renderers';

type StreamdownProps = ComponentProps<typeof Streamdown>;

const LazyStreamdown = lazy(() =>
  import('streamdown').then((mod) => ({ default: mod.Streamdown })),
);

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
  width: fit-content;

  .streamdown {
    font-size: inherit;
    line-height: inherit;

    p {
      margin: 0 0 0.75em 0;

      &:last-child {
        margin-bottom: 0;
      }
    }

    code {
      background: ${({ theme }) => theme.background.tertiary};
      border-radius: ${({ theme }) => theme.border.radius.sm};
      padding: ${({ theme }) => theme.spacing(0.5, 1)};
      font-size: 0.9em;
    }

    pre {
      background: ${({ theme }) => theme.background.tertiary};
      border-radius: ${({ theme }) => theme.border.radius.sm};
      margin: 0.75em 0;
      overflow-x: auto;
      padding: ${({ theme }) => theme.spacing(2)};

      code {
        background: transparent;
        padding: 0;
      }
    }

    ul,
    ol {
      margin: 0.5em 0;
      padding-left: 1.5em;
    }

    li {
      margin: 0.25em 0;
    }

    blockquote {
      border-left: 3px solid ${({ theme }) => theme.border.color.light};
      margin: 0.75em 0;
      padding-left: ${({ theme }) => theme.spacing(2)};
      color: ${({ theme }) => theme.font.color.secondary};
    }

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      margin: 1em 0 0.5em;
      font-weight: ${({ theme }) => theme.font.weight.semiBold};
    }

    a {
      color: ${({ theme }) => theme.font.color.primary};
      text-decoration: underline;
    }

    table {
      border-collapse: collapse;
      margin: 0.75em 0;
      width: 100%;

      th,
      td {
        border: 1px solid ${({ theme }) => theme.border.color.light};
        padding: ${({ theme }) => theme.spacing(1, 2)};
      }

      th {
        background: ${({ theme }) => theme.background.secondary};
        font-weight: ${({ theme }) => theme.font.weight.medium};
      }
    }

    .shiki {
      background: ${({ theme }) => theme.background.secondary};
      border-radius: ${({ theme }) => theme.border.radius.sm};
      padding: ${({ theme }) => theme.spacing(2)};
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
    disabled ? theme.background.transparent.light : theme.background.tertiary};
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

const StyledLoadingSkeleton = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

type AgentChatPanelProps = {
  mode?: 'streaming' | 'static';
};

export const AgentChatPanel = ({ mode = 'streaming' }: AgentChatPanelProps) => {
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
                      <Suspense
                        fallback={
                          <StyledLoadingSkeleton>
                            Loading...
                          </StyledLoadingSkeleton>
                        }
                      >
                        <LazyStreamdown
                          mode={isUser ? 'static' : mode}
                          shikiTheme={['github-light', 'github-dark']}
                        >
                          {part.text}
                        </LazyStreamdown>
                      </Suspense>
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
