import { Effect } from 'effect';

import type {
  SpeechToTextProviderService,
  SpeechToTextResult,
  SpeechSegmentTiming,
  SpeechTiming,
} from './ports';

type GroqTranscriptionResponse = {
  text?: unknown;
  language?: unknown;
  duration?: unknown;
  words?: unknown;
  segments?: unknown;
};

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const timing = (
  value: unknown,
  textKey: 'word' | 'text',
): SpeechTiming | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row[textKey] !== 'string' ||
    !finite(row.start) ||
    !finite(row.end) ||
    row.start < 0 ||
    row.end < row.start
  )
    return null;
  return {
    text: row[textKey],
    startMs: Math.round(row.start * 1000),
    endMs: Math.round(row.end * 1000),
  };
};

const segmentTiming = (value: unknown): SpeechSegmentTiming | null => {
  const base = timing(value, 'text');
  if (!base) return null;
  const row = value as Record<string, unknown>;
  return {
    ...base,
    ...(finite(row.avg_logprob)
      ? { averageLogProbability: row.avg_logprob }
      : {}),
    ...(finite(row.no_speech_prob) &&
    row.no_speech_prob >= 0 &&
    row.no_speech_prob <= 1
      ? { noSpeechProbability: row.no_speech_prob }
      : {}),
    ...(finite(row.compression_ratio) && row.compression_ratio >= 0
      ? { compressionRatio: row.compression_ratio }
      : {}),
  };
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
    ...(Array.isArray(response.words)
      ? {
          words: response.words
            .map((word) => timing(word, 'word'))
            .filter((word): word is SpeechTiming => word !== null),
        }
      : {}),
    ...(Array.isArray(response.segments)
      ? {
          segments: response.segments
            .map(segmentTiming)
            .filter(
              (segment): segment is SpeechSegmentTiming => segment !== null,
            ),
        }
      : {}),
    ...(typeof response.language === 'string'
      ? { language: response.language }
      : {}),
    ...(typeof response.duration === 'number' &&
    Number.isFinite(response.duration)
      ? { audioDurationMs: Math.max(0, Math.round(response.duration * 1_000)) }
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
      try: (signal) => {
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
        body.append('timestamp_granularities[]', 'word');
        body.append('timestamp_granularities[]', 'segment');
        if (request.language) body.append('language', request.language);
        return (input.fetch ?? fetch)(
          `${(input.baseUrl ?? 'https://api.groq.com/openai/v1').replace(/\/$/, '')}/audio/transcriptions`,
          {
            method: 'POST',
            headers: { authorization: `Bearer ${input.apiKey}` },
            body,
            signal: request.signal
              ? AbortSignal.any([signal, request.signal])
              : signal,
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
