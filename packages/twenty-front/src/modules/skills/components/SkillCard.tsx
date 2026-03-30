import styled from '@emotion/styled';
import { useTheme } from '@emotion/react';
import { IconBolt } from '@tabler/icons-react';
import { useLingui } from '@lingui/react/macro';
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

const StyledFooter = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  margin-top: auto;
`;

const StyledBadge = styled.span<{ color: string }>`
  background: ${({ theme }) => theme.background.transparent.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ color }) => color};
  font-size: ${({ theme }) => theme.font.size.xs};
  padding: ${({ theme }) => theme.spacing(0.5)}
    ${({ theme }) => theme.spacing(1)};
`;

type SkillCardProps = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  enabled: boolean;
};

const formatCategory = (category: string): string =>
  category.replace(/_/g, ' ');

export const SkillCard = ({
  id,
  name,
  description,
  category,
  enabled,
}: SkillCardProps) => {
  const { t } = useLingui();
  const navigate = useNavigate();
  const theme = useTheme();

  return (
    <StyledCard onClick={() => navigate(`/skills/${id}`)}>
      <StyledHeader>
        <IconBolt size={16} />
        <StyledName>{name}</StyledName>
      </StyledHeader>
      {description && <StyledDescription>{description}</StyledDescription>}
      <StyledFooter>
        <StyledBadge color={theme.font.color.secondary}>
          {formatCategory(category)}
        </StyledBadge>
        <StyledBadge
          color={enabled ? theme.font.color.primary : theme.font.color.tertiary}
        >
          {enabled ? t`Active` : t`Draft`}
        </StyledBadge>
      </StyledFooter>
    </StyledCard>
  );
};
