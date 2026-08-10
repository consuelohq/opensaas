import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(
  resolve(import.meta.dirname, '../src/pages/os/launcher.astro'),
  'utf8',
);

test('should route workspace surfaces through the configured deployment origin', () => {
  assert.match(source, /PUBLIC_CONSUELO_WORKSPACE_ORIGIN/);
  assert.match(source, /https:\/\/workspace\.consuelohq\.com/);
  assert.match(source, /new URL\(pathname, workspaceOrigin\)/);
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
