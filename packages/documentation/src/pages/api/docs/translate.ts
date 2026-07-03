import type { APIRoute } from 'astro';
import { env as cloudflareEnv } from 'cloudflare:workers';
import { createTranslationCacheKey, getCachedTranslation, setCachedTranslation } from '../../../lib/translation/cache';
import { getSupportedTranslationLanguage } from '../../../lib/translation/languages';
import { translateSegments, TranslationProviderError } from '../../../lib/translation/provider';
import { getDocumentationTranslationSource } from '../../../lib/translation/source';

export const prerender = false;

type TranslationSuccess = {
  ok: true;
  cached: boolean;
  provider: 'google' | 'passthrough';
  sourceLanguage: 'en';
  targetLanguage: string;
  route: string;
  contentHash: string;
  cacheKey: string;
  title: string;
  description: string | null;
  segments: string[];
};

type TranslationFailure = {
  ok: false;
  error: { code: string; message: string };
};

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const requestedPath = url.searchParams.get('path');
  const targetLanguage = getSupportedTranslationLanguage(url.searchParams.get('lang'));

  if (!targetLanguage) {
    return json<TranslationFailure>({ ok: false, error: { code: 'unsupported_language', message: 'Unsupported translation language.' } }, 400);
  }

  const source = await getDocumentationTranslationSource(requestedPath);
  if (!source) {
    return json<TranslationFailure>({ ok: false, error: { code: 'source_not_found', message: 'Documentation source was not found for this route.' } }, 404);
  }

  const cacheKey = createTranslationCacheKey({
    route: source.route,
    contentHash: source.contentHash,
    targetLanguage: targetLanguage.code,
  });
  const cached = getCachedTranslation<TranslationSuccess>(cacheKey);
  if (cached) return json({ ...cached, cached: true });

  const runtimeEnv = getRuntimeEnv();

  try {
    const translated = await translateSegments({
      segments: source.segments,
      targetLanguage: targetLanguage.code,
      env: runtimeEnv,
    });
    const payload: TranslationSuccess = {
      ok: true,
      cached: false,
      provider: translated.provider,
      sourceLanguage: 'en',
      targetLanguage: targetLanguage.code,
      route: source.route,
      contentHash: source.contentHash,
      cacheKey,
      title: source.title,
      description: source.description,
      segments: translated.segments,
    };
    setCachedTranslation(cacheKey, payload);
    return json(payload);
  } catch (error: unknown) {
    if (isTranslationProviderError(error)) {
      return json<TranslationFailure>({ ok: false, error: { code: error.code, message: error.message } }, error.status);
    }
    return json<TranslationFailure>({ ok: false, error: { code: 'translation_failed', message: debugTranslationErrorMessage(error, runtimeEnv) } }, 500);
  }
};

function getRuntimeEnv(): Record<string, string | undefined> {
  const processEnv = globalThis.process?.env ?? {};
  if (cloudflareEnv && typeof cloudflareEnv === 'object') {
    return { ...processEnv, ...(cloudflareEnv as Record<string, string | undefined>) };
  }
  return processEnv;
}

function debugTranslationErrorMessage(error: unknown, env: Record<string, string | undefined>): string {
  if (env.DOCS_TRANSLATION_DEBUG !== '1') return 'Translation request failed.';
  if (error instanceof Error) return error.message;
  return 'Translation request failed.';
}

function isTranslationProviderError(error: unknown): error is TranslationProviderError {
  if (error instanceof TranslationProviderError) return true;
  if (!error || typeof error !== 'object') return false;
  const candidate = error as Record<string, unknown>;
  return candidate.name === 'TranslationProviderError'
    && typeof candidate.code === 'string'
    && typeof candidate.message === 'string'
    && typeof candidate.status === 'number';
}

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': status === 200 ? 'private, max-age=300' : 'no-store',
    },
  });
}
