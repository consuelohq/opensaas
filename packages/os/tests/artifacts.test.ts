import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let tempHome: string;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-os-artifacts-'));
});

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true });
});

function runBunEval(code: string): string {
  return execFileSync('bun', ['-e', code], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CONSUELO_HOME: tempHome,
    },
    encoding: 'utf8',
  });
}

describe('createWorkspaceArtifact', () => {
  it('writes artifact bytes, persists metadata, and refreshes the local Office site', () => {
    const descriptor = JSON.parse(runBunEval(`
      const { createWorkspaceArtifact } = await import('./scripts/lib/artifacts.ts');
      const descriptor = createWorkspaceArtifact({
        traceId: 'trc_test_artifact',
        workspaceId: 'workspace-id',
        createdByUserId: 'user-id',
        skillName: 'daily-revenue-brief',
        title: 'Daily Revenue Brief',
        fileName: 'daily-revenue-brief.json',
        type: 'brief',
        format: 'json',
        content: { ok: true },
        inputSummary: { source: 'test' },
      });
      process.stdout.write(JSON.stringify(descriptor));
    `)) as { id: string; localPath: string; path: string; storageMode: string; traceId: string; skillName: string };

    expect(descriptor.id).toMatch(/^art_/);
    expect(descriptor.storageMode).toBe('local');
    expect(descriptor.traceId).toBe('trc_test_artifact');
    expect(descriptor.skillName).toBe('daily-revenue-brief');
    expect(descriptor.path).toBe('artifacts/trc_test_artifact/daily-revenue-brief.json');
    expect(existsSync(descriptor.localPath)).toBe(true);
    expect(JSON.parse(readFileSync(descriptor.localPath, 'utf8'))).toEqual({ ok: true });

    const officeSiteIndexPath = join(tempHome, 'sites', 'office', 'index.html');
    const officeSiteDataPath = join(tempHome, 'sites', 'office', 'data', 'artifacts.json');
    expect(existsSync(officeSiteIndexPath)).toBe(true);
    expect(existsSync(officeSiteDataPath)).toBe(true);
    expect(existsSync(join(tempHome, 'sites', 'github', 'index.html'))).toBe(false);
    expect(existsSync(join(tempHome, 'pages', 'office', 'index.html'))).toBe(false);
    expect(readFileSync(officeSiteIndexPath, 'utf8')).toContain('Daily Revenue Brief');
    const officeSiteData = JSON.parse(readFileSync(officeSiteDataPath, 'utf8')) as {
      artifacts: Array<{ id: string; title: string; traceId: string }>;
    };
    expect(officeSiteData.artifacts).toContainEqual(expect.objectContaining({
      id: descriptor.id,
      title: 'Daily Revenue Brief',
      traceId: 'trc_test_artifact',
    }));

    const row = JSON.parse(runBunEval(`
      const { Database } = await import('bun:sqlite');
      const db = new Database('${join(tempHome, 'consuelo.db')}');
      const row = db.query('SELECT id, workspace_id, created_by_user_id, skill_execution_trace_id, skill_name, title, type, format, storage_mode, storage_key FROM artifacts WHERE id = ?').get('${descriptor.id}');
      db.close();
      process.stdout.write(JSON.stringify(row));
    `));

    expect(row).toMatchObject({
      id: descriptor.id,
      workspace_id: 'workspace-id',
      created_by_user_id: 'user-id',
      skill_execution_trace_id: 'trc_test_artifact',
      skill_name: 'daily-revenue-brief',
      title: 'Daily Revenue Brief',
      type: 'brief',
      format: 'json',
      storage_mode: 'local',
      storage_key: 'artifacts/trc_test_artifact/daily-revenue-brief.json',
    });
  });
});
