import styled from '@emotion/styled';
import { useCallback } from 'react';

import { SKILL_CATEGORIES } from '@/agent/constants/skill-editor';
import { type SkillCategory } from '@/agent/types/skill-editor';

type SkillCategorySelectProps = {
  value: SkillCategory;
  onChange: (value: SkillCategory) => void;
};

const StyledSelect = styled.select`
  width: 100%;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.secondary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: 14px;
  outline: none;
  cursor: pointer;

  &:focus {
    border-color: ${({ theme }) => theme.color.blue};
  }
`;

export const SkillCategorySelect = ({
  value,
  onChange,
}: SkillCategorySelectProps) => {
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(event.target.value as SkillCategory);
    },
    [onChange],
  );

  return (
    <StyledSelect value={value} onChange={handleChange} aria-label="Category">
      {SKILL_CATEGORIES.map((category) => (
        <option key={category.value} value={category.value}>
          {category.label}
        </option>
      ))}
    </StyledSelect>
  );
};
