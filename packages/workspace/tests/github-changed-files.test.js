import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const repoRoot = resolve(import.meta.dirname, '..', '..', '..');
const workflowPath = join(repoRoot, '.github/workflows/changed-files.yaml');
const workflow = parse(readFileSync(workflowPath, 'utf8'));

async function classify({
  eventName = 'pull_request',
  patterns = 'package.json\npackages/documentation/**',
  prFiles = [],
  compareFiles = [],
  compareOmitFiles = false,
  pullNumber = 42,
  before = 'old',
  sha = 'new',
  baseSha = 'base',
  headSha = 'head',
  paginateError,
  compareError,
} = {}) {
  const step = workflow.jobs['changed-files'].steps.find(
    (candidate) => candidate.uses === 'actions/github-script@v7',
  );
  expect(step, 'GitHub API diff avoids a full checkout on irrelevant PRs').toBeTruthy();

  const outputs = new Map();
  const calls = [];
  const core = {
    setOutput(name, value) { outputs.set(name, String(value)); },
    info() {},
  };
  const github = {
    paginate: async (_fn, args) => {
      calls.push({ kind: 'pulls.listFiles', args });
      if (paginateError) throw paginateError;
      return prFiles;
    },
    rest: {
      pulls: { listFiles() {} },
      repos: {
        async compareCommits(args) {
          calls.push({ kind: 'repos.compareCommits', args });
          if (compareError) throw compareError;
          return { data: { files: compareOmitFiles ? undefined : compareFiles } };
        },
      },
    },
  };
  const context = {
    repo: { owner: 'consuelohq', repo: 'opensaas' },
    eventName,
    sha,
    payload: {
      pull_request: eventName === 'pull_request' && pullNumber
        ? { number: pullNumber }
        : undefined,
      before,
      merge_group: { base_sha: baseSha, head_sha: headSha },
    },
  };
  const fakeProcess = { env: { CHANGED_FILE_PATTERNS: patterns } };
  const run = new Function('github', 'context', 'core', 'process',
    `return (async () => { ${step.with.script} })();`);
  await run(github, context, core, fakeProcess);
  return { changed: outputs.get('any_changed'), calls };
}

describe('GitHub API changed-file gate', () => {
  it('runs without an initial checkout, retains stable reusable status, and only requires read permissions', () => {
    expect(workflow.jobs['changed-files']).toBeDefined();
    expect(workflow.jobs['changed-files'].steps.some((step) => step.uses === 'actions/checkout@v4')).toBe(false);
    expect(workflow.jobs['changed-files'].steps.some((step) => step.uses?.startsWith('tj-actions/'))).toBe(false);
    expect(workflow.permissions).toMatchObject({ contents: 'read', 'pull-requests': 'read' });
  });

  it('detects deletions on PRs and does not activate irrelevant documentation builds', async () => {
    const deleted = await classify({ prFiles: [{ filename: 'packages/documentation/guide.md', status: 'removed' }] });
    expect(deleted.changed).toBe('true');
    expect(deleted.calls).toHaveLength(1);
    const movedAway = await classify({
      prFiles: [{
        filename: 'archived/guide.md',
        previous_filename: 'packages/documentation/guide.md',
        status: 'renamed',
      }],
    });
    expect(movedAway.changed).toBe('true');
    const irrelevant = await classify({ prFiles: [{ filename: 'packages/dialer-server/src/app.ts' }] });
    expect(irrelevant.changed).toBe('false');
  });

  it('uses complete PR file pagination and fails open on the GitHub 3,000-file ceiling', async () => {
    const huge = await classify({ prFiles: Array.from({ length: 3000 }, (_, i) => ({ filename: `other/${i}.ts` })) });
    expect(huge.changed).toBe('true');
  });

  it('uses GitHub compare for push and merge_group, including removed files', async () => {
    const pushed = await classify({
      eventName: 'push',
      compareFiles: [{ filename: 'packages/documentation/old.md', status: 'removed' }],
    });
    expect(pushed.changed).toBe('true');
    expect(pushed.calls[0]).toMatchObject({ kind: 'repos.compareCommits', args: { base: 'old', head: 'new' } });

    const queued = await classify({
      eventName: 'merge_group',
      compareFiles: [{ filename: 'unrelated.txt' }],
    });
    expect(queued.changed).toBe('false');
    expect(queued.calls[0]).toMatchObject({ kind: 'repos.compareCommits', args: { base: 'base', head: 'head' } });
  });

  it('never silently skips checks when the compare response reaches its 300-file limit', async () => {
    const huge = await classify({
      eventName: 'push',
      compareFiles: Array.from({ length: 300 }, (_, i) => ({ filename: `other/${i}.ts` })),
    });
    expect(huge.changed).toBe('true');
  });

  it('fails open when PR metadata or a comparison base is missing, and on unknown events', async () => {
    expect((await classify({ pullNumber: null })).changed).toBe('true');
    expect((await classify({ eventName: 'push', before: '0000000000000000000000000000000000000000' })).changed).toBe('true');
    expect((await classify({ eventName: 'workflow_dispatch' })).changed).toBe('true');
  });

  it('does not silently classify an API failure as an irrelevant diff', async () => {
    await expect(classify({ paginateError: new Error('GitHub API unavailable') })).rejects.toThrow('GitHub API unavailable');
    await expect(classify({ eventName: 'push', compareError: new Error('comparison failed') })).rejects.toThrow('comparison failed');
  });

  it('retains the safer default if GitHub comparison omits its files field', async () => {
    // The GitHub API can omit file details for very large comparison ranges.
    const result = await classify({ eventName: 'push', compareOmitFiles: true });
    expect(result.changed).toBe('true');
  });

  it('does not skip work for a future unsupported glob pattern', async () => {
    expect((await classify({
      patterns: 'packages/**/src/**',
      prFiles: [{ filename: 'unrelated.txt' }],
    })).changed).toBe('true');
  });

  it.each([
    '!packages/documentation/**',
    'packages/documentation/(guide)/**',
    'packages/documentation/guide\\*.md',
  ])('runs downstream checks for unsupported negation and glob expression %s', async (pattern) => {
    const result = await classify({
      patterns: pattern,
      prFiles: [{ filename: 'other/unrelated.ts' }],
    });
    expect(result.changed).toBe('true');
  });
});
