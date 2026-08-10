import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(
  resolve(import.meta.dirname, '../src/pages/os/launcher.astro'),
  'utf8',
);

test('OS launcher routes workspace surfaces to the workspace host', () => {
  assert.match(source, /https:\/\/workspace\.consuelohq\.com/);
  for (const pathname of [
    '/gtm',
    '/artifacts',
    '/observability',
    '/diffs',
    '/tools',
    '/environments',
    '/secrets',
  ]) {
    assert.match(source, new RegExp(`workspaceUrl\\('${pathname}'\\)`));
    assert.doesNotMatch(source, new RegExp(`href: '${pathname}'`));
  }
});
