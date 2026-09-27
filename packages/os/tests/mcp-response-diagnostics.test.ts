import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildToolManifest } from '../scripts/generate-tool-manifest';

const osRoot = resolve(import.meta.dirname, '..');
const repoRoot = resolve(osRoot, '../..');

function source(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

describe('MCP response diagnostics surface', () => {
  it('runs server diagnostics from the installed runtime rather than a stale controller checkout', () => {
    const manifest = buildToolManifest({ write: false });
    const server = manifest.full.tools.find((entry) => entry.name === 'server');

    expect(server?.definition.command).toMatchObject({
      script: 'consuelo-reload',
      executionScope: 'runtime',
      branchMode: 'none',
    });
  });

  it('surfaces the durable MCP request receipt log from both reload entrypoints', () => {
    for (const relativePath of [
      'packages/os/scripts/consuelo-reload.js',
      'packages/workspace/scripts/consuelo-reload.js',
    ]) {
      const reload = source(relativePath);
      expect(reload, relativePath).toContain('mcp-requests.jsonl');
      expect(reload, relativePath).toContain('recent MCP request receipts');
    }
  });
});
