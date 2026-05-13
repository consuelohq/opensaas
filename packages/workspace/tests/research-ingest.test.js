import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, test } from 'vitest';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(dirname, '..');
const tempPaths = [];

afterEach(() => {
  for (const tempPath of tempPaths.splice(0)) {
    fs.rmSync(tempPath, { force: true, recursive: true });
  }
});

function makeFakeSummarize(payload) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'research-ingest-test-'));
  tempPaths.push(dir);

  const executablePath = path.join(dir, 'fake-summarize.js');
  fs.writeFileSync(
    executablePath,
    [
      '#!/usr/bin/env node',
      `process.stdout.write(${JSON.stringify(JSON.stringify(payload))});`,
      '',
    ].join('\n'),
    'utf8',
  );
  fs.chmodSync(executablePath, 0o755);
  return executablePath;
}

test('research ingest prefers extracted content over summarize input config strings', () => {
  const expectedText = 'Actual extracted source text from the README should be written to extracted.md.';
  const fakeSummarize = makeFakeSummarize({
    input: {
      markdown: 'readability',
      format: 'markdown',
    },
    extracted: {
      content: expectedText,
    },
  });
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'research-ingest-output-'));
  tempPaths.push(outputRoot);

  const result = childProcess.spawnSync(
    'bun',
    [
      'scripts/research-ingest.js',
      'https://example.test/dirac',
      '--summarize-bin',
      fakeSummarize,
      '--out-dir',
      outputRoot,
      '--no-context-save',
      '--json',
    ],
    {
      cwd: workspaceRoot,
      encoding: 'utf8',
    },
  );

  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');

  const manifest = JSON.parse(result.stdout);
  expect(fs.readFileSync(manifest.extractedPath, 'utf8')).toBe(`${expectedText}\n`);
});
