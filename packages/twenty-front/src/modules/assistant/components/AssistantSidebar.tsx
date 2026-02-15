import styled from '@emotion/styled';
import { useEffect, useRef } from 'react';
import { useRecoilValue } from 'recoil';
import { IconTrash } from 'twenty-ui/display';

import { AssistantMessage } from '@/assistant/components/AssistantMessage';
import { AssistantMessageInput } from '@/assistant/components/AssistantMessageInput';
import { useAssistant } from '@/assistant/hooks/useAssistant';
import {
  assistantLoadingState,
  assistantSidebarOpenState,
} from '@/assistant/states/assistantState';

const SIDEBAR_WIDTH = 380;

const StyledSidebar = styled.div<{ isOpen: boolean }>`
  width: ${SIDEBAR_WIDTH}px;
  min-width: ${SIDEBAR_WIDTH}px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.background.primary};
  border-left: 1px solid ${({ theme }) => theme.border.color.medium};
  overflow: hidden;
  transform: translateX(${({ isOpen }) => (isOpen ? '0' : '100%')});
  margin-right: ${({ isOpen }) => (isOpen ? '0' : `-${SIDEBAR_WIDTH}px`)};
  transition:
    transform 200ms ease-out,
    margin-right 200ms ease-out;
`;

const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(3)} ${({ theme }) => theme.spacing(4)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledTitle = styled.span`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledClearButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: transparent;
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.background.tertiary};
    color: ${({ theme }) => theme.font.color.secondary};
  }
`;

const StyledMessages = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)} ${({ theme }) => theme.spacing(3)};
  flex: 1;
  overflow-y: auto;
`;

const StyledEmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledTypingIndicator = styled.div`
  display: flex;
  gap: 4px;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  align-items: center;

  span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${({ theme }) => theme.font.color.tertiary};
    animation: bounce 1.2s infinite;
  }

  span:nth-of-type(2) {
    animation-delay: 0.2s;
  }

  span:nth-of-type(3) {
    animation-delay: 0.4s;
  }

  @keyframes bounce {
    0%,
    60%,
    100% {
      transform: translateY(0);
    }
    30% {
      transform: translateY(-4px);
    }
  }
`;

export const AssistantSidebar = () => {
  const isOpen = useRecoilValue(assistantSidebarOpenState);
  const isLoading = useRecoilValue(assistantLoadingState);
  const { messages, sendMessage, clearConversation } = useAssistant();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <StyledSidebar isOpen={isOpen}>
      <StyledHeader>
        <StyledTitle>Assistant</StyledTitle>
        {messages.length > 0 && (
          <StyledClearButton onClick={clearConversation} title="Clear conversation">
            <IconTrash size={16} />
          </StyledClearButton>
        )}
      </StyledHeader>

      <StyledMessages>
        {messages.length === 0 ? (
          <StyledEmptyState>Ask me anything about your data</StyledEmptyState>
        ) : (
          messages.map((msg) => (
            <AssistantMessage key={msg.id} message={msg} />
          ))
        )}
        {isLoading && (
          <StyledTypingIndicator>
            <span />
            <span />
            <span />
          </StyledTypingIndicator>
        )}
        <div ref={messagesEndRef} />
      </StyledMessages>

      <AssistantMessageInput onSend={sendMessage} disabled={isLoading} />
    </StyledSidebar>
  );
};
