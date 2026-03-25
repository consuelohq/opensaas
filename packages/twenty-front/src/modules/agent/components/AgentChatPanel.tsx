import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { lazy, Suspense } from 'react';
import type { ComponentProps } from 'react';
import type { Streamdown } from 'streamdown';

import { AgentComposer } from '@/agent/components/AgentComposer';
import {
  ExecuteToolToolUI,
  FindPeopleToolUI,
  LearnToolsToolUI,
  LoadSkillToolUI,
} from '@/agent/components/AgentToolUIs';
import {
  MessagePrimitive,
  ThreadPrimitive,
} from '@assistant-ui/react';

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

const StyledViewport = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow-y: auto;
`;

const StyledMessageList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
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

const StyledEmpty = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  flex: 1;
  font-size: ${({ theme }) => theme.font.size.lg};
  justify-content: center;
`;

const StyledLoadingSkeleton = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

const UserMessage = () => (
  <StyledMessageBubble isUser={true}>
    <StyledMessageText isUser={true}>
      <MessagePrimitive.Content />
    </StyledMessageText>
  </StyledMessageBubble>
);

const AssistantMessage = () => (
  <StyledMessageBubble isUser={false}>
    <StyledMessageText isUser={false}>
      <Suspense
        fallback={<StyledLoadingSkeleton>Loading…</StyledLoadingSkeleton>}
      >
        <MessagePrimitive.Content
          components={{
            Text: ({ text }) => (
              <LazyStreamdown
                mode="streaming"
                shikiTheme={['github-light', 'github-dark']}
              >
                {text}
              </LazyStreamdown>
            ),
          }}
        />
      </Suspense>
    </StyledMessageText>
  </StyledMessageBubble>
);

export const AgentChatPanel = () => {
  const { t } = useLingui();

  return (
    <StyledContainer>
      <LearnToolsToolUI />
      <LoadSkillToolUI />
      <ExecuteToolToolUI />
      <FindPeopleToolUI />
      <ThreadPrimitive.Root>
        <StyledViewport>
          <ThreadPrimitive.Empty>
            <StyledEmpty>{t`Ask the Agent anything`}</StyledEmpty>
          </ThreadPrimitive.Empty>
          <StyledMessageList>
            <ThreadPrimitive.Messages
              components={{
                UserMessage,
                AssistantMessage,
              }}
            />
          </StyledMessageList>
        </StyledViewport>
        <AgentComposer />
      </ThreadPrimitive.Root>
    </StyledContainer>
  );
};
