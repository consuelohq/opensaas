import { describe, expect, it } from 'vitest';

import {
  getDefaultSelectedSkillNames,
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

  it('preselects active skills and excludes deprecated compatibility aliases', () => {
    const selected = getDefaultSelectedSkillNames();

    expect(selected).toContain('senior-engineer');
    expect(selected).toContain('research-ingest');
    expect(selected).toContain('task');
    expect(selected).not.toContain('consuelo-design-landing-page');
  });
});
