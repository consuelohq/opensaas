import { Effect } from 'effect';
import { existsSync, readFileSync } from 'node:fs';

import { MediaTimelineSchema } from './schema';

export const requiredCommands: string[] = [];

type TimelineValidationResult = { ok: boolean; errors?: Array<{ path: string; message: string }>; timeline?: unknown };

type JsonObject = Record<string, unknown>;

function pathToString(path: Array<string | number>): string {
  return path.map((part) => typeof part === 'number' ? '[' + part + ']' : (path.indexOf(part) === 0 ? part : '.' + part)).join('').replace('.[', '[');
}

function objectValue(value: unknown): JsonObject {
  return typeof value === 'object' && value !== null ? value as JsonObject : {};
}

export function validateTimelineJson(value: unknown): TimelineValidationResult {
  const strict = MediaTimelineSchema.safeParse(value);
  if (strict.success) return { ok: true, timeline: strict.data };

  const timeline = objectValue(value);
  const errors: Array<{ path: string; message: string }> = [];
  if (timeline.schema !== 'media.timeline.v1') errors.push({ path: 'schema', message: 'timeline schema must be media.timeline.v1' });
  const source = objectValue(timeline.source);
  if (typeof source.path !== 'string' || source.path.length === 0) errors.push({ path: 'source.path', message: 'source path is required' });
  const render = objectValue(timeline.render);
  const duration = typeof render.durationSeconds === 'number' ? render.durationSeconds : 0;
  if (duration <= 0) errors.push({ path: 'render.durationSeconds', message: 'render duration must be positive' });
  for (const [index, beatValue] of Array.isArray(timeline.beats) ? timeline.beats.entries() : []) {
    const beat = objectValue(beatValue);
    const start = typeof beat.startSeconds === 'number' ? beat.startSeconds : -1;
    const end = typeof beat.endSeconds === 'number' ? beat.endSeconds : -1;
    if (start < 0) errors.push({ path: 'beats[' + index + '].startSeconds', message: 'beat start must be nonnegative' });
    if (end <= start) errors.push({ path: 'beats[' + index + '].endSeconds', message: 'beat end must be after start' });
    if (duration > 0 && (start > duration || end > duration)) errors.push({ path: 'beats[' + index + ']', message: 'beat must fit within render duration' });
  }
  for (const issue of strict.error.issues) {
    const path = pathToString(issue.path);
    if (!path.startsWith('assets') && !path.startsWith('source.assetId') && !path.startsWith('provenance.status')) errors.push({ path, message: issue.message });
  }
  return errors.length === 0 ? { ok: true, timeline } : { ok: false, errors };
}

export function collectTimelineReferences(value: unknown): { assets: string[]; captions: string[]; audio: string[]; overlays: string[] } {
  const timeline = objectValue(value);
  const source = objectValue(timeline.source);
  const tracks = objectValue(timeline.tracks);
  const overlays = Array.isArray(timeline.overlays) ? timeline.overlays.map((overlay) => objectValue(overlay).id).filter((id): id is string => typeof id === 'string') : [];
  return {
    assets: typeof source.path === 'string' ? [source.path] : [],
    captions: typeof tracks.captions === 'string' ? [tracks.captions] : [],
    audio: [tracks.voiceover, tracks.music].filter((item): item is string => typeof item === 'string'),
    overlays,
  };
}

export const validateTimelineEffect = (input: { timelinePath?: string; timeline?: unknown }) => Effect.try({
  try: () => {
    const value = input.timeline ?? (input.timelinePath ? JSON.parse(readFileSync(input.timelinePath, 'utf8')) as unknown : undefined);
    const result = validateTimelineJson(value);
    if (!result.ok) return { schema: 'media.timeline-validation.v1', ok: false, errors: result.errors };
    const refs = collectTimelineReferences(value);
    const missing = refs.assets.filter((path) => !existsSync(path));
    return { schema: 'media.timeline-validation.v1', ok: missing.length === 0, errors: missing.map((path) => ({ path, message: 'referenced asset does not exist' })), references: refs };
  },
  catch: (cause) => cause instanceof Error ? cause : new Error(String(cause)),
});

export function validateTimelineForCli(input: { timelinePath?: string; timeline?: unknown }) {
  return validateTimelineEffect(input);
}
