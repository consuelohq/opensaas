import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useRecoilValue } from 'recoil';

import { ConversationList } from '@/agent/components/ConversationList';
import { useAgentConversations } from '@/agent/hooks/useAgentConversations';
import { agentContextPanelCollapsedState } from '@/agent/states/agentState';

const StyledContainer = styled.div`
  background: ${({ theme }) => theme.background.secondary};
  border-left: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  flex-direction: column;
  min-width: 280px;
  overflow-y: auto;
  width: 280px;

  @media (max-width: 1024px) {
    display: none;
  }
`;

export const AgentContextPanel = () => {
  const { t } = useLingui();
  const agentContextPanelCollapsed = useRecoilValue(
    agentContextPanelCollapsedState,
  );
  const { selectedConversationId, selectConversation } =
    useAgentConversations();

  if (agentContextPanelCollapsed) {
    return null;
  }

  return (
    <StyledContainer>
      <ConversationList
        onSelectConversation={selectConversation}
        selectedConversationId={selectedConversationId}
      />
    </StyledContainer>
  );
};
