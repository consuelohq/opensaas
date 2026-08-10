import { Effect } from 'effect';

import type { SpeechToTextProviderService, SpeechToTextResult } from './ports';

type GroqTranscriptionResponse = {
  text?: unknown;
  language?: unknown;
  duration?: unknown;
};

const parseResponse = (candidate: unknown): SpeechToTextResult => {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error('Groq transcription response is invalid');
  }
  const response = candidate as GroqTranscriptionResponse;
  if (typeof response.text !== 'string') {
    throw new Error('Groq transcription response did not include text');
  }
  return {
    text: response.text,
    ...(typeof response.language === 'string'
      ? { language: response.language }
      : {}),
    ...(typeof response.duration === 'number' &&
    Number.isFinite(response.duration)
      ? { endMs: Math.max(0, Math.round(response.duration * 1_000)) }
      : {}),
  };
};

export const createGroqSpeechToTextProvider = (input: {
  apiKey: string;
  fetch?: (
    request: string | URL | Request,
    init?: RequestInit,
  ) => Promise<Response>;
  baseUrl?: string;
}): SpeechToTextProviderService => ({
  transcribe: (request) =>
    Effect.tryPromise({
      try: () => {
        if (!input.apiKey.trim()) {
          throw new Error('GROQ_API_KEY is required for transcription');
        }
        const body = new FormData();
        const audio = new Uint8Array(request.audio.byteLength);
        audio.set(request.audio);
        body.append(
          'file',
          new Blob([audio.buffer], { type: request.encoding }),
          `${request.track}.wav`,
        );
        body.append('model', request.model);
        body.append('response_format', 'verbose_json');
        if (request.language) body.append('language', request.language);
        return (input.fetch ?? fetch)(
          `${(input.baseUrl ?? 'https://api.groq.com/openai/v1').replace(/\/$/, '')}/audio/transcriptions`,
          {
            method: 'POST',
            headers: { authorization: `Bearer ${input.apiKey}` },
            body,
          },
        ).then((response) => {
          if (!response.ok) {
            throw new Error(
              `Groq transcription failed with status ${response.status}`,
            );
          }
          return response.json().then(parseResponse);
        });
      },
      catch: (cause) =>
        cause instanceof Error ? cause : new Error(String(cause)),
    }),
});
