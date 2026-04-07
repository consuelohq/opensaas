import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useRef, useEffect } from 'react';

import { useAgentChatContextOrThrow } from '@/ai/hooks/useAgentChatContextOrThrow';
import { agentChatInputState } from '@/ai/states/agentChatInputState';
import { useRecoilState } from 'recoil';

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
  line-height: 1.5;
  max-width: 100%;
  padding: ${({ theme, isUser }) => (isUser ? theme.spacing(1, 2) : '0')};
  white-space: pre-wrap;
  width: fit-content;
`;

const StyledEmpty = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  flex: 1;
  font-size: ${({ theme }) => theme.font.size.lg};
  justify-content: center;
`;

const StyledComposer = styled.div`
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
`;

const StyledInput = styled.input`
  background: ${({ theme }) => theme.background.transparent.lighter};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  flex: 1;
  font-size: ${({ theme }) => theme.font.size.md};
  outline: none;
  padding: ${({ theme }) => theme.spacing(2)};

  &::placeholder {
    color: ${({ theme }) => theme.font.color.tertiary};
  }
`;

const StyledSendButton = styled.button`
  background: ${({ theme }) => theme.color.blue};
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: white;
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.md};
  padding: ${({ theme }) => theme.spacing(2, 3)};

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

export const AgentChatPanel = () => {
  const { t } = useLingui();
  const { messages, handleSendMessage, isLoading } =
    useAgentChatContextOrThrow();
  const [agentChatInput, setAgentChatInput] =
    useRecoilState(agentChatInputState);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages]);

  const onSubmit = () => {
    if (agentChatInput.trim() && !isLoading) {
      handleSendMessage();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <StyledContainer>
      <StyledViewport ref={viewportRef}>
        {messages.length === 0 ? (
          <StyledEmpty>{t`Ask the Agent anything`}</StyledEmpty>
        ) : (
          <StyledMessageList>
            {messages.map((msg) => {
              const textPart = msg.parts?.find(
                (p: { type: string }) => p.type === 'text',
              ) as { type: 'text'; text: string } | undefined;

              if (!textPart?.text) return null;

              return (
                <StyledMessageBubble key={msg.id} isUser={msg.role === 'user'}>
                  <StyledMessageText isUser={msg.role === 'user'}>
                    {textPart.text}
                  </StyledMessageText>
                </StyledMessageBubble>
              );
            })}
          </StyledMessageList>
        )}
      </StyledViewport>
      <StyledComposer>
        <StyledInput
          value={agentChatInput}
          onChange={(e) => setAgentChatInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t`Message the Agent...`}
          disabled={isLoading}
        />
        <StyledSendButton
          onClick={onSubmit}
          disabled={isLoading || !agentChatInput.trim()}
        >
          ↑
        </StyledSendButton>
      </StyledComposer>
    </StyledContainer>
  );
};
