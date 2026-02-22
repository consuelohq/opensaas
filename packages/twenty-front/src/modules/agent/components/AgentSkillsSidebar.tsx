import styled from '@emotion/styled';
import { IconBolt, IconPlus } from '@tabler/icons-react';
import { useMemo } from 'react';

import { useAgentSkills } from '@/agent/hooks/useAgentSkills';
import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';
import { NavigationDrawerSection } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSection';
import { NavigationDrawerSectionTitle } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSectionTitle';
import { NavigationDrawerSubItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSubItem';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 240px;
  min-width: 240px;
  border-right: 1px solid ${({ theme }) => theme.border.color.medium};
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(1)};
`;

const StyledEmptyState = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => theme.spacing(4)};
  text-align: center;
`;

const StyledSpacer = styled.div`
  flex: 1;
`;

export const AgentSkillsSidebar = () => {
  const { skills, folders, isLoading, selectedSkillId, setSelectedSkillId } =
    useAgentSkills();

  const folderMap = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder])),
    [folders],
  );

  const { ungrouped, grouped } = useMemo(() => {
    const ungroupedSkills = skills.filter((skill) => !skill.folderId);
    const groupedSkills = new Map<string, typeof skills>();

    for (const skill of skills) {
      if (skill.folderId) {
        const existing = groupedSkills.get(skill.folderId) ?? [];

        existing.push(skill);
        groupedSkills.set(skill.folderId, existing);
      }
    }

    return { ungrouped: ungroupedSkills, grouped: groupedSkills };
  }, [skills]);

  if (isLoading) {
    return <StyledContainer />;
  }

  const hasSkills = skills.length > 0;

  return (
    <StyledContainer>
      {hasSkills ? (
        <NavigationDrawerSection>
          <NavigationDrawerSectionTitle label="Skills" />
          {ungrouped.map((skill) => (
            <NavigationDrawerItem
              key={skill.id}
              label={skill.name}
              Icon={IconBolt}
              active={selectedSkillId === skill.id}
              onClick={() => setSelectedSkillId(skill.id)}
            />
          ))}
          {Array.from(grouped.entries()).map(([folderId, folderSkills]) => (
            <NavigationDrawerSection key={folderId}>
              <NavigationDrawerSectionTitle
                label={folderMap.get(folderId)?.name ?? 'Folder'}
              />
              {folderSkills.map((skill) => (
                <NavigationDrawerSubItem
                  key={skill.id}
                  label={skill.name}
                  Icon={IconBolt}
                  active={selectedSkillId === skill.id}
                  onClick={() => setSelectedSkillId(skill.id)}
                />
              ))}
            </NavigationDrawerSection>
          ))}
        </NavigationDrawerSection>
      ) : (
        <StyledEmptyState>No skills yet</StyledEmptyState>
      )}
      <StyledSpacer />
      <NavigationDrawerItem
        label="New Skill"
        Icon={IconPlus}
        onClick={() => {
          // NOTE: DEV-960 handles skill creation flow
        }}
      />
    </StyledContainer>
  );
};
