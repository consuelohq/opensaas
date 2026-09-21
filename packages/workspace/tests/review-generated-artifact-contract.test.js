import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const reviewSource = readFileSync(
  resolve(import.meta.dirname, '../scripts/review.js'),
  'utf8',
);

test('review keeps generated artifacts in project validation but skips hand-written static heuristics', () => {
  assert.match(reviewSource, /function isGeneratedArtifactFile\(filePath\)/);
  assert.match(reviewSource, /filePath\.includes\('\/generated\/'\)/);
  assert.match(reviewSource, /filePath\.includes\('\/generated-metadata\/'\)/);
  assert.match(
    reviewSource,
    /if \(isGeneratedArtifactFile\(file\)\) continue;/,
  );
  assert.doesNotMatch(
    reviewSource,
    /function isReviewableFile\(filePath\)[\s\S]{0,300}isGeneratedArtifactFile/,
  );
});
