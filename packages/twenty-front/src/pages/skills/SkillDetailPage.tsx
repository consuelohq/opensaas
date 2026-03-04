import { useParams } from 'react-router-dom';

import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';

export const SkillDetailPage = () => {
  const { skillId: _skillId } = useParams();

  // TODO(DEV-1080): wire up skill detail view
  return (
    <PageContainer>
      <PageHeader title="Skill Detail" />
    </PageContainer>
  );
};
