import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { execute } from '../scripts/lib/codemode/executor';

type ToolResultLike = {
  ok: boolean;
  data?: unknown;
};

function scriptPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'code-run.ts');
}

describe('codemode executor', () => {
  it('runs the Bun-native function runtime without a fallback warning', async () => {
    const result = await execute('return 1 + 1', {}, { maxOperations: 5 });
    expect(result.success).toBe(true);
    expect(result.result).toBe(2);
    expect(result.console.warn).toEqual([]);
  });

  it('enforces maxOperations across helper calls', async () => {
    const result = await execute('await ping(); await ping(); return true', {
      ping: async () => ({ ok: true }),
    }, { maxOperations: 1 });
    expect(result.success).toBe(false);
    expect(String(result.result)).toContain('maxOperations=1');
    expect(result.operations).toBe(2);
  });
});

describe('code-run CLI', () => {
  it('accepts JSON input from an input file', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'code-run-input-file-'));
    try {
      const inputPath = join(tempRoot, 'input.json');
      writeFileSync(inputPath, JSON.stringify({ code: 'return { value: 42 }' }));
      const result = spawnSync('bun', [scriptPath(), '--input-file', inputPath], {
        cwd: process.cwd(),
        encoding: 'utf8',
      });
      expect(result.status).toBe(0);
      const envelope = JSON.parse(result.stdout) as ToolResultLike;
      expect(envelope.ok).toBe(true);
      expect(JSON.stringify(envelope.data)).toContain('42');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('truncates oversized results', () => {
    const result = spawnSync('bun', [scriptPath(), JSON.stringify({
      code: 'return "x".repeat(100)',
      maxResultChars: 20,
    })], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    const envelope = JSON.parse(result.stdout) as ToolResultLike;
    expect(envelope.ok).toBe(true);
    expect(JSON.stringify(envelope.data)).toContain('truncated');
  });
});
