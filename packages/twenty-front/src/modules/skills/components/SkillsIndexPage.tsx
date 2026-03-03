import styled from '@emotion/styled';
import { IconBolt, IconPlus } from '@tabler/icons-react';
import { useState } from 'react';

import { useAgentSkills } from '@/agent/hooks/useAgentSkills';
import { SkillCard } from '@/skills/components/SkillCard';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import { Button } from 'twenty-ui/input';

const StyledBody = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledSearchInput = styled.input`
  background: ${({ theme }) => theme.background.transparent.lighter};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  outline: none;
  padding: ${({ theme }) => theme.spacing(2)};
  width: 100%;

  &::placeholder {
    color: ${({ theme }) => theme.font.color.tertiary};
  }

  &:focus {
    border-color: ${({ theme }) => theme.border.color.strong};
  }
`;

const StyledGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(3)};
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  margin-top: ${({ theme }) => theme.spacing(4)};
`;

const StyledEmptyState = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.md};
  margin-top: ${({ theme }) => theme.spacing(8)};
  text-align: center;
`;

export const SkillsIndexPage = () => {
  const { skills, isLoading } = useAgentSkills();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSkills = skills.filter((skill) => {
    const term = searchTerm.toLowerCase();

    return (
      skill.name.toLowerCase().includes(term) ||
      (skill.description?.toLowerCase().includes(term) ?? false)
    );
  });

  return (
    <PageContainer>
      <PageHeader title="Skills" Icon={IconBolt}>
        <Button
          Icon={IconPlus}
          title="Create Skill"
          size="small"
          variant="secondary"
        />
      </PageHeader>
      <StyledBody>
        <StyledSearchInput
          placeholder="Search skills..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        {isLoading ? (
          <StyledEmptyState>Loading skills...</StyledEmptyState>
        ) : filteredSkills.length === 0 ? (
          <StyledEmptyState>
            {searchTerm ? 'No skills match your search' : 'No skills yet'}
          </StyledEmptyState>
        ) : (
          <StyledGrid>
            {filteredSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                id={skill.id}
                name={skill.name}
                description={skill.description}
                category={skill.category}
              />
            ))}
          </StyledGrid>
        )}
      </StyledBody>
    </PageContainer>
  );
};
