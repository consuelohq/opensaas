import { listBundledSkills, type SkillMetadata } from './skills';

export type OnboardingSkillOption = {
  value: string;
  label: string;
  hint: string;
  defaultSelected: boolean;
};

function isActiveSkill(skill: SkillMetadata): boolean {
  return skill.status === undefined || skill.status === 'active';
}

function toSkillOption(skill: SkillMetadata): OnboardingSkillOption {
  return {
    value: skill.name,
    label: skill.title,
    hint: skill.description,
    defaultSelected: isActiveSkill(skill),
  };
}

export function getOnboardingSkillOptions(
  skills: SkillMetadata[] = listBundledSkills(),
): OnboardingSkillOption[] {
  return skills
    .filter((skill) => skill.status !== 'deprecated')
    .map(toSkillOption)
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function getDefaultSelectedSkillNames(
  skills: SkillMetadata[] = listBundledSkills(),
): string[] {
  return getOnboardingSkillOptions(skills)
    .filter((option) => option.defaultSelected)
    .map((option) => option.value);
}
