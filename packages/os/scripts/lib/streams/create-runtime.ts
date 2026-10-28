import { createRequire } from 'node:module';

import { Effect } from 'effect';

import { createStreamEffect } from './creation';
import { StreamServiceError, streamError } from './errors';
import type { StreamBranchState, StreamCommitFile, StreamCreationContext } from './types';

const require = createRequire(import.meta.url);
const {
  createBlob,
  createBranch,
  createCommit,
  createTree,
  getBranchRef,
  getCommit,
  getToken,
} = require('../github.js');
const { fetchOrigin, refExists, runGit } = require('../git.js');
const { DEFAULT_REPO, resolveGitRoot } = require('../paths.js');

type GitHubBranchRef = { object: { sha: string } };
type GitHubCommit = { sha: string; tree: { sha: string } };
type GitHubBlob = { sha: string };
type GitHubTree = { sha: string };

function remoteFailure(operation: string, cause: unknown): StreamServiceError {
  return streamError('REMOTE_FAILURE', `${operation}: ${cause instanceof Error ? cause.message : String(cause)}`, cause);
}

function localFailure(operation: string, cause: unknown): StreamServiceError {
  return streamError('LOCAL_FAILURE', `${operation}: ${cause instanceof Error ? cause.message : String(cause)}`, cause);
}

async function readRemoteBranch(
  token: string,
  repository: string,
  branch: string,
): Promise<StreamBranchState | null> {
  try {
    const ref = await getBranchRef({ token, repository, branch }) as GitHubBranchRef | null;
    if (!ref) return null;
    const commit = await getCommit({ token, repository, sha: ref.object.sha }) as GitHubCommit;
    return { sha: ref.object.sha, treeSha: commit.tree.sha };
  } catch (error: unknown) {
    throw remoteFailure(`read branch ${branch}`, error);
  }
}

async function createRemoteBranch(
  token: string,
  repository: string,
  branch: string,
  sha: string,
): Promise<StreamBranchState> {
  try {
    await createBranch({ token, repository, branch, sha });
    const commit = await getCommit({ token, repository, sha }) as GitHubCommit;
    return { sha, treeSha: commit.tree.sha };
  } catch (error: unknown) {
    throw remoteFailure(`create branch ${branch}`, error);
  }
}

async function createInstructionCommit(
  token: string,
  repository: string,
  parentSha: string,
  files: StreamCommitFile[],
  message: string,
): Promise<StreamBranchState> {
  try {
    const parent = await getCommit({ token, repository, sha: parentSha }) as GitHubCommit;
    const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];
    for (const file of files) {
      const blob = await createBlob({
        token,
        repository,
        content: Buffer.from(file.content).toString('base64'),
        encoding: 'base64',
      }) as GitHubBlob;
      treeItems.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const tree = await createTree({ token, repository, baseTree: parent.tree.sha, tree: treeItems }) as GitHubTree;
    const commit = await createCommit({ token, repository, message, tree: tree.sha, parents: [parentSha] }) as GitHubCommit;
    return { sha: commit.sha, treeSha: tree.sha };
  } catch (error: unknown) {
    throw remoteFailure('create stream instruction commit', error);
  }
}

function normalizeRemoteError(cause: unknown, operation: string): StreamServiceError {
  return cause instanceof StreamServiceError ? cause : remoteFailure(operation, cause);
}

export function createLiveStreamContext(repository = DEFAULT_REPO): StreamCreationContext {
  const token = getToken() as string;
  const repoRoot = resolveGitRoot(process.cwd());
  return {
    remote: {
      getBranch: (branch) => Effect.tryPromise({
        try: () => readRemoteBranch(token, repository, branch),
        catch: (cause) => normalizeRemoteError(cause, `read branch ${branch}`),
      }),
      createBranch: ({ branch, sha }) => Effect.tryPromise({
        try: () => createRemoteBranch(token, repository, branch, sha),
        catch: (cause) => normalizeRemoteError(cause, `create branch ${branch}`),
      }),
      commitFiles: ({ parentSha, files, message }) => Effect.tryPromise({
        try: () => createInstructionCommit(token, repository, parentSha, files, message),
        catch: (cause) => normalizeRemoteError(cause, 'create stream instruction commit'),
      }),
    },
    local: {
      fetchOrigin: () => Effect.try({
        try: () => fetchOrigin(repoRoot),
        catch: (cause) => localFailure('fetch origin', cause),
      }),
      branchExists: (branch) => Effect.try({
        try: () => refExists(repoRoot, `refs/heads/${branch}`),
        catch: (cause) => localFailure(`inspect local branch ${branch}`, cause),
      }),
      createTrackingBranch: ({ branch, upstream }) => Effect.try({
        try: () => runGit(['branch', '--track', branch, upstream], { cwd: repoRoot }),
        catch: (cause) => localFailure(`create local tracking branch ${branch}`, cause),
      }),
    },
  };
}

export function createStreamFromCliEffect(input: { area: string; sourceBranch?: string; repo?: string }) {
  const repo = input.repo || DEFAULT_REPO;
  return createStreamEffect({ area: input.area, sourceBranch: input.sourceBranch }, createLiveStreamContext(repo));
}
