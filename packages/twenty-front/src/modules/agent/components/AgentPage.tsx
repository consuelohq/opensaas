import styled from '@emotion/styled';

import { AgentChatPanel } from '@/agent/components/AgentChatPanel';
import { AgentContextPanel } from '@/agent/components/AgentContextPanel';
import { AgentSkillsSidebar } from '@/agent/components/AgentSkillsSidebar';
import { useAgentHotkeys } from '@/agent/hooks/useAgentHotkeys';

const StyledContainer = styled.div`
  display: flex;
  height: 100%;
  overflow: hidden;
`;

export const AgentPage = () => {
  useAgentHotkeys();

  return (
    <StyledContainer>
      <AgentSkillsSidebar />
      <AgentChatPanel />
      <AgentContextPanel />
    </StyledContainer>
  );
};
