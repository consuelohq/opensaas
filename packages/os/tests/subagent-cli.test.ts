import { describe, expect, it } from 'vitest';

import { parseSubagentCliInput, subagentCliHelpText } from '../scripts/subagent';

describe('subagent CLI', () => {
  it('forwards requestId for idempotent start retries and documents the flag', () => {
    const parsed = parseSubagentCliInput([
      '--action', 'start',
      '--provider', 'codex',
      '--instruction-path', '/tmp/instructions.md',
      '--request-id', 'req_cli_retry',
    ]);

    expect(parsed.requestId).toBe('req_cli_retry');
    expect(subagentCliHelpText()).toContain('--request-id <id>');
  });
});
