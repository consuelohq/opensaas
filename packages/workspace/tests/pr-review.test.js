import { createRequire } from 'node:module';
import { expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const {
  classifyAuthor,
  flattenPaginatedJson,
  isNoisyBotSummary,
  mergeCommentsById,
} = require('../scripts/pr-review.js');

test('flattens slurped paginated gh API arrays', () => {
  expect(flattenPaginatedJson([[{ id: 1 }], [{ id: 2 }]])).toEqual([{ id: 1 }, { id: 2 }]);
  expect(flattenPaginatedJson([{ id: 1 }])).toEqual([{ id: 1 }]);
  expect(flattenPaginatedJson(null)).toEqual([]);
});

test('classifies Codex and review bot authors without exact login coupling', () => {
  expect(classifyAuthor('coderabbitai[bot]')).toBe('coderabbit');
  expect(classifyAuthor('qodo-code-review[bot]')).toBe('qodo');
  expect(classifyAuthor('openai-codex[bot]')).toBe('codex');
  expect(classifyAuthor('codex')).toBe('codex');
  expect(classifyAuthor('kokayicobb')).toBe('ko');
});

test('keeps the latest body when comments are fetched from multiple review endpoints', () => {
  expect(mergeCommentsById([
    { id: 1, path: 'a.ts', line: 10, updated_at: '2026-01-01T00:00:00Z', body: 'old', user: { login: 'codex' } },
    { id: 1, path: 'a.ts', line: 10, updated_at: '2026-01-02T00:00:00Z', body: 'new', user: { login: 'codex' } },
  ])).toEqual([
    { id: 1, path: 'a.ts', line: 10, updated_at: '2026-01-02T00:00:00Z', body: 'new', user: { login: 'codex' } },
  ]);
});

test('suppresses non-actionable bot rate-limit summaries but keeps actionable comments', () => {
  expect(isNoisyBotSummary({ user: { login: 'openai-codex[bot]' }, body: 'HTTP 429: secondary rate limit, try again later' })).toBe(true);
  expect(isNoisyBotSummary({ user: { login: 'coderabbitai[bot]' }, body: 'Actionable comments posted: 3\nPlease fix the security assertion.' })).toBe(false);
});
