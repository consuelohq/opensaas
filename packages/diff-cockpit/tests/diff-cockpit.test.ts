import { describe, expect, test } from 'bun:test';

import {
  buildDiffCockpitUrl,
  buildFileTree,
  createGithubPullRequestLoader,
  parsePullRequestLocator,
  renderReviewPage,
} from '../src/index';

describe('parsePullRequestLocator', () => {
  test('accepts a bare PR number with a default repo', () => {
    expect(parsePullRequestLocator('708', 'consuelohq/opensaas')).toEqual({
      owner: 'consuelohq',
      repo: 'opensaas',
      number: 708,
    });
  });

  test('accepts a GitHub PR URL', () => {
    expect(
      parsePullRequestLocator(
        'https://github.com/consuelohq/opensaas/pull/708',
      ),
    ).toEqual({ owner: 'consuelohq', repo: 'opensaas', number: 708 });
  });

  test('accepts the cockpit route shape', () => {
    expect(
      parsePullRequestLocator('/consuelohq/opensaas/pull/708'),
    ).toEqual({ owner: 'consuelohq', repo: 'opensaas', number: 708 });
  });
});

describe('buildDiffCockpitUrl', () => {
  test('builds the canonical diffs.consuelohq.com URL', () => {
    expect(buildDiffCockpitUrl({ owner: 'consuelohq', repo: 'opensaas', number: 708 })).toBe(
      'https://diffs.consuelohq.com/consuelohq/opensaas/pull/708',
    );
  });
});

describe('createGithubPullRequestLoader', () => {
  test('fetches live GitHub PR metadata and files', async () => {
    const calls: string[] = [];
    const fetcher = async (input: string | URL): Promise<Response> => {
      const url = String(input);
      calls.push(url);

      if (url.endsWith('/pulls/708')) {
        return Response.json({
          number: 708,
          title: 'Stream/os',
          html_url: 'https://github.com/consuelohq/opensaas/pull/708',
          state: 'open',
          draft: false,
          user: { login: 'ko' },
          head: { ref: 'stream/os', sha: 'abc123' },
          base: { ref: 'main', sha: 'def456' },
        });
      }

      if (url.endsWith('/pulls/708/files?per_page=100')) {
        return Response.json([
          {
            filename: 'packages/workspace/scripts/status.js',
            status: 'modified',
            additions: 2,
            deletions: 1,
            changes: 3,
            patch: '@@ -1 +1 @@\n-old\n+new',
            blob_url: 'https://github.com/consuelohq/opensaas/blob/abc/packages/workspace/scripts/status.js',
          },
        ]);
      }

      throw new Error(`unexpected url ${url}`);
    };

    const loader = createGithubPullRequestLoader({ fetcher });
    const result = await loader({ owner: 'consuelohq', repo: 'opensaas', number: 708 });

    expect(calls).toEqual([
      'https://api.github.com/repos/consuelohq/opensaas/pulls/708',
      'https://api.github.com/repos/consuelohq/opensaas/pulls/708/files?per_page=100',
    ]);
    expect(result.pull.title).toBe('Stream/os');
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.filename).toBe('packages/workspace/scripts/status.js');
  });
});

describe('buildFileTree', () => {
  test('groups files by path segment and preserves file metadata', () => {
    const tree = buildFileTree([
      {
        filename: 'packages/workspace/scripts/status.js',
        status: 'modified',
        additions: 2,
        deletions: 1,
        changes: 3,
        patch: 'patch',
        blobUrl: 'https://example.com/status.js',
      },
      {
        filename: 'packages/os/scripts/bootstrap.sh',
        status: 'added',
        additions: 10,
        deletions: 0,
        changes: 10,
        patch: 'patch',
        blobUrl: 'https://example.com/bootstrap.sh',
      },
    ]);

    expect(tree.children.map((child) => child.name)).toEqual(['packages']);
    const packages = tree.children[0];
    expect(packages?.children.map((child) => child.name)).toEqual(['workspace', 'os']);
  });
});

describe('renderReviewPage', () => {
  test('keeps the right review panel closed by default', () => {
    const html = renderReviewPage({
      owner: 'consuelohq',
      repo: 'opensaas',
      number: 708,
    });

    expect(html).toContain('data-review-drawer="closed"');
    expect(html).toContain('@pierre/diffs');
    expect(html).toContain('@pierre/trees');
    expect(html).toContain('/api/consuelohq/opensaas/pull/708');
  });
});
