import styled from '@emotion/styled';
import { IconRobot } from 'twenty-ui/display';

import { AgentChatPanel } from '@/agent/components/AgentChatPanel';
import { AgentContextPanel } from '@/agent/components/AgentContextPanel';
import { useAgentHotkeys } from '@/agent/hooks/useAgentHotkeys';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';

const StyledContent = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

export const AgentPage = () => {
  useAgentHotkeys();

  return (
    <PageContainer>
      <PageHeader title="Agent" Icon={IconRobot} />
      <StyledContent>
        <AgentChatPanel />
        <AgentContextPanel />
      </StyledContent>
    </PageContainer>
  );
};
