import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

type ScriptAuditResult = {
  scripts?: {
    passed?: boolean;
    documented_count?: number;
    actual_count?: number;
  };
};

const testDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(testDirectory, '..', '..');

function initializeGitRepository(repoRoot: string): void {
  execFileSync('git', ['init'], { cwd: repoRoot, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'workspace-test@example.com'], { cwd: repoRoot, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Workspace Test'], { cwd: repoRoot, stdio: 'ignore' });
  execFileSync('git', ['add', '.'], { cwd: repoRoot, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: repoRoot, stdio: 'ignore' });
}

describe('workspace audit', () => {
  it('runs scripts JSON audit without loading index-only tree-sitter dependencies', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'workspace-audit-scripts-'));

    try {
      const workspaceRoot = join(repoRoot, 'packages', 'workspace');
      const scriptsRoot = join(workspaceRoot, 'scripts');
      mkdirSync(join(scriptsRoot, 'lib'), { recursive: true });

      writeFileSync(join(repoRoot, 'package.json'), JSON.stringify({
        scripts: {
          sample: 'bun packages/workspace/scripts/sample.js',
        },
      }, null, 2));
      writeFileSync(join(workspaceRoot, 'SCRIPTS.md'), '### sample — sample workspace command\n');
      copyFileSync(join(packageRoot, 'scripts', 'audit.js'), join(scriptsRoot, 'audit.js'));
      copyFileSync(join(packageRoot, 'scripts', 'lib', 'paths.js'), join(scriptsRoot, 'lib', 'paths.js'));
      initializeGitRepository(repoRoot);

      const { TASK_BRANCH, TASK_WORKTREE, ...cleanEnvironment } = process.env;
      void TASK_BRANCH;
      void TASK_WORKTREE;

      const result = spawnSync('bun', ['./scripts/audit.js', '--scripts', '--json'], {
        cwd: workspaceRoot,
        encoding: 'utf8',
        env: cleanEnvironment,
      });

      expect(result.stderr).not.toContain('tree-sitter');
      expect(result.stderr).not.toContain('lib/index/chunker');
      expect(result.status).toBe(0);

      const parsed = JSON.parse(result.stdout) as ScriptAuditResult;
      expect(parsed.scripts?.passed).toBe(true);
      expect(parsed.scripts?.documented_count).toBe(1);
      expect(parsed.scripts?.actual_count).toBe(1);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
