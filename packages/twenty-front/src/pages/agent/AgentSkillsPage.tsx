import { AgentSkillsSidebar } from '@/agent/components/AgentSkillsSidebar';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import styled from '@emotion/styled';
import { IconBolt } from 'twenty-ui/display';

const StyledContent = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

export const AgentSkillsPage = () => {
  return (
    <PageContainer>
      <PageHeader title="Skills" Icon={IconBolt} />
      <StyledContent>
        <AgentSkillsSidebar />
      </StyledContent>
    </PageContainer>
  );
};
