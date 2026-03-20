import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { IconRobot } from 'twenty-ui/display';

import { AgentChatPanel } from '@/agent/components/AgentChatPanel';
import { AgentContextPanel } from '@/agent/components/AgentContextPanel';
import { AgentRuntimeProviderWrapper } from '@/agent/components/AgentRuntimeProvider';
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
  const { t } = useLingui();

  useAgentHotkeys();

  return (
    <PageContainer>
      <PageHeader title={t`Agent`} Icon={IconRobot} />
      <StyledPageBody>
        <AgentRuntimeProviderWrapper>
          <StyledContent>
            <AgentChatPanel />
            <AgentContextPanel />
          </StyledContent>
        </AgentRuntimeProviderWrapper>
      </StyledPageBody>
    </PageContainer>
  );
};
