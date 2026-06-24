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

export const poseTrackOutputSchema = 'media.pose-track.v1';
export const angleMeasureOutputSchema = 'media.angle-measure-result.v1';
export const sportsScienceMetricsOutputSchema = 'media.sports-science-metrics.v1';
export const poseTrackLandmarkCount = 33;
export const implicitModelDownloads = false;

export const mediapipeModelBundles = [
  {
    id: 'pose_landmarker_lite',
    profile: 'media-vision-pose',
    task: 'pose-landmarker',
    estimatedInstalledSizeMb: 15,
    implicit: false,
  },
  {
    id: 'pose_landmarker_full',
    profile: 'media-vision-pose',
    task: 'pose-landmarker',
    estimatedInstalledSizeMb: 30,
    implicit: false,
  },
] as const;

export const visionPoseProfile = {
  id: 'media-vision-pose',
  dependencies: ['python3', 'numpy', 'opencv-python-headless', 'mediapipe'],
  optional: true,
  semanticLayer: 'human-body-pose-landmarks',
  buildsOn: ['media-vision-light'],
  requiresExplicitModelBundle: true,
  implicitModelDownloads,
  landmarkSlotsPerPoseFrame: poseTrackLandmarkCount,
  modelBundles: mediapipeModelBundles.map((bundle) => bundle.id),
} as const;

export const poseEstimateRequiredProfiles = ['media-vision-pose'] as const;
export const poseEstimateRequiredDependencies = ['python3', 'numpy', 'opencv-python-headless', 'mediapipe'] as const;
export const angleMeasureInputs = ['media.pose-track.v1'] as const;
export const sportsScienceMetricInputs = ['media.pose-track.v1', 'media.motion-track.v1'] as const;

const poseLandmarkNames = [
  'nose',
  'left_eye_inner',
  'left_eye',
  'left_eye_outer',
  'right_eye_inner',
  'right_eye',
  'right_eye_outer',
  'left_ear',
  'right_ear',
  'mouth_left',
  'mouth_right',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_pinky',
  'right_pinky',
  'left_index',
  'right_index',
  'left_thumb',
  'right_thumb',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
  'left_heel',
  'right_heel',
  'left_foot_index',
  'right_foot_index',
] as const;

export type PoseLandmark = {
  index: number;
  name: string;
  x: number;
  y: number;
  z: number;
  visibility: number;
  presence: number;
};

type PoseFrameInput = {
  timeSeconds?: number;
  frameId?: string;
  landmarks?: Array<Partial<PoseLandmark>>;
};

type AnglePointInput = {
  name: string;
  x: number;
  y: number;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function buildDefaultLandmark(index: number, override: Partial<PoseLandmark> = {}): PoseLandmark {
  return {
    index,
    name: typeof override.name === 'string' && override.name.length > 0 ? override.name : poseLandmarkNames[index] ?? 'landmark_' + index,
    x: round3(numberValue(override.x, 0)),
    y: round3(numberValue(override.y, 0)),
    z: round3(numberValue(override.z, 0)),
    visibility: round3(clamp01(numberValue(override.visibility, 1))),
    presence: round3(clamp01(numberValue(override.presence, 1))),
  };
}

function normalizePoseLandmarks(inputLandmarks: unknown): PoseLandmark[] {
  const overrides = Array.isArray(inputLandmarks) ? inputLandmarks as Array<Partial<PoseLandmark>> : [];
  return Array.from({ length: poseTrackLandmarkCount }, (_, index) => buildDefaultLandmark(index, overrides[index] ?? {}));
}

function asPoseFrameInputs(value: unknown): PoseFrameInput[] {
  if (!Array.isArray(value)) return [{ timeSeconds: 0, frameId: 'frame_000001' }];
  const frames = value
    .map((frame) => typeof frame === 'object' && frame !== null ? frame as PoseFrameInput : null)
    .filter((frame): frame is PoseFrameInput => frame !== null);
  return frames.length > 0 ? frames : [{ timeSeconds: 0, frameId: 'frame_000001' }];
}

export function missingMediapipeError(): Record<string, unknown> {
  return {
    schema: 'media.error.v1',
    code: 'MEDIA_DEPENDENCY_MISSING',
    message: 'MediaPipe pose tools require the mediapipe Python import and the media-vision-pose profile.',
    dependencyId: 'mediapipe',
    importName: 'mediapipe',
    profile: 'media-vision-pose',
    requiredProfiles: [...poseEstimateRequiredProfiles],
    requiredDependencies: [...poseEstimateRequiredDependencies],
    recovery: 'Install or enable media-vision-pose before running MediaPipe-backed pose tools.',
  };
}

export function missingMediapipeModelError(modelBundleId = 'pose_landmarker_lite'): Record<string, unknown> {
  return {
    schema: 'media.error.v1',
    code: 'MEDIA_MODEL_BUNDLE_MISSING',
    message: 'MediaPipe pose estimate requires an explicit pose model bundle. Model downloads are never implicit.',
    dependencyId: 'mediapipe',
    profile: 'media-vision-pose',
    modelBundleId,
    modelBundles: mediapipeModelBundles.map((bundle) => ({ ...bundle })),
    implicitModelDownloads,
    requiredProfiles: [...poseEstimateRequiredProfiles],
    recovery: 'Select and install one of the declared MediaPipe pose model bundles before running pose estimation.',
  };
}

export function buildPoseTrackFixtureResult(input: Record<string, unknown>): Record<string, unknown> {
  const sourcePath = stringValue(input.sourcePath, 'source.mp4');
  const modelBundleId = stringValue(input.modelBundleId, 'pose_landmarker_lite');
  const frames = asPoseFrameInputs(input.frames).map((frame, index) => ({
    id: stringValue(frame.frameId, 'pose_frame_' + String(index + 1).padStart(6, '0')),
    frameId: stringValue(frame.frameId, 'frame_' + String(index + 1).padStart(6, '0')),
    timeSeconds: round3(numberValue(frame.timeSeconds, index / 30)),
    poses: [
      {
        id: 'pose_' + String(index + 1).padStart(3, '0'),
        landmarkCount: poseTrackLandmarkCount,
        landmarks: normalizePoseLandmarks(frame.landmarks),
      },
    ],
  }));

  return {
    schema: poseTrackOutputSchema,
    source: sourceObject(sourcePath),
    profile: 'media-vision-pose',
    method: 'mediapipe-pose-landmarker-fixture',
    modelBundleId,
    implicitModelDownloads,
    landmarkSlotsPerPoseFrame: poseTrackLandmarkCount,
    requiredProfiles: [...poseEstimateRequiredProfiles],
    requiredDependencies: [...poseEstimateRequiredDependencies],
    frames,
  };
}

function angleDegrees(a: AnglePointInput, b: AnglePointInput, c: AnglePointInput): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const denominator = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (denominator === 0) return 0;
  const cosine = Math.min(1, Math.max(-1, (abx * cbx + aby * cby) / denominator));
  return round3((Math.acos(cosine) * 180) / Math.PI);
}

function defaultAnglePoints(input: Record<string, unknown>): [AnglePointInput, AnglePointInput, AnglePointInput] {
  const points = Array.isArray(input.points) ? input.points as AnglePointInput[] : [];
  const [a, b, c] = points;
  return [
    a ?? { name: 'left_hip', x: 0, y: 0 },
    b ?? { name: 'left_knee', x: 1, y: 0 },
    c ?? { name: 'left_ankle', x: 1, y: 1 },
  ];
}

export function buildAngleMeasureFixtureResult(input: Record<string, unknown>): Record<string, unknown> {
  const poseTrackId = stringValue(input.poseTrackId, 'pose_track_fixture');
  const [a, b, c] = defaultAnglePoints(input);
  return {
    schema: angleMeasureOutputSchema,
    inputSchemas: [...angleMeasureInputs],
    profile: 'media-vision-pose',
    poseTrackId,
    metrics: [
      {
        id: 'angle_001',
        type: 'joint-angle',
        joint: b.name,
        points: [a.name, b.name, c.name],
        degrees: angleDegrees(a, b, c),
      },
    ],
  };
}

export function buildSportsScienceMetricsFixtureResult(input: Record<string, unknown>): Record<string, unknown> {
  return {
    schema: sportsScienceMetricsOutputSchema,
    inputSchemas: [...sportsScienceMetricInputs],
    profile: 'media-vision-pose',
    metricSources: {
      poseTrackId: stringValue(input.poseTrackId, 'pose_track_fixture'),
      motionTrackId: stringValue(input.motionTrackId, 'motion_track_fixture'),
    },
    metrics: [
      {
        id: 'metric_001',
        type: 'pose-derived-angle',
        label: 'fixture joint angle',
        sourceSchemas: [...sportsScienceMetricInputs],
        requiresMeasurementData: true,
      },
    ],
  };
}

export const poseEstimateEffect = (input: Record<string, unknown>) => Effect.succeed(buildPoseTrackFixtureResult(input));
export const angleMeasureEffect = (input: Record<string, unknown>) => Effect.succeed(buildAngleMeasureFixtureResult(input));
export const sportsScienceMetricsEffect = (input: Record<string, unknown>) => Effect.succeed(buildSportsScienceMetricsFixtureResult(input));

export function poseEstimateForCli(input: Record<string, unknown>) {
  return Effect.map(poseEstimateEffect(input), (data) => ({ schema: 'media.pose-estimate-result.v1', ok: true, data }));
}

export function angleMeasureForCli(input: Record<string, unknown>) {
  return Effect.map(angleMeasureEffect(input), (data) => ({ schema: angleMeasureOutputSchema, ok: true, data }));
}

export function sportsScienceMetricsForCli(input: Record<string, unknown>) {
  return Effect.map(sportsScienceMetricsEffect(input), (data) => ({ schema: sportsScienceMetricsOutputSchema, ok: true, data }));
}

