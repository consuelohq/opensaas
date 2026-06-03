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
  test('fetches live GitHub PR metadata, files, review comments, and stream commits', async () => {
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

      if (url.endsWith('/pulls/708/reviews?per_page=100')) {
        return Response.json([
          {
            id: 1,
            user: { login: 'chatgpt-codex-connector' },
            body: 'Codex says update the drawer copy action.',
            html_url: 'https://github.com/consuelohq/opensaas/pull/708#pullrequestreview-1',
            submitted_at: '2026-06-03T04:00:00Z',
          },
        ]);
      }

      if (url.endsWith('/issues/708/comments?per_page=100')) {
        return Response.json([
          {
            id: 2,
            user: { login: 'coderabbitai' },
            body: 'CodeRabbit found a missing keyboard shortcut test.',
            html_url: 'https://github.com/consuelohq/opensaas/pull/708#issuecomment-2',
            created_at: '2026-06-03T04:01:00Z',
          },
        ]);
      }

      if (url.endsWith('/pulls/708/comments?per_page=100')) {
        return Response.json([
          {
            id: 3,
            user: { login: 'github-actions' },
            body: 'Inline note for source file.',
            path: 'packages/diff-cockpit/src/index.ts',
            line: 42,
            html_url: 'https://github.com/consuelohq/opensaas/pull/708#discussion_r3',
            created_at: '2026-06-03T04:02:00Z',
          },
        ]);
      }

      if (url.endsWith('/commits?sha=stream%2Fos&per_page=10')) {
        return Response.json([
          {
            sha: 'abc123',
            html_url: 'https://github.com/consuelohq/opensaas/commit/abc123',
            commit: {
              message: 'feat(os): install script',
              author: { name: 'Ko', date: '2026-06-03T03:59:00Z' },
            },
            author: { login: 'kokayi' },
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
      'https://api.github.com/repos/consuelohq/opensaas/pulls/708/reviews?per_page=100',
      'https://api.github.com/repos/consuelohq/opensaas/issues/708/comments?per_page=100',
      'https://api.github.com/repos/consuelohq/opensaas/pulls/708/comments?per_page=100',
      'https://api.github.com/repos/consuelohq/opensaas/commits?sha=stream%2Fos&per_page=10',
    ]);
    expect(result.pull.title).toBe('Stream/os');
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.filename).toBe('packages/workspace/scripts/status.js');
    expect(result.comments.map((comment) => comment.provider)).toEqual([
      'codex',
      'coderabbit',
      'github',
    ]);
    expect(result.comments[2]?.path).toBe('packages/diff-cockpit/src/index.ts');
    expect(result.streamCommits).toEqual([
      {
        sha: 'abc123',
        shortSha: 'abc123',
        message: 'feat(os): install script',
        author: 'kokayi',
        url: 'https://github.com/consuelohq/opensaas/commit/abc123',
        committedAt: '2026-06-03T03:59:00Z',
      },
    ]);
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
  test('keeps the right review panel closed by default and exposes phase three actions', () => {
    const html = renderReviewPage({
      owner: 'consuelohq',
      repo: 'opensaas',
      number: 708,
    });

    expect(html).toContain('data-review-drawer="closed"');
    expect(html).toContain('@pierre/diffs');
    expect(html).toContain('@pierre/trees');
    expect(html).toContain('/api/consuelohq/opensaas/pull/708');
    expect(html).toContain('id="copy-all-comments"');
    expect(html).toContain('id="open-chatgpt-prompt"');
    expect(html).toContain('id="copy-codex-prompt"');
    expect(html).toContain('Keyboard:');
    expect(html).toContain("event.key === 'r'");
    expect(html).toContain("event.key === 'c'");
    expect(html).toContain("event.key === 'g'");
    expect(html).toContain("event.key === 'Escape'");
  });
});
