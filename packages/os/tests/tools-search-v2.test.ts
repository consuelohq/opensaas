import { describe, expect, it } from 'vitest';

import { runToolSearch } from '../scripts/tools-search';

type ToolMatch = {
  name: string;
  capabilities?: { readOnly?: boolean; mutating?: boolean };
};

type ToolSearchPayload = {
  recommended?: string;
  matches: ToolMatch[];
  detectedIntent?: string;
};

async function runSearch(query: string, limit = 8): Promise<ToolSearchPayload> {
  return await runToolSearch({
    query,
    limit,
    includeDocs: false,
    includeEmbeddings: false,
  }) as ToolSearchPayload;
}

function names(payload: ToolSearchPayload): string[] {
  return payload.matches.map((match) => match.name);
}

describe('OS tools.search v2 intent resolution', () => {
  it('routes programmable repo runtime and structured file work to code.call', async () => {
    for (const query of [
      'run bun package command',
      'run tests package script',
      'syntax typecheck package scripts',
      'exact cli reproduction',
      'structured file rewrite python',
      'multi file transformation',
      'inspect many files and summarize',
      'generate files with bun script',
    ]) {
      const payload = await runSearch(query, 5);
      expect(payload.recommended, query).toBe('code.call');
      expect(names(payload)[0], query).toBe('code.call');
    }
  });

  it('keeps task and stream workflow tools ahead of code.call', async () => {
    const expectations: Array<[string, string]> = [
      ['task push changed files', 'task.push'],
      ['task current existing branch worktree', 'task.current'],
      ['merge git task branch conflict', 'task.merge'],
      ['finish completed task branch', 'task.finish'],
      ['stream sync branch', 'stream.sync'],
    ];

    for (const [query, expected] of expectations) {
      const payload = await runSearch(query, 8);
      expect(payload.recommended, query).toBe(expected);
      expect(names(payload)[0], query).toBe(expected);
    }
  });

  it('keeps literal file and anchored patch operations on typed fs tools', async () => {
    expect((await runSearch('read file lines', 5)).recommended).toBe('fs.read');
    expect((await runSearch('grep file contents for pattern', 5)).recommended).toBe('fs.search');
    expect((await runSearch('search codebase with rg', 5)).recommended).toBe('fs.search');
    expect((await runSearch('list directory files', 5)).recommended).toBe('fs.list');
    expect((await runSearch('apply anchored patch', 5)).recommended).toBe('fs.apply_patch');
    expect((await runSearch('write patch file contents', 5)).recommended).toBe('fs.apply_patch');
  });
});
