import styled from '@emotion/styled';
import {
  IconPin,
  IconPinnedFilled,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';

import { useAgentConversations } from '@/agent/hooks/useAgentConversations';

type ConversationListProps = {
  onSelectConversation: (id: string | null) => void;
  selectedConversationId: string | null;
};

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  max-height: 300px;
  overflow-y: auto;
`;

const StyledHeader = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
`;

const StyledTitle = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledNewButton = styled.button`
  align-items: center;
  background: none;
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;
  display: flex;
  height: 24px;
  justify-content: center;
  width: 24px;

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledItem = styled.div<{ isSelected: boolean }>`
  align-items: center;
  background: ${({ theme, isSelected }) =>
    isSelected ? theme.background.transparent.light : 'transparent'};
  cursor: pointer;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(1.5)} ${({ theme }) => theme.spacing(3)};

  &:hover {
    background: ${({ theme }) => theme.background.transparent.lighter};
  }
`;

const StyledItemContent = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
`;

const StyledItemTitle = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledItemMeta = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
`;

const StyledActions = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(0.5)};
  opacity: 0;

  ${StyledItem}:hover & {
    opacity: 1;
  }
`;

const StyledActionButton = styled.button`
  align-items: center;
  background: none;
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;
  display: flex;
  height: 20px;
  justify-content: center;
  width: 20px;

  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledEmpty = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => theme.spacing(3)};
  text-align: center;
`;

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  }

  if (diffDays === 1) {
    return 'Yesterday';
  }

  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString();
};

export const ConversationList = ({
  onSelectConversation,
  selectedConversationId,
}: ConversationListProps) => {
  const { conversations, togglePin, deleteConversation, isLoading } =
    useAgentConversations();

  const handleNewChat = () => {
    onSelectConversation(null);
  };

  if (isLoading && conversations.length === 0) {
    return (
      <StyledContainer>
        <StyledEmpty>Loading…</StyledEmpty>
      </StyledContainer>
    );
  }

  return (
    <StyledContainer>
      <StyledHeader>
        <StyledTitle>Conversations</StyledTitle>
        <StyledNewButton onClick={handleNewChat} title="New chat">
          <IconPlus size={14} />
        </StyledNewButton>
      </StyledHeader>
      {conversations.length === 0 ? (
        <StyledEmpty>No conversations yet</StyledEmpty>
      ) : (
        conversations.map((conversation) => (
          <StyledItem
            key={conversation.id}
            isSelected={conversation.id === selectedConversationId}
            onClick={() => onSelectConversation(conversation.id)}
          >
            <StyledItemContent>
              <StyledItemTitle>{conversation.title}</StyledItemTitle>
              <StyledItemMeta>
                {conversation.messageCount} messages ·{' '}
                {formatDate(conversation.updatedAt)}
              </StyledItemMeta>
            </StyledItemContent>
            <StyledActions>
              <StyledActionButton
                onClick={(event) => {
                  event.stopPropagation();
                  void togglePin(conversation.id);
                }}
                title={conversation.pinned ? 'Unpin' : 'Pin'}
              >
                {conversation.pinned ? (
                  <IconPinnedFilled size={12} />
                ) : (
                  <IconPin size={12} />
                )}
              </StyledActionButton>
              <StyledActionButton
                onClick={(event) => {
                  event.stopPropagation();
                  void deleteConversation(conversation.id);
                }}
                title="Delete"
              >
                <IconTrash size={12} />
              </StyledActionButton>
            </StyledActions>
          </StyledItem>
        ))
      )}
    </StyledContainer>
  );
};
