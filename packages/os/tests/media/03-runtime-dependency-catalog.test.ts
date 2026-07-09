import { describe, expect, it } from 'vitest';

import { expectedProfiles, importMediaModule } from './helpers';

type Dependency = {
  id: string;
  profile: string;
  commands?: string[];
  importName?: string;
  packageManagers?: Record<string, string>;
  versionCommands?: string[][];
  installHint?: string;
  requiredBy?: string[];
  optional?: boolean;
  estimatedInstalledSizeMb?: number;
  modelBundles?: Array<{ id: string; estimatedInstalledSizeMb: number; implicit?: boolean }>;
};

type Profile = {
  id: string;
  dependencies: string[];
  default?: boolean;
  optional?: boolean;
  estimatedInstalledSizeMb?: number;
  warningThresholdMb?: number;
};

async function loadCatalog() {
  const module = await importMediaModule('scripts/lib/media/dependency-catalog.ts');
  const dependencies = module.mediaRuntimeDependencies;
  const profiles = module.mediaDependencyProfiles;

  expect(
    Array.isArray(dependencies),
    'mediaRuntimeDependencies should be an array',
  ).toBe(true);
  expect(
    Array.isArray(profiles),
    'mediaDependencyProfiles should be an array',
  ).toBe(true);

  return {
    dependencies: dependencies as Dependency[],
    profiles: profiles as Profile[],
  };
}

describe('media runtime dependency catalog', () => {
  it('should satisfy media contract when it declares explicit media dependency profiles with storage budgets', async () => {
    const { profiles } = await loadCatalog();
    const ids = profiles.map((profile) => profile.id);

    for (const profile of expectedProfiles) expect(ids).toContain(profile);
    for (const profile of profiles) {
      expect(typeof profile.estimatedInstalledSizeMb, profile.id + ' should declare estimatedInstalledSizeMb').toBe('number');
      expect(profile.estimatedInstalledSizeMb).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(profile.dependencies), profile.id + ' should list dependency ids').toBe(true);
    }

    expect(profiles.find((profile) => profile.id === 'media-core')?.default).toBe(true);
    expect(profiles.find((profile) => profile.id === 'media-vision-pose')?.optional).toBe(true);
    expect(profiles.find((profile) => profile.id === 'media-render-advanced')?.optional).toBe(true);
  });

  it('should satisfy media contract when it models ffmpeg as the package that provides both ffmpeg and ffprobe commands', async () => {
    const { dependencies } = await loadCatalog();
    const ffmpeg = dependencies.find((dependency) => dependency.id === 'ffmpeg');

    expect(ffmpeg).toMatchObject({
      id: 'ffmpeg',
      profile: 'media-core',
      commands: ['ffmpeg', 'ffprobe'],
      packageManagers: { homebrew: 'ffmpeg' },
      optional: false,
    });
    expect(ffmpeg?.versionCommands).toEqual(expect.arrayContaining([['ffmpeg', '-version'], ['ffprobe', '-version']]));
    expect(ffmpeg?.requiredBy).toEqual(expect.arrayContaining(['media.probe', 'media.frames.extract', 'media.compose', 'media.qa']));
  });

  it('should satisfy media contract when it keeps YouTube, audio, OpenCV, and MediaPipe out of media-core', async () => {
    const { dependencies, profiles } = await loadCatalog();
    const core = profiles.find((profile) => profile.id === 'media-core');

    expect(core?.dependencies).toEqual(expect.arrayContaining(['ffmpeg', 'mediainfo', 'imagemagick', 'exiftool']));
    expect(core?.dependencies).not.toEqual(expect.arrayContaining(['yt-dlp', 'sox', 'opencv-python-headless', 'mediapipe', 'openai-whisper']));

    expect(dependencies.find((dependency) => dependency.id === 'yt-dlp')).toMatchObject({ profile: 'media-youtube', commands: ['yt-dlp'], optional: true });
    expect(dependencies.find((dependency) => dependency.id === 'sox')).toMatchObject({ profile: 'media-audio', commands: ['sox'], optional: true });
    expect(dependencies.find((dependency) => dependency.id === 'opencv-python-headless')).toMatchObject({ profile: 'media-vision-light', importName: 'cv2', optional: true });
    expect(dependencies.find((dependency) => dependency.id === 'mediapipe')).toMatchObject({ profile: 'media-vision-pose', importName: 'mediapipe', optional: true });
    expect(dependencies.find((dependency) => dependency.id === 'opencv-python')).toBeUndefined();
  });

  it('should satisfy media contract when it declares model bundles and makes large downloads explicit, never implicit', async () => {
    const { dependencies, profiles } = await loadCatalog();
    const mediapipe = dependencies.find((dependency) => dependency.id === 'mediapipe');
    const whisper = dependencies.find((dependency) => dependency.id === 'whisper.cpp' || dependency.id === 'openai-whisper');
    const fullEstimate = profiles.reduce((total, profile) => total + (profile.estimatedInstalledSizeMb ?? 0), 0);

    expect(mediapipe?.modelBundles?.length).toBeGreaterThan(0);
    for (const bundle of mediapipe?.modelBundles ?? []) {
      expect(bundle.implicit, 'MediaPipe model bundle downloads must be explicit').not.toBe(true);
      expect(bundle.estimatedInstalledSizeMb).toBeGreaterThan(0);
    }
    expect(whisper, 'whisper.cpp or openai-whisper should exist in dependencies').toBeDefined();
    expect(whisper?.optional).toBe(true);
    for (const bundle of whisper?.modelBundles ?? []) {
      expect(bundle.implicit, 'Whisper model downloads must be explicit').not.toBe(true);
    }
    expect(fullEstimate).toBeLessThanOrEqual(2048);
  });
});
