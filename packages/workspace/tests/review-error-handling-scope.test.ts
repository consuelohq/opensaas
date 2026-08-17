import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const helperModules = [
  '../scripts/lib/review-static-rules.js',
  '../../os/scripts/lib/review-static-rules.js',
] as const;

describe.each(helperModules)('%s error-handling scope', (helperModule) => {
  it('does not attribute an await in the next function to the previous async function', () => {
    const { findUnhandledAsyncAwaitLines } = require(helperModule) as {
      findUnhandledAsyncAwaitLines: (lines: string[]) => number[];
    };
    const lines = [
      "const message = 'async function with await but no try/catch within 30 lines';",
      'async function delegatesWithoutAwait() {',
      '  return Promise.resolve(1);',
      '}',
      '',
      'async function ownsAwaitWithoutCatch({ value: inputValue }) {',
      '  const value = await Promise.resolve(2);',
      '  return value;',
      '}',
    ];

    expect(findUnhandledAsyncAwaitLines(lines)).toEqual([6]);
  });

  it('accepts an await when its own function has a try/catch', () => {
    const { findUnhandledAsyncAwaitLines } = require(helperModule) as {
      findUnhandledAsyncAwaitLines: (lines: string[]) => number[];
    };
    const lines = [
      'async function handled() {',
      '  try {',
      '    return await Promise.resolve(1);',
      ['  } cat', 'ch (error) {'].join(''),
      '    throw error;',
      '  }',
      '}',
    ];

    expect(findUnhandledAsyncAwaitLines(lines)).toEqual([]);
  });
});
