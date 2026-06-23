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

export const MediaDependencyReportSchema = z.object({ schema: z.literal('media.dependency-report.v1') }).passthrough();
export const MediaIngestManifestSchema = z.object({ schema: z.literal('media.ingest-manifest.v1') }).passthrough();
export const MediaFrameManifestSchema = z.object({ schema: z.literal('media.frame-manifest.v1') }).passthrough();
export const MediaTranscriptSchema = z.object({ schema: z.literal('media.transcript.v1') }).passthrough();
export const MediaPoseTrackSchema = z.object({ schema: z.literal('media.pose-track.v1') }).passthrough();
export const MediaMotionTrackSchema = z.object({ schema: z.literal('media.motion-track.v1') }).passthrough();
export const MediaOverlaySchema = z.object({ schema: z.literal('media.overlay.v1') }).passthrough();
export const MediaBreakdownPlanSchema = z.object({ schema: z.literal('media.breakdown-plan.v1') }).passthrough();
export const MediaExportPackageSchema = z.object({ schema: z.literal('media.export-package.v1') }).passthrough();

export type MediaAsset = z.infer<typeof MediaAssetSchema>;
export type MediaTimeline = z.infer<typeof MediaTimelineSchema>;
export type MediaRenderResult = z.infer<typeof MediaRenderResultSchema>;
