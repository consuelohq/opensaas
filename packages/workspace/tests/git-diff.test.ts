import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

const scriptPath = new URL('../scripts/git-diff.js', import.meta.url).pathname;

function runGit(cwd: string, args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `git ${args.join(' ')} failed`);
}

function runDiff(cwd: string, args: string[]) {
  const result = spawnSync('bun', [scriptPath, ...args, '--json'], { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'git-diff failed');
  return JSON.parse(result.stdout);
}

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'git-diff-test-'));
  runGit(dir, ['init']);
  runGit(dir, ['config', 'user.email', 'test@example.com']);
  runGit(dir, ['config', 'user.name', 'Test User']);
  writeFileSync(join(dir, 'README.md'), 'one\n');
  runGit(dir, ['add', 'README.md']);
  runGit(dir, ['commit', '-m', 'initial']);
  return dir;
}

describe('git-diff script', () => {
  it('returns structured working-tree diff summary, files, and hunks', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'README.md'), 'one\ntwo\n');

    const output = runDiff(repo, ['--stat', '--files', '--hunks']);

    expect(output.mode).toBe('working-tree');
    expect(output.summary.filesChanged).toBe(1);
    expect(output.summary.insertions).toBe(1);
    expect(output.files).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'README.md', additions: 1, deletions: 0 }),
    ]));
    expect(output.hunks[0].hunks[0].newStart).toBe(1);
  });

  it('bounds patch output and reports truncation', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'README.md'), `one\n${'x'.repeat(200)}\n`);

    const output = runDiff(repo, ['--patch', '--max-bytes', '80']);

    expect(output.patch.length).toBeLessThanOrEqual(80);
    expect(output.truncated).toBe(true);
    expect(output.notes[0]).toContain('truncated');
  });

  it('supports path filtering', () => {
    const repo = makeRepo();
    mkdirSync(join(repo, 'src'));
    writeFileSync(join(repo, 'README.md'), 'one\ntwo\n');
    writeFileSync(join(repo, 'src', 'app.ts'), 'export const value = 1;\n');
    runGit(repo, ['add', 'src/app.ts']);
    runGit(repo, ['commit', '-m', 'add app']);
    writeFileSync(join(repo, 'src', 'app.ts'), 'export const value = 2;\n');

    const output = runDiff(repo, ['--files', '--paths', 'src']);

    expect(output.files).toEqual([
      expect.objectContaining({ path: 'src/app.ts' }),
    ]);
  });

  it('includes untracked files in working-tree output', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'new-file.txt'), 'alpha\nbeta\n');

    const output = runDiff(repo, ['--stat', '--files', '--hunks', '--patch']);

    expect(output.summary).toMatchObject({ filesChanged: 1, insertions: 2, deletions: 0 });
    expect(output.files).toEqual([
      expect.objectContaining({ path: 'new-file.txt', status: 'A', additions: 2, deletions: 0 }),
    ]);
    expect(output.hunks[0]).toEqual(expect.objectContaining({ path: 'new-file.txt' }));
    expect(output.patch).toContain('new file mode 100644');
    expect(output.patch).toContain('+alpha');
  });

  it('keeps untracked files out of revision comparisons', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'new-file.txt'), 'alpha\n');

    const output = runDiff(repo, ['--base', 'HEAD', '--stat', '--files', '--hunks', '--patch']);

    expect(output.mode).toBe('revision');
    expect(output.summary).toMatchObject({ filesChanged: 0, insertions: 0, deletions: 0 });
    expect(output.files).toEqual([]);
    expect(output.hunks).toEqual([]);
    expect(output.patch).toBe('');
  });

});


describe('git.diff complete task visibility and safety', () => {
  it('includes both staged and unstaged changes in its default working-tree view', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'README.md'), 'one\nstaged\n');
    runGit(repo, ['add', 'README.md']);
    writeFileSync(join(repo, 'README.md'), 'one\nstaged\nunstaged\n');
    const output = runDiff(repo, ['--stat', '--files', '--patch']);
    expect(output.summary).toMatchObject({ filesChanged: 1, insertions: 2 });
    expect(output.files).toContainEqual(expect.objectContaining({ path: 'README.md', additions: 2 }));
    expect(output.patch).toContain('+staged');
    expect(output.patch).toContain('+unstaged');
  });

  it('offers explicit task mode that unites committed, staged, unstaged and untracked changes while preserving revision-only base', () => {
    const repo = makeRepo();
    runGit(repo, ['tag', 'baseline']);
    writeFileSync(join(repo, 'README.md'), 'one\ncommitted\n');
    runGit(repo, ['add', 'README.md']);
    runGit(repo, ['commit', '-m', 'commit one change']);
    writeFileSync(join(repo, 'README.md'), 'one\ncommitted\nstaged\n');
    runGit(repo, ['add', 'README.md']);
    writeFileSync(join(repo, 'README.md'), 'one\ncommitted\nstaged\nunstaged\n');
    writeFileSync(join(repo, 'untracked.txt'), 'new\n');
    const task = runDiff(repo, ['--task', '--base', 'baseline', '--stat', '--files', '--patch']);
    expect(task.mode).toBe('task');
    expect(task.summary.filesChanged).toBe(2);
    expect(task.files.map((f: { path: string }) => f.path).sort()).toEqual(['README.md','untracked.txt']);
    expect(task.patch).toContain('+committed');
    expect(task.patch).toContain('+staged');
    expect(task.patch).toContain('+unstaged');
    expect(task.patch).toContain('+new');
    const revision = runDiff(repo, ['--base', 'baseline', '--stat', '--files', '--patch']);
    expect(revision.mode).toBe('revision');
    expect(revision.files.map((f: { path: string }) => f.path)).toEqual(['README.md']);
    expect(revision.patch).not.toContain('+staged');
    expect(revision.patch).not.toContain('+unstaged');
    expect(revision.patch).not.toContain('+new');
  });

  it('represents untracked binary bytes without lossy UTF-8 text conversion', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'asset.bin'), Buffer.from([0, 0xff, 0x00, 0x41, 0x42]));
    const output = runDiff(repo, ['--files', '--stat', '--patch', '--hunks']);
    expect(output.files).toContainEqual(expect.objectContaining({
      path: 'asset.bin', status: 'A', additions: null, deletions: null, binary: true,
    }));
    expect(output.patch).toContain('Binary files');
    expect(output.patch).not.toContain('\ufffd');
    expect(JSON.stringify(output.hunks)).not.toContain('\ufffd');
  });

  it('includes exact renamed filenames with spaces and tabs in structured file metadata', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'old name.txt'), 'original\n');
    runGit(repo, ['add', 'old name.txt']);
    runGit(repo, ['commit', '-m', 'add named file']);
    const fs = require('node:fs');
    fs.renameSync(join(repo, 'old name.txt'), join(repo, 'new\tname.txt'));
    runGit(repo, ['add', '-A']);
    const result = runDiff(repo, ['--files', '--name-only']);
    const rename = result.files.find((f: { path: string }) => f.path === 'new\tname.txt');
    expect(rename).toMatchObject({ oldPath: 'old name.txt' });
    expect(result.nameOnly).toContain('new\tname.txt');
  });

  it('never represents a truncated hunk as a complete hunk', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'README.md'), 'one\n' + 'x'.repeat(300) + '\n');
    const output = runDiff(repo, ['--patch', '--hunks', '--max-bytes', '75']);
    expect(output.truncated).toBe(true);
    expect(output.hunks).toEqual([]);
    expect(output.notes.join(' ')).toMatch(/incomplete|truncat/i);
  });
});


describe('git.diff path and byte integrity', () => {
  it('does not dereference an untracked symlink to a file outside the repository', () => {
    const repo = makeRepo();
    const fs = require('node:fs');
    const external = join(tmpdir(), 'git-diff-external-' + process.pid + '.txt');
    try {
      writeFileSync(external, 'sensitive external contents\n');
      fs.symlinkSync(external, join(repo, 'local-link.txt'));
      const output = runDiff(repo, ['--files', '--patch']);
      expect(output.files).toContainEqual(expect.objectContaining({ path: 'local-link.txt', symlink: true, status: 'A' }));
      expect(output.patch).toContain('new file mode 120000');
      expect(output.patch).not.toContain('sensitive external contents');
    } finally {
      fs.rmSync(external, { force: true });
    }
  });

  it('extracts renamed hunk paths even when Git quotes a tab in the filename', () => {
    const repo = makeRepo();
    const fs = require('node:fs');
    writeFileSync(join(repo, 'old name.txt'), 'hello\n');
    runGit(repo, ['add', 'old name.txt']);
    runGit(repo, ['commit', '-m', 'add old file']);
    fs.renameSync(join(repo, 'old name.txt'), join(repo, 'new\tname.txt'));
    writeFileSync(join(repo, 'new\tname.txt'), 'hello\nplus\n');
    runGit(repo, ['add', '-A']);
    const output = runDiff(repo, ['--files', '--hunks']);
    expect(output.hunks).toContainEqual(expect.objectContaining({ path: 'new\tname.txt', oldPath: 'old name.txt' }));
  });

  it('does not split a multibyte UTF-8 character at a patch byte cap', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'README.md'), 'one\n' + '😀'.repeat(50) + '\n');
    const full = runDiff(repo, ['--patch', '--max-bytes', '10000']);
    const location = full.patch.indexOf('😀');
    expect(location).toBeGreaterThan(0);
    const cap = Buffer.byteLength(full.patch.slice(0, location)) + 2;
    const output = runDiff(repo, ['--patch', '--max-bytes', String(cap)]);
    expect(output.truncated).toBe(true);
    expect(output.patch).not.toContain('\ufffd');
    expect(Buffer.byteLength(output.patch)).toBeLessThanOrEqual(cap);
  });

  it('rejects task mode without an explicit base to avoid ambiguous comparisons', () => {
    const repo = makeRepo();
    const child = spawnSync('bun', [scriptPath, '--task', '--json'], { cwd: repo, encoding: 'utf8' });
    expect(child.status).not.toBe(0);
    expect(child.stderr).toMatch(/requires --base/i);
  });
});


it('exposes unified task mode in both typed facades, OS handler and critical selection coverage', () => {
  const { readFileSync } = require('node:fs');
  const root = join(import.meta.dirname, '../../..');
  const handler = readFileSync(join(root, 'packages/os/tools/git/handler.ts'), 'utf8');
  const osSchema = readFileSync(join(root, 'packages/os/scripts/lib/facade/schemas.ts'), 'utf8');
  const workspaceSchema = readFileSync(join(root, 'packages/workspace/scripts/lib/facade/schemas.ts'), 'utf8');
  expect(handler).toContain('"source": "task"');
  expect(handler).toContain('"flag": "--task"');
  expect(osSchema).toContain('task: z.boolean().optional()');
  expect(workspaceSchema).toContain('task: z.boolean().optional()');
  const ruleJson = JSON.parse(readFileSync(join(root, 'packages/workspace/test-selection.rules.json'), 'utf8'));
  const rule = ruleJson.rules.find((item: { id: string }) => item.id === 'os-git-diff-unified-task');
  expect(rule.critical).toBe(true);
  for (const entry of [
    'packages/os/scripts/git-diff.js',
    'packages/workspace/scripts/git-diff.js',
    'packages/os/tools/git/handler.ts',
    'packages/workspace/tests/git-diff.test.ts',
  ]) expect(rule.source).toContain(entry);
});
