import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { executeTool } from '../../scripts/lib/facade/executor';

const packageRoot = resolve(import.meta.dirname, '../..');

describe('facade unknown-tool recovery', () => {
  it('returns bounded manifest-backed recovery instead of silently retrying a guessed tool', async () => {
    const result = await executeTool('browser.login.profile', {}, {
      cwd: packageRoot,
      now: () => 1_000,
      randomUUID: () => 'unknown-tool-recovery-test',
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'NOT_FOUND',
      data: {
        requestedTool: 'browser.login.profile',
        autoRetry: false,
      },
    });
    expect(JSON.stringify(result.data)).toContain('browser.headed');
    expect(JSON.stringify(result.data)).toContain('tools.search');
  });
});
