import { test, expect } from 'bun:test';
import { hasCurrentScriptEvidence } from './current-evidence';
test.each([
  'The clinic stopped accepting walk-ins.',
  'Our laboratory ceased processing samples.',
  'The office finished reviewing the request yesterday.',
])('past aspect is historical without a personal subject: %s', (text) => {
  expect(hasCurrentScriptEvidence(text)).toBe(false);
});
test.each([
  'The required training is confusing.',
  'Our laboratory is processing samples.',
  'The office is reviewing the request.',
  'The completed request needs a signature.',
])(
  'current noun subjects and participial adjectives remain eligible: %s',
  (text) => {
    expect(hasCurrentScriptEvidence(text)).toBe(true);
  },
);
