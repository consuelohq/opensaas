export const MEDIA_SOURCE_CAPTURE_PLAN_SCHEMA = 'media.source-capture-plan.v1';
export const MEDIA_SOURCE_CAPTURE_RESULT_SCHEMA = 'media.source-capture-result.v1';

export type SourceCaptureKind = 'url' | 'file';

export type SourceCaptureSource = {
  kind: SourceCaptureKind;
  url?: string;
  path?: string;
  extractor?: string;
};

export type SourceCaptureCommandPlan = {
  command: string;
  args: string[];
};

export type SourceCapturePlan = {
  schema: typeof MEDIA_SOURCE_CAPTURE_PLAN_SCHEMA;
  source: string;
  outDir: string;
  dryRun: boolean;
  requiredProfiles: string[];
  requiredCommands: string[];
  outputs: string[];
  commandPlan: SourceCaptureCommandPlan;
};

export type SourceCaptureFileRef = {
  path: string;
  sha256?: string;
  bytes?: number;
  mime?: string;
};

export type SourceCaptureTranscriptRef = {
  path: string;
  language?: string;
  kind?: string;
  ext?: string;
};

export type SourceCaptureThumbnailRef = SourceCaptureFileRef;

export type SourceCaptureResult = {
  schema?: typeof MEDIA_SOURCE_CAPTURE_RESULT_SCHEMA;
  source: SourceCaptureSource;
  capturedAt?: string;
  commandPlan?: SourceCaptureCommandPlan;
  mediaAsset?: SourceCaptureFileRef;
  infoJson?: SourceCaptureFileRef;
  transcripts?: SourceCaptureTranscriptRef[];
  thumbnails?: SourceCaptureThumbnailRef[];
};
