#!/usr/bin/env bun

import { Effect } from 'effect';

import { buildMulawWav } from '../src/call-operations/application';
import { createGroqSpeechToTextProvider } from '../src/call-operations/groq';

const optIn = process.env.DIALER_RUN_GROQ_TRANSCRIPTION_INTEGRATION === '1';
if (!optIn) {
  throw new Error(
    'Set DIALER_RUN_GROQ_TRANSCRIPTION_INTEGRATION=1 to authorize the Groq-only integration check',
  );
}

const apiKey = process.env.GROQ_API_KEY?.trim();
if (!apiKey) throw new Error('GROQ_API_KEY is not present');

// Deterministic, non-sensitive two-second μ-law silence fixture.
const mulawSilence = new Uint8Array(16_000);
mulawSilence.fill(0xff);
const provider = createGroqSpeechToTextProvider({ apiKey });
const model =
  process.env.GROQ_TRANSCRIPTION_MODEL?.trim() ?? 'whisper-large-v3-turbo';
const result = await Effect.runPromise(
  provider.transcribe({
    audio: buildMulawWav(mulawSilence),
    encoding: 'audio/wav',
    track: 'inbound',
    model,
  }),
);

process.stdout.write(
  `${JSON.stringify({
    ok: true,
    fixture: 'synthetic-mulaw-silence',
    model,
    textLength: result.text.length,
    language: result.language ?? null,
  })}\n`,
);
