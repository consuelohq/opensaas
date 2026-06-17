import { describe, expect, it } from 'vitest';

import {
  CORE_SKILL_GROUP_LABEL,
  OPTIONAL_SKILL_GROUP_LABEL,
  getCoreSelectedSkillNames,
  getDefaultSelectedSkillNames,
  getGroupedOnboardingSkillOptions,
  getOnboardingSkillOptions,
} from '../scripts/lib/onboarding-skills';

describe('onboarding skill choices', () => {
  it('builds onboarding choices from bundled skills instead of the old three hardcoded names', () => {
    const options = getOnboardingSkillOptions();
    const names = options.map((option) => option.value);

    expect(names.length).toBeGreaterThan(3);
    expect(names).toContain('senior-engineer');
    expect(names).toContain('research-ingest');
    expect(names).toContain('task');
    expect(names).not.toContain('artifact-search');
    expect(names).not.toContain('agent-handoff');
  });

  it('defaults to core skills and excludes optional plus deprecated skills', () => {
    const selected = getDefaultSelectedSkillNames();

    expect(selected).toEqual(getCoreSelectedSkillNames());
    expect(selected).toContain('browser');
    expect(selected).toContain('office');
    expect(selected).toContain('debugger');
    expect(selected).toContain('handoff');
    expect(selected).toContain('research-ingest');
    expect(selected).toContain('senior-engineer');
    expect(selected).toContain('skill-creator');
    expect(selected).toContain('task');
    expect(selected).not.toContain('consuelo-workspace-snapshot');
    expect(selected).not.toContain('daily-revenue-brief');
    expect(selected).not.toContain('office-landing-page');
  });

  it('groups the interactive prompt with core first, optional second, title-only rows', () => {
    const grouped = getGroupedOnboardingSkillOptions();
    const groupNames = Object.keys(grouped.options);

    expect(groupNames).toEqual([
      CORE_SKILL_GROUP_LABEL,
      OPTIONAL_SKILL_GROUP_LABEL,
    ]);
    expect(grouped.cursorAt).toBe(CORE_SKILL_GROUP_LABEL);
    expect(grouped.initialValues).toEqual([]);
    expect(grouped.selectableGroups).toBe(true);
    expect(grouped.groupSpacing).toBeGreaterThan(0);

    const coreNames = grouped.options[CORE_SKILL_GROUP_LABEL].map(
      (option) => option.value,
    );
    const optionalNames = grouped.options[OPTIONAL_SKILL_GROUP_LABEL].map(
      (option) => option.value,
    );

    expect(coreNames).toEqual(getCoreSelectedSkillNames());
    expect(optionalNames).toEqual([
      'consuelo-workspace-snapshot',
      'daily-revenue-brief',
    ]);

    for (const option of Object.values(grouped.options).flat()) {
      expect(option.label).toBeTruthy();
      expect(option.hint).toBeUndefined();
    }
  });
});
