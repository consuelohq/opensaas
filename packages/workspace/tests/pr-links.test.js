import { expect, test } from 'vitest';

const {
  buildGitHubPullRequestUrl,
  buildGraphitePullRequestUrl,
  getBranchSlug,
  slugifyGraphitePath,
} = require('../scripts/lib/pr-links');

test('builds Graphite PR URLs from repo, number, and slug source', () => {
  expect(buildGraphitePullRequestUrl('consuelohq/opensaas', 400, 'add operator cleanup and navi cheats')).toBe(
    'https://app.graphite.com/github/pr/consuelohq/opensaas/400/add-operator-cleanup-and-navi-cheats',
  );
});

test('keeps GitHub PR URL generation available for machine metadata', () => {
  expect(buildGitHubPullRequestUrl('consuelohq/opensaas', 400)).toBe(
    'https://github.com/consuelohq/opensaas/pull/400',
  );
});

test('slugifies Graphite URL paths', () => {
  expect(slugifyGraphitePath('Stream/workspace-agents')).toBe('stream-workspace-agents');
  expect(slugifyGraphitePath('  Fix: Redis metadata login resilience!  ')).toBe('fix-redis-metadata-login-resilience');
});

test('extracts the final segment from task branches', () => {
  expect(getBranchSlug('task/workspace-agents/add-operator-cleanup-and-navi-cheats')).toBe(
    'add-operator-cleanup-and-navi-cheats',
  );
});
