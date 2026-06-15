import { describe, expect, test } from 'bun:test';

import {
  buildDiffCockpitUrl,
  buildFileTree,
  createGithubCodeBrowserLoader,
  createGithubCodeHistoryLoader,
  createGithubPullRequestIndexLoader,
  createGithubPullRequestLoader,
  createWorker,
  deriveAssociatedStream,
  groupPullRequestSummaries,
  normalizeReviewItems,
  parsePullRequestLocator,
  renderCodeBrowserPage,
  renderHistoryPage,
  renderIndexPage,
  renderReviewPage,
  scorePullRequestSearch,
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

describe('normalizeReviewItems', () => {
  test('keeps GitHub review thread resolution as source of truth for AI comments', () => {
    const items = normalizeReviewItems(
      [
        {
          id: 'issue-1',
          provider: 'coderabbit',
          author: 'coderabbitai',
          body: 'Top-level CodeRabbit summary.',
          url: 'https://github.com/consuelohq/opensaas/pull/708#issuecomment-1',
          createdAt: '2026-06-03T04:00:00Z',
          source: 'issue-comment',
        },
        {
          id: 'review-2',
          provider: 'codex',
          author: 'chatgpt-codex-connector',
          body: 'Inline Codex finding.',
          url: 'https://github.com/consuelohq/opensaas/pull/708#discussion_r2',
          createdAt: '2026-06-03T04:01:00Z',
          source: 'review-comment',
          path: 'packages/diff-cockpit/src/index.ts',
          line: 42,
        },
      ],
      [
        {
          id: 'PRRT_123',
          isResolved: true,
          isOutdated: false,
          path: 'packages/diff-cockpit/src/index.ts',
          line: 42,
          comments: [
            {
              id: 'PRRC_2',
              databaseId: 'review-2',
              provider: 'codex',
              author: 'chatgpt-codex-connector',
              body: 'Inline Codex finding.',
              url: 'https://github.com/consuelohq/opensaas/pull/708#discussion_r2',
              createdAt: '2026-06-03T04:01:00Z',
              path: 'packages/diff-cockpit/src/index.ts',
              line: 42,
            },
          ],
        },
      ],
    );

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      provider: 'coderabbit',
      source: 'issue-comment',
      canResolve: false,
      isResolved: false,
      resolutionSource: 'local',
    });
    expect(items[1]).toMatchObject({
      provider: 'codex',
      source: 'review-thread',
      threadId: 'PRRT_123',
      commentNodeId: 'PRRC_2',
      canResolve: true,
      isResolved: true,
      resolutionSource: 'github',
      path: 'packages/diff-cockpit/src/index.ts',
      line: 42,
    });
  });
});


describe('createGithubCodeBrowserLoader', () => {
  test('loads the packages tree with latest commit metadata and commit count', async () => {
    const calls: string[] = [];
    const fetcher = async (input: string | URL): Promise<Response> => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith('/contents/packages?ref=main')) {
        return Response.json([
          { name: 'os', path: 'packages/os', type: 'dir', html_url: 'https://github.com/consuelohq/opensaas/tree/main/packages/os', sha: 'ossha' },
          { name: 'README.md', path: 'packages/README.md', type: 'file', html_url: 'https://github.com/consuelohq/opensaas/blob/main/packages/README.md', sha: 'readmesha', download_url: 'https://raw.githubusercontent.test/readme' },
        ]);
      }
      if (url.endsWith('/commits?sha=main&path=packages&per_page=1')) {
        return new Response(JSON.stringify([{ sha: 'latestsha', html_url: 'https://github.com/consuelohq/opensaas/commit/latestsha', commit: { message: 'Stream/os (#770)', author: { name: 'Ko', date: '2026-06-05T04:00:00Z' } }, author: { login: 'kokayicobb' } }]), { headers: { 'content-type': 'application/json', link: '<https://api.github.com/repos/consuelohq/opensaas/commits?sha=main&path=packages&per_page=1&page=123>; rel="last"' } });
      }
      if (url.endsWith('/commits?sha=main&path=packages%2Fos&per_page=1')) {
        return Response.json([{ sha: 'oscommit', html_url: 'https://github.com/consuelohq/opensaas/commit/oscommit', commit: { message: 'Stream/os (#770)', author: { name: 'Ko', date: '2026-06-05T04:01:00Z' } }, author: { login: 'kokayicobb' } }]);
      }
      if (url.endsWith('/commits?sha=main&path=packages%2FREADME.md&per_page=1')) {
        return Response.json([{ sha: 'readmecommit', html_url: 'https://github.com/consuelohq/opensaas/commit/readmecommit', commit: { message: 'docs(packages): update readme', author: { name: 'Ko', date: '2026-06-05T04:02:00Z' } }, author: { login: 'kokayicobb' } }]);
      }
      throw new Error('unexpected code browser url ' + url);
    };

    const result = await createGithubCodeBrowserLoader({ fetcher })({ owner: 'consuelohq', repo: 'opensaas', ref: 'main', path: 'packages' });

    expect(calls).toContain('https://api.github.com/repos/consuelohq/opensaas/contents/packages?ref=main');
    expect(result.commitCount).toBe(123);
    expect(result.entries.map((entry) => entry.name)).toEqual(['os', 'README.md']);
    expect(result.entries[0]).toMatchObject({ type: 'dir', latestCommitMessage: 'Stream/os (#770)', latestCommitAuthor: 'kokayicobb' });
    expect(result.entries[1]).toMatchObject({ type: 'file', latestCommitMessage: 'docs(packages): update readme' });
  });

  test('renders markdown file contents when the selected file is markdown', async () => {
    const fetcher = async (input: string | URL): Promise<Response> => {
      const url = String(input);
      if (url.endsWith('/contents/packages%2FREADME.md?ref=main')) {
        return Response.json({ name: 'README.md', path: 'packages/README.md', type: 'file', html_url: 'https://github.com/consuelohq/opensaas/blob/main/packages/README.md', sha: 'sha', content: btoa('# Packages\n\nHello **workspace**'), encoding: 'base64' });
      }
      if (url.includes('/commits?sha=main&path=packages%2FREADME.md&per_page=1')) {
        return Response.json([{ sha: 'readmecommit', html_url: 'https://github.com/consuelohq/opensaas/commit/readmecommit', commit: { message: 'docs(packages): update readme', author: { name: 'Ko', date: '2026-06-05T04:02:00Z' } }, author: { login: 'kokayicobb' } }]);
      }
      throw new Error('unexpected markdown url ' + url);
    };
    const result = await createGithubCodeBrowserLoader({ fetcher })({ owner: 'consuelohq', repo: 'opensaas', ref: 'main', path: 'packages/README.md' });
    expect(result.file?.renderedHtml).toContain('<h1>Packages</h1>');
    expect(result.file?.renderedHtml).toContain('<strong>workspace</strong>');
  });
});

describe('createGithubCodeHistoryLoader', () => {
  test('loads path history and builds commit tree links', async () => {
    const fetcher = async (input: string | URL): Promise<Response> => {
      const url = String(input);
      if (url.endsWith('/commits?sha=main&path=packages&per_page=100&page=1')) {
        return Response.json([
          { sha: 'abc123456789', html_url: 'https://github.com/consuelohq/opensaas/commit/abc123', commit: { message: 'Stream/os (#770)', author: { name: 'Ko', date: '2026-06-05T04:00:00Z' } }, author: { login: 'kokayicobb' } },
        ]);
      }
      if (url.endsWith('/commits?sha=main&path=packages&per_page=100&page=2')) return Response.json([]);
      throw new Error('unexpected history url ' + url);
    };
    const result = await createGithubCodeHistoryLoader({ fetcher })({ owner: 'consuelohq', repo: 'opensaas', ref: 'main', path: 'packages' });
    expect(result.commits[0]).toMatchObject({ shortSha: 'abc1234', treeUrl: '/consuelohq/opensaas/tree/abc123456789/packages' });
  });
});

describe('createGithubPullRequestIndexLoader', () => {
  test('fetches all PR states and enriches homepage metadata', async () => {
    const calls: string[] = [];
    const fetcher = async (input: string | URL): Promise<Response> => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith('/pulls?state=open&sort=updated&direction=desc&per_page=100&page=1')) {
        return Response.json([
          { number: 722, title: 'Stream/diff-cockpit', html_url: 'https://github.com/consuelohq/opensaas/pull/722', state: 'open', draft: false, updated_at: '2026-06-03T05:04:00Z', created_at: '2026-06-03T03:44:00Z', user: { login: 'ko' }, head: { ref: 'stream/diff-cockpit', sha: 'streamsha' }, base: { ref: 'main', sha: 'basesha' } },
          { number: 734, title: 'rework home screen', html_url: 'https://github.com/consuelohq/opensaas/pull/734', state: 'open', draft: false, updated_at: '2026-06-03T07:32:00Z', created_at: '2026-06-03T07:30:00Z', user: { login: 'ko' }, head: { ref: 'task/diff-cockpit/rework-home-screen', sha: 'tasksha' }, base: { ref: 'stream/diff-cockpit', sha: 'streamsha' } },
        ]);
      }
      if (url.endsWith('/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=1')) {
        return Response.json([
          { number: 726, title: 'merged drawer work', html_url: 'https://github.com/consuelohq/opensaas/pull/726', state: 'closed', draft: false, updated_at: '2026-06-03T04:30:00Z', created_at: '2026-06-03T04:00:00Z', user: { login: 'ko' }, head: { ref: 'task/diff-cockpit/drawer', sha: 'mergedsha' }, base: { ref: 'stream/diff-cockpit', sha: 'streamsha' } },
        ]);
      }
      if (url.endsWith('/pulls?state=open&sort=updated&direction=desc&per_page=100&page=2')) return Response.json([]);
      if (url.endsWith('/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=1')) return Response.json([]);
      if (url.endsWith('/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=2')) return Response.json([]);
      if (url.endsWith('/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=2')) return Response.json([]);
      if (url.endsWith('/pulls/722')) return Response.json({ number: 722, title: 'Stream/diff-cockpit', html_url: 'https://github.com/consuelohq/opensaas/pull/722', state: 'open', draft: false, additions: 3879, deletions: 32, changed_files: 12, updated_at: '2026-06-03T05:04:00Z', created_at: '2026-06-03T03:44:00Z', user: { login: 'ko' }, head: { ref: 'stream/diff-cockpit', sha: 'streamsha' }, base: { ref: 'main', sha: 'basesha' } });
      if (url.endsWith('/pulls/734')) return Response.json({ number: 734, title: 'rework home screen', html_url: 'https://github.com/consuelohq/opensaas/pull/734', state: 'open', draft: false, additions: 250, deletions: 10, changed_files: 2, updated_at: '2026-06-03T07:32:00Z', created_at: '2026-06-03T07:30:00Z', user: { login: 'ko' }, head: { ref: 'task/diff-cockpit/rework-home-screen', sha: 'tasksha' }, base: { ref: 'stream/diff-cockpit', sha: 'streamsha' } });
      if (url.endsWith('/pulls/726')) return Response.json({ number: 726, title: 'merged drawer work', html_url: 'https://github.com/consuelohq/opensaas/pull/726', state: 'closed', draft: false, additions: 0, deletions: 0, changed_files: 0, merged_at: '2026-06-03T04:30:00Z', closed_at: '2026-06-03T04:30:00Z', updated_at: '2026-06-03T04:30:00Z', created_at: '2026-06-03T04:00:00Z', user: { login: 'ko' }, head: { ref: 'task/diff-cockpit/drawer', sha: 'mergedsha' }, base: { ref: 'stream/diff-cockpit', sha: 'streamsha' } });
      if (url.includes('/commits/streamsha/check-runs')) return Response.json({ check_runs: [{ status: 'completed', conclusion: 'success' }] });
      if (url.includes('/commits/tasksha/check-runs')) return Response.json({ check_runs: [{ status: 'completed', conclusion: 'failure' }] });
      if (url.includes('/commits/mergedsha/check-runs')) return Response.json({ check_runs: [{ status: 'completed', conclusion: 'success' }] });
      if (url.includes('/pulls/722/reviews')) return Response.json(url.endsWith('page=1') ? [{ state: 'APPROVED' }] : []);
      if (url.includes('/pulls/734/reviews')) return Response.json(url.endsWith('page=1') ? [{ state: 'CHANGES_REQUESTED' }] : []);
      if (url.includes('/pulls/726/reviews')) return Response.json(url.endsWith('page=1') ? [{ state: 'COMMENTED' }] : []);
      throw new Error('unexpected index url ' + url);
    };
    const result = await createGithubPullRequestIndexLoader({ fetcher })({ owner: 'consuelohq', repo: 'opensaas' });
    expect(calls).toContain('https://api.github.com/repos/consuelohq/opensaas/pulls?state=open&sort=updated&direction=desc&per_page=100&page=1');
    expect(calls).toContain('https://api.github.com/repos/consuelohq/opensaas/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=1');
    expect(result.warnings).toEqual([]);
    expect(result.pulls[0]).toMatchObject({ number: 722, kind: 'stream', associatedStream: 'stream/diff-cockpit', additions: 3879, deletions: 32, changedFiles: 12, checkStatus: 'unknown', reviewStatus: 'none', lifecycleStatus: 'open' });
    expect(result.pulls[1]).toMatchObject({ number: 734, kind: 'task', associatedStream: 'stream/diff-cockpit', checkStatus: 'unknown', reviewStatus: 'none', lifecycleStatus: 'open' });
    expect(result.pulls[2]).toMatchObject({ number: 726, lifecycleStatus: 'merged', associatedStream: 'stream/diff-cockpit' });
  });
});

describe('createGithubPullRequestLoader', () => {
  test('fetches live GitHub PR metadata, files, review comments, and commits', async () => {
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

      if (url.endsWith('/pulls/708/commits?per_page=100&page=1')) {
        return Response.json([
          { sha: 'prsha1', html_url: 'https://github.com/consuelohq/opensaas/commit/prsha1', commit: { message: 'feat(os): pr commit', author: { name: 'Ko', date: '2026-06-03T03:58:00Z' } }, author: { login: 'kokayi' } },
          { sha: 'prsha2', html_url: 'https://github.com/consuelohq/opensaas/commit/prsha2', commit: { message: 'fix(os): second pr commit', author: { name: 'Ko', date: '2026-06-03T03:57:00Z' } }, author: { login: 'kokayi' } },
        ]);
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

      if (url.endsWith('/commits?sha=stream%2Fos&per_page=100&page=1')) {
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

      if (url.endsWith('/commits?sha=stream%2Fos&per_page=100&page=2')) {
        return Response.json([]);
      }

      throw new Error(`unexpected url ${url}`);
    };

    const loader = createGithubPullRequestLoader({ fetcher });
    const result = await loader({ owner: 'consuelohq', repo: 'opensaas', number: 708 });

    expect(calls).toContain('https://api.github.com/repos/consuelohq/opensaas/pulls/708');
    expect(calls).toContain('https://api.github.com/repos/consuelohq/opensaas/pulls/708/files?per_page=100&page=1');
    expect(calls).toContain('https://api.github.com/repos/consuelohq/opensaas/pulls/708/files?per_page=100&page=2');
    expect(calls).toContain('https://api.github.com/repos/consuelohq/opensaas/pulls/708/commits?per_page=100&page=1');
    expect(calls).toContain('https://api.github.com/repos/consuelohq/opensaas/pulls/708/reviews?per_page=100&page=1');
    expect(calls).toContain('https://api.github.com/repos/consuelohq/opensaas/pulls/708/reviews?per_page=100&page=2');
    expect(calls).toContain('https://api.github.com/repos/consuelohq/opensaas/issues/708/comments?per_page=100&page=1');
    expect(calls).toContain('https://api.github.com/repos/consuelohq/opensaas/issues/708/comments?per_page=100&page=2');
    expect(calls).toContain('https://api.github.com/repos/consuelohq/opensaas/pulls/708/comments?per_page=100&page=1');
    expect(calls).toContain('https://api.github.com/repos/consuelohq/opensaas/pulls/708/comments?per_page=100&page=2');
    expect(calls).toContain('https://api.github.com/repos/consuelohq/opensaas/commits?sha=stream%2Fos&per_page=100&page=1');
    expect(calls).not.toContain('https://api.github.com/repos/consuelohq/opensaas/commits?sha=stream%2Fos&per_page=100&page=2');
    expect(result.pull.title).toBe('Stream/os');
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.filename).toBe('packages/workspace/scripts/status.js');
    expect(result.comments.map((comment) => comment.provider)).toEqual([
      'codex',
      'coderabbit',
      'github',
    ]);
    expect(result.comments[2]?.path).toBe('packages/diff-cockpit/src/index.ts');
    expect(result.commits.map((commit) => commit.shortSha)).toEqual(['prsha1', 'prsha2']);
    expect(result.streamCommits).toEqual([
      {
        sha: 'abc123',
        shortSha: 'abc123',
        message: 'feat(os): install script',
        author: 'kokayi',
        url: 'https://github.com/consuelohq/opensaas/commit/abc123',
        committedAt: '2026-06-03T03:59:00Z',
        additions: 0,
        deletions: 0,
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
      if (url.includes('/files?') || url.includes('/reviews?') || url.includes('/comments?') || url.includes('/pulls/44/commits?')) {
        return Response.json([]);
      }
      throw new Error(`unexpected non-stream url ${url}`);
    };

    const loader = createGithubPullRequestLoader({ fetcher });
    const result = await loader({ owner: 'consuelohq', repo: 'opensaas', number: 44 });

    expect(result.commits).toEqual([]);
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
      if (url.includes('/files?') || url.includes('/reviews?') || url.includes('/comments?') || url.includes('/pulls/12/commits?')) {
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

describe('createGithubPullRequestIndexLoader GraphQL mergeability', () => {
  test('loads all PRs with mergeability in paginated GraphQL requests when token is available', async () => {
    const calls: string[] = [];
    const fetcher = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      calls.push(String(input));
      const body = JSON.parse(String(init?.body ?? '{}'));
      if (body.variables.after) {
        return Response.json({ data: { repository: { pullRequests: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [
          { number: 2, title: 'merged pr', url: 'https://github.com/consuelohq/opensaas/pull/2', state: 'MERGED', isDraft: false, merged: true, mergedAt: '2026-06-03T00:00:00Z', closedAt: '2026-06-03T00:00:00Z', createdAt: '2026-06-03T00:00:00Z', updatedAt: '2026-06-03T00:02:00Z', additions: 2, deletions: 1, changedFiles: 1, mergeStateStatus: 'UNKNOWN', author: { login: 'ko' }, headRefName: 'task/diff-cockpit/merged', headRefOid: 'sha2', baseRefName: 'stream/diff-cockpit', baseRefOid: 'base' },
        ] } } } });
      }
      return Response.json({ data: { repository: { pullRequests: { pageInfo: { hasNextPage: true, endCursor: 'cursor-1' }, nodes: [
        { number: 1, title: 'clean pr', url: 'https://github.com/consuelohq/opensaas/pull/1', state: 'OPEN', isDraft: false, merged: false, mergedAt: null, closedAt: null, createdAt: '2026-06-03T00:00:00Z', updatedAt: '2026-06-03T00:01:00Z', additions: 5, deletions: 3, changedFiles: 2, mergeStateStatus: 'CLEAN', author: { login: 'ko' }, headRefName: 'task/diff-cockpit/clean', headRefOid: 'sha1', baseRefName: 'stream/diff-cockpit', baseRefOid: 'base' },
        { number: 3, title: 'conflict pr', url: 'https://github.com/consuelohq/opensaas/pull/3', state: 'OPEN', isDraft: false, merged: false, mergedAt: null, closedAt: null, createdAt: '2026-06-03T00:00:00Z', updatedAt: '2026-06-03T00:03:00Z', additions: 7, deletions: 4, changedFiles: 3, mergeStateStatus: 'DIRTY', author: { login: 'ko' }, headRefName: 'task/diff-cockpit/conflict', headRefOid: 'sha3', baseRefName: 'stream/diff-cockpit', baseRefOid: 'base' },
      ] } } } });
    };
    const result = await createGithubPullRequestIndexLoader({ fetcher, token: 'token' })({ owner: 'consuelohq', repo: 'opensaas' });
    expect(calls).toEqual(['https://api.github.com/graphql']);
    expect(result.pulls.map((pull) => ({ number: pull.number, mergeability: pull.mergeability, additions: pull.additions, changedFiles: pull.changedFiles }))).toEqual([
      { number: 1, mergeability: 'mergeable', additions: 5, changedFiles: 2 },
      { number: 3, mergeability: 'conflicts', additions: 7, changedFiles: 3 },
    ]);
  });
});

describe('pull request index grouping', () => {
  const basePull = { number: 1, kind: 'task', title: 'Example', htmlUrl: 'https://github.com/consuelohq/opensaas/pull/1', state: 'open', draft: false, author: 'ko', headRef: 'task/diff-cockpit/example', headSha: 'sha', baseRef: 'stream/diff-cockpit', baseSha: 'base', mergeable: true, mergeableState: 'clean', createdAt: '2026-06-03T00:00:00Z', updatedAt: '2026-06-03T00:01:00Z', cockpitUrl: '/consuelohq/opensaas/pull/1', additions: 1, deletions: 0, changedFiles: 1, checkStatus: 'unknown', reviewStatus: 'none', lifecycleStatus: 'open', mergeStatus: 'open', mergedAt: '', closedAt: '', associatedStream: 'stream/diff-cockpit', mergeability: 'mergeable' } as const;
  test('derives stream ownership from stream and task branches', () => {
    expect(deriveAssociatedStream({ ...basePull, headRef: 'stream/os', baseRef: 'main' })).toBe('stream/os');
    expect(deriveAssociatedStream({ ...basePull, headRef: 'task/workspace-agents/fix', baseRef: 'main' })).toBe('stream/workspace-agents');
    expect(deriveAssociatedStream({ ...basePull, headRef: 'fix/random', baseRef: 'stream/diff-cockpit' })).toBe('stream/diff-cockpit');
  });
  test('groups pull requests into collapsible sections and filters by stream', () => {
    const sections = groupPullRequestSummaries([
      { ...basePull, number: 10, kind: 'stream', headRef: 'stream/diff-cockpit' },
      { ...basePull, number: 11, kind: 'task' },
      { ...basePull, number: 12, kind: 'task', lifecycleStatus: 'merged', mergeStatus: 'merged', state: 'closed', mergedAt: '2026-06-03T00:02:00Z' },
      { ...basePull, number: 13, kind: 'open', lifecycleStatus: 'closed', mergeStatus: 'closed', state: 'closed', closedAt: '2026-06-03T00:03:00Z' },
    ]);
    expect(sections.map((section) => section.title)).toEqual(['Streams', 'Merging and recently merged', 'Open', 'Closed']);
    expect(groupPullRequestSummaries([{ ...basePull }, { ...basePull, number: 2, associatedStream: 'stream/os' }], { stream: 'stream/diff-cockpit' }).flatMap((section) => section.pulls.map((pull) => pull.number))).toEqual([1]);
  });
  test('streams section shows open streams by default and all streams when toggled', () => {
    const sections = groupPullRequestSummaries([
      { ...basePull, number: 20, kind: 'stream', headRef: 'stream/diff-cockpit' },
      { ...basePull, number: 21, kind: 'stream', headRef: 'stream/closed', associatedStream: 'stream/closed', lifecycleStatus: 'closed', mergeStatus: 'closed', state: 'closed', closedAt: '2026-06-03T00:03:00Z' },
    ]);
    const allSections = groupPullRequestSummaries([
      { ...basePull, number: 20, kind: 'stream', headRef: 'stream/diff-cockpit' },
      { ...basePull, number: 21, kind: 'stream', headRef: 'stream/closed', associatedStream: 'stream/closed', lifecycleStatus: 'closed', mergeStatus: 'closed', state: 'closed', closedAt: '2026-06-03T00:03:00Z' },
    ], { showAllStreams: true });
    expect(sections.find((section) => section.id === 'streams')?.pulls.map((pull) => pull.number)).toEqual([20]);
    expect(allSections.find((section) => section.id === 'streams')?.pulls.map((pull) => pull.number)).toEqual([20, 21]);
  });
  test('scores dotted fuzzy PR search across PR fields', () => {
    const pull = {
      ...basePull,
      number: 889,
      title: 'hotfix code call codemode facade',
      headRef: 'task/diff-cockpit/hotfix-code-call-codemode-facade',
      associatedStream: 'stream/diff-cockpit',
    };

    const codeCallScore = scorePullRequestSearch(pull, 'code.call');
    const numberScore = scorePullRequestSearch(pull, '889');
    const missingScore = scorePullRequestSearch(pull, 'missing');

    expect(codeCallScore > 0).toBe(true);
    expect(numberScore > missingScore).toBe(true);
    expect(missingScore).toBe(0);
  });
});


describe('renderCodeBrowserPage', () => {
  test('renders the main packages browser shell and history shell', () => {
    const codeHtml = renderCodeBrowserPage({ owner: 'consuelohq', repo: 'opensaas' }, 'main', 'packages');
    expect(codeHtml).toContain('data-code-browser-root');
    expect(codeHtml).toContain('/api/consuelohq/opensaas/code?ref=main&amp;path=packages');
    expect(codeHtml).toContain('data-history-link');
    expect(codeHtml).toContain('/consuelohq/opensaas/history/main/packages');
    expect(codeHtml).toContain('id="code-search"');
    expect(codeHtml).toContain('Press / to search');
    expect(codeHtml).toContain('focusSearch');
    expect(codeHtml).toContain('state.search');
    expect(codeHtml).toContain('No files match');
    expect(codeHtml).toContain('copy-file-path');
    expect(codeHtml).toContain('navigator.clipboard.writeText');
    expect(codeHtml).toContain('.code-hero h1 { font-size:34px;');
    expect(codeHtml).toContain('.code-name { font-weight:500;');
    expect(codeHtml).toContain('code-table-head');
    expect(codeHtml).toContain('Last commit date');
    expect(codeHtml).toContain('.code-message { display:none; }');
    expect(codeHtml).toContain('grid-template-columns:24px minmax(0, 1fr) 116px');
    expect(codeHtml).toContain('history-table-head');
    expect(codeHtml).toContain('history-main');
    expect(codeHtml).toContain('history-meta');
    expect(codeHtml).toContain('main');
    expect(codeHtml).toContain('packages');

    const historyHtml = renderHistoryPage({ owner: 'consuelohq', repo: 'opensaas' }, 'main', 'packages');
    expect(historyHtml).toContain('data-code-history-root');
    expect(historyHtml).toContain('/api/consuelohq/opensaas/history?ref=main&amp;path=packages');
  });
});

describe('renderIndexPage', () => {
  test('renders a Graphite-like PR inbox with command search and load-more sections', () => {
    const html = renderIndexPage({ owner: 'consuelohq', repo: 'opensaas' });

    expect(html).toContain('Consuelo Diffs');
    expect(html).not.toContain('>Pull Requests</a>');
    expect(html).not.toContain('>main</a>');
    expect(html).not.toContain('<h1>Pull Requests</h1>');
    expect(html).toContain('data-sections-root');
    expect(html).toContain('data-stream-filter');
    expect(html).toContain('data-active-stream');
    expect(html).toContain('<details class="section pr-section" open data-section-id="open">');
    expect(html).toContain('<details class="section pr-section" open data-section-id="closed">');
    expect(html).toContain('data-command-trigger');
    expect(html).toContain('data-command-palette');
    expect(html).toContain('id="diff-command-input"');
    expect(html).toContain('Search PRs or jump pages, e.g. code.call');
    expect(html).toContain('class="command-button command-button-plain"');
    expect(html).not.toContain('id="diff-cockpit-search"');
    expect(html).not.toContain('data-search-toggle');
    expect(html).toContain('data-command-page');
    expect(html).toContain('class="mobile-command-fab"');
    expect(html).toContain('command-bottom-drawer');
    expect(html).toContain('const sectionPageSize = 10');
    expect(html).toContain('data-load-more');
    expect(html).toContain('pr-author-avatar');
    expect(html).toContain('renderAuthorAvatar');
    expect(html).toContain('Load more');
    expect(html).not.toContain('data-page-next');
    expect(html).toContain('data-toggle-streams');
    expect(html).toContain('showAllStreams');
    expect(html).toContain("cacheSchemaVersion = 'v4-mergeability-live'");
    expect(html).toContain('clearStaleIndexCaches');
    expect(html).toContain('localStorage.getItem(cacheKey)');
    expect(html).toContain('mergeIndexWithCache');
    expect(html).toContain('localStorage.setItem(cacheKey');
    expect(html).toContain("cache: 'no-cache'");
    expect(html).toContain('refreshIndexIfStale');
    expect(html).toContain('readInitialIndexData');
    expect(html).toContain('diff-cockpit-index-initial-data');
    expect(html).toContain('If-None-Match');
    expect(html).toContain('response.status === 304');
    expect(html).toContain("window.addEventListener('focus'");
    expect(html).not.toContain("document.addEventListener('pointerdown', () => refreshIndexIfStale");
    expect(html).toContain('button:focus:not(:focus-visible)');
    expect(html).toContain('-webkit-tap-highlight-color: transparent');
    expect(html).toContain('pr-title-line');
    expect(html).toContain('pr-subtitle');
    expect(html).toContain("stream + ' • ' + repoLabel + ' #' + pull.number + ' • ' + fileCount");
    expect(html).toContain('stream-compact-button');
    expect(html).toContain('data-card-route');
    expect(html).not.toContain('pr-row-meta-line');
    expect(html).not.toContain("pull.author + ' · #'");
    expect(html).not.toContain("escapeText(pull.headRef) + ' → '");
    expect(html).not.toContain('class="pagination"');
    expect(html).not.toContain('pageSize');
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
    expect(html).toContain('data-ai-sidebar="closed"');
    expect(html).not.toContain('<body class="review-page" data-review-drawer="closed" data-ai-sidebar="open"');
    expect(html).toContain('id="ai-comments-sidebar"');
    expect(html).toContain('id="ai-comments-toggle"');
    expect(html).toContain('aria-label="Comments"');
    expect(html).toContain('<div><strong>Comments</strong>');
    expect(html).not.toContain('AI comments</button>');
    expect(html).not.toContain('<strong>AI comments</strong>');
    expect(html).toContain('@pierre/diffs');
    expect(html).toContain('@pierre/trees');
    expect(html).toContain('/api/consuelohq/opensaas/pull/708');
    expect(html).toContain('id="copy-all-comments"');
    expect(html).toContain('id="open-chatgpt-prompt"');
    expect(html).toContain('id="copy-codex-prompt"');
    expect(html).toContain('Keyboard:');
    expect(html).not.toContain("event.key === 'r'");
    expect(html).toContain("event.key === 'c'");
    expect(html).toContain("event.key === 'g'");
    expect(html).toContain("event.key === 'Escape'");
    expect(html).toContain('loadLiveData();');
    expect(html).toContain('loadViewerLibraries();');
    expect(html).toContain('readInitialReviewData');
    expect(html).toContain('diff-cockpit-initial-etag');
    expect(html).toContain('If-None-Match');
    expect(html).toContain('response.status === 304');
    expect(html.indexOf('loadLiveData();')).toBeLessThan(html.indexOf('loadViewerLibraries();'));
    expect(html).not.toContain(']).finally(loadLiveData)');
    const script = html.split('<script type="module">')[1]?.split('</script>')[0] ?? '';
    expect(script).toContain('buildCommentsMarkdown');
    expect(script).toContain('sortCommitsNewestFirst');
    expect(script).toContain('new Date(right.committedAt || 0).getTime()');
    expect(script).toContain("els.aiCommentsToggle.textContent = formatCountLabel(aiCommentCount, 'comment')");
    expect(html).toContain('data-review-drawer="closed"');
    expect(html).toContain('data-file-pane-collapsed="false"');
    expect(html).toContain('data-comments-visible="true"');
    expect(html).toContain('data-current-view="diff"');
    expect(html).toContain('>Panel</button>');
    expect(html).toContain('<strong>panel</strong>');
    expect(html).toContain('id="mergeability-button"');
    expect(html).toContain('id="merge-pr-button"');
    expect(html).toContain('id="mergeability-popover"');
    expect(html).toContain('id="mergeability-nav-button"');
    expect(html).toContain('id="commit-nav-button"');
    expect(html).not.toContain('>GitHub</a>');
    expect(html).not.toContain('>Graphite</a>');
    expect(html).not.toContain('>DiffsHub</a>');
    expect(html).toContain('id="drawer-status"');
    expect(html).toContain('id="drawer-checks"');
    expect(html).toContain('id="mobile-files-toggle"');
    expect(html).toContain('aria-label="Close files"');
    expect(html).toContain('class="mobile-file-backdrop"');
    expect(html).toContain('body[data-file-pane-drawer="open"] .file-pane');
    expect(html).toContain('@media (max-width: 760px)');
    expect(html).toContain('.layout { height:calc(100dvh - 132px); grid-template-columns:minmax(0, 1fr); }');
    expect(html).toContain('.diff-line { grid-template-columns:34px 34px minmax(0, 1fr); padding:0 6px 0 0; }');
    expect(html).toContain('.diff-gutter { padding-right:4px; }');
    expect(html).toContain('.inline-comment { margin-left:68px; }');
    expect(html).toContain('--paper:#0f0f0d');
    expect(html).toContain('--surface:#191814');
    expect(html).toContain('id="file-pane-resizer"');
    expect(html).toContain('font-family: Inter');
    expect(html).toContain('font-size:13px');
    expect(html).toContain('font-size:12px');
    expect(html).toContain('grid-template-columns:42px 42px minmax(0, 1fr)');
    expect(html).toContain('overflow-x:hidden');
    expect(html).toContain('white-space:pre-wrap');
    expect(html).toContain('overflow-wrap:anywhere');
    expect(html).toContain('grid-template-columns:34px 34px minmax(0, 1fr)');
    expect(html).toContain('height:calc(100dvh - 76px)');
    expect(html).toContain('height:calc(100dvh - 132px)');
    expect(script).toContain('renderLongDiffs();');
    expect(script).toContain("event.key === 'p'");
    expect(script).not.toContain("event.key === 'r'");
    expect(script).toContain("event.key === 'f'");
    expect(script).toContain("event.key === 'm'");
    expect(script).toContain("event.key === 'v'");
    expect(script).toContain("event.key === 'i'");
    expect(script).toContain('renderMarkdown');
    expect(script).toContain('renderInlineComments');
    expect(script).toContain('navigateToComment');
    expect(script).toContain('IntersectionObserver');
    expect(script).toContain('updateActiveFileFromViewport');
    expect(script).toContain('parseHunkHeader');
    expect(script).toContain('oldLine');
    expect(script).toContain('newLine');
    expect(script).toContain('toggleFilePane');
    expect(script).toContain('toggleCurrentView');
    expect(script).toContain('toggleInlineComments');
    expect(script).toContain("setDrawer(document.body.dataset.reviewDrawer !== 'open')");
    expect(script).not.toContain('drawerContent.scrollTo');
    expect(script).toContain('scrollToFile(state.selected);');
    expect(html).not.toContain('scroll-behavior:smooth');
    expect(script).not.toContain("behavior: 'smooth'");
    expect(script).toContain('preserveDiffViewport');
    expect(script).toContain('preserveDiffViewport(() => setDrawer');
    expect(script).toContain('preserveDiffViewport(() => setAiSidebar');
    expect(script).toContain('preserveDiffViewport(() => setFilePaneDrawer');
    expect(script).toContain('captureDiffViewport');
    expect(script).toContain('restoreDiffViewport');
    expect(script).toContain('class=\"diff-file\"');
    expect(script).not.toContain('new state.diffModule.FileDiff');
    expect(html).toContain('id="commit-popover"');
    expect(html).toContain('data-folder-path');
    expect(html).toContain('aria-expanded');
    expect(html).toContain('tree-branch');
    expect(html).toContain('tree-children');
    expect(html).toContain('tree-depth-');
    expect(html).toContain('directory-toggle');
    expect(script).toContain('collapsedFolders');
    expect(script).toContain('toggleFolder');
    expect(script).toContain('data-open-commits');
    expect(script).toContain('renderCommitPopover');
    expect(script).toContain('closeCommitPopover');
    expect(script).toContain('renderMergeabilityPopover');
    expect(script).toContain('closeMergeabilityPopover');
    expect(script).toContain('data-open-mergeability');
    expect(script).toContain('mergePullRequest');
    expect(script).toContain("apiPath + '/merge'");
    expect(script).toContain('event.metaKey || event.ctrlKey');
    expect(script).toContain("mergeabilityLabel");
    expect(script).toContain('Files to inspect before merging');
    expect(script).toContain('relativeCommitTime');
    expect(script).toContain('formatCommitDelta');
    expect(script).toContain('data-comment-jump');
    expect(script).toContain('data-comment-file');
    expect(script).toContain('data-comment-line');
    expect(html).toContain('id="copy-review-link"');
    expect(html).toContain('id="copy-current-commit-link"');
    expect(html).toContain('id="drawer-prompt"');
    expect(html).toContain('data-drawer-section-toggle="checks"');
    expect(html).toContain('data-drawer-section-toggle="comments"');
    expect(html).toContain('data-drawer-section-toggle="commits"');
    expect(script).toContain('renderDrawerSection');
    expect(script).toContain('toggleDrawerSection');
    expect(script).toContain('copyReviewLink');
    expect(script).toContain('copyCurrentCommitLink');
    expect(script).toContain('renderMarkdownBlocks');
    expect(script).toContain('renderAiCommentsSidebar');
    expect(script).toContain('data-ai-review-toggle');
    expect(script).toContain('copyReviewItemField');
    expect(script).toContain('resolveReviewItem');
    expect(script).toContain("apiPath + '/review-threads/'");
    expect(() => new Function(script || '')).not.toThrow();
  });
});

async function githubWebhookSignature(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return 'sha256=' + Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('createWorker', () => {
  test('updates GitHub review threads through the review thread API endpoint', async () => {
    const calls: Array<{ url: string; method?: string; body?: string }> = [];
    const cacheStore = new Map<string, Response>();
    const cache = {
      async match(request: Request): Promise<Response | undefined> {
        const hit = cacheStore.get(request.url);
        return hit ? hit.clone() : undefined;
      },
      async put(request: Request, response: Response): Promise<void> {
        cacheStore.set(request.url, response.clone());
      },
      async delete(request: Request): Promise<boolean> {
        return cacheStore.delete(request.url);
      },
    };
    const cacheKey = 'https://diffs.consuelohq.com/api/consuelohq/opensaas/pull/708?_dcv=v5-review-commit-popovers';
    cacheStore.set(cacheKey, Response.json({ cached: true }));
    const fetcher = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      calls.push({ url: String(input), method: init?.method, body: String(init?.body ?? '') });
      if (String(input) === 'https://api.github.com/graphql') {
        return Response.json({ data: { resolveReviewThread: { thread: { id: 'PRRT_1', isResolved: true } } } });
      }
      throw new Error('unexpected review thread mutation url ' + String(input));
    };
    const worker = createWorker({ fetcher, cache });

    const missingToken = await worker.fetch(new Request('https://diffs.consuelohq.com/api/consuelohq/opensaas/pull/708/review-threads/PRRT_1/resolve', { method: 'POST' }));
    const response = await worker.fetch(
      new Request('https://diffs.consuelohq.com/api/consuelohq/opensaas/pull/708/review-threads/PRRT_1/resolve', { method: 'POST' }),
      { GITHUB_TOKEN: 'token' },
    );
    const payload = await response.json() as { ok: boolean; action: string; edgeInvalidated: boolean; invalidated: string[] };

    expect(missingToken.status).toBe(401);
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, action: 'resolve', edgeInvalidated: true });
    expect(payload.invalidated).toContain('/api/consuelohq/opensaas/pull/708');
    expect(cacheStore.has(cacheKey)).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: 'https://api.github.com/graphql', method: 'POST' });
    expect(calls[0]?.body || '').toContain('resolveReviewThread');
    expect(calls[0]?.body || '').toContain('PRRT_1');
  });

  test('invalidates PR cache for resolved GitHub review-thread webhooks', async () => {
    const cacheStore = new Map<string, Response>();
    const cache = {
      async match(request: Request): Promise<Response | undefined> {
        const hit = cacheStore.get(request.url);
        return hit ? hit.clone() : undefined;
      },
      async put(request: Request, response: Response): Promise<void> {
        cacheStore.set(request.url, response.clone());
      },
      async delete(request: Request): Promise<boolean> {
        return cacheStore.delete(request.url);
      },
    };
    const cacheKey = 'https://diffs.consuelohq.com/api/consuelohq/opensaas/pull/708?_dcv=v5-review-commit-popovers';
    cacheStore.set(cacheKey, Response.json({ cached: true }));
    const body = JSON.stringify({
      action: 'resolved',
      pull_request: { number: 708 },
      repository: { name: 'opensaas', owner: { login: 'consuelohq' } },
      thread: { id: 'PRRT_1' },
    });
    const signature = await githubWebhookSignature(body, 'secret');
    const worker = createWorker({ fetcher: async () => Response.json([]), cache });

    const response = await worker.fetch(new Request('https://diffs.consuelohq.com/api/github/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'pull_request_review_thread',
        'x-hub-signature-256': signature,
      },
      body,
    }), { GITHUB_WEBHOOK_SECRET: 'secret' });
    const payload = await response.json() as { ok: boolean; edgeInvalidated: boolean; invalidated: string[] };

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, edgeInvalidated: true });
    expect(payload.invalidated).toContain('/api/consuelohq/opensaas/pull/708');
    expect(cacheStore.has(cacheKey)).toBe(false);
  });

  test('routes the homepage to the live PR index shell', async () => {
    const worker = createWorker({ fetcher: async () => Response.json([]) });
    const response = await worker.fetch(new Request('https://diffs.consuelohq.com/'));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('Consuelo Diffs');
  });


  test('hydrates PR pages from shared API cache when available', async () => {
    const file = { filename: 'packages/cached.ts', status: 'modified', additions: 1, deletions: 1, changes: 2, patch: '@@ -1 +1 @@\n-old\n+new', blobUrl: '' };
    const cachedReviewData = {
      locator: { owner: 'consuelohq', repo: 'opensaas', number: 708 },
      pull: {
        number: 708,
        title: 'Cached PR',
        htmlUrl: 'https://github.com/consuelohq/opensaas/pull/708',
        state: 'open',
        draft: false,
        author: 'ko',
        headRef: 'task/cache',
        headSha: 'headsha',
        baseRef: 'stream/diff-cockpit',
        baseSha: 'basesha',
        mergeable: true,
        mergeableState: 'clean',
        updatedAt: '2026-06-09T00:00:00Z',
      },
      files: [file],
      tree: { type: 'root', name: '', path: '', children: [{ type: 'file', name: 'cached.ts', path: 'packages/cached.ts', children: [], file }] },
      comments: [],
      streamCommits: [],
      warnings: [],
      checks: [],
    };
    const cacheStore = new Map<string, Response>([
      ['https://diffs.consuelohq.com/api/consuelohq/opensaas/pull/708?_dcv=v5-review-commit-popovers', Response.json(cachedReviewData)],
    ]);
    const cache = {
      async match(request: Request): Promise<Response | undefined> {
        const hit = cacheStore.get(request.url);
        return hit ? hit.clone() : undefined;
      },
      async put(request: Request, response: Response): Promise<void> {
        if (response.headers.has('vary')) throw new Error('cache.put rejects Vary response headers');
        cacheStore.set(request.url, response.clone());
      },
      async delete(request: Request): Promise<boolean> {
        return cacheStore.delete(request.url);
      },
    };
    const worker = createWorker({
      cache,
      fetcher: async (input) => {
        throw new Error('unexpected live fetch during cached page render: ' + String(input));
      },
    });

    const response = await worker.fetch(new Request('https://diffs.consuelohq.com/consuelohq/opensaas/pull/708'));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('id="diff-cockpit-initial-data"');
    expect(html).toContain('Cached PR');
    expect(html).toContain('packages/cached.ts');
  });

  test('keeps the PR loading shell when shared API cache misses', async () => {
    const worker = createWorker({ fetcher: async () => Response.json([]) });
    const response = await worker.fetch(new Request('https://diffs.consuelohq.com/consuelohq/opensaas/pull/708'));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('Loading live GitHub data');
    expect(html).not.toContain('id="diff-cockpit-initial-data"');
  });


  test('merges a pull request through the merge API endpoint', async () => {
    const calls: Array<{ url: string; method?: string; body?: string }> = [];
    const fetcher = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      calls.push({ url: String(input), method: init?.method, body: String(init?.body ?? '') });
      if (String(input).endsWith('/repos/consuelohq/opensaas/pulls/708/merge')) {
        return Response.json({ merged: true, sha: 'mergedsha', message: 'Pull Request successfully merged' });
      }
      throw new Error('unexpected merge url ' + String(input));
    };
    const worker = createWorker({ fetcher });
    const methodNotAllowed = await worker.fetch(new Request('https://diffs.consuelohq.com/api/consuelohq/opensaas/pull/708/merge'));
    const missingToken = await worker.fetch(new Request('https://diffs.consuelohq.com/api/consuelohq/opensaas/pull/708/merge', { method: 'POST' }));
    const response = await worker.fetch(new Request('https://diffs.consuelohq.com/api/consuelohq/opensaas/pull/708/merge', { method: 'POST' }), { GITHUB_TOKEN: 'token' });
    const payload = await response.json();

    expect(methodNotAllowed.status).toBe(405);
    expect(missingToken.status).toBe(401);
    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, merged: true, sha: 'mergedsha', message: 'Pull Request successfully merged' });
    expect(calls).toEqual([{ url: 'https://api.github.com/repos/consuelohq/opensaas/pulls/708/merge', method: 'PUT', body: '{"merge_method":"merge"}' }]);
  });




  test('routes code browser pages and APIs for main packages and history', async () => {
    const fetcher = async (input: string | URL): Promise<Response> => {
      const url = String(input);
      if (url.endsWith('/contents/packages?ref=main')) return Response.json([]);
      if (url.endsWith('/commits?sha=main&path=packages&per_page=1')) return Response.json([]);
      if (url.endsWith('/commits?sha=main&path=packages&per_page=100&page=1')) return Response.json([]);
      throw new Error('unexpected worker code url ' + url);
    };
    const worker = createWorker({ fetcher });
    const treePage = await worker.fetch(new Request('https://diffs.consuelohq.com/consuelohq/opensaas/tree/main/packages'));
    const codeApi = await worker.fetch(new Request('https://diffs.consuelohq.com/api/consuelohq/opensaas/code?ref=main&path=packages'));
    const historyPage = await worker.fetch(new Request('https://diffs.consuelohq.com/consuelohq/opensaas/history/main/packages'));
    const historyApi = await worker.fetch(new Request('https://diffs.consuelohq.com/api/consuelohq/opensaas/history?ref=main&path=packages'));

    expect(treePage.status).toBe(200);
    expect(await treePage.text()).toContain('data-code-browser-root');
    expect(codeApi.status).toBe(200);
    expect(historyPage.status).toBe(200);
    expect(await historyPage.text()).toContain('data-code-history-root');
    expect(historyApi.status).toBe(200);
  });

  test('refresh endpoint uses waitUntil so cron does not block on slow cache warming', async () => {
    const cacheStore = new Map<string, Response>();
    const cache = {
      async match(request: Request): Promise<Response | undefined> {
        const hit = cacheStore.get(request.url);
        return hit ? hit.clone() : undefined;
      },
      async put(request: Request, response: Response): Promise<void> {
        cacheStore.set(request.url, response.clone());
      },
      async delete(request: Request): Promise<boolean> {
        return cacheStore.delete(request.url);
      },
    };
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    const fetcher = async (input: string | URL): Promise<Response> => {
      await gate;
      calls += 1;
      const url = String(input);
      if (url.endsWith('/pulls?state=open&sort=updated&direction=desc&per_page=100&page=1')) {
        return Response.json([{ number: 757, title: 'queued refresh', html_url: 'https://github.com/consuelohq/opensaas/pull/757', state: 'open', draft: false, updated_at: '2026-06-05T00:21:00Z', created_at: '2026-06-05T00:20:00Z', user: { login: 'ko' }, head: { ref: 'task/diff-cockpit/queued-refresh', sha: 'headsha' }, base: { ref: 'stream/diff-cockpit', sha: 'streamsha' } }]);
      }
      if (url.endsWith('/pulls?state=open&sort=updated&direction=desc&per_page=100&page=2')) return Response.json([]);
      if (url.endsWith('/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=1')) return Response.json([]);
      if (url.endsWith('/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=2')) return Response.json([]);
      if (url.endsWith('/pulls/757')) return Response.json({ number: 757, title: 'queued refresh', html_url: 'https://github.com/consuelohq/opensaas/pull/757', state: 'open', draft: false, mergeable: true, mergeable_state: 'clean', additions: 10, deletions: 1, changed_files: 2, updated_at: '2026-06-05T00:21:00Z', created_at: '2026-06-05T00:20:00Z', user: { login: 'ko' }, head: { ref: 'task/diff-cockpit/queued-refresh', sha: 'headsha' }, base: { ref: 'stream/diff-cockpit', sha: 'streamsha' } });
      if (url.endsWith('/contents/packages?ref=main')) return Response.json([]);
      if (url.endsWith('/commits?sha=main&path=packages&per_page=1')) return Response.json([]);
      if (url.endsWith('/commits?sha=main&path=packages&per_page=100&page=1')) return Response.json([]);
      if (url.endsWith('/commits?sha=main&path=packages&per_page=100&page=2')) return Response.json([]);
      if (url.includes('/files?')) return Response.json([]);
      if (url.includes('/commits/headsha/check-runs')) return Response.json({ check_runs: [] });
      if (url.includes('/reviews?') || url.includes('/comments?') || url.includes('/commits?')) return Response.json([]);
      throw new Error(`unexpected queued refresh url ${url}`);
    };
    const worker = createWorker({ fetcher, cache });
    const waitUntilPromises: Promise<unknown>[] = [];
    const responsePromise = worker.fetch(new Request('https://diffs.consuelohq.com/internal/cache/refresh', {
      method: 'POST',
      headers: { authorization: 'Bearer secret', 'content-type': 'application/json' },
      body: JSON.stringify({ repo: 'consuelohq/opensaas', pulls: [757], reason: 'cron.diff-cockpit' }),
    }), { DIFF_COCKPIT_REFRESH_TOKEN: 'secret' }, { waitUntil: (promise: Promise<unknown>) => waitUntilPromises.push(promise) });

    const response = await Promise.race([
      responsePromise,
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 10)),
    ]);

    expect(response).not.toBe('timeout');
    expect(waitUntilPromises).toHaveLength(1);
    expect(calls).toBe(0);
    release();
    await Promise.all(waitUntilPromises);
    expect(calls > 0).toBe(true);
    expect(cacheStore.has('https://diffs.consuelohq.com/api/consuelohq/opensaas/pull/757?_dcv=v5-review-commit-popovers')).toBe(true);
  });

  test('server-renders warmed inbox and PR pages from shared API cache', async () => {
    const cacheStore = new Map<string, Response>();
    const cache = {
      async match(request: Request): Promise<Response | undefined> {
        const hit = cacheStore.get(request.url);
        return hit ? hit.clone() : undefined;
      },
      async put(request: Request, response: Response): Promise<void> {
        cacheStore.set(request.url, response.clone());
      },
      async delete(request: Request): Promise<boolean> {
        return cacheStore.delete(request.url);
      },
    };
    let calls = 0;
    const fetcher = async (input: string | URL): Promise<Response> => {
      calls += 1;
      const url = String(input);
      if (url.endsWith('/pulls?state=open&sort=updated&direction=desc&per_page=100&page=1')) {
        return Response.json([
          { number: 757, title: 'warmed server page', html_url: 'https://github.com/consuelohq/opensaas/pull/757', state: 'open', draft: false, updated_at: '2026-06-05T00:21:00Z', created_at: '2026-06-05T00:20:00Z', user: { login: 'ko', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' }, head: { ref: 'task/diff-cockpit/warmed-server-page', sha: 'headsha' }, base: { ref: 'stream/diff-cockpit', sha: 'streamsha' } },
        ]);
      }
      if (url.endsWith('/pulls?state=open&sort=updated&direction=desc&per_page=100&page=2')) return Response.json([]);
      if (url.endsWith('/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=1')) return Response.json([]);
      if (url.endsWith('/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=2')) return Response.json([]);
      if (url.endsWith('/pulls/757')) return Response.json({ number: 757, title: 'warmed server page', html_url: 'https://github.com/consuelohq/opensaas/pull/757', state: 'open', draft: false, mergeable: true, mergeable_state: 'clean', additions: 10, deletions: 1, changed_files: 2, updated_at: '2026-06-05T00:21:00Z', created_at: '2026-06-05T00:20:00Z', user: { login: 'ko', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' }, head: { ref: 'task/diff-cockpit/warmed-server-page', sha: 'headsha' }, base: { ref: 'stream/diff-cockpit', sha: 'streamsha' } });
      if (url.endsWith('/contents/packages?ref=main')) return Response.json([]);
      if (url.endsWith('/commits?sha=main&path=packages&per_page=1')) return Response.json([]);
      if (url.endsWith('/commits?sha=main&path=packages&per_page=100&page=1')) return Response.json([]);
      if (url.endsWith('/commits?sha=main&path=packages&per_page=100&page=2')) return Response.json([]);
      if (url.includes('/files?')) return Response.json([]);
      if (url.includes('/commits/headsha/check-runs')) return Response.json({ check_runs: [] });
      if (url.includes('/reviews?') || url.includes('/comments?') || url.includes('/commits?')) return Response.json([]);
      throw new Error(`unexpected server hydration url ${url}`);
    };
    const worker = createWorker({ fetcher, cache });

    const refresh = await worker.fetch(new Request('https://diffs.consuelohq.com/internal/cache/refresh?wait=1', {
      method: 'POST',
      headers: { authorization: 'Bearer secret', 'content-type': 'application/json' },
      body: JSON.stringify({ repo: 'consuelohq/opensaas', pulls: [757], reason: 'cron.diff-cockpit' }),
    }), { DIFF_COCKPIT_REFRESH_TOKEN: 'secret' });
    const refreshed = await refresh.json() as { queued?: boolean; completed?: boolean };
    const callsAfterRefresh = calls;
    const inbox = await worker.fetch(new Request('https://diffs.consuelohq.com/consuelohq/opensaas'));
    const prPage = await worker.fetch(new Request('https://diffs.consuelohq.com/consuelohq/opensaas/pull/757'));
    const inboxHtml = await inbox.text();
    const prHtml = await prPage.text();

    expect(refresh.status).toBe(200);
    expect(refreshed).toMatchObject({ completed: true });
    expect(refreshed.queued).toBe(undefined);
    expect(inbox.status).toBe(200);
    expect(prPage.status).toBe(200);
    expect(inboxHtml).toContain('id="diff-cockpit-index-initial-data"');
    expect(inboxHtml).toContain('id="diff-cockpit-index-initial-etag"');
    expect(inboxHtml).toContain('warmed server page');
    expect(prHtml).toContain('id="diff-cockpit-initial-data"');
    expect(prHtml).toContain('id="diff-cockpit-initial-etag"');
    expect(prHtml).toContain('warmed server page');
    expect(calls).toBe(callsAfterRefresh);
  });

  test('refresh endpoint protects and prewarms homepage and PR API cache entries', async () => {
    const cacheStore = new Map<string, Response>();
    const cache = {
      async match(request: Request): Promise<Response | undefined> {
        const hit = cacheStore.get(request.url);
        return hit ? hit.clone() : undefined;
      },
      async put(request: Request, response: Response): Promise<void> {
        if (response.headers.has('vary')) throw new Error('cache.put rejects Vary response headers');
        cacheStore.set(request.url, response.clone());
      },
      async delete(request: Request): Promise<boolean> {
        return cacheStore.delete(request.url);
      },
    };
    let calls = 0;
    const fetcher = async (input: string | URL): Promise<Response> => {
      calls += 1;
      const url = String(input);
      if (url.endsWith('/pulls?state=open&sort=updated&direction=desc&per_page=100&page=1')) {
        return Response.json([
          { number: 757, title: 'event driven cache refresh hooks', html_url: 'https://github.com/consuelohq/opensaas/pull/757', state: 'open', draft: false, updated_at: '2026-06-05T00:21:00Z', created_at: '2026-06-05T00:20:00Z', user: { login: 'ko' }, head: { ref: 'task/diff-cockpit/event-driven-cache-refresh-hooks', sha: 'headsha' }, base: { ref: 'stream/diff-cockpit', sha: 'streamsha' } },
        ]);
      }
      if (url.endsWith('/pulls?state=open&sort=updated&direction=desc&per_page=100&page=2')) return Response.json([]);
      if (url.endsWith('/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=1')) return Response.json([]);
      if (url.endsWith('/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=2')) return Response.json([]);
      if (url.endsWith('/pulls/757')) return Response.json({ number: 757, title: 'event driven cache refresh hooks', html_url: 'https://github.com/consuelohq/opensaas/pull/757', state: 'open', draft: false, mergeable: true, mergeable_state: 'clean', additions: 10, deletions: 1, changed_files: 2, updated_at: '2026-06-05T00:21:00Z', created_at: '2026-06-05T00:20:00Z', user: { login: 'ko' }, head: { ref: 'task/diff-cockpit/event-driven-cache-refresh-hooks', sha: 'headsha' }, base: { ref: 'stream/diff-cockpit', sha: 'streamsha' } });
      if (url.endsWith('/contents/packages?ref=main')) return Response.json([{ name: 'diff-cockpit', path: 'packages/diff-cockpit', type: 'dir', html_url: '', sha: 'pkgsha' }]);
      if (url.endsWith('/commits?sha=main&path=packages&per_page=1')) return Response.json([{ sha: 'pkgcommit', html_url: '', commit: { message: 'feat(diff-cockpit): add browser', author: { name: 'Ko', date: '2026-06-05T05:00:00Z' } }, author: { login: 'kokayicobb' } }]);
      if (url.endsWith('/commits?sha=main&path=packages%2Fdiff-cockpit&per_page=1')) return Response.json([{ sha: 'entrycommit', html_url: '', commit: { message: 'feat(diff-cockpit): add browser', author: { name: 'Ko', date: '2026-06-05T05:01:00Z' } }, author: { login: 'kokayicobb' } }]);
      if (url.endsWith('/commits?sha=main&path=packages&per_page=100&page=1')) return Response.json([{ sha: 'historysha', html_url: '', commit: { message: 'history', author: { name: 'Ko', date: '2026-06-05T05:02:00Z' } }, author: { login: 'kokayicobb' } }]);
      if (url.endsWith('/commits?sha=main&path=packages&per_page=100&page=2')) return Response.json([]);
      if (url.includes('/files?')) return Response.json([{ filename: 'packages/diff-cockpit/src/index.ts', status: 'modified', additions: 1, deletions: 1, changes: 2, patch: '@@ -1 +1 @@\n-old\n+new', blob_url: '' }]);
      if (url.includes('/commits/headsha/check-runs')) return Response.json({ check_runs: [{ status: 'completed', conclusion: 'success' }] });
      if (url.includes('/reviews?') || url.includes('/comments?') || url.includes('/commits?')) return Response.json([]);
      throw new Error(`unexpected refresh url ${url}`);
    };
    const worker = createWorker({ fetcher, cache });

    const unauthorized = await worker.fetch(new Request('https://diffs.consuelohq.com/internal/cache/refresh', { method: 'POST' }), { DIFF_COCKPIT_REFRESH_TOKEN: 'secret' });
    const refresh = await worker.fetch(new Request('https://diffs.consuelohq.com/internal/cache/refresh', {
      method: 'POST',
      headers: { authorization: 'Bearer secret', 'content-type': 'application/json' },
      body: JSON.stringify({ repo: 'consuelohq/opensaas', pulls: [757], reason: 'task.pr' }),
    }), { DIFF_COCKPIT_REFRESH_TOKEN: 'secret' });
    const refreshed = await refresh.json() as { refreshed: { homepage: string; pulls: string[]; code: string[]; history: string[] } };
    const callsAfterRefresh = calls;
    const homepage = await worker.fetch(new Request('https://diffs.consuelohq.com/api/consuelohq/opensaas/pulls'));
    const detail = await worker.fetch(new Request('https://diffs.consuelohq.com/api/consuelohq/opensaas/pull/757'));
    const code = await worker.fetch(new Request('https://diffs.consuelohq.com/api/consuelohq/opensaas/code?ref=main&path=packages'));
    const history = await worker.fetch(new Request('https://diffs.consuelohq.com/api/consuelohq/opensaas/history?ref=main&path=packages'));

    expect(unauthorized.status).toBe(401);
    expect(refresh.status).toBe(200);
    expect(refreshed.refreshed.homepage).toContain('/api/consuelohq/opensaas/pulls');
    expect(refreshed.refreshed.pulls).toContain('/api/consuelohq/opensaas/pull/757');
    expect(refreshed.refreshed.code).toContain('/api/consuelohq/opensaas/code?ref=main&path=packages');
    expect(refreshed.refreshed.history).toContain('/api/consuelohq/opensaas/history?ref=main&path=packages');
    expect(homepage.status).toBe(200);
    expect(detail.status).toBe(200);
    expect(code.status).toBe(200);
    expect(history.status).toBe(200);
    expect(calls).toBe(callsAfterRefresh);
  });

  test('returns homepage API shared cache headers and 304 for unchanged ETags', async () => {
    const fetcher = async (input: string | URL): Promise<Response> => {
      const url = String(input);
      if (url.endsWith('/pulls?state=open&sort=updated&direction=desc&per_page=100&page=1')) {
        return Response.json([
          { number: 750, title: 'homepage cache headers', html_url: 'https://github.com/consuelohq/opensaas/pull/750', state: 'open', draft: false, updated_at: '2026-06-03T18:10:00Z', created_at: '2026-06-03T18:05:00Z', user: { login: 'ko' }, head: { ref: 'task/diff-cockpit/homepage-cache-headers', sha: 'headsha' }, base: { ref: 'stream/diff-cockpit', sha: 'streamsha' } },
        ]);
      }
      if (url.endsWith('/pulls?state=open&sort=updated&direction=desc&per_page=100&page=2')) return Response.json([]);
      if (url.endsWith('/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=1')) return Response.json([]);
      if (url.endsWith('/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=2')) return Response.json([]);
      if (url.endsWith('/pulls/750')) return Response.json({ number: 750, title: 'homepage cache headers', html_url: 'https://github.com/consuelohq/opensaas/pull/750', state: 'open', draft: false, additions: 12, deletions: 1, changed_files: 2, updated_at: '2026-06-03T18:10:00Z', created_at: '2026-06-03T18:05:00Z', user: { login: 'ko' }, head: { ref: 'task/diff-cockpit/homepage-cache-headers', sha: 'headsha' }, base: { ref: 'stream/diff-cockpit', sha: 'streamsha' } });
      if (url.includes('/commits/headsha/check-runs')) return Response.json({ check_runs: [{ status: 'completed', conclusion: 'success' }] });
      if (url.includes('/pulls/750/reviews')) return Response.json(url.endsWith('page=1') ? [{ state: 'COMMENTED' }] : []);
      throw new Error(`unexpected homepage cache url ${url}`);
    };
    const worker = createWorker({ fetcher });
    const first = await worker.fetch(new Request('https://diffs.consuelohq.com/api/consuelohq/opensaas/pulls'));
    const etag = first.headers.get('etag') || '';
    const second = await worker.fetch(new Request('https://diffs.consuelohq.com/api/consuelohq/opensaas/pulls', { headers: { 'if-none-match': etag } }));

    expect(first.status).toBe(200);
    expect(first.headers.get('cache-control') || '').toContain('public');
    expect(first.headers.get('cache-control') || '').toContain('s-maxage');
    expect(first.headers.get('cache-control') || '').toContain('stale-while-revalidate');
    expect(first.headers.get('vary') || '').toBe('Accept');
    expect(etag).toContain('W/');
    expect(second.status).toBe(304);
  });

  test('returns PR API cache headers and 304 for unchanged ETags', async () => {
    const fetcher = async (input: string | URL): Promise<Response> => {
      const url = String(input);
      if (url.endsWith('/pulls/708')) {
        return Response.json({
          number: 708,
          title: 'Stream/os',
          html_url: 'https://github.com/consuelohq/opensaas/pull/708',
          state: 'open',
          draft: false,
          mergeable: true,
          mergeable_state: 'clean',
          user: { login: 'ko' },
          head: { ref: 'stream/os', sha: 'abc123' },
          base: { ref: 'main', sha: 'def456' },
        });
      }
      if (url.includes('/files?')) {
        return Response.json([{ filename: 'a.ts', status: 'modified', additions: 1, deletions: 1, changes: 2, patch: '@@ -1 +1 @@\n-old\n+new', blob_url: '' }]);
      }
      if (url.includes('/reviews?') || url.includes('/comments?')) {
        return Response.json([]);
      }
      if (url.includes('/commits?')) {
        return Response.json([]);
      }
      throw new Error(`unexpected cache url ${url}`);
    };
    const worker = createWorker({ fetcher });
    const first = await worker.fetch(new Request('https://diffs.consuelohq.com/api/consuelohq/opensaas/pull/708'));
    const etag = first.headers.get('etag') || '';
    const second = await worker.fetch(new Request('https://diffs.consuelohq.com/api/consuelohq/opensaas/pull/708', { headers: { 'if-none-match': etag } }));

    expect(first.status).toBe(200);
    expect(first.headers.get('cache-control') || '').toContain('public');
    expect(first.headers.get('cache-control') || '').toContain('s-maxage');
    expect(first.headers.get('cache-control') || '').toContain('stale-while-revalidate');
    expect(first.headers.get('vary') || '').toBe('Accept');
    expect(etag).toContain('W/');
    expect(second.status).toBe(304);
  });
});

