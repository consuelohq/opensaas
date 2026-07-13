import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(here, '..');

const workspaceScenarioNames = [
  'rejects shell-escaped Python transport',
  'runs multiline Python through a staged file',
  'runs Bun JavaScript through a staged file',
  'runs Bash through a staged script',
  'uses codeFile and stdinFile for staged payloads',
  'fails read mode when repo files change',
  'blocks edit mode in the first implementation slice',
  'truncates oversized output deterministically',
  'reports timeouts clearly',
  'rejects cwd escape outside workspace and temp roots',
  'accepts JSON input from an input file',
];

const expectedMistakeClasses = [
  'shell_escaped_code',
  'unsupported_language',
  'edit_without_task',
  'edit_mode_gated',
  'mutation_in_read_mode',
  'timeout',
  'output_truncated',
  'runtime_missing',
  'cwd_out_of_scope',
  'invalid_source',
  'unsafe_shell',
];

function readWorkspaceSource(relativePath: string): string {
  return readFileSync(join(workspaceRoot, relativePath), 'utf8');
}

describe('workspace code.call parity with OS PR 1123', () => {
  it('keeps every Workspace runtime scenario covered by the OS test', () => {
    const testSource = readWorkspaceSource('tests/code-call.test.ts');
    for (const name of workspaceScenarioNames) {
      expect(testSource).toContain(name);
    }
  });

  it('keeps language aliases, modes, mistake classes, and defaults aligned', () => {
    const codeCallSource = [
      'scripts/lib/code-call/runtime.ts',
      'scripts/lib/code-call/schema.ts',
      'scripts/lib/code-call/runtimes.ts',
      'scripts/lib/code-call/types.ts',
    ].map(readWorkspaceSource).join('\n');
    const typeSource = readWorkspaceSource('scripts/lib/code-call/types.ts');

    for (const alias of ['py', 'python', 'python3', 'bun', 'node', 'javascript', 'typescript', 'js', 'ts', 'bash', 'shell', 'sh']) {
      expect(codeCallSource).toContain(`${alias}:`);
    }

    for (const mode of ["'read'", "'edit'", "'verify'"]) {
      expect(typeSource).toContain(mode);
    }

    for (const mistakeClass of expectedMistakeClasses) {
      expect(typeSource).toContain(`'${mistakeClass}'`);
    }

    expect(codeCallSource).toContain('const DEFAULT_TIMEOUT_MS = 30_000;');
    expect(codeCallSource).toContain('const DEFAULT_MAX_RESULT_CHARS = 20_000;');
  });
});
