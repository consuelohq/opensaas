export type TranslationCacheKeyInput = {
  route: string;
  contentHash: string;
  targetLanguage: string;
};

export type TranslationCacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const defaultTtlMs = 1000 * 60 * 60 * 24;
const memoryCache = new Map<string, TranslationCacheEntry<unknown>>();

export function createTranslationCacheKey({ route, contentHash, targetLanguage }: TranslationCacheKeyInput): string {
  return [route, contentHash, targetLanguage].map(encodeURIComponent).join(':');
}

export function getCachedTranslation<T>(key: string, now = Date.now()): T | null {
  const cached = memoryCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= now) {
    memoryCache.delete(key);
    return null;
  }
  return cached.value as T;
}

export function setCachedTranslation<T>(key: string, value: T, now = Date.now(), ttlMs = defaultTtlMs): void {
  memoryCache.set(key, { value, expiresAt: now + ttlMs });
}

export function clearTranslationCache(): void {
  memoryCache.clear();
}
