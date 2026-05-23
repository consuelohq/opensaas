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


  it('does not invent hunk lines for empty untracked files', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, 'empty.txt'), '');

    const output = runDiff(repo, ['--stat', '--files', '--hunks', '--patch']);

    expect(output.summary).toMatchObject({ filesChanged: 1, insertions: 0, deletions: 0 });
    expect(output.files).toEqual([
      expect.objectContaining({ path: 'empty.txt', status: 'A', additions: 0, deletions: 0 }),
    ]);
    expect(output.hunks[0]).toEqual(expect.objectContaining({ path: 'empty.txt', hunks: [] }));
    expect(output.patch).toContain('new file mode 100644');
    expect(output.patch).not.toContain('@@ -0,0 +1,1 @@');
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
