import { readManagedComponentState } from './managed-components';
import {
  loadOsConfig,
  resolveOsHome,
  updateSelectedSkillSelection,
} from './install-state';
import { getDefaultSelectedSkillNames } from './onboarding-skills';
import { listBundledSkills } from './skills';

export type SkillSelectionAction = 'add' | 'remove';

export type SkillSelectionSnapshot = {
  home: string;
  bundled: string[];
  selected: string[];
  addable: string[];
  removable: string[];
};

export type SkillSelectionResult = {
  action: SkillSelectionAction;
  requestedSkills: string[];
  changedSkills: string[];
  selectedSkills: string[];
  reviewRequired: string[];
  changed: boolean;
};

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right),
  );
}

function bundledSkillNames(): string[] {
  return listBundledSkills()
    .filter((skill) => skill.status !== 'deprecated')
    .map((skill) => skill.name)
    .sort((left, right) => left.localeCompare(right));
}

export function readSkillSelectionSnapshot(home?: string): SkillSelectionSnapshot {
  const resolvedHome = resolveOsHome(home);
  const config = loadOsConfig(resolvedHome);
  if (!config) {
    throw new Error(
      `Consuelo OS is not installed at ${resolvedHome}. Run consuelo install first.`,
    );
  }

  const bundled = bundledSkillNames();
  const bundledSet = new Set(bundled);
  const selected = uniqueSorted(
    (config.selectedSkills ?? getDefaultSelectedSkillNames()).filter((name) =>
      bundledSet.has(name),
    ),
  );
  const selectedSet = new Set(selected);

  return {
    home: resolvedHome,
    bundled,
    selected,
    addable: bundled.filter((name) => !selectedSet.has(name)),
    removable: bundled.filter((name) => selectedSet.has(name)),
  };
}

export function applySkillSelectionChange(input: {
  action: SkillSelectionAction;
  skills: readonly string[];
  home?: string;
  visibleUserRoot?: string;
}): SkillSelectionResult {
  const snapshot = readSkillSelectionSnapshot(input.home);
  const requestedSkills = uniqueSorted(input.skills);
  const bundledSet = new Set(snapshot.bundled);
  const unknown = requestedSkills.filter((name) => !bundledSet.has(name));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown bundled skill${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}`,
    );
  }

  const next = new Set(snapshot.selected);
  const changedSkills: string[] = [];
  for (const name of requestedSkills) {
    if (input.action === 'add') {
      if (!next.has(name)) {
        next.add(name);
        changedSkills.push(name);
      }
    } else if (next.delete(name)) {
      changedSkills.push(name);
    }
  }

  if (changedSkills.length === 0) {
    return {
      action: input.action,
      requestedSkills,
      changedSkills: [],
      selectedSkills: snapshot.selected,
      reviewRequired: [],
      changed: false,
    };
  }

  const updated = updateSelectedSkillSelection({
    home: snapshot.home,
    visibleUserRoot: input.visibleUserRoot,
    selectedSkills: uniqueSorted([...next]),
  });
  const changedSet = new Set(changedSkills);
  const reviewRequired = readManagedComponentState(snapshot.home).plan.items
    .filter(
      (item) =>
        item.kind === 'skill' &&
        changedSet.has(item.id) &&
        item.requiresReview,
    )
    .map((item) => item.id)
    .sort((left, right) => left.localeCompare(right));

  return {
    action: input.action,
    requestedSkills,
    changedSkills: uniqueSorted(changedSkills),
    selectedSkills: updated.selectedSkills,
    reviewRequired,
    changed: true,
  };
}
