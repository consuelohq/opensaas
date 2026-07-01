import { listBundledSkills, type SkillMetadata } from './skills';

export const CORE_SKILL_GROUP_LABEL = 'Core OS skills (suggested starting point)';
export const OPTIONAL_SKILL_GROUP_LABEL = 'Optional skills';

const OPTIONAL_SKILL_NAMES = new Set([
  'consuelo-workspace-snapshot',
  'daily-revenue-brief',
]);

export type OnboardingSkillOption = {
  value: string;
  label: string;
  hint?: string;
  defaultSelected: boolean;
};

export type GroupedOnboardingSkillOptions = {
  options: Record<string, Array<{ value: string; label: string; hint?: string }>>;
  initialValues: string[];
  cursorAt: string;
  selectableGroups: true;
  groupSpacing: number;
};

function isActiveSkill(skill: SkillMetadata): boolean {
  return skill.status === undefined || skill.status === 'active';
}

function isCoreSkill(skill: SkillMetadata): boolean {
  return isActiveSkill(skill) && !OPTIONAL_SKILL_NAMES.has(skill.name);
}

function toSkillOption(skill: SkillMetadata): OnboardingSkillOption {
  return {
    value: skill.name,
    label: skill.title,
    defaultSelected: isCoreSkill(skill),
  };
}

function sortSkillOptions(
  left: OnboardingSkillOption,
  right: OnboardingSkillOption,
): number {
  return left.label.localeCompare(right.label);
}

export function getOnboardingSkillOptions(
  skills: SkillMetadata[] = listBundledSkills(),
): OnboardingSkillOption[] {
  return skills
    .filter((skill) => skill.status !== 'deprecated')
    .map(toSkillOption)
    .sort(sortSkillOptions);
}

export function getCoreSelectedSkillNames(
  skills: SkillMetadata[] = listBundledSkills(),
): string[] {
  return getOnboardingSkillOptions(skills)
    .filter((option) => option.defaultSelected)
    .map((option) => option.value);
}

export function getDefaultSelectedSkillNames(
  skills: SkillMetadata[] = listBundledSkills(),
): string[] {
  return getCoreSelectedSkillNames(skills);
}

export function getGroupedOnboardingSkillOptions(
  skills: SkillMetadata[] = listBundledSkills(),
): GroupedOnboardingSkillOptions {
  const options = getOnboardingSkillOptions(skills);
  const coreOptions = options.filter((option) => option.defaultSelected);
  const optionalOptions = options.filter((option) => !option.defaultSelected);
  const toPromptOption = (option: OnboardingSkillOption) => ({
    value: option.value,
    label: option.label,
  });

  return {
    options: {
      [CORE_SKILL_GROUP_LABEL]: coreOptions.map(toPromptOption),
      [OPTIONAL_SKILL_GROUP_LABEL]: optionalOptions.map(toPromptOption),
    },
    initialValues: coreOptions.map((option) => option.value),
    cursorAt: coreOptions[0]?.value ?? optionalOptions[0]?.value ?? CORE_SKILL_GROUP_LABEL,
    selectableGroups: true,
    groupSpacing: 1,
  };
}
