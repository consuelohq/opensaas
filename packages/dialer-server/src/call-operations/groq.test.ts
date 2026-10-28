import { describe, expect, it, mock } from 'bun:test';
import { Effect } from 'effect';

import { createGroqSpeechToTextProvider } from './groq';

describe('Groq speech-to-text adapter', () => {
  it('uses the OpenAI-compatible audio endpoint and returns provider-grounded metadata', async () => {
    const transport = mock(
      async (_input: string | URL | Request, init?: RequestInit) => {
        const body = init?.body;
        expect(body).toBeInstanceOf(FormData);
        expect((body as FormData).get('model')).toBe('whisper-large-v3-turbo');
        expect((body as FormData).get('language')).toBe('en');
        return new Response(
          JSON.stringify({
            text: 'Hello there',
            language: 'en',
            duration: 1.25,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    );
    const provider = createGroqSpeechToTextProvider({
      apiKey: 'test-key',
      fetch: transport,
    });

    const result = await Effect.runPromise(
      provider.transcribe({
        audio: new Uint8Array([1, 2, 3]),
        encoding: 'audio/wav',
        track: 'inbound',
        model: 'whisper-large-v3-turbo',
        language: 'en',
      }),
    );

    expect(result).toEqual({
      text: 'Hello there',
      language: 'en',
      endMs: 1250,
    });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0]?.[0]).toBe(
      'https://api.groq.com/openai/v1/audio/transcriptions',
    );
  });

  it('fails closed when credentials are absent', async () => {
    const provider = createGroqSpeechToTextProvider({ apiKey: '' });
    const exit = await Effect.runPromiseExit(
      provider.transcribe({
        audio: new Uint8Array([1]),
        encoding: 'audio/wav',
        track: 'outbound',
        model: 'whisper-large-v3-turbo',
      }),
    );
    expect(exit._tag).toBe('Failure');
  });
});
