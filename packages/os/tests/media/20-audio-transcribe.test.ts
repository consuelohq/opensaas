import { describe, expect, it } from 'vitest';

import { expectFunctionExport, importMediaModule } from './helpers';

describe('media audio and transcription', () => {
  it('should satisfy media contract when it exposes deterministic audio extraction, normalization, and transcription surfaces', async () => {
    const module = await importMediaModule('scripts/lib/media/audio.ts');
    for (const exportName of ['extractAudioEffect', 'normalizeAudioEffect', 'transcribeEffect', 'transcribeForCli']) {
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
  });

  it('should satisfy media contract when it supports segment-level and word-level transcript schemas', async () => {
    const schemaModule = await importMediaModule('scripts/lib/media/schema.ts');
    expect(schemaModule.MediaTranscriptSchema).toBeDefined();
    expect(schemaModule.MediaTranscriptSegmentSchema).toBeDefined();
    expect(schemaModule.MediaTranscriptWordSchema).toBeDefined();
  });
});
