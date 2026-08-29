import { describe, expect, it } from 'vitest';

import { resolveGitHubCliPath } from '../scripts/lib/github-cli';

describe('GitHub CLI resolution', () => {
  it('skips the Consuelo gh shim and selects a real GitHub CLI later on PATH', () => {
    const attempted: string[] = [];
    const result = resolveGitHubCliPath({
      pathValue: '/Users/ko/.consuelo/bin:/opt/homebrew/bin:/usr/bin',
      platform: 'darwin',
      isExecutable: () => true,
      readVersion: (candidate) => {
        attempted.push(candidate);
        if (candidate === '/opt/homebrew/bin/gh') return 'gh version 2.93.0 (2026-05-27)';
        return '{"ok":false,"code":"VALIDATION_ERROR"}';
      },
    });

    expect(result).toBe('/opt/homebrew/bin/gh');
    expect(attempted).toEqual([
      '/Users/ko/.consuelo/bin/gh',
      '/opt/homebrew/bin/gh',
    ]);
  });

  it('fails without returning environment values when no real GitHub CLI is available', () => {
    expect(() => resolveGitHubCliPath({
      pathValue: '/private/shim:/another/shim',
      platform: 'darwin',
      isExecutable: () => true,
      readVersion: () => 'not github cli',
    })).toThrow('real GitHub CLI');
  });
});
