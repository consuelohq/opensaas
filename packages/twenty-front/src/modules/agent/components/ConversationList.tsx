import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { IconPlus } from 'twenty-ui/display';

import { useAgentConversations } from '@/agent/hooks/useAgentConversations';

type ConversationListProps = {
  onSelectConversation: (id: string | null) => void;
  selectedConversationId: string | null;
};

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
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
  background: ${({ theme, isSelected }) =>
    isSelected ? theme.background.transparent.light : 'transparent'};
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing(1.5)}
    ${({ theme }) => theme.spacing(3)};

  &:hover {
    background: ${({ theme }) => theme.background.transparent.lighter};
  }
`;

const StyledItemTitle = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledEmpty = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => theme.spacing(3)};
  text-align: center;
`;

export const ConversationList = ({
  onSelectConversation,
  selectedConversationId,
}: ConversationListProps) => {
  const { t } = useLingui();
  const { conversations, createNewConversation, isLoading } =
    useAgentConversations();

  if (isLoading && conversations.length === 0) {
    return (
      <StyledContainer>
        <StyledEmpty>{t`Loading…`}</StyledEmpty>
      </StyledContainer>
    );
  }

  return (
    <StyledContainer>
      <StyledHeader>
        <StyledTitle>{t`Conversations`}</StyledTitle>
        <StyledNewButton onClick={createNewConversation} title={t`New chat`}>
          <IconPlus size={14} />
        </StyledNewButton>
      </StyledHeader>
      {conversations.length === 0 ? (
        <StyledEmpty>{t`No conversations yet`}</StyledEmpty>
      ) : (
        conversations.map((conversation) => (
          <StyledItem
            key={conversation.id}
            isSelected={conversation.id === selectedConversationId}
            onClick={() => onSelectConversation(conversation.id)}
          >
            <StyledItemTitle>{conversation.title}</StyledItemTitle>
          </StyledItem>
        ))
      )}
    </StyledContainer>
  );
};
