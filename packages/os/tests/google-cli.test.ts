import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseGoogleCliArgs, runGoogleCli } from '../scripts/google';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Google CLI compatibility', () => {
  it('parses the workspace-standard quiet flag', () => {
    expect(parseGoogleCliArgs(['--quiet', '--action', 'status'])).toMatchObject({
      action: 'status',
      quiet: true,
    });
  });

  it('accepts quiet mode and suppresses command output', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(await runGoogleCli(['--quiet'])).toBe(1);
    expect(stdout).not.toHaveBeenCalled();
  });
});
