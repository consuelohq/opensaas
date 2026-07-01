export type RuntimeTranslationEnv = Partial<Record<'DOCS_TRANSLATION_PROVIDER' | 'GOOGLE_TRANSLATE_API_KEY', string>>;

export type TranslateSegmentsInput = {
  segments: string[];
  targetLanguage: string;
  env?: RuntimeTranslationEnv;
};

export type TranslateSegmentsResult = {
  provider: 'google' | 'passthrough';
  segments: string[];
};

export class TranslationProviderError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'TranslationProviderError';
    this.code = code;
    this.status = status;
  }
}

export async function translateSegments({ segments, targetLanguage, env = globalThis.process?.env ?? {} }: TranslateSegmentsInput): Promise<TranslateSegmentsResult> {
  const provider = env.DOCS_TRANSLATION_PROVIDER ?? 'google';
  if (provider === 'passthrough') {
    return { provider: 'passthrough', segments };
  }

  const apiKey = env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    throw new TranslationProviderError(
      'translation_provider_unconfigured',
      'Runtime translation is not configured for this environment.',
      503,
    );
  }

  const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      q: segments,
      source: 'en',
      target: targetLanguage,
      format: 'text',
    }),
  });

  const payload = await response.json().catch(() => null) as GoogleTranslateResponse | null;
  if (!response.ok) {
    throw new TranslationProviderError(
      'translation_provider_failed',
      providerErrorMessage(payload),
      response.status,
    );
  }

  const translated = payload?.data?.translations?.map((translation) => translation.translatedText) ?? [];
  if (translated.length !== segments.length) {
    throw new TranslationProviderError(
      'translation_provider_malformed_response',
      'Translation provider returned an unexpected response shape.',
      502,
    );
  }

  return { provider: 'google', segments: translated };
}

type GoogleTranslateResponse = {
  data?: { translations?: Array<{ translatedText?: string }> };
  error?: { message?: string };
};

function providerErrorMessage(payload: GoogleTranslateResponse | null): string {
  const message = payload?.error?.message;
  if (!message) return 'Translation provider request failed.';
  return message.length > 180 ? `${message.slice(0, 177)}...` : message;
}
