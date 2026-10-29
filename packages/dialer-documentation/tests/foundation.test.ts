import { describe, expect, it } from 'bun:test';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extractTranslationSegments } from '../src/lib/translation/text';

describe('documentation foundation', () => {
  it('normalizes emphasis and code spans while retaining SDK punctuation', () => {
    expect(extractTranslationSegments('Use **ready reps**, *clear queues*, and `@consuelo/dialer_sdk` for calling.')).toEqual(['Use ready reps, clear queues, and @consuelo/dialer_sdk for calling.']);
  });
  it('preserves emphasis markers inside inline code identifiers and patterns', () => {
    expect(extractTranslationSegments('Use **ready reps** with `__init__`, `**/*.ts`, and ``a *literal* value``.')).toEqual(['Use ready reps with __init__, **/*.ts, and a *literal* value.']);
  });
  it('requires an isolated preview origin before build or deploy', async () => {
    const { requirePreviewOrigin } = await import('../scripts/lib/preview-deploy.mjs');
    for (const origin of [undefined, '', 'not-a-url', 'https://docs.consuelohq.com', 'https://os.consuelohq.com/docs/', 'https://preview.example/path', 'https://docs.consuelohq.com./', 'https://calls.consuelohq.com/', 'https://calls.consuelohq.com./']) {
      expect(() => requirePreviewOrigin(origin)).toThrow();
    }
    expect(requirePreviewOrigin('https://dialer-preview.example/')).toBe('https://dialer-preview.example');
  });
  it('forces the isolated Wrangler configuration for both preview child commands', () => {
    const directory = mkdtempSync(join(tmpdir(), 'dialer-docs-preview-'));
    const evidence = join(directory, 'commands.jsonl');
    const fakeBun = join(directory, 'bun');
    try {
      writeFileSync(fakeBun, `#!${process.execPath}
import { appendFileSync } from 'node:fs';
appendFileSync(process.env.PREVIEW_TEST_EVIDENCE, JSON.stringify({
  args: process.argv.slice(2),
  config: process.env.DOCS_WRANGLER_CONFIG,
  origin: process.env.DOCS_SITE_URL,
  noindex: process.env.PUBLIC_DOCS_PREVIEW,
}) + '\\n');
`);
      chmodSync(fakeBun, 0o700);
      const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/deploy-preview.mjs', import.meta.url))], {
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          PREVIEW_TEST_EVIDENCE: evidence,
          DOCS_SITE_URL: 'https://dialer-preview.example/',
          DOCS_WRANGLER_CONFIG: './wrangler.production.jsonc',
        },
        encoding: 'utf8',
        timeout: 5000,
      });
      expect(result.status).toBe(0);
      const commands = readFileSync(evidence, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
      expect(commands).toEqual([
        { args: ['run', 'build'], config: './wrangler.jsonc', origin: 'https://dialer-preview.example', noindex: '1' },
        { args: ['x', 'wrangler', 'deploy', '--config', 'dist/server/wrangler.json'], config: './wrangler.jsonc', origin: 'https://dialer-preview.example', noindex: '1' },
      ]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
