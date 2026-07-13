import { Effect } from 'effect';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';

import { dependenciesForProfiles, mediaDependencyProfiles } from './dependency-catalog';

export const MediaDependencyCatalog = Symbol('MediaDependencyCatalog');
export const MediaLogger = Symbol('MediaLogger');
export const MediaClock = Symbol('MediaClock');

export type MediaDependencyCommandStatus = {
  name: string;
  found: boolean;
  path?: string;
  version?: string;
};

export type MediaDependencyStatus = {
  id: string;
  optional: boolean;
  estimatedInstalledSizeMb: number;
  commands: MediaDependencyCommandStatus[];
};

export type MediaProfileStatus = {
  optional: boolean;
  satisfied: boolean;
  estimatedInstalledSizeMb: number;
  dependencies: MediaDependencyStatus[];
};

export type MediaDependencyReport = {
  schema: 'media.dependency-report.v1';
  ok: boolean;
  profiles: Record<string, MediaProfileStatus>;
  estimatedInstalledSizeMb: number;
};

function commandPath(command: string): string | undefined {
  if (process.env.CONSUELO_MEDIA_TEST_FORCE_MISSING === command) return undefined;
  const searchPath = process.env.PATH ?? '';
  for (const directory of searchPath.split(delimiter)) {
    if (!directory) continue;
    const candidate = join(directory, command);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

export function checkMediaDependencies(input: { profiles?: string[]; allProfiles?: boolean } = {}): MediaDependencyReport {
  const profileIds = input.allProfiles ? mediaDependencyProfiles.map((profile) => profile.id) : (input.profiles && input.profiles.length > 0 ? input.profiles : ['media-core']);
  const profiles: Record<string, MediaProfileStatus> = {};
  let ok = true;
  let estimatedInstalledSizeMb = 0;

  for (const profileId of profileIds) {
    const profile = mediaDependencyProfiles.find((candidate) => candidate.id === profileId);
    if (!profile) throw new Error('unknown media dependency profile: ' + profileId);
    const dependencies = dependenciesForProfiles([profileId]);
    estimatedInstalledSizeMb += profile.estimatedInstalledSizeMb;
    const statuses = dependencies.map((dependency) => {
      const commands = (dependency.commands ?? []).map((command) => {
        const foundPath = commandPath(command);
        return {
          name: command,
          found: Boolean(foundPath),
          ...(foundPath ? { path: foundPath } : {}),
        };
      });
      return {
        id: dependency.id,
        optional: dependency.optional,
        estimatedInstalledSizeMb: dependency.estimatedInstalledSizeMb,
        commands,
      };
    });
    const satisfied = statuses.every((dependency) => dependency.commands.length === 0 || dependency.commands.every((command) => command.found));
    if (!profile.optional && !satisfied) ok = false;
    profiles[profileId] = {
      optional: Boolean(profile.optional),
      satisfied,
      estimatedInstalledSizeMb: profile.estimatedInstalledSizeMb,
      dependencies: statuses,
    };
  }

  return { schema: 'media.dependency-report.v1', ok, profiles, estimatedInstalledSizeMb };
}

export const checkMediaDependenciesEffect = (input: { profiles?: string[]; allProfiles?: boolean } = {}) => Effect.try({
  try: () => checkMediaDependencies(input),
  catch: (cause) => cause instanceof Error ? cause : new Error(String(cause)),
});

export function checkMediaDependenciesForCli(input: { profiles?: string[]; allProfiles?: boolean } = {}): Promise<MediaDependencyReport> {
  return Promise.resolve(checkMediaDependencies(input));
}
