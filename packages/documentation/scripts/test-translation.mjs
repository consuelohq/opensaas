import { strict as assert } from 'node:assert';
import { createTranslationCacheKey, getCachedTranslation, setCachedTranslation, clearTranslationCache } from '../src/lib/translation/cache.ts';
import { getSupportedTranslationLanguage, isSupportedTranslationLanguage } from '../src/lib/translation/languages.ts';
import { translateSegments } from '../src/lib/translation/provider.ts';
import { extractTranslationSegments } from '../src/lib/translation/text.ts';

assert.equal(getSupportedTranslationLanguage('es')?.label, 'Spanish');
assert.equal(getSupportedTranslationLanguage('EN'), null);
assert.equal(isSupportedTranslationLanguage('ja'), true);
assert.equal(isSupportedTranslationLanguage('xx'), false);

const key = createTranslationCacheKey({ route: '/user-guide/user-stories-use-cases/', contentHash: 'abc123', targetLanguage: 'es' });
assert.match(key, /user-guide%2Fuser-stories-use-cases/);
assert.match(key, /abc123/);
assert.match(key, /es/);
clearTranslationCache();
assert.equal(getCachedTranslation(key), null);
setCachedTranslation(key, { translated: true }, 1000, 500);
assert.deepEqual(getCachedTranslation(key, 1200), { translated: true });
assert.equal(getCachedTranslation(key, 1600), null);

const segments = extractTranslationSegments(`---
title: Demo
---

import Note from './Note.astro';

# Heading

This is a paragraph with [a link](/tools/overview/).

<Note>Do not keep tags but keep useful body copy.</Note>
`);
assert.deepEqual(segments, [
  'This is a paragraph with a link.',
  'Do not keep tags but keep useful body copy.',
]);

process.env.DOCS_TRANSLATION_PROVIDER = 'passthrough';
const translated = await translateSegments({ segments: ['Hello docs'], targetLanguage: 'es' });
assert.deepEqual(translated, { provider: 'passthrough', segments: ['Hello docs'] });

process.stdout.write(`${JSON.stringify({ ok: true }, null, 2)}\n`);
