export type MediaPackageManager = 'homebrew' | 'python-venv' | 'model-bundle';

export type MediaRuntimeDependency = {
  id: string;
  profile: string;
  commands?: string[];
  importName?: string;
  packageManagers?: Partial<Record<MediaPackageManager, string>>;
  versionCommands?: string[][];
  installHint: string;
  requiredBy: string[];
  optional: boolean;
  estimatedInstalledSizeMb: number;
  modelBundles?: Array<{ id: string; estimatedInstalledSizeMb: number; implicit?: boolean }>;
};

export type MediaDependencyProfile = {
  id: string;
  dependencies: string[];
  default?: boolean;
  optional?: boolean;
  estimatedInstalledSizeMb: number;
  warningThresholdMb?: number;
};

export const mediaRuntimeDependencies: MediaRuntimeDependency[] = [
  {
    id: 'ffmpeg',
    profile: 'media-core',
    commands: ['ffmpeg', 'ffprobe'],
    packageManagers: { homebrew: 'ffmpeg' },
    versionCommands: [['ffmpeg', '-version'], ['ffprobe', '-version']],
    installHint: 'brew install ffmpeg',
    requiredBy: ['media.probe', 'media.frames.extract', 'media.compose', 'media.qa'],
    optional: false,
    estimatedInstalledSizeMb: 180,
  },
  {
    id: 'mediainfo',
    profile: 'media-core',
    commands: ['mediainfo'],
    packageManagers: { homebrew: 'mediainfo' },
    versionCommands: [['mediainfo', '--Version']],
    installHint: 'brew install mediainfo',
    requiredBy: ['media.doctor', 'media.probe'],
    optional: false,
    estimatedInstalledSizeMb: 20,
  },
  {
    id: 'imagemagick',
    profile: 'media-core',
    commands: ['magick'],
    packageManagers: { homebrew: 'imagemagick' },
    versionCommands: [['magick', '-version']],
    installHint: 'brew install imagemagick',
    requiredBy: ['media.overlay.render', 'media.export'],
    optional: false,
    estimatedInstalledSizeMb: 85,
  },
  {
    id: 'exiftool',
    profile: 'media-core',
    commands: ['exiftool'],
    packageManagers: { homebrew: 'exiftool' },
    versionCommands: [['exiftool', '-ver']],
    installHint: 'brew install exiftool',
    requiredBy: ['media.ingest', 'media.probe'],
    optional: false,
    estimatedInstalledSizeMb: 35,
  },
  {
    id: 'yt-dlp',
    profile: 'media-youtube',
    commands: ['yt-dlp'],
    packageManagers: { homebrew: 'yt-dlp' },
    versionCommands: [['yt-dlp', '--version']],
    installHint: 'brew install yt-dlp',
    requiredBy: ['media.clip.search', 'media.ingest'],
    optional: true,
    estimatedInstalledSizeMb: 35,
  },
  {
    id: 'sox',
    profile: 'media-audio',
    commands: ['sox'],
    packageManagers: { homebrew: 'sox' },
    versionCommands: [['sox', '--version']],
    installHint: 'brew install sox',
    requiredBy: ['media.audio.normalize'],
    optional: true,
    estimatedInstalledSizeMb: 15,
  },
  {
    id: 'whisper.cpp',
    profile: 'media-audio',
    commands: ['whisper-cli'],
    packageManagers: { homebrew: 'whisper-cpp' },
    versionCommands: [['whisper-cli', '--help']],
    installHint: 'brew install whisper-cpp; download explicit model bundle separately',
    requiredBy: ['media.transcribe'],
    optional: true,
    estimatedInstalledSizeMb: 45,
    modelBundles: [
      { id: 'ggml-tiny.en', estimatedInstalledSizeMb: 75, implicit: false },
      { id: 'ggml-base.en', estimatedInstalledSizeMb: 150, implicit: false },
    ],
  },
  {
    id: 'python3',
    profile: 'media-vision-light',
    commands: ['python3'],
    packageManagers: { homebrew: 'python' },
    versionCommands: [['python3', '--version']],
    installHint: 'brew install python',
    requiredBy: ['media.scene.detect', 'media.motion.track'],
    optional: true,
    estimatedInstalledSizeMb: 120,
  },
  {
    id: 'numpy',
    profile: 'media-vision-light',
    importName: 'numpy',
    packageManagers: { 'python-venv': 'numpy' },
    versionCommands: [['python3', '-c', 'import numpy; print(numpy.__version__)']],
    installHint: 'python3 -m pip install numpy inside the media vision venv',
    requiredBy: ['media.scene.detect', 'media.motion.track'],
    optional: true,
    estimatedInstalledSizeMb: 80,
  },
  {
    id: 'opencv-python-headless',
    profile: 'media-vision-light',
    importName: 'cv2',
    packageManagers: { 'python-venv': 'opencv-python-headless' },
    versionCommands: [['python3', '-c', 'import cv2; print(cv2.__version__)']],
    installHint: 'python3 -m pip install opencv-python-headless inside the media vision venv',
    requiredBy: ['media.scene.detect', 'media.motion.track', 'media.object.track', 'media.camera.motion'],
    optional: true,
    estimatedInstalledSizeMb: 210,
  },
  {
    id: 'mediapipe',
    profile: 'media-vision-pose',
    importName: 'mediapipe',
    packageManagers: { 'python-venv': 'mediapipe' },
    versionCommands: [['python3', '-c', 'import mediapipe; print(mediapipe.__version__)']],
    installHint: 'python3 -m pip install mediapipe inside the media vision venv; choose model bundles explicitly',
    requiredBy: ['media.pose.estimate', 'media.angle.measure', 'media.sports-science.metrics'],
    optional: true,
    estimatedInstalledSizeMb: 260,
    modelBundles: [
      { id: 'pose_landmarker_lite', estimatedInstalledSizeMb: 15, implicit: false },
      { id: 'pose_landmarker_full', estimatedInstalledSizeMb: 30, implicit: false },
    ],
  },
  {
    id: 'sharp',
    profile: 'media-render-advanced',
    packageManagers: { homebrew: 'vips' },
    installHint: 'bun package dependency or brew install vips depending on renderer implementation',
    requiredBy: ['media.overlay.render'],
    optional: true,
    estimatedInstalledSizeMb: 60,
  },
  {
    id: 'gifski',
    profile: 'media-render-advanced',
    commands: ['gifski'],
    packageManagers: { homebrew: 'gifski' },
    versionCommands: [['gifski', '--version']],
    installHint: 'brew install gifski',
    requiredBy: ['media.export'],
    optional: true,
    estimatedInstalledSizeMb: 35,
  },
  {
    id: 'vtracer',
    profile: 'media-render-advanced',
    commands: ['vtracer'],
    packageManagers: { homebrew: 'vtracer' },
    versionCommands: [['vtracer', '--version']],
    installHint: 'brew install vtracer',
    requiredBy: ['media.overlay.render'],
    optional: true,
    estimatedInstalledSizeMb: 45,
  },
];

export const mediaDependencyProfiles: MediaDependencyProfile[] = [
  { id: 'media-core', dependencies: ['ffmpeg', 'mediainfo', 'imagemagick', 'exiftool'], default: true, optional: false, estimatedInstalledSizeMb: 320, warningThresholdMb: 600 },
  { id: 'media-youtube', dependencies: ['yt-dlp'], optional: true, estimatedInstalledSizeMb: 35, warningThresholdMb: 200 },
  { id: 'media-audio', dependencies: ['sox', 'whisper.cpp'], optional: true, estimatedInstalledSizeMb: 60, warningThresholdMb: 350 },
  { id: 'media-vision-light', dependencies: ['python3', 'numpy', 'opencv-python-headless'], optional: true, estimatedInstalledSizeMb: 410, warningThresholdMb: 700 },
  { id: 'media-vision-pose', dependencies: ['python3', 'numpy', 'opencv-python-headless', 'mediapipe'], optional: true, estimatedInstalledSizeMb: 670, warningThresholdMb: 900 },
  { id: 'media-render-advanced', dependencies: ['sharp', 'gifski', 'vtracer'], optional: true, estimatedInstalledSizeMb: 140, warningThresholdMb: 300 },
];

export function dependencyById(id: string): MediaRuntimeDependency | undefined {
  return mediaRuntimeDependencies.find((dependency) => dependency.id === id);
}

export function profileById(id: string): MediaDependencyProfile | undefined {
  return mediaDependencyProfiles.find((profile) => profile.id === id);
}

export function dependenciesForProfiles(profileIds: string[]): MediaRuntimeDependency[] {
  const seen = new Set<string>();
  const out: MediaRuntimeDependency[] = [];
  for (const profileId of profileIds) {
    const profile = profileById(profileId);
    if (!profile) throw new Error('unknown media dependency profile: ' + profileId);
    for (const dependencyId of profile.dependencies) {
      if (seen.has(dependencyId)) continue;
      const dependency = dependencyById(dependencyId);
      if (!dependency) throw new Error('unknown media dependency: ' + dependencyId);
      seen.add(dependencyId);
      out.push(dependency);
    }
  }
  return out;
}
