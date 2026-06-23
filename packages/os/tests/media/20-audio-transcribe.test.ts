import { describe, expect, it } from 'vitest';

import { expectFunctionExport, importMediaModule } from './helpers';

describe('media audio and transcription', () => {
  it('exposes deterministic audio extraction, normalization, and transcription surfaces', async () => {
    const module = await importMediaModule('scripts/lib/media/audio.ts');
    for (const exportName of ['extractAudioEffect', 'normalizeAudioEffect', 'transcribeEffect', 'transcribeForCli']) {
      expectFunctionExport(module, exportName);
    }
  });

  it('keeps model downloads explicit and supports fixture transcript mode', async () => {
    const module = await importMediaModule('scripts/lib/media/audio.ts');

    expect(module.requiredProfiles).toEqual(expect.arrayContaining(['media-audio']));
    expect(module.transcriptionModes).toEqual(expect.arrayContaining(['fixture', 'whisper.cpp', 'openai-whisper']));
    expect(module.defaultTranscriptionMode).toBe('fixture');
    expect(module.implicitModelDownloads).toBe(false);
  });

  it('supports segment-level and word-level transcript schemas', async () => {
    const schemaModule = await importMediaModule('scripts/lib/media/schema.ts');
    expect(schemaModule.MediaTranscriptSchema).toBeDefined();
    expect(schemaModule.MediaTranscriptSegmentSchema).toBeDefined();
    expect(schemaModule.MediaTranscriptWordSchema).toBeDefined();
  });
});
