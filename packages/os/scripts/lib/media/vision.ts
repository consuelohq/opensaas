import { Effect } from 'effect';

export const visionMediaModuleBoundary = true;

export const visionLightProfile = {
  id: 'media-vision-light',
  dependencies: ['python3', 'numpy', 'opencv-python-headless'],
  optional: true,
  semanticLayer: 'generic-motion-computer-vision',
  excludes: ['opencv-python', 'mediapipe'],
} as const;

export const sceneDetectRequiredProfiles = ['media-vision-light'] as const;
export const sceneDetectRequiredDependencies = ['python3', 'numpy', 'opencv-python-headless'] as const;
export const sceneDetectOutputSchema = 'media.scene-detect-result.v1';
export const motionTrackOutputSchema = 'media.motion-track.v1';

export const opencvToolRoles = [
  'optical-flow',
  'feature-tracking',
  'frame-differencing',
  'camera-motion',
] as const;

const SCENE_THRESHOLD = 0.35;

type Point2d = readonly [number, number];

type FrameSample = {
  timeSeconds: number;
  frameId: string;
  differenceScore: number;
};

type SceneDetectInput = {
  sourcePath?: string;
  durationSeconds?: number;
  frameSamples?: FrameSample[];
};

type MotionPoint = {
  id?: string;
  start: Point2d;
  end: Point2d;
  startSeconds?: number;
  endSeconds?: number;
};

type ObjectBox = {
  id?: string;
  label?: string;
  timeSeconds?: number;
  box: readonly [number, number, number, number];
};

type CameraTransform = {
  startSeconds?: number;
  endSeconds?: number;
  dx?: number;
  dy?: number;
  rotationDegrees?: number;
};

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asFrameSamples(value: unknown): FrameSample[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((sample) => {
      if (typeof sample !== 'object' || sample === null) return null;
      const record = sample as Record<string, unknown>;
      const timeSeconds = numberValue(record.timeSeconds, Number.NaN);
      const differenceScore = numberValue(record.differenceScore, Number.NaN);
      const frameId = stringValue(record.frameId, '');
      if (!Number.isFinite(timeSeconds) || !Number.isFinite(differenceScore) || frameId.length === 0) return null;
      return { timeSeconds, differenceScore, frameId };
    })
    .filter((sample): sample is FrameSample => sample !== null)
    .sort((left, right) => left.timeSeconds - right.timeSeconds);
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}

function sourceObject(sourcePath: string): Record<string, unknown> {
  return { path: sourcePath };
}

export function missingOpenCvError(): Record<string, unknown> {
  return {
    schema: 'media.error.v1',
    code: 'MEDIA_DEPENDENCY_MISSING',
    message: 'OpenCV vision-light tools require the cv2 import from opencv-python-headless',
    dependencyId: 'opencv-python-headless',
    importName: 'cv2',
    profile: 'media-vision-light',
    requiredProfiles: ['media-vision-light'],
    requiredDependencies: ['python3', 'numpy', 'opencv-python-headless'],
    recovery: 'Install or enable the media-vision-light profile before running OpenCV-backed media vision tools.',
  };
}

export function buildSceneDetectFixtureResult(input: Record<string, unknown>): Record<string, unknown> {
  const sourcePath = stringValue(input.sourcePath, 'source.mp4');
  const durationSeconds = Math.max(numberValue(input.durationSeconds, 1), 0.001);
  const samples = asFrameSamples(input.frameSamples);
  const boundarySamples = samples.filter((sample) => sample.differenceScore >= SCENE_THRESHOLD && sample.timeSeconds > 0 && sample.timeSeconds < durationSeconds);
  const shotBoundaries = [] as Array<Record<string, unknown>>;
  let startSeconds = 0;
  let previousBoundarySample = samples[0];

  for (const [index, sample] of boundarySamples.entries()) {
    const previousSample = samples.slice().reverse().find((candidate) => candidate.timeSeconds < sample.timeSeconds) ?? previousBoundarySample ?? sample;
    shotBoundaries.push({
      id: 'shot_' + String(index + 1).padStart(3, '0'),
      startSeconds: round3(startSeconds),
      endSeconds: round3(sample.timeSeconds),
      boundaryTimeSeconds: round3(sample.timeSeconds),
      confidence: round3(sample.differenceScore),
      evidenceFrameIds: [previousSample.frameId, sample.frameId],
    });
    startSeconds = sample.timeSeconds;
    previousBoundarySample = sample;
  }

  const lastSample = samples.at(-1) ?? previousBoundarySample;
  shotBoundaries.push({
    id: 'shot_' + String(shotBoundaries.length + 1).padStart(3, '0'),
    startSeconds: round3(startSeconds),
    endSeconds: round3(durationSeconds),
    boundaryTimeSeconds: round3(durationSeconds),
    confidence: 1,
    evidenceFrameIds: [previousBoundarySample?.frameId, lastSample?.frameId].filter((value): value is string => typeof value === 'string' && value.length > 0),
  });

  return {
    schema: 'media.scene-detect-result.v1',
    source: sourceObject(sourcePath),
    profile: 'media-vision-light',
    method: 'opencv-frame-difference-fixture',
    threshold: SCENE_THRESHOLD,
    requiredProfiles: [...sceneDetectRequiredProfiles],
    requiredDependencies: [...sceneDetectRequiredDependencies],
    shotBoundaries,
    candidateMoments: boundarySamples.map((sample, index) => ({
      id: 'moment_' + String(index + 1).padStart(3, '0'),
      timeSeconds: round3(sample.timeSeconds),
      type: 'shot-boundary',
      confidence: round3(sample.differenceScore),
      reason: 'OpenCV frame-difference fixture exceeded scene threshold',
    })),
  };
}

export function buildMotionTrackFixtureResult(input: Record<string, unknown>): Record<string, unknown> {
  const sourcePath = stringValue(input.sourcePath, 'source.mp4');
  const points = Array.isArray(input.points) ? input.points as MotionPoint[] : [];
  return {
    schema: 'media.motion-track.v1',
    source: sourceObject(sourcePath),
    profile: 'media-vision-light',
    method: 'opencv-optical-flow-fixture',
    tracks: points.map((point, index) => {
      const start = point.start;
      const end = point.end;
      const dx = end[0] - start[0];
      const dy = end[1] - start[1];
      return {
        id: 'track_' + String(index + 1).padStart(3, '0'),
        pointId: point.id ?? 'point_' + String(index + 1).padStart(3, '0'),
        start,
        end,
        vector: [round3(dx), round3(dy)],
        startSeconds: numberValue(point.startSeconds, 0),
        endSeconds: numberValue(point.endSeconds, 0),
        magnitudePixels: round3(Math.hypot(dx, dy)),
      };
    }),
  };
}

export function buildObjectTrackFixtureResult(input: Record<string, unknown>): Record<string, unknown> {
  const sourcePath = stringValue(input.sourcePath, 'source.mp4');
  const boxes = Array.isArray(input.boxes) ? input.boxes as ObjectBox[] : [];
  return {
    schema: 'media.object-track.v1',
    source: sourceObject(sourcePath),
    profile: 'media-vision-light',
    method: 'opencv-feature-tracking-fixture',
    objects: boxes.map((box, index) => ({
      id: box.id ?? 'object_' + String(index + 1).padStart(3, '0'),
      label: box.label ?? 'object',
      timeSeconds: numberValue(box.timeSeconds, 0),
      box: box.box,
    })),
  };
}

export function buildCameraMotionFixtureResult(input: Record<string, unknown>): Record<string, unknown> {
  const sourcePath = stringValue(input.sourcePath, 'source.mp4');
  const transforms = Array.isArray(input.transforms) ? input.transforms as CameraTransform[] : [];
  return {
    schema: 'media.camera-motion.v1',
    source: sourceObject(sourcePath),
    profile: 'media-vision-light',
    method: 'opencv-feature-transform-fixture',
    segments: transforms.map((transform, index) => ({
      id: 'camera_' + String(index + 1).padStart(3, '0'),
      startSeconds: numberValue(transform.startSeconds, 0),
      endSeconds: numberValue(transform.endSeconds, 0),
      dx: numberValue(transform.dx, 0),
      dy: numberValue(transform.dy, 0),
      rotationDegrees: numberValue(transform.rotationDegrees, 0),
    })),
  };
}

export const sceneDetectEffect = (input: Record<string, unknown>) => Effect.succeed(buildSceneDetectFixtureResult(input));
export const motionTrackEffect = (input: Record<string, unknown>) => Effect.succeed(buildMotionTrackFixtureResult(input));
export const objectTrackEffect = (input: Record<string, unknown>) => Effect.succeed(buildObjectTrackFixtureResult(input));
export const cameraMotionEffect = (input: Record<string, unknown>) => Effect.succeed(buildCameraMotionFixtureResult(input));

export function sceneDetectForCli(input: Record<string, unknown>) {
  return Effect.map(sceneDetectEffect(input), (data) => ({ schema: 'media.scene-detect-result.v1', ok: true, data }));
}

export function motionTrackForCli(input: Record<string, unknown>) {
  return Effect.map(motionTrackEffect(input), (data) => ({ schema: 'media.motion-track-result.v1', ok: true, data }));
}

export function objectTrackForCli(input: Record<string, unknown>) {
  return Effect.map(objectTrackEffect(input), (data) => ({ schema: 'media.object-track-result.v1', ok: true, data }));
}

export function cameraMotionForCli(input: Record<string, unknown>) {
  return Effect.map(cameraMotionEffect(input), (data) => ({ schema: 'media.camera-motion-result.v1', ok: true, data }));
}
