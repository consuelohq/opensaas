import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { useRecoilValue } from 'recoil';
import { IconBolt, IconChevronDown, IconMessage } from 'twenty-ui/display';

import { useAgentContext } from '@/agent/hooks/useAgentContext';
import { useAgentConversations } from '@/agent/hooks/useAgentConversations';
import { agentContextPanelCollapsedState } from '@/agent/states/agentState';

const StyledContainer = styled.div`
  background: ${({ theme }) => theme.background.secondary};
  border-left: 1px solid ${({ theme }) => theme.border.color.medium};
  display: flex;
  flex-direction: column;
  min-width: 280px;
  overflow-y: auto;
  width: 280px;

  @media (max-width: 1024px) {
    display: none;
  }
`;

const StyledSection = styled.div`
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  padding: ${({ theme }) => theme.spacing(3)};
`;

const StyledSectionHeader = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.secondary};
  cursor: pointer;
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  gap: ${({ theme }) => theme.spacing(2)};
  user-select: none;
`;

const StyledChevron = styled(IconChevronDown)<{ collapsed: boolean }>`
  margin-left: auto;
  transform: ${({ collapsed }) => (collapsed ? 'rotate(-90deg)' : 'none')};
  transition: transform 0.15s ease;
`;

const StyledSectionContent = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  margin-top: ${({ theme }) => theme.spacing(2)};
`;

const StyledDetailRow = styled.div`
  display: flex;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(1)} 0;
`;

const StyledLabel = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledValue = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledEmptyState = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.light};
  display: flex;
  flex: 1;
  font-size: ${({ theme }) => theme.font.size.sm};
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(4)};
  text-align: center;
`;

export const AgentContextPanel = () => {
  const { t } = useLingui();
  const agentContextPanelCollapsed = useRecoilValue(
    agentContextPanelCollapsedState,
  );
  const { selectedSkill } = useAgentContext();
  const { conversations, selectedConversationId } = useAgentConversations();

  const [skillSectionCollapsed, setSkillSectionCollapsed] = useState(false);
  const [conversationSectionCollapsed, setConversationSectionCollapsed] =
    useState(false);

  if (agentContextPanelCollapsed) {
    return null;
  }

  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedConversationId,
  );

  const hasContent = selectedSkill || selectedConversation;

  return (
    <StyledContainer>
      {selectedSkill && (
        <StyledSection>
          <StyledSectionHeader
            onClick={() => setSkillSectionCollapsed(!skillSectionCollapsed)}
          >
            <IconBolt size={16} />
            {t`Selected Skill`}
            <StyledChevron size={14} collapsed={skillSectionCollapsed} />
          </StyledSectionHeader>
          {!skillSectionCollapsed && (
            <StyledSectionContent>
              <StyledDetailRow>
                <StyledLabel>{t`Name`}</StyledLabel>
                <StyledValue>{selectedSkill.name}</StyledValue>
              </StyledDetailRow>
              {selectedSkill.description && (
                <StyledDetailRow>
                  <StyledLabel>{t`Description`}</StyledLabel>
                  <StyledValue>{selectedSkill.description}</StyledValue>
                </StyledDetailRow>
              )}
              <StyledDetailRow>
                <StyledLabel>{t`Category`}</StyledLabel>
                <StyledValue>{selectedSkill.category}</StyledValue>
              </StyledDetailRow>
            </StyledSectionContent>
          )}
        </StyledSection>
      )}
      {selectedConversation && (
        <StyledSection>
          <StyledSectionHeader
            onClick={() =>
              setConversationSectionCollapsed(!conversationSectionCollapsed)
            }
          >
            <IconMessage size={16} />
            {t`Conversation`}
            <StyledChevron size={14} collapsed={conversationSectionCollapsed} />
          </StyledSectionHeader>
          {!conversationSectionCollapsed && (
            <StyledSectionContent>
              <StyledDetailRow>
                <StyledLabel>{t`Title`}</StyledLabel>
                <StyledValue>{selectedConversation.title}</StyledValue>
              </StyledDetailRow>
              <StyledDetailRow>
                <StyledLabel>{t`Messages`}</StyledLabel>
                <StyledValue>{selectedConversation.messageCount}</StyledValue>
              </StyledDetailRow>
              <StyledDetailRow>
                <StyledLabel>{t`Created`}</StyledLabel>
                <StyledValue>
                  {new Date(
                    selectedConversation.createdAt,
                  ).toLocaleDateString()}
                </StyledValue>
              </StyledDetailRow>
            </StyledSectionContent>
          )}
        </StyledSection>
      )}
      {!hasContent && (
        <StyledEmptyState>
          {t`Select a skill or start a conversation`}
        </StyledEmptyState>
      )}
    </StyledContainer>
  );
};
