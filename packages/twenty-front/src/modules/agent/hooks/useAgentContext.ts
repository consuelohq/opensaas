import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';

import { selectedSkillIdState } from '@/agent/states/agentState';
import { useAgentSkills } from '@/agent/hooks/useAgentSkills';

export const useAgentContext = () => {
  const selectedSkillId = useRecoilValue(selectedSkillIdState);
  const { skills, isLoading } = useAgentSkills();

  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.id === selectedSkillId) ?? null,
    [skills, selectedSkillId],
  );

  return {
    selectedSkill,
    isLoading,
  };
};
