import { createHash } from 'node:crypto';

import { Effect } from 'effect';

import { MediaError } from './errors';
import { liveMediaProcess } from './process';

export const requiredProfiles = ['media-audio'] as const;
export const transcriptionModes = ['fixture', 'whisper.cpp', 'openai-whisper'] as const;
export const defaultTranscriptionMode = 'fixture';
export const implicitModelDownloads = false;

export type TranscriptionMode = typeof transcriptionModes[number];

export type AudioPlan = {
  schema: 'media.audio-plan.v1';
  kind: 'extract' | 'normalize' | 'transcribe';
  command: string;
  args: string[];
  requiredProfiles: string[];
  requiredCommands: string[];
  output: {
    path: string;
    sampleRate?: number;
    channels?: number;
    format?: string;
  };
  mode?: TranscriptionMode;
  modelRef?: string;
  implicitModelDownloads: false;
};

type AudioExtractionInput = {
  inputPath: string;
  outPath: string;
  sampleRate?: number;
  channels?: number;
  format?: string;
};

type AudioNormalizationInput = AudioExtractionInput;

type TranscriptWord = {
  startSeconds: number;
  endSeconds: number;
  text: string;
  confidence?: number;
};

type TranscriptSegment = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
  words: TranscriptWord[];
};

type FixtureTranscriptInput = {
  sourceAudioPath: string;
  language?: string;
  fixtureText?: string;
  segments?: Array<{
    id?: string;
    startSeconds: number;
    endSeconds: number;
    text: string;
    words?: Array<{
      startSeconds: number;
      endSeconds: number;
      text: string;
      confidence?: number;
    }>;
  }>;
};

type TranscriptionInput = {
  inputPath: string;
  mode?: TranscriptionMode;
  language?: string;
  fixtureText?: string;
  segments?: FixtureTranscriptInput['segments'];
  modelRef?: string;
  outPath?: string;
};

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function stableId(prefix: string, value: string): string {
  return prefix + '_' + createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function assertNoImplicitModelDownloads(mode: TranscriptionMode, modelRef?: string): void {
  if (mode !== 'fixture' && !modelRef) {
    throw new MediaError(
      'MEDIA_MODEL_REQUIRED',
      'Transcription mode ' + mode + ' requires explicit model selection before any model download or model-backed run',
      { mode, implicitModelDownloads: false },
    );
  }
}

function parseMode(value: unknown): TranscriptionMode {
  if (value === 'whisper.cpp' || value === 'openai-whisper') return value;
  return 'fixture';
}

function defaultOutputPath(inputPath: string, suffix: string): string {
  return inputPath.replace(/.[^/.]+$/, '') + suffix;
}

export function buildAudioExtractionPlan(input: Record<string, unknown>): AudioPlan {
  const inputPath = stringValue(input.inputPath);
  const outPath = stringValue(input.outPath, defaultOutputPath(inputPath, '.wav'));
  const sampleRate = numberValue(input.sampleRate, 16000);
  const channels = numberValue(input.channels, 1);
  return {
    schema: 'media.audio-plan.v1',
    kind: 'extract',
    command: 'ffmpeg',
    args: ['-y', '-i', inputPath, '-vn', '-acodec', 'pcm_s16le', '-ac', String(channels), '-ar', String(sampleRate), outPath],
    requiredProfiles: ['media-core'],
    requiredCommands: ['ffmpeg'],
    output: { path: outPath, sampleRate, channels, format: stringValue(input.format, 'wav') },
    implicitModelDownloads: false,
  };
}

export function buildAudioNormalizationPlan(input: Record<string, unknown>): AudioPlan {
  const inputPath = stringValue(input.inputPath);
  const outPath = stringValue(input.outPath, defaultOutputPath(inputPath, '-normalized.wav'));
  const sampleRate = numberValue(input.sampleRate, 16000);
  const channels = numberValue(input.channels, 1);
  return {
    schema: 'media.audio-plan.v1',
    kind: 'normalize',
    command: 'sox',
    args: [inputPath, '-r', String(sampleRate), '-c', String(channels), outPath, 'gain', '-n'],
    requiredProfiles: ['media-audio'],
    requiredCommands: ['sox'],
    output: { path: outPath, sampleRate, channels, format: stringValue(input.format, 'wav') },
    implicitModelDownloads: false,
  };
}

export function createTranscriptionPlan(input: Record<string, unknown>): AudioPlan {
  const mode = parseMode(input.mode);
  const inputPath = stringValue(input.inputPath);
  const modelRef = stringValue(input.modelRef) || undefined;
  assertNoImplicitModelDownloads(mode, modelRef);
  const command = mode === 'fixture' ? 'fixture-transcript' : (mode === 'whisper.cpp' ? 'whisper-cli' : 'openai-whisper');
  return {
    schema: 'media.audio-plan.v1',
    kind: 'transcribe',
    command,
    args: mode === 'fixture' ? [] : [inputPath, '--model', modelRef ?? ''],
    requiredProfiles: ['media-audio'],
    requiredCommands: mode === 'whisper.cpp' ? ['whisper-cli'] : [],
    output: { path: stringValue(input.outPath, defaultOutputPath(inputPath, '.transcript.json')), format: 'json' },
    mode,
    ...(modelRef ? { modelRef } : {}),
    implicitModelDownloads: false,
  };
}

function wordsFromText(text: string, startSeconds: number, endSeconds: number): TranscriptWord[] {
  const rawWords = text.split(/s+/).map((word) => word.trim()).filter(Boolean);
  if (rawWords.length === 0) return [];
  const duration = Math.max(endSeconds - startSeconds, rawWords.length * 0.1);
  const step = duration / rawWords.length;
  return rawWords.map((word, index) => ({
    startSeconds: Number((startSeconds + step * index).toFixed(3)),
    endSeconds: Number((startSeconds + step * (index + 1)).toFixed(3)),
    text: word,
    confidence: 1,
  }));
}

function normalizeSegment(segment: NonNullable<FixtureTranscriptInput['segments']>[number], index: number): TranscriptSegment {
  const startSeconds = segment.startSeconds;
  const endSeconds = segment.endSeconds;
  const text = segment.text;
  return {
    id: segment.id ?? 'seg_' + String(index + 1).padStart(3, '0'),
    startSeconds,
    endSeconds,
    text,
    words: Array.isArray(segment.words) && segment.words.length > 0 ? segment.words.map((word) => ({
      startSeconds: word.startSeconds,
      endSeconds: word.endSeconds,
      text: word.text,
      ...(typeof word.confidence === 'number' ? { confidence: word.confidence } : {}),
    })) : wordsFromText(text, startSeconds, endSeconds),
  };
}

export function buildFixtureTranscript(input: FixtureTranscriptInput): Record<string, unknown> {
  const text = input.fixtureText ?? 'fixture transcript';
  const segments = Array.isArray(input.segments) && input.segments.length > 0
    ? input.segments.map((segment, index) => normalizeSegment(segment, index))
    : [{ id: 'seg_001', startSeconds: 0, endSeconds: Math.max(1, text.split(/s+/).filter(Boolean).length * 0.4), text, words: wordsFromText(text, 0, Math.max(1, text.split(/s+/).filter(Boolean).length * 0.4)) }];
  return {
    schema: 'media.transcript.v1',
    id: stableId('transcript', input.sourceAudioPath + ':' + segments.map((segment) => segment.text).join('|')),
    mode: 'fixture',
    language: input.language ?? 'en',
    source: { audioPath: input.sourceAudioPath },
    implicitModelDownloads: false,
    segments,
  };
}

function runAudioPlan(plan: AudioPlan, failureCode: string) {
  return Effect.flatMap(
    liveMediaProcess.run({ command: plan.command, args: plan.args }),
    (result) => result.exitCode === 0
      ? Effect.succeed({ schema: 'media.audio-result.v1', ok: true, data: { plan, stdout: result.stdout } })
      : Effect.fail(new MediaError('MEDIA_AUDIO_PROCESS_FAILED', failureCode + ' failed', { stderr: result.stderr, plan })),
  );
}

export const extractAudioEffect = (input: AudioExtractionInput) => runAudioPlan(buildAudioExtractionPlan(input as unknown as Record<string, unknown>), 'audio extraction');

export const normalizeAudioEffect = (input: AudioNormalizationInput) => runAudioPlan(buildAudioNormalizationPlan(input as unknown as Record<string, unknown>), 'audio normalization');

export const transcribeEffect = (input: TranscriptionInput) => Effect.try({
  try: () => {
    const value = objectValue(input);
    const plan = createTranscriptionPlan(value);
    if (plan.mode !== 'fixture') {
      throw new MediaError('MEDIA_NOT_IMPLEMENTED', 'Model-backed transcription is not implemented in this branch; fixture mode is deterministic and model downloads remain explicit', { mode: plan.mode, modelRef: plan.modelRef });
    }
    return buildFixtureTranscript({
      sourceAudioPath: input.inputPath,
      language: input.language,
      fixtureText: input.fixtureText,
      segments: input.segments,
    });
  },
  catch: (cause) => cause instanceof Error ? cause : new Error(String(cause)),
});

export function transcribeForCli(input: TranscriptionInput) {
  return Effect.map(transcribeEffect(input), (data) => ({ schema: 'media.transcript-result.v1', ok: true, data }));
}
