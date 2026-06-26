import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { Effect } from 'effect';

import { MediaError } from './errors';
import { createSourceCapturePlan, mediaIngestOutputLayout } from './source-capture/plan';
import { liveSourceCaptureProcess } from './source-capture/process';
import type { SourceCaptureCommandPlan, SourceCaptureFileRef, SourceCaptureResult, SourceCaptureTranscriptRef } from './source-capture/schema';

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

type MaterializedMediaIngestResult = MediaIngestManifestPair & {
  written: string[];
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

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function sourceKind(source: string): 'url' | 'file' {
  return source.startsWith('http://') || source.startsWith('https://') ? 'url' : 'file';
}

function requireString(value: unknown, code: 'MEDIA_INPUT_MISSING', message: string): string {
  const string = stringValue(value);
  if (!string) throw new MediaError(code, message);
  return string;
}

function listFilesRecursive(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? listFilesRecursive(path) : [path];
  });
}

function refFor(path: string, mime?: string): SourceCaptureFileRef {
  return {
    path,
    sha256: sha256File(path),
    bytes: statSync(path).size,
    mime,
  };
}

function isVideoPath(path: string): boolean {
  return /\.(mp4|mov|m4v|webm|mkv)$/i.test(path);
}

function isInfoJsonPath(path: string): boolean {
  return /\.info\.json$/i.test(path) || /source\.info\.json$/i.test(path);
}

function isTranscriptPath(path: string): boolean {
  return /\.(vtt|srt|ttml|json3)$/i.test(path) && !isInfoJsonPath(path);
}

function isThumbnailPath(path: string): boolean {
  return /\.(jpg|jpeg|png|webp)$/i.test(path);
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

export function materializeCapturedSourceDirectory(input: { source: string; outDir: string; commandPlan: SourceCaptureCommandPlan; capturedAt?: string }): MaterializedMediaIngestResult {
  const files = listFilesRecursive(input.outDir);
  const mediaPath = files.find((path) => isVideoPath(path));
  if (!mediaPath) {
    throw new MediaError('MEDIA_SOURCE_ASSET_MISSING', 'yt-dlp capture did not produce a source media asset', { outDir: input.outDir });
  }

  const capturedAt = input.capturedAt ?? new Date().toISOString();
  const infoPath = files.find((path) => isInfoJsonPath(path));
  const transcripts: SourceCaptureTranscriptRef[] = files
    .filter((path) => isTranscriptPath(path))
    .map((path) => ({ path, kind: 'subtitle' }));
  const thumbnails = files.filter((path) => isThumbnailPath(path)).map((path) => refFor(path));
  const infoRef = infoPath ? refFor(infoPath, 'application/json') : undefined;

  const mapped = mapSourceCaptureResultToMediaIngestManifest({
    schema: 'media.source-capture-result.v1',
    source: { kind: 'url', url: input.source, extractor: 'yt-dlp' },
    capturedAt,
    commandPlan: input.commandPlan,
    mediaAsset: refFor(mediaPath, 'video/mp4'),
    infoJson: infoRef,
    transcripts,
    thumbnails,
  });

  const manifestPath = join(input.outDir, 'ingest-manifest.json');
  const assetPath = join(input.outDir, 'media-asset.json');
  writeFileSync(manifestPath, JSON.stringify(mapped.manifest, null, 2) + '\n');
  writeFileSync(assetPath, JSON.stringify(mapped.asset, null, 2) + '\n');

  return {
    ...mapped,
    written: [mediaPath, ...(infoPath ? [infoPath] : []), manifestPath, assetPath],
  };
}

export function materializeLocalFileIngest(input: unknown): MaterializedMediaIngestResult {
  const value = isRecord(input) ? input : {};
  const source = requireString(value.source, 'MEDIA_INPUT_MISSING', 'media.ingest --source is required');
  const outDir = requireString(value.outDir, 'MEDIA_INPUT_MISSING', 'media.ingest --out is required');

  if (sourceKind(source) !== 'file') {
    throw new MediaError('MEDIA_NOT_IMPLEMENTED', 'media.ingest currently executes local file sources; use --dry-run for URL capture plans', { source });
  }
  if (!existsSync(source)) {
    throw new MediaError('MEDIA_INPUT_MISSING', 'media.ingest source file does not exist', { source });
  }

  const assetsDir = join(outDir, 'assets');
  const thumbnailsDir = join(outDir, 'thumbnails');
  mkdirSync(assetsDir, { recursive: true });
  mkdirSync(thumbnailsDir, { recursive: true });

  const sourceOutputPath = join(assetsDir, 'source.mp4');
  if (source !== sourceOutputPath) copyFileSync(source, sourceOutputPath);

  const infoPath = join(outDir, 'source.info.json');
  const capturedAt = new Date().toISOString();
  const sourceStat = statSync(sourceOutputPath);
  const sourceRef = {
    path: sourceOutputPath,
    sha256: sha256File(sourceOutputPath),
    bytes: sourceStat.size,
    mime: 'video/mp4',
  };
  const info = {
    schema: 'media.source-info.v1',
    source: { kind: 'file', path: source, extractor: 'media.local-file' },
    capturedAt,
  };
  writeFileSync(infoPath, JSON.stringify(info, null, 2) + '\n');

  const infoRef = {
    path: infoPath,
    sha256: sha256File(infoPath),
    bytes: statSync(infoPath).size,
    mime: 'application/json',
  };

  const mapped = mapSourceCaptureResultToMediaIngestManifest({
    schema: 'media.source-capture-result.v1',
    source: { kind: 'file', path: source, extractor: 'media.local-file' },
    capturedAt,
    commandPlan: { command: 'copy-file', args: [source, 'assets/source.mp4'] },
    mediaAsset: sourceRef,
    infoJson: infoRef,
    transcripts: [],
    thumbnails: [],
  });

  const manifestPath = join(outDir, 'ingest-manifest.json');
  const assetPath = join(outDir, 'media-asset.json');
  writeFileSync(manifestPath, JSON.stringify(mapped.manifest, null, 2) + '\n');
  writeFileSync(assetPath, JSON.stringify(mapped.asset, null, 2) + '\n');

  return {
    ...mapped,
    written: [sourceOutputPath, infoPath, manifestPath, assetPath],
  };
}

function toMediaFailure(cause: unknown): MediaError {
  if (cause instanceof MediaError) return cause;
  return new MediaError('MEDIA_VALIDATION_ERROR', cause instanceof Error ? cause.message : String(cause));
}

export const ingestMediaEffect = (input: unknown) => Effect.gen(function* () {
  const value = isRecord(input) ? input : {};
  if (value.dryRun === true) return createMediaIngestPlan(input);

  const source = stringValue(value.source);
  if (!source) return yield* Effect.fail(new MediaError('MEDIA_INPUT_MISSING', 'media.ingest --source is required'));

  if (sourceKind(source) === 'url') {
    const outDir = stringValue(value.outDir);
    if (!outDir) return yield* Effect.fail(new MediaError('MEDIA_INPUT_MISSING', 'media.ingest --out is required'));
    const plan = createMediaIngestPlan(input);
    const commandPlan = plan.commandPlan as SourceCaptureCommandPlan;
    const result = yield* liveSourceCaptureProcess.run(commandPlan.command, commandPlan.args);
    if (result.exitCode !== 0) {
      return yield* Effect.fail(new MediaError('MEDIA_VALIDATION_ERROR', 'yt-dlp media ingest failed', {
        source,
        stderr: result.stderr.slice(-4000),
      }));
    }
    return yield* Effect.try({
      try: () => materializeCapturedSourceDirectory({ source, outDir, commandPlan }),
      catch: toMediaFailure,
    });
  }

  return yield* Effect.try({
    try: () => materializeLocalFileIngest(input),
    catch: toMediaFailure,
  });
});

export function ingestMediaForCli(input: unknown) {
  return Effect.match(ingestMediaEffect(input), {
    onFailure: (error) => {
      const mediaError = error instanceof MediaError ? error : new MediaError('MEDIA_VALIDATION_ERROR', error instanceof Error ? error.message : String(error));
      return {
        schema: 'media.error.v1',
        ok: false,
        error: {
          code: mediaError.code,
          message: mediaError.message,
          details: mediaError.details,
        },
      };
    },
    onSuccess: (data) => {
      const schema = isRecord(data) && data.schema === 'media.source-capture-plan.v1'
        ? 'media.source-capture-plan.v1'
        : 'media.ingest-result.v1';
      return { schema, ok: true, data };
    },
  });
}
