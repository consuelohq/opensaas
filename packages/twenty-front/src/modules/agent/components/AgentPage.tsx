import styled from '@emotion/styled';
import { IconRobot } from 'twenty-ui/display';

import { AgentChatPanel } from '@/agent/components/AgentChatPanel';
import { AgentContextPanel } from '@/agent/components/AgentContextPanel';
import { useAgentHotkeys } from '@/agent/hooks/useAgentHotkeys';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';

const StyledPageBody = styled(PageBody)`
  flex: 1;
  min-height: 0;
`;

const StyledContent = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  width: 100%;
`;

export const AgentPage = () => {
  useAgentHotkeys();

  return (
    <PageContainer>
      <PageHeader title="Agent" Icon={IconRobot} />
      <StyledPageBody>
        <StyledContent>
          <AgentChatPanel />
          <AgentContextPanel />
        </StyledContent>
      </StyledPageBody>
    </PageContainer>
  );
};
