import { createHash } from 'node:crypto';

export const mediaArtifactKind = 'media.render';
export const artifactSchema = 'artifact.manifest.v1';

type JsonObject = Record<string, unknown>;

function objectValue(value: unknown): JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonObject : {};
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function stableId(prefix: string, value: unknown): string {
  return prefix + '_' + createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

export function toArtifactManifest(input: unknown): JsonObject {
  const renderResult = objectValue(input);
  const output = objectValue(renderResult.output);
  const provenance = objectValue(renderResult.provenance);
  const previewPath = stringValue(output.path, 'renders/final.mp4');
  const sourceAssetId = stringValue(provenance.sourceAssetId, stringValue(renderResult.id, 'unknown-source'));
  const rightsStatus = stringValue(provenance.rightsStatus, stringValue(provenance.status, 'needs-review'));

  return {
    schema: artifactSchema,
    id: stableId('artifact', { previewPath, sourceAssetId, renderId: renderResult.id }),
    kind: mediaArtifactKind,
    previewPath,
    sourceSchema: stringValue(renderResult.schema, 'media.render-result.v1'),
    media: {
      renderResultId: stringValue(renderResult.id, 'unknown-render'),
      timelineId: stringValue(renderResult.timelineId, 'unknown-timeline'),
      output,
    },
    provenance: {
      sourceAssetId,
      rightsStatus,
      renderResultSchema: stringValue(renderResult.schema, 'media.render-result.v1'),
    },
  };
}
