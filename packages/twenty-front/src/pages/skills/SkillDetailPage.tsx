import styled from '@emotion/styled';
import { IconBolt, IconChevronRight, IconClock, IconEye, IconPencil, IconPlayerPlay } from '@tabler/icons-react';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { SkillEditorForm } from '@/agent/components/skill-editor/SkillEditorForm';
import { useAgentSkills } from '@/agent/hooks/useAgentSkills';
import { type SkillFormData } from '@/agent/types/skill-editor';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import { AppPath } from 'twenty-shared/types';
import { TabButton } from 'twenty-ui/input';

type SkillDetailTab = 'overview' | 'editor' | 'history' | 'test';

const StyledPageBody = styled(PageBody)`
  flex: 1;
  min-height: 0;
`;

const StyledTabBar = styled.div`
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: 0 ${({ theme }) => theme.spacing(4)};
`;

const StyledTabContent = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
`;

const StyledBreadcrumb = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledBreadcrumbLink = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.md};
  padding: 0;

  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledBreadcrumbCurrent = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledOverview = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledField = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledFieldLabel = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledFieldValue = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

const StyledBadge = styled.span<{ active?: boolean }>`
  background: ${({ theme }) => theme.background.transparent.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ active, theme }) =>
    active ? theme.font.color.primary : theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  padding: ${({ theme }) => theme.spacing(0.5)}
    ${({ theme }) => theme.spacing(1)};
`;

const StyledPlaceholder = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  flex: 1;
  font-size: ${({ theme }) => theme.font.size.md};
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(8)};
`;

const StyledRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(4)};
`;

const formatCategory = (category: string): string =>
  category.replace(/_/g, ' ');

export const SkillDetailPage = () => {
  const { t } = useLingui();
  const { skillId } = useParams();
  const navigate = useNavigate();
  const { skills, isLoading } = useAgentSkills();
  const [activeTab, setActiveTab] = useState<SkillDetailTab>('overview');

  const skill = skills.find((s) => s.id === skillId);

  const handleBreadcrumbClick = useCallback(() => {
    navigate(AppPath.Skills);
  }, [navigate]);

  const handleEditorSave = useCallback(
    (_data: SkillFormData) => {
      // NOTE: save wired when DEV-948 storage layer is complete
      setActiveTab('overview');
    },
    [],
  );

  const handleEditorCancel = useCallback(() => {
    setActiveTab('overview');
  }, []);

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader title={t`Skill Detail`} Icon={IconBolt} />
        <StyledPageBody>
          <StyledPlaceholder>{t`Loading...`}</StyledPlaceholder>
        </StyledPageBody>
      </PageContainer>
    );
  }

  const skillName = skill?.name ?? t`Unknown Skill`;

  return (
    <PageContainer>
      <PageHeader
        title={
          <StyledBreadcrumb>
            <StyledBreadcrumbLink onClick={handleBreadcrumbClick}>
              {t`Skills`}
            </StyledBreadcrumbLink>
            <IconChevronRight size={14} />
            <StyledBreadcrumbCurrent>{skillName}</StyledBreadcrumbCurrent>
          </StyledBreadcrumb>
        }
        Icon={IconBolt}
      />
      <StyledPageBody>
        <StyledTabBar>
          <TabButton
            id="overview"
            title={t`Overview`}
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            LeftIcon={IconEye}
          />
          <TabButton
            id="editor"
            title={t`Editor`}
            active={activeTab === 'editor'}
            onClick={() => setActiveTab('editor')}
            LeftIcon={IconPencil}
          />
          <TabButton
            id="history"
            title={t`History`}
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            LeftIcon={IconClock}
          />
          <TabButton
            id="test"
            title={t`Test`}
            active={activeTab === 'test'}
            onClick={() => setActiveTab('test')}
            LeftIcon={IconPlayerPlay}
          />
        </StyledTabBar>
        <StyledTabContent>
          {activeTab === 'overview' && (
            <StyledOverview>
              <StyledField>
                <StyledFieldLabel>{t`Name`}</StyledFieldLabel>
                <StyledFieldValue>{skillName}</StyledFieldValue>
              </StyledField>
              {skill?.description && (
                <StyledField>
                  <StyledFieldLabel>{t`Description`}</StyledFieldLabel>
                  <StyledFieldValue>{skill.description}</StyledFieldValue>
                </StyledField>
              )}
              <StyledRow>
                <StyledField>
                  <StyledFieldLabel>{t`Category`}</StyledFieldLabel>
                  <StyledFieldValue>
                    {skill?.category
                      ? formatCategory(skill.category)
                      : t`Uncategorized`}
                  </StyledFieldValue>
                </StyledField>
                <StyledField>
                  <StyledFieldLabel>{t`Status`}</StyledFieldLabel>
                  <StyledBadge active={skill?.enabled}>
                    {skill?.enabled ? t`Active` : t`Draft`}
                  </StyledBadge>
                </StyledField>
              </StyledRow>
            </StyledOverview>
          )}
          {activeTab === 'editor' && (
            <SkillEditorForm
              onSave={handleEditorSave}
              onCancel={handleEditorCancel}
            />
          )}
          {activeTab === 'history' && (
            <StyledPlaceholder>
              {t`Execution history will appear here once skills are run.`}
            </StyledPlaceholder>
          )}
          {activeTab === 'test' && (
            <StyledPlaceholder>
              {t`Test runner will be available once the skill execution engine is wired.`}
            </StyledPlaceholder>
          )}
        </StyledTabContent>
      </StyledPageBody>
    </PageContainer>
  );
};
