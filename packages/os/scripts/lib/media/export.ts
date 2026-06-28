import { Effect } from 'effect';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MediaExportPackageSchema } from './schema';

export const exportMediaModuleBoundary = true;
export const exportTargets = ['youtube-shorts', 'tiktok', 'reels', 'longform-youtube'] as const;

type ExportTarget = typeof exportTargets[number];
type JsonObject = Record<string, unknown>;

type ExportPackageInput = {
  renderResult?: unknown;
  renderResultPath?: string;
  target?: string;
  outDir?: string;
  thumbnail?: string;
  captions?: string;
  notes?: string;
  rightsNotes?: string;
};

function objectValue(value: unknown): JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonObject : {};
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function stableId(prefix: string, value: unknown): string {
  return prefix + '_' + createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

function normalizeTarget(value: string | undefined): ExportTarget {
  return exportTargets.includes(value as ExportTarget) ? value as ExportTarget : 'youtube-shorts';
}

function loadRenderResult(input: ExportPackageInput): JsonObject {
  if (input.renderResult !== undefined) return objectValue(input.renderResult);
  if (input.renderResultPath) return JSON.parse(readFileSync(input.renderResultPath, 'utf8')) as JsonObject;
  throw new Error('render result is required for media export');
}

export function buildExportPackage(input: ExportPackageInput): JsonObject {
  const renderResult = loadRenderResult(input);
  const output = objectValue(renderResult.output);
  const provenance = objectValue(renderResult.provenance);
  const outDir = stringValue(input.outDir, 'exports');
  const target = normalizeTarget(input.target);
  const renderResultPath = stringValue(input.renderResultPath, 'render-result.json');
  const mp4 = stringValue(output.path, join(outDir, 'final.mp4'));
  const sourceAssetId = stringValue(provenance.sourceAssetId, 'unknown-source');
  const rightsStatus = stringValue(provenance.rightsStatus, stringValue(provenance.status, 'needs-review'));
  const candidate = {
    schema: 'media.export-package.v1',
    id: stableId('export', { target, mp4, sourceAssetId, renderResultPath }),
    target,
    files: {
      mp4,
      thumbnail: stringValue(input.thumbnail, join(outDir, 'thumbnail.png')),
      captions: stringValue(input.captions, join(outDir, 'captions.vtt')),
      notes: stringValue(input.notes, join(outDir, 'notes.md')),
      renderResult: renderResultPath,
    },
    provenance: {
      sourceAssetId,
      rightsStatus,
      rightsNotes: input.rightsNotes,
    },
    deterministic: true,
    renderResult,
  };
  return MediaExportPackageSchema.parse(candidate) as JsonObject;
}

export function validateExportPackage(input: unknown): JsonObject {
  return MediaExportPackageSchema.parse(input) as JsonObject;
}

export const exportPackageEffect = (input: ExportPackageInput) => Effect.try({
  try: () => buildExportPackage(input),
  catch: (cause) => cause instanceof Error ? cause : new Error(String(cause)),
});

export function exportPackageForCli(input: ExportPackageInput) {
  return Effect.map(exportPackageEffect(input), (data) => ({ schema: 'media.export-package.v1', ok: true, data }));
}
