import { Effect } from 'effect';

import { MediaError } from './errors';
import { createSourceCapturePlan, mediaIngestOutputLayout } from './source-capture/plan';
import type { SourceCaptureResult } from './source-capture/schema';

export const expectedMediaIngestLayout = mediaIngestOutputLayout();

type MediaIngestInput = {
  source?: string;
  outDir?: string;
  dryRun?: boolean;
  format?: string;
};

type MediaIngestManifestPair = {
  manifest: Record<string, unknown>;
  asset: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function sourceUrl(result: SourceCaptureResult): string | undefined {
  return result.source.url ?? result.source.path;
}

export function createMediaIngestPlan(input: unknown): Record<string, unknown> {
  const value = isRecord(input) ? input : {};
  return createSourceCapturePlan({
    source: stringValue(value.source) ?? '',
    outDir: stringValue(value.outDir) ?? '',
    dryRun: value.dryRun === true,
    format: stringValue(value.format),
  });
}

export function assertSourceCaptureHasMediaAsset(input: unknown): void {
  if (!isRecord(input)) {
    throw new MediaError('MEDIA_SOURCE_ASSET_MISSING', 'source media asset is missing from capture result');
  }
  const mediaAsset = input.mediaAsset;
  if (!isRecord(mediaAsset) || !stringValue(mediaAsset.path)) {
    throw new MediaError('MEDIA_SOURCE_ASSET_MISSING', 'source media asset is missing from capture result');
  }
}

export function mapSourceCaptureResultToMediaIngestManifest(input: unknown): MediaIngestManifestPair {
  assertSourceCaptureHasMediaAsset(input);
  const result = input as SourceCaptureResult;
  const mediaAsset = isRecord(result.mediaAsset) ? result.mediaAsset : {};
  const infoJson = isRecord(result.infoJson) ? result.infoJson : undefined;
  const capturedAt = result.capturedAt ?? new Date(0).toISOString();
  const url = sourceUrl(result);
  const extractor = result.source.extractor ?? 'media.source-capture';
  const mediaPath = stringValue(mediaAsset.path) ?? 'assets/source.mp4';

  const manifest = {
    schema: 'media.ingest-manifest.v1',
    source: {
      kind: result.source.kind,
      url,
      path: result.source.path,
      extractor,
      title: undefined,
      channel: undefined,
    },
    rights: { status: 'needs-review' },
    capturedAt,
    commandPlan: result.commandPlan,
    mediaAsset: {
      path: mediaPath,
      sha256: stringValue(mediaAsset.sha256),
      bytes: numberValue(mediaAsset.bytes),
      mime: stringValue(mediaAsset.mime) ?? 'video/mp4',
    },
    infoJson,
    transcripts: Array.isArray(result.transcripts) ? result.transcripts : [],
    thumbnails: Array.isArray(result.thumbnails) ? result.thumbnails : [],
    outputs: expectedMediaIngestLayout,
  };

  const asset = {
    schema: 'media.asset.v1',
    id: 'media_ingest_asset_001',
    path: mediaPath,
    source: {
      path: mediaPath,
      provenance: {
        status: 'captured',
        url,
        capturedAt,
        extractor,
      },
      rights: { status: 'needs-review' },
    },
    provenance: {
      captureTool: 'media.ingest',
      sourceCapture: {
        extractor,
        commandPlan: result.commandPlan,
      },
    },
    files: {
      source: mediaAsset,
      infoJson,
      transcripts: Array.isArray(result.transcripts) ? result.transcripts : [],
      thumbnails: Array.isArray(result.thumbnails) ? result.thumbnails : [],
    },
  };

  return { manifest, asset };
}

export const ingestMediaEffect = (input: unknown) => Effect.try({
  try: () => mapSourceCaptureResultToMediaIngestManifest(input),
  catch: (cause) => cause instanceof Error ? cause : new Error(String(cause)),
});

export function ingestMediaForCli(input: unknown) {
  return Effect.map(ingestMediaEffect(input), (data) => ({ schema: 'media.ingest-result.v1', ok: true, data }));
}
