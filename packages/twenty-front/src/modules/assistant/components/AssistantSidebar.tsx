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
import { PAGE_BAR_MIN_HEIGHT } from '@/ui/layout/page/constants/PageBarMinHeight';
import { RootStackingContextZIndices } from '@/ui/layout/constants/RootStackingContextZIndices';

const SIDEBAR_WIDTH = 380;

const StyledSidePanelWrapper = styled.div<{ isOpen: boolean }>`
  flex-shrink: 0;
  min-width: 0;
  overflow: hidden;
  width: ${({ isOpen }) => (isOpen ? `${SIDEBAR_WIDTH}px` : '0px')};
  transition: width ${({ theme }) => theme.animation.duration.normal}s;
`;

const StyledSidebar = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.background.primary};
  border-left: 1px solid ${({ theme }) => theme.border.color.medium};
  overflow: hidden;
  position: relative;
  box-sizing: border-box;
  z-index: ${RootStackingContextZIndices.CommandMenu - 2};
`;

const StyledHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  justify-content: space-between;
  min-height: ${PAGE_BAR_MIN_HEIGHT}px;
  padding: ${({ theme }) => theme.spacing(3)} ${({ theme }) => theme.spacing(4)};
`;

const StyledTitle = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
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
  const assistantSidebarOpen = useRecoilValue(assistantSidebarOpenState);
  const assistantLoading = useRecoilValue(assistantLoadingState);
  const { messages, sendMessage, clearConversation } = useAssistant();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <StyledSidePanelWrapper isOpen={assistantSidebarOpen}>
      <StyledSidebar>
        <StyledHeader>
          <StyledTitle>Assistant</StyledTitle>
          {messages.length > 0 && (
            <StyledClearButton
              onClick={clearConversation}
              title="Clear conversation"
            >
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
          {assistantLoading && (
            <StyledTypingIndicator>
              <span />
              <span />
              <span />
            </StyledTypingIndicator>
          )}
          <div ref={messagesEndRef} />
        </StyledMessages>

        <AssistantMessageInput
          onSend={sendMessage}
          disabled={assistantLoading}
        />
      </StyledSidebar>
    </StyledSidePanelWrapper>
  );
};
