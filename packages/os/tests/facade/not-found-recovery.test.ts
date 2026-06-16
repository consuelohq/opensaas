import { describe, expect, it } from 'vitest';

import { executeTool } from '../../scripts/lib/facade/executor';
import type { ToolResult } from '../../scripts/lib/facade/types';

function stableOptions() {
  return {
    cwd: '/tmp/not-a-repo',
    now: () => 1000,
    randomUUID: () => 'abc123def4567890abc123def4567890',
    logMode: 'silent' as const,
  };
}

type UnknownToolRecovery = {
  requestedTool: string;
  recommendedTool?: string;
  candidates?: string[];
  confidence: 'high' | 'medium' | 'low';
  source: 'alias' | 'tools.search';
  autoRetry: false;
  repair: {
    workspaceCall?: string;
    toolsSearchCall: string;
  };
};

function recovery(result: ToolResult<unknown>): UnknownToolRecovery {
  expect(result.ok).toBe(false);
  expect(result.code).toBe('NOT_FOUND');
  expect(result.data).toBeTruthy();
  return result.data as UnknownToolRecovery;
}

describe('OS facade unknown-tool recovery', () => {
  it('returns a high-confidence canonical recommendation for exact safe aliases', async () => {
    const requested = ['mac', 'run'].join('.');
    const expected = ['mac', 'call'].join('.');
    const result = await executeTool(requested, {}, stableOptions());
    const data = recovery(result);

    expect(result.message).toContain(`unknown tool: ${requested}`);
    expect(result.message).toContain(`use ${expected}`);
    expect(data.requestedTool).toBe(requested);
    expect(data.recommendedTool).toBe(expected);
    expect(data.confidence).toBe('high');
    expect(data.source).toBe('alias');
    expect(data.autoRetry).toBe(false);
    expect(data.repair.workspaceCall).toContain(`tool: "${expected}"`);
    expect(data.repair.toolsSearchCall).toContain('tools.search');
  });

  it('keeps ambiguous short aliases as suggestions instead of auto-routing', async () => {
    const result = await executeTool('run', {}, stableOptions());
    const data = recovery(result);

    expect(result.message).toContain('unknown tool: run');
    expect(result.message).toContain('tools.search');
    expect(data.requestedTool).toBe('run');
    expect(data.recommendedTool).toBeUndefined();
    expect(data.candidates).toEqual(['task.call', 'mac.call', 'code.run']);
    expect(data.confidence).toBe('low');
    expect(data.source).toBe('alias');
    expect(data.autoRetry).toBe(false);
  });

  it('uses the tools.search scorer for non-alias near misses', async () => {
    const requested = ['git', 'diffs'].join('.');
    const expected = ['git', 'diff'].join('.');
    const result = await executeTool(requested, {}, stableOptions());
    const data = recovery(result);

    expect(data.requestedTool).toBe(requested);
    expect(data.recommendedTool).toBe(expected);
    expect(data.source).toBe('tools.search');
    expect(data.confidence).not.toBe('low');
    expect(data.autoRetry).toBe(false);
    expect(data.repair.workspaceCall).toContain(`tool: "${expected}"`);
    expect(data.repair.toolsSearchCall).toContain('git diffs');
  });
});
