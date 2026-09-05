import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

type GitRunner = (args: string[], options?: { cwd?: string }) => string;
type GitModule = {
  fetchOrigin: (repoRoot: string, options?: { runGit?: GitRunner }) => void;
};

const gitModules: Array<[string, GitModule]> = [
  ['os', require('../scripts/lib/git.js') as GitModule],
  ['workspace', require('../../workspace/scripts/lib/git.js') as GitModule],
];

function concurrentRefRace(message = 'error: fetching ref refs/remotes/origin/main failed: incorrect old value provided') {
  const error = new Error(message) as Error & { stderr?: string };
  error.stderr = message;
  return error;
}

describe('origin fetch concurrency recovery', () => {
  for (const [label, git] of gitModules) {
    it(`${label} retries once when another fetch wins the remote-ref compare-and-swap`, () => {
      const calls: string[][] = [];
      const runGit: GitRunner = (args) => {
        calls.push(args);
        if (calls.length === 1) throw concurrentRefRace();
        return '';
      };

      expect(() => git.fetchOrigin('/repo', { runGit })).not.toThrow();
      expect(calls).toEqual([
        ['fetch', 'origin', '--prune'],
        ['fetch', 'origin', '--prune'],
      ]);
    });

    it(`${label} preserves unrelated fetch failures without retrying`, () => {
      const calls: string[][] = [];
      const failure = new Error('fatal: Authentication failed for origin');
      const runGit: GitRunner = (args) => {
        calls.push(args);
        throw failure;
      };

      expect(() => git.fetchOrigin('/repo', { runGit })).toThrow(failure);
      expect(calls).toEqual([['fetch', 'origin', '--prune']]);
    });
  }
});
