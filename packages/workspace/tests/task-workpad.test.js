import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  checkWorkpadReady,
  collectCodeCallReadFiles,
  syncCodeCallReadEvidence,
  syncFilesRead,
  syncTddEvidence,
  syncTestSelectionEvidence,
} = require('../scripts/lib/task-workpad.js');

function createWorkpad(content) {
  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), 'task-workpad-tdd-'));
  const meta = { taskBranch: 'task/workspace-agents/tdd-workpad-test', area: 'workspace-agents' };
  const workpadPath = path.join(worktree, '.task', 'workspace-agents', 'tdd-workpad-test', 'workpad.md');
  fs.mkdirSync(path.dirname(workpadPath), { recursive: true });
  fs.writeFileSync(workpadPath, content, 'utf8');
  return { worktree, meta, workpadPath };
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

describe('task workpad TDD evidence sections', () => {
  it('syncs files read without overwriting the agent-authored test contract', () => {
    const { worktree, meta, workpadPath } = createWorkpad(`# Test workpad\n\n## Test-first contract\n\n### Behavior under test\n- preserve this behavior note\n`);

    syncFilesRead(worktree, meta, ['packages/workspace/scripts/lib/task-workpad.js', '.task/evidence-log.json']);

    const content = read(workpadPath);
    expect(content).toContain('## Test-first contract');
    expect(content).toContain('- preserve this behavior note');
    expect(content).toContain('## Server Automatically populates this section: files read');
    expect(content).toContain('- `packages/workspace/scripts/lib/task-workpad.js`');
    expect(content).toContain('## Server Automatically populates this section: activity log');
    expect(content).toContain('fs.read: `packages/workspace/scripts/lib/task-workpad.js`');
    expect(content).not.toContain('.task/evidence-log.json');
  });

  it('preserves first-read order instead of sorting paths', () => {
    const { worktree, meta, workpadPath } = createWorkpad(`# Test workpad\n\n## Server Automatically populates this section: files read\n\n- none yet\n\n## Server Automatically populates this section: activity log\n\n- none yet\n`);

    syncFilesRead(worktree, meta, [
      'packages/workspace/scripts/task-z.js',
      'packages/workspace/scripts/task-a.js',
      'packages/workspace/scripts/task-m.js',
    ]);

    const content = read(workpadPath);
    expect(content.indexOf('- `packages/workspace/scripts/task-z.js`')).toBeLessThan(content.indexOf('- `packages/workspace/scripts/task-a.js`'));
    expect(content.indexOf('- `packages/workspace/scripts/task-a.js`')).toBeLessThan(content.indexOf('- `packages/workspace/scripts/task-m.js`'));
    expect(content.indexOf('fs.read: `packages/workspace/scripts/task-z.js`')).toBeLessThan(content.indexOf('fs.read: `packages/workspace/scripts/task-a.js`'));
  });

  it('migrates legacy workspace-owned sections to the server-managed heading', () => {
    const { worktree, meta, workpadPath } = createWorkpad([
      '# Test workpad',
      '',
      '## workspace-owned: files read',
      '',
      '- `packages/workspace/scripts/first.js`',
      '',
      '## workspace-owned: activity log',
      '',
      '- none yet',
      '',
    ].join('\n'));

    syncFilesRead(worktree, meta, ['packages/workspace/scripts/second.js']);

    const content = read(workpadPath);
    expect(content).toContain('## Server Automatically populates this section: files read');
    expect(content).toContain('## Server Automatically populates this section: activity log');
    expect(content).not.toContain('## workspace-owned: files read');
    expect(content.indexOf('- `packages/workspace/scripts/first.js`')).toBeLessThan(content.indexOf('- `packages/workspace/scripts/second.js`'));
  });

  it('extracts deterministic read paths from code.call input and structured stdout', () => {
    const { worktree, meta, workpadPath } = createWorkpad(`# Test workpad\n\n## Server Automatically populates this section: files read\n\n- none yet\n\n## Server Automatically populates this section: activity log\n\n- none yet\n`);

    const result = {
      data: {
        stdout: JSON.stringify({
          file: 'packages/workspace/scripts/lib/task-workpad.js',
          snippets: [{ path: 'packages/workspace/scripts/task-fs.js' }],
          ignored: { path: '.task/evidence-log.json' },
        }),
      },
    };

    expect(collectCodeCallReadFiles({ codeFile: 'scripts/read-fixture.ts' }, result, worktree)).toEqual([
      'scripts/read-fixture.ts',
      'packages/workspace/scripts/lib/task-workpad.js',
      'packages/workspace/scripts/task-fs.js',
    ]);

    syncCodeCallReadEvidence(worktree, meta, { codeFile: 'scripts/read-fixture.ts' }, result);

    const content = read(workpadPath);
    expect(content).toContain('fs.read: `scripts/read-fixture.ts` code.call');
    expect(content).toContain('fs.read: `packages/workspace/scripts/lib/task-workpad.js` code.call');
    expect(content).toContain('fs.read: `packages/workspace/scripts/task-fs.js` code.call');
    expect(content).not.toContain('.task/evidence-log.json');
  });

  it('writes explicit red and green TDD evidence to separate Server Automatically populates this section sections', () => {
    const { worktree, meta, workpadPath } = createWorkpad(`# Test workpad\n\n## Test-first contract\n\n### Focused red command\n- bun test task-workpad\n`);

    syncTddEvidence(worktree, meta, {
      phase: 'red',
      command: 'bun test packages/workspace/tests/task-workpad.test.js',
      ok: false,
      exitCode: 1,
      traceId: 'trc_red',
      output: 'expected syncTddEvidence to exist',
    });
    syncTddEvidence(worktree, meta, {
      phase: 'green',
      command: 'bun test packages/workspace/tests/task-workpad.test.js',
      ok: true,
      exitCode: 0,
      traceId: 'trc_green',
      output: '4 passed',
    });

    const content = read(workpadPath);
    expect(content).toContain('## Server Automatically populates this section: TDD red evidence');
    expect(content).toContain('`bun test packages/workspace/tests/task-workpad.test.js`: failed');
    expect(content).toContain('trace: `trc_red`');
    expect(content).toContain('expected syncTddEvidence to exist');
    expect(content).toContain('## Server Automatically populates this section: TDD green evidence');
    expect(content).toContain('`bun test packages/workspace/tests/task-workpad.test.js`: passed');
    expect(content).toContain('trace: `trc_green`');
  });

  it('summarizes verify test-selection output into a Server Automatically populates this section section', () => {
    const { worktree, meta, workpadPath } = createWorkpad('# Test workpad\n');

    syncTestSelectionEvidence(worktree, meta, {
      changedFiles: ['packages/workspace/scripts/verify.js'],
      matchedRules: [{ id: 'workspace-publish-gate' }],
      selectedSuites: [{ name: 'workspace verification stamp tests' }],
      runResults: [{ name: 'workspace verification stamp tests', status: 'passed' }],
      failedSuites: [],
      zeroSuiteReason: null,
    });

    const content = read(workpadPath);
    expect(content).toContain('## Server Automatically populates this section: test selection');
    expect(content).toContain('- changed files: `packages/workspace/scripts/verify.js`');
    expect(content).toContain('- matched rules: `workspace-publish-gate`');
    expect(content).toContain('- selected suites: `workspace verification stamp tests`');
    expect(content).toContain('- run results: `workspace verification stamp tests` passed');
  });

  it('treats a no-test waiver in the test-first contract as a meaningful workpad update', () => {
    const { worktree, meta } = createWorkpad(`# Test workpad\n\n## Test-first contract\n\n### No-test waiver\n- Copy-only steering update; validation is markdown review.\n`);

    expect(checkWorkpadReady(worktree, meta).ok).toBe(true);
  });
});
