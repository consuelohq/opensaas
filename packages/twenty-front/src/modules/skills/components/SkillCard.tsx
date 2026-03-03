import styled from '@emotion/styled';
import { IconBolt } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

const StyledCard = styled.div`
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(4)};

  &:hover {
    background: ${({ theme }) => theme.background.transparent.lighter};
    border-color: ${({ theme }) => theme.border.color.strong};
  }
`;

const StyledHeader = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledName = styled.div`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledDescription = styled.div`
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: ${({ theme }) => theme.font.color.tertiary};
  display: -webkit-box;
  font-size: ${({ theme }) => theme.font.size.sm};
  overflow: hidden;
`;

const StyledCategoryBadge = styled.span`
  background: ${({ theme }) => theme.background.transparent.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.xs};
  padding: ${({ theme }) => theme.spacing(0.5)}
    ${({ theme }) => theme.spacing(1)};
`;

type SkillCardProps = {
  id: string;
  name: string;
  description: string | null;
  category: string;
};

const formatCategory = (category: string): string =>
  category.replace(/_/g, ' ');

export const SkillCard = ({
  id,
  name,
  description,
  category,
}: SkillCardProps) => {
  const navigate = useNavigate();

  return (
    <StyledCard onClick={() => navigate(`/skills/${id}`)}>
      <StyledHeader>
        <IconBolt size={16} />
        <StyledName>{name}</StyledName>
      </StyledHeader>
      {description && <StyledDescription>{description}</StyledDescription>}
      <StyledCategoryBadge>{formatCategory(category)}</StyledCategoryBadge>
    </StyledCard>
  );
};
