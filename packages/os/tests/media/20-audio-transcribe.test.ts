import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createTempDir,
  expectFunctionExport,
  expectSchemaAccepts,
  expectSchemaRejects,
  importMediaModule,
  parseJsonStdout,
  removeTempDir,
  runMediaCli,
} from './helpers';

describe('media audio and transcription', () => {
  it('should satisfy media contract when it exposes deterministic audio extraction, normalization, and transcription surfaces', async () => {
    const module = await importMediaModule('scripts/lib/media/audio.ts');
    for (const exportName of [
      'buildAudioExtractionPlan',
      'buildAudioNormalizationPlan',
      'buildFixtureTranscript',
      'createTranscriptionPlan',
      'extractAudioEffect',
      'normalizeAudioEffect',
      'transcribeEffect',
      'transcribeForCli',
    ]) {
      expectFunctionExport(module, exportName);
    }
  });

  it('should require media-audio profile when transcribing audio', async () => {
    const module = await importMediaModule('scripts/lib/media/audio.ts');

    expect(module.requiredProfiles).toEqual(expect.arrayContaining(['media-audio']));
  });

  it('should support fixture and whisper modes when transcribing audio', async () => {
    const module = await importMediaModule('scripts/lib/media/audio.ts');

    expect(module.transcriptionModes).toEqual(
      expect.arrayContaining(['fixture', 'whisper.cpp', 'openai-whisper']),
    );
  });

  it('should default to fixture transcript mode when transcribing in tests', async () => {
    const module = await importMediaModule('scripts/lib/media/audio.ts');

    expect(module.defaultTranscriptionMode).toBe('fixture');
  });

  it('should keep model downloads explicit when transcribing audio', async () => {
    const module = await importMediaModule('scripts/lib/media/audio.ts');

    expect(module.implicitModelDownloads).toBe(false);
    const plan = module.createTranscriptionPlan as (input: Record<string, unknown>) => Record<string, unknown>;
    expect(() => plan({ inputPath: 'audio/source.wav', mode: 'whisper.cpp' })).toThrow(/explicit model/i);
    expect(() => plan({ inputPath: 'audio/source.wav', mode: 'openai-whisper' })).toThrow(/explicit model/i);
  });

  it('should build deterministic ffmpeg and sox audio plans without downloading models', async () => {
    const module = await importMediaModule('scripts/lib/media/audio.ts');
    const buildAudioExtractionPlan = module.buildAudioExtractionPlan as (input: Record<string, unknown>) => Record<string, unknown>;
    const buildAudioNormalizationPlan = module.buildAudioNormalizationPlan as (input: Record<string, unknown>) => Record<string, unknown>;

    expect(buildAudioExtractionPlan({ inputPath: 'assets/source.mp4', outPath: 'audio/source.wav', sampleRate: 16000, channels: 1 })).toMatchObject({
      schema: 'media.audio-plan.v1',
      kind: 'extract',
      command: 'ffmpeg',
      requiredProfiles: ['media-core'],
      requiredCommands: ['ffmpeg'],
      output: { path: 'audio/source.wav', sampleRate: 16000, channels: 1, format: 'wav' },
      implicitModelDownloads: false,
    });

    const normalize = buildAudioNormalizationPlan({ inputPath: 'audio/source.wav', outPath: 'audio/source-normalized.wav', sampleRate: 16000, channels: 1 });
    expect(normalize).toMatchObject({
      schema: 'media.audio-plan.v1',
      kind: 'normalize',
      command: 'sox',
      requiredProfiles: ['media-audio'],
      requiredCommands: ['sox'],
      output: { path: 'audio/source-normalized.wav', sampleRate: 16000, channels: 1, format: 'wav' },
      implicitModelDownloads: false,
    });
    expect(normalize.args).toEqual(expect.arrayContaining(['gain', '-n']));
  });

  it('should build fixture transcripts with segment-level and word-level data', async () => {
    const module = await importMediaModule('scripts/lib/media/audio.ts');
    const buildFixtureTranscript = module.buildFixtureTranscript as (input: Record<string, unknown>) => Record<string, unknown>;

    const transcript = buildFixtureTranscript({
      sourceAudioPath: 'audio/source.wav',
      language: 'en',
      segments: [
        {
          id: 'seg_001',
          startSeconds: 0,
          endSeconds: 1.2,
          text: 'Plant foot hits',
          words: [
            { startSeconds: 0, endSeconds: 0.4, text: 'Plant', confidence: 0.98 },
            { startSeconds: 0.4, endSeconds: 0.8, text: 'foot', confidence: 0.97 },
            { startSeconds: 0.8, endSeconds: 1.2, text: 'hits', confidence: 0.96 },
          ],
        },
      ],
    });

    expect(transcript).toMatchObject({
      schema: 'media.transcript.v1',
      mode: 'fixture',
      language: 'en',
      source: { audioPath: 'audio/source.wav' },
      implicitModelDownloads: false,
    });
    expect(transcript.segments).toHaveLength(1);
    expect((transcript.segments as Array<Record<string, unknown>>)[0].words).toHaveLength(3);
  });

  it('should satisfy media contract when it supports segment-level and word-level transcript schemas', async () => {
    const schemaModule = await importMediaModule('scripts/lib/media/schema.ts');
    expect(schemaModule.MediaTranscriptSchema).toBeDefined();
    expect(schemaModule.MediaTranscriptSegmentSchema).toBeDefined();
    expect(schemaModule.MediaTranscriptWordSchema).toBeDefined();

    expectSchemaAccepts(schemaModule.MediaTranscriptWordSchema, { startSeconds: 0, endSeconds: 0.5, text: 'plant', confidence: 0.99 });
    expectSchemaRejects(schemaModule.MediaTranscriptWordSchema, { startSeconds: 1, endSeconds: 0.5, text: 'plant' });
    expectSchemaAccepts(schemaModule.MediaTranscriptSegmentSchema, {
      id: 'seg_001',
      startSeconds: 0,
      endSeconds: 1.2,
      text: 'Plant foot hits',
      words: [{ startSeconds: 0, endSeconds: 0.5, text: 'Plant', confidence: 0.9 }],
    });
    expectSchemaRejects(schemaModule.MediaTranscriptSegmentSchema, { id: 'seg_bad', startSeconds: 2, endSeconds: 1, text: '' });
    expectSchemaAccepts(schemaModule.MediaTranscriptSchema, {
      schema: 'media.transcript.v1',
      id: 'transcript_001',
      mode: 'fixture',
      language: 'en',
      source: { audioPath: 'audio/source.wav' },
      implicitModelDownloads: false,
      segments: [{ id: 'seg_001', startSeconds: 0, endSeconds: 1, text: 'hello', words: [] }],
    });
  });

  it('should return a structured fixture transcript from the audio CLI without invoking external models', () => {
    const tempDir = createTempDir('consuelo-media-test-audio-');
    try {
      const audioPath = join(tempDir, 'source.wav');
      mkdirSync(tempDir, { recursive: true });
      writeFileSync(audioPath, 'fixture audio bytes');

      const result = runMediaCli(['audio', 'transcribe', '--input', audioPath, '--mode', 'fixture', '--fixture-text', 'Plant foot hits', '--json']);
      expect(result.status, `stderr:\n${result.stderr}`).toBe(0);
      const body = parseJsonStdout(result.stdout);
      expect(body).toMatchObject({ schema: 'media.transcript-result.v1', ok: true });
      expect(body.data).toMatchObject({
        schema: 'media.transcript.v1',
        mode: 'fixture',
        source: { audioPath },
        implicitModelDownloads: false,
      });
    } finally {
      removeTempDir(tempDir);
    }
  });
});
