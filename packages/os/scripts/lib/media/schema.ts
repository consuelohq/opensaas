import { z } from 'zod';

export const MEDIA_ASSET_SCHEMA = 'media.asset.v1';
export const MEDIA_TIMELINE_SCHEMA = 'media.timeline.v1';
export const MEDIA_RENDER_RESULT_SCHEMA = 'media.render-result.v1';

export const mediaSchemaKinds = [
  'media.asset.v1',
  'media.timeline.v1',
  'media.render-result.v1',
  'media.dependency-report.v1',
  'media.ingest-manifest.v1',
  'media.frame-manifest.v1',
  'media.transcript.v1',
  'media.pose-track.v1',
  'media.motion-track.v1',
  'media.overlay.v1',
  'media.breakdown-plan.v1',
  'media.export-package.v1',
  'media.svg-result.v1',
] as const;

const IsoTimestampSchema = z.string().min(1);
const ProvenanceStatusSchema = z.enum(['needs-review', 'captured', 'reviewed']);
const RightsStatusSchema = z.enum(['needs-review', 'approved', 'rejected', 'unknown']);
const NonEmptyStringSchema = z.string().min(1);
const JsonObjectSchema = z.object({}).passthrough();
const AssetReferenceSchema = z.object({ id: NonEmptyStringSchema, kind: NonEmptyStringSchema, path: NonEmptyStringSchema }).passthrough();

export const MediaAssetSchema = z.object({
  schema: z.literal(MEDIA_ASSET_SCHEMA),
  id: NonEmptyStringSchema,
  source: z.object({
    path: NonEmptyStringSchema,
    provenance: z.object({
      status: ProvenanceStatusSchema,
      url: z.string().url().optional(),
      capturedAt: IsoTimestampSchema.optional(),
    }).passthrough(),
    rights: z.object({
      status: RightsStatusSchema,
      notes: z.string().optional(),
    }).passthrough(),
  }).passthrough(),
  probe: z.object({
    durationSeconds: z.number().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().positive(),
    videoCodec: NonEmptyStringSchema,
    audioCodec: z.string().optional(),
    streams: z.array(z.unknown()).default([]),
  }).passthrough(),
  toolVersions: z.record(z.string(), z.string()).optional(),
}).passthrough();

export const MediaTimelineSchema = z.object({
  schema: z.literal(MEDIA_TIMELINE_SCHEMA),
  id: NonEmptyStringSchema,
  assets: z.array(MediaAssetSchema).min(1),
  source: z.object({ assetId: NonEmptyStringSchema, path: NonEmptyStringSchema }).passthrough(),
  render: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().positive(),
    format: NonEmptyStringSchema,
    durationSeconds: z.number().positive(),
  }).passthrough(),
  beats: z.array(z.object({
    id: NonEmptyStringSchema,
    startSeconds: z.number().nonnegative(),
    endSeconds: z.number().positive(),
    type: NonEmptyStringSchema,
  }).passthrough()).default([]),
  overlays: z.array(z.object({
    id: NonEmptyStringSchema,
    type: NonEmptyStringSchema,
    startSeconds: z.number().nonnegative().optional(),
    endSeconds: z.number().positive().optional(),
    data: JsonObjectSchema.optional(),
  }).passthrough()).default([]),
  tracks: z.object({
    captions: z.string().nullable().optional(),
    voiceover: z.string().nullable().optional(),
    music: z.string().nullable().optional(),
  }).passthrough().optional(),
  provenance: z.object({ status: ProvenanceStatusSchema, sourceAssetId: NonEmptyStringSchema.optional() }).passthrough(),
  analysisRefs: z.array(AssetReferenceSchema).optional(),
}).passthrough().superRefine((timeline, ctx) => {
  const duration = timeline.render.durationSeconds;
  for (const [index, beat] of timeline.beats.entries()) {
    if (beat.endSeconds <= beat.startSeconds) {
      ctx.addIssue({ code: 'custom', path: ['beats', index, 'endSeconds'], message: 'beat end must be after start' });
    }
    if (beat.startSeconds > duration || beat.endSeconds > duration) {
      ctx.addIssue({ code: 'custom', path: ['beats', index], message: 'beat must fit within render duration' });
    }
  }
  for (const [index, overlay] of timeline.overlays.entries()) {
    if (overlay.startSeconds === undefined || overlay.endSeconds === undefined) {
      ctx.addIssue({ code: 'custom', path: ['overlays', index], message: 'overlay requires startSeconds and endSeconds' });
      continue;
    }
    if (overlay.endSeconds <= overlay.startSeconds || overlay.endSeconds > duration) {
      ctx.addIssue({ code: 'custom', path: ['overlays', index], message: 'overlay time range must fit within render duration' });
    }
    if (overlay.type === 'joint-angle') {
      const data = overlay.data ?? {};
      const points = Array.isArray(data.points) ? data.points : [];
      if (typeof data.poseTrackId !== 'string' || points.length < 3) {
        ctx.addIssue({ code: 'custom', path: ['overlays', index, 'data'], message: 'joint-angle overlay requires poseTrackId and three points' });
      }
    }
  }
});

export const MediaRenderResultSchema = z.object({
  schema: z.literal(MEDIA_RENDER_RESULT_SCHEMA),
  id: NonEmptyStringSchema,
  timelineId: NonEmptyStringSchema,
  output: z.object({
    path: NonEmptyStringSchema,
    durationSeconds: z.number().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    codec: NonEmptyStringSchema,
    fileSizeBytes: z.number().int().nonnegative(),
  }).passthrough(),
  qa: z.object({ status: z.enum(['passed', 'failed', 'warning']), checks: z.array(JsonObjectSchema) }).passthrough(),
  provenance: z.object({ status: ProvenanceStatusSchema, sourceAssetId: NonEmptyStringSchema.optional() }).passthrough(),
  toolVersions: z.record(z.string(), z.string()),
  artifacts: z.array(JsonObjectSchema),
}).passthrough().superRefine((result, ctx) => {
  if (Object.keys(result.toolVersions).length === 0) {
    ctx.addIssue({ code: 'custom', path: ['toolVersions'], message: 'render result requires tool versions' });
  }
});


export const MediaSvgResultSchema = z.object({
  schema: z.literal('media.svg-result.v1'),
  id: NonEmptyStringSchema,
  input: z.object({
    path: NonEmptyStringSchema,
    mimeType: NonEmptyStringSchema,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }).passthrough(),
  strategy: z.enum(['wrapper', 'trace', 'both']),
  outputs: z.object({
    svg: NonEmptyStringSchema,
    wrapperSvg: NonEmptyStringSchema.optional(),
    tracedSvg: NonEmptyStringSchema.optional(),
  }).passthrough(),
  toolVersions: z.record(z.string(), z.string()).default({}),
  deterministic: z.literal(true),
}).passthrough().superRefine((result, ctx) => {
  if (result.strategy === 'wrapper' && !result.outputs.wrapperSvg) {
    ctx.addIssue({ code: 'custom', path: ['outputs', 'wrapperSvg'], message: 'wrapper strategy requires wrapperSvg output' });
  }
  if (result.strategy === 'trace' && !result.outputs.tracedSvg) {
    ctx.addIssue({ code: 'custom', path: ['outputs', 'tracedSvg'], message: 'trace strategy requires tracedSvg output' });
  }
  if (result.strategy === 'both' && (!result.outputs.wrapperSvg || !result.outputs.tracedSvg)) {
    ctx.addIssue({ code: 'custom', path: ['outputs'], message: 'both strategy requires wrapperSvg and tracedSvg outputs' });
  }
});

export const MediaDependencyReportSchema = z.object({ schema: z.literal('media.dependency-report.v1') }).passthrough();
export const MediaIngestManifestSchema = z.object({ schema: z.literal('media.ingest-manifest.v1') }).passthrough();
export const MediaFrameManifestSchema = z.object({ schema: z.literal('media.frame-manifest.v1') }).passthrough();
export const MediaTranscriptWordSchema = z.object({
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
  text: NonEmptyStringSchema,
  confidence: z.number().min(0).max(1).optional(),
}).passthrough().superRefine((word, ctx) => {
  if (word.endSeconds <= word.startSeconds) {
    ctx.addIssue({ code: 'custom', path: ['endSeconds'], message: 'word end must be after start' });
  }
});

export const MediaTranscriptSegmentSchema = z.object({
  id: NonEmptyStringSchema,
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
  text: NonEmptyStringSchema,
  words: z.array(MediaTranscriptWordSchema).default([]),
}).passthrough().superRefine((segment, ctx) => {
  if (segment.endSeconds <= segment.startSeconds) {
    ctx.addIssue({ code: 'custom', path: ['endSeconds'], message: 'segment end must be after start' });
  }
  for (const [index, word] of segment.words.entries()) {
    if (word.startSeconds < segment.startSeconds || word.endSeconds > segment.endSeconds) {
      ctx.addIssue({ code: 'custom', path: ['words', index], message: 'word must fit within segment time range' });
    }
  }
});

export const MediaTranscriptSchema = z.object({
  schema: z.literal('media.transcript.v1'),
  id: NonEmptyStringSchema.optional(),
  mode: z.enum(['fixture', 'whisper.cpp', 'openai-whisper']),
  language: NonEmptyStringSchema.optional(),
  source: z.object({ audioPath: NonEmptyStringSchema }).passthrough(),
  implicitModelDownloads: z.literal(false),
  modelRef: z.string().optional(),
  segments: z.array(MediaTranscriptSegmentSchema),
}).passthrough();
export const MediaPoseTrackSchema = z.object({ schema: z.literal('media.pose-track.v1') }).passthrough();
export const MediaMotionTrackSchema = z.object({ schema: z.literal('media.motion-track.v1') }).passthrough();

const Point2dSchema = z.tuple([z.number(), z.number()]);
const OverlayPrimitiveTypeSchema = z.enum([
  'arrow',
  'label',
  'zoom-box',
  'freeze-frame-callout',
  'force-vector',
  'joint-angle',
  'velocity-trail',
  'comparison-ghost',
]);

const OverlayOutputFormatSchema = z.enum(['png-sequence', 'transparent-video', 'svg']);

const OverlayDataSchema = z.object({
  label: z.string().optional(),
  text: z.string().optional(),
  start: Point2dSchema.optional(),
  end: Point2dSchema.optional(),
  box: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  poseTrackId: z.string().optional(),
  motionTrackId: z.string().optional(),
  metricRef: z.string().optional(),
  provenanceRef: z.string().optional(),
  frameRef: z.string().optional(),
  points: z.array(z.string()).optional(),
  ghostAssetRef: z.string().optional(),
}).passthrough();

const ExecutableOverlayKeys = new Set(['code', 'script', 'javascript', 'eval', 'function', 'functionBody', 'onload', 'onclick']);

function containsExecutableOverlaySurface(value: unknown): boolean {
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    return normalized.includes('javascript:') || normalized.includes('eval(') || normalized.includes('function(') || normalized.includes('=>');
  }
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => containsExecutableOverlaySurface(item));
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (ExecutableOverlayKeys.has(key)) return true;
    if (containsExecutableOverlaySurface(nested)) return true;
  }
  return false;
}

export const MediaOverlayPrimitiveSchema = z.object({
  id: NonEmptyStringSchema,
  type: OverlayPrimitiveTypeSchema,
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
  data: OverlayDataSchema.default({}),
  requiredData: z.array(NonEmptyStringSchema).default([]),
}).passthrough().superRefine((primitive, ctx) => {
  if (primitive.endSeconds <= primitive.startSeconds) {
    ctx.addIssue({ code: 'custom', path: ['endSeconds'], message: 'overlay primitive end must be after start' });
  }
  if (containsExecutableOverlaySurface(primitive)) {
    ctx.addIssue({ code: 'custom', path: [], message: 'overlay primitives must be declarative JSON and may not contain executable code' });
  }
  const data = primitive.data as Record<string, unknown>;
  if (primitive.type === 'force-vector' && (!Array.isArray(data.start) || !Array.isArray(data.end))) {
    ctx.addIssue({ code: 'custom', path: ['data'], message: 'force-vector overlay requires start and end coordinate data' });
  }
  if (primitive.type === 'joint-angle') {
    const points = Array.isArray(data.points) ? data.points : [];
    if (typeof data.poseTrackId !== 'string' || points.length < 3) {
      ctx.addIssue({ code: 'custom', path: ['data'], message: 'joint-angle overlay requires poseTrackId and three pose points' });
    }
  }
  if (primitive.type === 'velocity-trail' && typeof data.motionTrackId !== 'string') {
    ctx.addIssue({ code: 'custom', path: ['data'], message: 'velocity-trail overlay requires motionTrackId' });
  }
  if (primitive.type === 'comparison-ghost' && typeof data.ghostAssetRef !== 'string') {
    ctx.addIssue({ code: 'custom', path: ['data'], message: 'comparison-ghost overlay requires ghostAssetRef' });
  }
});

export const MediaOverlaySchema = z.object({
  schema: z.literal('media.overlay.v1'),
  id: NonEmptyStringSchema,
  timelineId: NonEmptyStringSchema.optional(),
  render: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().positive(),
    durationSeconds: z.number().positive(),
  }).passthrough(),
  primitives: z.array(MediaOverlayPrimitiveSchema).min(1),
  output: z.object({
    format: OverlayOutputFormatSchema,
    path: NonEmptyStringSchema.optional(),
  }).passthrough(),
  provenance: z.object({ status: ProvenanceStatusSchema, sourceAssetId: NonEmptyStringSchema.optional() }).passthrough(),
}).passthrough().superRefine((overlay, ctx) => {
  if (containsExecutableOverlaySurface(overlay)) {
    ctx.addIssue({ code: 'custom', path: [], message: 'overlay specs must be declarative JSON and may not contain executable code' });
  }
  for (const [index, primitive] of overlay.primitives.entries()) {
    if (primitive.endSeconds > overlay.render.durationSeconds) {
      ctx.addIssue({ code: 'custom', path: ['primitives', index], message: 'overlay primitive must fit within render duration' });
    }
  }
});

const BreakdownClaimSchema = z.object({
  id: NonEmptyStringSchema,
  text: NonEmptyStringSchema,
  timestampSeconds: z.number().nonnegative(),
  frameRef: NonEmptyStringSchema,
  metricRef: NonEmptyStringSchema,
  provenanceRef: NonEmptyStringSchema,
}).passthrough();

const PlannedOverlaySchema = z.object({
  overlayId: NonEmptyStringSchema,
  claimId: NonEmptyStringSchema,
  type: OverlayPrimitiveTypeSchema.optional(),
  requiredData: z.array(NonEmptyStringSchema).default([]),
  coordinateRef: z.string().optional(),
  poseTrackRef: z.string().optional(),
  motionTrackRef: z.string().optional(),
}).passthrough();

export const MediaBreakdownPlanSchema = z.object({
  schema: z.literal('media.breakdown-plan.v1'),
  id: NonEmptyStringSchema,
  timelineId: NonEmptyStringSchema,
  claims: z.array(BreakdownClaimSchema).min(1),
  plannedOverlays: z.array(PlannedOverlaySchema).default([]),
}).passthrough().superRefine((plan, ctx) => {
  const claimIds = new Set(plan.claims.map((claim) => claim.id));
  for (const [index, overlay] of plan.plannedOverlays.entries()) {
    if (!claimIds.has(overlay.claimId)) {
      ctx.addIssue({ code: 'custom', path: ['plannedOverlays', index, 'claimId'], message: 'planned overlay must reference an existing claim' });
    }
    if (overlay.type === 'force-vector' && overlay.requiredData.length === 0 && typeof overlay.coordinateRef !== 'string') {
      ctx.addIssue({ code: 'custom', path: ['plannedOverlays', index], message: 'force-vector breakdown overlay requires coordinate data' });
    }
    if (overlay.type === 'joint-angle' && !overlay.requiredData.includes('media.pose-track.v1') && typeof overlay.poseTrackRef !== 'string') {
      ctx.addIssue({ code: 'custom', path: ['plannedOverlays', index], message: 'joint-angle breakdown overlay requires pose data' });
    }
    if (overlay.type === 'velocity-trail' && !overlay.requiredData.includes('media.motion-track.v1') && typeof overlay.motionTrackRef !== 'string') {
      ctx.addIssue({ code: 'custom', path: ['plannedOverlays', index], message: 'velocity-trail breakdown overlay requires motion-track data' });
    }
  }
});
const MediaExportTargetSchema = z.enum(['youtube-shorts', 'tiktok', 'reels', 'longform-youtube']);

export const MediaExportPackageSchema = z.object({
  schema: z.literal('media.export-package.v1'),
  id: NonEmptyStringSchema,
  target: MediaExportTargetSchema,
  files: z.object({
    mp4: NonEmptyStringSchema,
    thumbnail: NonEmptyStringSchema,
    captions: NonEmptyStringSchema,
    notes: NonEmptyStringSchema,
    renderResult: NonEmptyStringSchema,
  }).passthrough(),
  provenance: z.object({
    sourceAssetId: NonEmptyStringSchema,
    rightsStatus: RightsStatusSchema,
    rightsNotes: z.string().optional(),
  }).passthrough(),
  deterministic: z.literal(true),
}).passthrough();

export type MediaAsset = z.infer<typeof MediaAssetSchema>;
export type MediaTimeline = z.infer<typeof MediaTimelineSchema>;
export type MediaRenderResult = z.infer<typeof MediaRenderResultSchema>;
