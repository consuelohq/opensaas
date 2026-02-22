import type {
  Skill,
  SkillIntegrationRequirement,
} from 'src/engine/core-modules/agent/types';

export type IntegrationValidationResult = {
  valid: boolean;
  missingRequired: SkillIntegrationRequirement[];
  missingOptional: SkillIntegrationRequirement[];
};

// pure function — no side effects, no DI needed
export const validateIntegrationRequirements = (
  skill: Skill,
  connectedIntegrations: string[],
): IntegrationValidationResult => {
  const connected = new Set(connectedIntegrations);

  const missingRequired = skill.integrations.filter(
    (i) => i.required && !connected.has(i.integrationId),
  );

  const missingOptional = skill.integrations.filter(
    (i) => !i.required && !connected.has(i.integrationId),
  );

  return {
    valid: missingRequired.length === 0,
    missingRequired,
    missingOptional,
  };
};
