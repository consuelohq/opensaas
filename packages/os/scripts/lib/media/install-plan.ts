import { dependenciesForProfiles, mediaDependencyProfiles, type MediaRuntimeDependency } from './dependency-catalog';

export type MediaInstallPlanStep = {
  dependencyId: string;
  packageName?: string;
  packageManager?: string;
  commands?: string[];
  skipped?: boolean;
  estimatedInstalledSizeMb: number;
  installHint: string;
};

export type MediaInstallPlan = {
  schema: 'media.install-plan.v1';
  dryRun: boolean;
  profiles: string[];
  packageManager: 'homebrew';
  steps: MediaInstallPlanStep[];
  estimatedInstalledSizeMb: number;
  warnings: string[];
};

export type CreateMediaInstallPlanInput = {
  profiles: string[];
  dryRun: boolean;
  installedCommands?: Record<string, string>;
  maxEstimatedSizeMb?: number;
};

function commandSatisfied(dependency: MediaRuntimeDependency, installedCommands: Record<string, string>): boolean {
  const commands = dependency.commands ?? [];
  return commands.length > 0 && commands.every((command) => Boolean(installedCommands[command]));
}

export function createMediaInstallPlan(input: CreateMediaInstallPlanInput): MediaInstallPlan {
  const profiles = input.profiles.length > 0 ? input.profiles : ['media-core'];
  const dependencies = dependenciesForProfiles(profiles);
  const installedCommands = input.installedCommands ?? {};
  const steps = dependencies.map((dependency) => ({
    dependencyId: dependency.id,
    packageName: dependency.packageManagers?.homebrew ?? dependency.packageManagers?.['python-venv'] ?? dependency.packageManagers?.['model-bundle'] ?? dependency.id,
    packageManager: dependency.packageManagers?.homebrew ? 'homebrew' : dependency.packageManagers?.['python-venv'] ? 'python-venv' : 'model-bundle',
    commands: dependency.commands ?? [],
    skipped: commandSatisfied(dependency, installedCommands),
    estimatedInstalledSizeMb: dependency.estimatedInstalledSizeMb,
    installHint: dependency.installHint,
  }));
  const estimatedInstalledSizeMb = dependencies.reduce((total, dependency) => total + dependency.estimatedInstalledSizeMb, 0);
  const warnings: string[] = [];
  const max = input.maxEstimatedSizeMb;
  if (max !== undefined && estimatedInstalledSizeMb > max) {
    warnings.push('Selected media profiles exceed size budget: estimate ' + estimatedInstalledSizeMb + 'MB > budget ' + max + 'MB.');
  }
  for (const profileId of profiles) {
    const profile = mediaDependencyProfiles.find((candidate) => candidate.id === profileId);
    if (profile?.warningThresholdMb !== undefined && profile.estimatedInstalledSizeMb > profile.warningThresholdMb) {
      warnings.push(profileId + ' estimated size ' + profile.estimatedInstalledSizeMb + 'MB exceeds warning threshold ' + profile.warningThresholdMb + 'MB.');
    }
  }
  return { schema: 'media.install-plan.v1', dryRun: input.dryRun, profiles, packageManager: 'homebrew', steps, estimatedInstalledSizeMb, warnings };
}
