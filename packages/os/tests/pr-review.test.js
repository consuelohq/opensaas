import { createRequire } from 'node:module';
import { expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const { classifyAuthor, flattenPaginatedJson } = require('../scripts/pr-review.js');

test('legacy pr-review wrapper re-exports the normalized collector helpers', () => {
  expect(classifyAuthor('openai-codex[bot]')).toBe('codex');
  expect(flattenPaginatedJson([[{ id: 1 }], [{ id: 2 }]])).toEqual([{ id: 1 }, { id: 2 }]);
});
