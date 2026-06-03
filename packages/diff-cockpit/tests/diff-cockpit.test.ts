import { describe, expect, test } from 'bun:test';

import {
  buildDiffCockpitUrl,
  buildFileTree,
  createGithubPullRequestIndexLoader,
  createGithubPullRequestLoader,
  createWorker,
  parsePullRequestLocator,
  renderIndexPage,
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

describe('createGithubPullRequestIndexLoader', () => {
  test('fetches live open PR data for the wiki-inspired index', async () => {
    const calls: string[] = [];
    const fetcher = async (input: string | URL): Promise<Response> => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith('/pulls?state=open&sort=updated&direction=desc&per_page=100&page=1')) {
        return Response.json([
          {
            number: 722,
            title: 'Stream/diff-cockpit',
            html_url: 'https://github.com/consuelohq/opensaas/pull/722',
            state: 'open',
            draft: false,
            updated_at: '2026-06-03T05:04:00Z',
            created_at: '2026-06-03T03:44:00Z',
            user: { login: 'ko' },
            head: { ref: 'stream/diff-cockpit', sha: 'abc123' },
            base: { ref: 'main', sha: 'def456' },
          },
        ]);
      }
      if (url.endsWith('/pulls?state=open&sort=updated&direction=desc&per_page=100&page=2')) {
        return Response.json([]);
      }
      throw new Error(`unexpected index url ${url}`);
    };

    const loader = createGithubPullRequestIndexLoader({ fetcher });
    const result = await loader({ owner: 'consuelohq', repo: 'opensaas' });

    expect(calls).toEqual([
      'https://api.github.com/repos/consuelohq/opensaas/pulls?state=open&sort=updated&direction=desc&per_page=100&page=1',
      'https://api.github.com/repos/consuelohq/opensaas/pulls?state=open&sort=updated&direction=desc&per_page=100&page=2',
    ]);
    expect(result.pulls).toHaveLength(1);
    expect(result.pulls[0]).toMatchObject({
      number: 722,
      title: 'Stream/diff-cockpit',
      kind: 'stream',
      cockpitUrl: '/consuelohq/opensaas/pull/722',
    });
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

      if (url.endsWith('/pulls/708/files?per_page=100&page=1')) {
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

      if (url.endsWith('/pulls/708/files?per_page=100&page=2')) {
        return Response.json([]);
      }

      if (url.endsWith('/pulls/708/reviews?per_page=100&page=1')) {
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

      if (url.endsWith('/pulls/708/reviews?per_page=100&page=2')) {
        return Response.json([]);
      }

      if (url.endsWith('/issues/708/comments?per_page=100&page=1')) {
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

      if (url.endsWith('/issues/708/comments?per_page=100&page=2')) {
        return Response.json([]);
      }

      if (url.endsWith('/pulls/708/comments?per_page=100&page=1')) {
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

      if (url.endsWith('/pulls/708/comments?per_page=100&page=2')) {
        return Response.json([]);
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

    expect(calls).toContain('https://api.github.com/repos/consuelohq/opensaas/pulls/708');
    expect(calls).toContain('https://api.github.com/repos/consuelohq/opensaas/pulls/708/files?per_page=100&page=1');
    expect(calls).toContain('https://api.github.com/repos/consuelohq/opensaas/pulls/708/files?per_page=100&page=2');
    expect(calls).toContain('https://api.github.com/repos/consuelohq/opensaas/pulls/708/reviews?per_page=100&page=1');
    expect(calls).toContain('https://api.github.com/repos/consuelohq/opensaas/pulls/708/reviews?per_page=100&page=2');
    expect(calls).toContain('https://api.github.com/repos/consuelohq/opensaas/issues/708/comments?per_page=100&page=1');
    expect(calls).toContain('https://api.github.com/repos/consuelohq/opensaas/issues/708/comments?per_page=100&page=2');
    expect(calls).toContain('https://api.github.com/repos/consuelohq/opensaas/pulls/708/comments?per_page=100&page=1');
    expect(calls).toContain('https://api.github.com/repos/consuelohq/opensaas/pulls/708/comments?per_page=100&page=2');
    expect(calls).toContain('https://api.github.com/repos/consuelohq/opensaas/commits?sha=stream%2Fos&per_page=10');
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

  test('throws a clear error when GitHub PR metadata fails', async () => {
    const loader = createGithubPullRequestLoader({
      fetcher: async () => new Response('nope', { status: 500 }),
    });

    await expect(loader({ owner: 'consuelohq', repo: 'opensaas', number: 708 })).rejects.toThrow(
      'GitHub live pull request load failed: GitHub pull request fetch failed: 500',
    );
  });

  test('skips stream commits for non-stream branches', async () => {
    const calls: string[] = [];
    const fetcher = async (input: string | URL): Promise<Response> => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith('/pulls/44')) {
        return Response.json({
          number: 44,
          title: 'Task branch',
          html_url: 'https://github.com/consuelohq/opensaas/pull/44',
          state: 'open',
          draft: false,
          user: { login: 'ko' },
          head: { ref: 'task/diff-cockpit/example', sha: 'abc123' },
          base: { ref: 'stream/diff-cockpit', sha: 'def456' },
        });
      }
      if (url.includes('/files?') || url.includes('/reviews?') || url.includes('/comments?')) {
        return Response.json([]);
      }
      throw new Error(`unexpected non-stream url ${url}`);
    };

    const loader = createGithubPullRequestLoader({ fetcher });
    const result = await loader({ owner: 'consuelohq', repo: 'opensaas', number: 44 });

    expect(result.streamCommits).toEqual([]);
    expect(calls.some((url) => url.includes('/commits?sha='))).toBe(false);
  });

  test('handles empty file, comment, and review arrays', async () => {
    const fetcher = async (input: string | URL): Promise<Response> => {
      const url = String(input);
      if (url.endsWith('/pulls/12')) {
        return Response.json({
          number: 12,
          title: 'Empty PR',
          html_url: 'https://github.com/consuelohq/opensaas/pull/12',
          state: 'open',
          draft: false,
          user: { login: 'ko' },
          head: { ref: 'task/example', sha: 'abc123' },
          base: { ref: 'main', sha: 'def456' },
        });
      }
      if (url.includes('/files?') || url.includes('/reviews?') || url.includes('/comments?')) {
        return Response.json([]);
      }
      throw new Error(`unexpected empty url ${url}`);
    };

    const loader = createGithubPullRequestLoader({ fetcher });
    const result = await loader({ owner: 'consuelohq', repo: 'opensaas', number: 12 });

    expect(result.files).toEqual([]);
    expect(result.comments).toEqual([]);
    expect(result.tree.children).toEqual([]);
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

describe('renderIndexPage', () => {
  test('renders the Consuelo Wiki-inspired shell for live PR index review', () => {
    const html = renderIndexPage({ owner: 'consuelohq', repo: 'opensaas' });

    expect(html).toContain('Consuelo Diffs');
    expect(html).toContain('Recently Updated');
    expect(html).toContain('data-search-toggle');
    expect(html).toContain('id="diff-cockpit-search"');
    expect(html).toContain('font-family: "Geist Mono"');
    expect(html).toContain('@media (prefers-color-scheme: dark)');
    expect(html).toContain('font-size:16px');
    expect(html).toContain('data-filter="stream"');
    expect(html).toContain('data-filter="task"');
    expect(html).toContain('data-filter="failing"');
    expect(html).toContain('<details class="section" id="recently-updated" open');
    expect(html).toContain('/api/consuelohq/opensaas/pulls');
    expect(html).toContain('const routePrefix = \"/consuelohq/opensaas/pull/\"');
    expect(html).not.toContain('.post-item { border');
  });
});

describe('renderReviewPage', () => {
  test('keeps the existing PR route and the right review panel closed by default', () => {
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
    expect(html).toContain('loadLiveData();');
    expect(html).toContain('loadViewerLibraries();');
    expect(html.indexOf('loadLiveData();')).toBeLessThan(html.indexOf('loadViewerLibraries();'));
    expect(html).not.toContain(']).finally(loadLiveData)');
    const script = html.split('<script type="module">')[1]?.split('</script>')[0] ?? '';
    expect(script).toContain('buildCommentsMarkdown');
    expect(script).toContain('renderLongDiffs();');
    expect(script).toContain('scrollToFile(state.selected);');
    expect(script).toContain('class=\"diff-file\"');
    expect(script).not.toContain('new state.diffModule.FileDiff');
    expect(() => new Function(script || '')).not.toThrow();
  });
});

describe('createWorker', () => {
  test('routes the homepage to the live PR index shell', async () => {
    const worker = createWorker({ fetcher: async () => Response.json([]) });
    const response = await worker.fetch(new Request('https://diffs.consuelohq.com/'));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('Consuelo Diffs');
  });
});
