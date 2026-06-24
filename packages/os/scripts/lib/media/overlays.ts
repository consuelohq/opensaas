import { Effect } from 'effect';
import { createHash } from 'node:crypto';

import { MediaOverlaySchema } from './schema';

export const overlayMediaModuleBoundary = true;

export const overlayPrimitiveTypes = [
  'arrow',
  'label',
  'zoom-box',
  'freeze-frame-callout',
  'force-vector',
  'joint-angle',
  'velocity-trail',
  'comparison-ghost',
] as const;

export const overlayOutputFormats = ['png-sequence', 'transparent-video', 'svg'] as const;
export const composeConsumableArtifactSchema = 'media.overlay.v1';

type JsonObject = Record<string, unknown>;

type OverlayRenderInput = {
  id?: string;
  timelineId?: string;
  render?: { width?: number; height?: number; fps?: number; durationSeconds?: number };
  primitives?: Array<Record<string, unknown>>;
  output?: { format?: string; path?: string };
  provenance?: Record<string, unknown>;
};

function stableId(prefix: string, value: unknown): string {
  return prefix + '_' + createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

export function normalizeOverlaySpec(input: OverlayRenderInput): JsonObject {
  const render = objectValue(input.render);
  const output = objectValue(input.output);
  return {
    schema: 'media.overlay.v1',
    id: input.id ?? stableId('overlay', input),
    timelineId: input.timelineId,
    render: {
      width: numberValue(render.width, 1080),
      height: numberValue(render.height, 1920),
      fps: numberValue(render.fps, 30),
      durationSeconds: numberValue(render.durationSeconds, 1),
    },
    primitives: Array.isArray(input.primitives) ? input.primitives : [],
    output: {
      format: typeof output.format === 'string' ? output.format : 'svg',
      path: typeof output.path === 'string' ? output.path : undefined,
    },
    provenance: input.provenance ?? { status: 'needs-review' },
  };
}

export function validateOverlaySpec(input: unknown): JsonObject {
  const normalized = normalizeOverlaySpec(objectValue(input) as OverlayRenderInput);
  return MediaOverlaySchema.parse(normalized) as JsonObject;
}

export function buildOverlayArtifact(input: unknown): JsonObject {
  const overlay = validateOverlaySpec(input);
  const output = objectValue(overlay.output);
  return {
    ...overlay,
    artifact: {
      schema: composeConsumableArtifactSchema,
      id: overlay.id,
      path: typeof output.path === 'string' ? output.path : 'overlays/' + String(overlay.id) + '.' + String(output.format ?? 'svg'),
      format: output.format,
      composeConsumable: true,
      declarative: true,
      nativeRendererRequired: false,
    },
  };
}

export const renderOverlayEffect = (input: unknown) => Effect.succeed(buildOverlayArtifact(input));

export function renderOverlayForCli(input: unknown) {
  return Effect.map(renderOverlayEffect(input), (data) => ({ schema: composeConsumableArtifactSchema, ok: true, data }));
}
