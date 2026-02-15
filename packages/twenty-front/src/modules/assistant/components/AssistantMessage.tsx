import styled from '@emotion/styled';

import { AssistantCommandResult } from '@/assistant/components/AssistantCommandResult';
import { type AssistantMessage as AssistantMessageType } from '@/assistant/states/assistantState';

const StyledMessageRow = styled.div<{ isUser: boolean }>`
  display: flex;
  justify-content: ${({ isUser }) => (isUser ? 'flex-end' : 'flex-start')};
`;

const StyledBubble = styled.div<{ isUser: boolean }>`
  max-width: 85%;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border-radius: ${({ theme }) => theme.border.radius.md};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  color: ${({ theme }) => theme.font.color.primary};
  background: ${({ theme, isUser }) =>
    isUser ? theme.accent.primary : theme.background.secondary};
  ${({ theme, isUser }) =>
    isUser ? `color: ${theme.grayScale.gray0};` : ''}
`;

const StyledCommands = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  max-width: 85%;
`;

type AssistantMessageProps = {
  message: AssistantMessageType;
};

export const AssistantMessage = ({ message }: AssistantMessageProps) => {
  const isUser = message.role === 'user';

  return (
    <>
      <StyledMessageRow isUser={isUser}>
        <StyledBubble isUser={isUser}>{message.content}</StyledBubble>
      </StyledMessageRow>
      {message.commandsExecuted && message.commandsExecuted.length > 0 && (
        <StyledCommands>
          {message.commandsExecuted.map((cmd, i) => (
            <AssistantCommandResult key={i} command={cmd} />
          ))}
        </StyledCommands>
      )}
    </>
  );
};
