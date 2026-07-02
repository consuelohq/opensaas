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
    `)) as { id: string; localPath: string; path: string; storageMode: string; traceId: string; skillName: string; currentVersionId: string; versionCount: number };

    expect(descriptor.id).toMatch(/^art_/);
    expect(descriptor.storageMode).toBe('local');
    expect(descriptor.traceId).toBe('trc_test_artifact');
    expect(descriptor.skillName).toBe('daily-revenue-brief');
    expect(descriptor.path).toBe(`artifacts/${descriptor.id}/versions/000001/daily-revenue-brief.json`);
    expect(descriptor.currentVersionId).toMatch(/^av_/);
    expect(descriptor.versionCount).toBe(1);
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
      const db = new Database('${join(tempHome, 'node', 'db', 'consuelo.db')}');
      const row = db.query('SELECT id, workspace_id, created_by_user_id, skill_execution_trace_id, skill_name, title, type, format, storage_mode, storage_key, current_version_id, version_count FROM artifacts WHERE id = ?').get('${descriptor.id}');
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
      storage_key: `artifacts/${descriptor.id}/versions/000001/daily-revenue-brief.json`,
      current_version_id: descriptor.currentVersionId,
      version_count: 1,
    });
  });

  it('should keep immutable versions when rolling back by version number or timestamp', () => {
    const result = JSON.parse(runBunEval(`
      const {
        createWorkspaceArtifact,
        getWorkspaceArtifactVersion,
        listWorkspaceArtifactVersions,
        rollbackWorkspaceArtifact,
        updateWorkspaceArtifact,
      } = await import('./scripts/lib/artifacts.ts');

      const created = createWorkspaceArtifact({
        traceId: 'trc_versions',
        skillName: 'spec-editor',
        title: 'StreamOS Spec',
        fileName: 'streamos.json',
        type: 'document',
        format: 'json',
        content: { body: 'v1' },
      });
      const firstCreatedAt = new Date().toISOString();
      await new Promise((resolve) => setTimeout(resolve, 5));
      const updated = updateWorkspaceArtifact({
        artifactId: created.id,
        traceId: 'trc_versions_update',
        title: 'StreamOS Spec',
        content: { body: 'v2' },
        reason: 'edit',
      });
      const historyAfterUpdate = listWorkspaceArtifactVersions(created.id);
      const beforeRollback = getWorkspaceArtifactVersion(created.id, { versionNumber: 1 });
      const rolledBack = rollbackWorkspaceArtifact({ artifactId: created.id, versionNumber: 1, reason: 'restore v1' });
      const historyAfterRollback = listWorkspaceArtifactVersions(created.id);
      const rollbackByTime = rollbackWorkspaceArtifact({ artifactId: created.id, before: firstCreatedAt, reason: 'restore by time' });
      const historyAfterTimeRollback = listWorkspaceArtifactVersions(created.id);

      process.stdout.write(JSON.stringify({
        created,
        updated,
        beforeRollback,
        rolledBack,
        rollbackByTime,
        historyAfterUpdate,
        historyAfterRollback,
        historyAfterTimeRollback,
      }));
    `)) as {
      created: { id: string; localPath: string; currentVersionId: string; versionCount: number };
      updated: { localPath: string; currentVersionId: string; versionCount: number };
      beforeRollback: { id: string; versionNumber: number; contentSha256: string; localPath: string };
      rolledBack: { localPath: string; restoredFromVersionId: string; versionCount: number };
      rollbackByTime: { localPath: string; versionCount: number };
      historyAfterUpdate: Array<{ versionNumber: number; isCurrent: boolean; localPath: string; reason: string | null }>;
      historyAfterRollback: Array<{ versionNumber: number; isCurrent: boolean; restoredFromVersionId: string | null }>;
      historyAfterTimeRollback: Array<{ versionNumber: number; isCurrent: boolean }>;
    };

    expect(result.created.versionCount).toBe(1);
    expect(result.updated.versionCount).toBe(2);
    expect(result.created.currentVersionId).not.toBe(result.updated.currentVersionId);
    expect(result.historyAfterUpdate.map((version) => version.versionNumber)).toEqual([1, 2]);
    expect(result.historyAfterUpdate.map((version) => version.isCurrent)).toEqual([false, true]);
    expect(result.historyAfterUpdate[0].localPath).not.toBe(result.historyAfterUpdate[1].localPath);
    expect(JSON.parse(readFileSync(result.historyAfterUpdate[0].localPath, 'utf8'))).toEqual({ body: 'v1' });
    expect(JSON.parse(readFileSync(result.historyAfterUpdate[1].localPath, 'utf8'))).toEqual({ body: 'v2' });

    expect(result.beforeRollback.versionNumber).toBe(1);
    expect(JSON.parse(readFileSync(result.rolledBack.localPath, 'utf8'))).toEqual({ body: 'v1' });
    expect(result.rolledBack.versionCount).toBe(3);
    expect(result.historyAfterRollback.map((version) => version.versionNumber)).toEqual([1, 2, 3]);
    expect(result.historyAfterRollback[2].isCurrent).toBe(true);
    expect(result.historyAfterRollback[2].restoredFromVersionId).toBe(result.beforeRollback.id);

    expect(JSON.parse(readFileSync(result.rollbackByTime.localPath, 'utf8'))).toEqual({ body: 'v1' });
    expect(result.rollbackByTime.versionCount).toBe(4);
    expect(result.historyAfterTimeRollback.map((version) => version.versionNumber)).toEqual([1, 2, 3, 4]);
    expect(result.historyAfterTimeRollback.at(-1)?.isCurrent).toBe(true);
  });

  it('should reject ambiguous or missing artifact version selectors when reading or rolling back', () => {
    const result = JSON.parse(runBunEval(`
      const { createWorkspaceArtifact, getWorkspaceArtifactVersion, rollbackWorkspaceArtifact } = await import('./scripts/lib/artifacts.ts');

      const created = createWorkspaceArtifact({
        traceId: 'trc_selector_guards',
        skillName: 'spec-editor',
        title: 'Selector Guard Spec',
        fileName: 'selector-guard.json',
        type: 'document',
        format: 'json',
        content: { body: 'v1' },
      });

      const ambiguous = (() => {
        try {
          getWorkspaceArtifactVersion(created.id, { versionId: created.currentVersionId, versionNumber: 1 });
          return null;
        } catch (error: unknown) {
          return error instanceof Error ? error.message : String(error);
        }
      })();

      const missingRollbackSelector = (() => {
        try {
          rollbackWorkspaceArtifact({ artifactId: created.id, reason: 'noop' });
          return null;
        } catch (error: unknown) {
          return error instanceof Error ? error.message : String(error);
        }
      })();

      process.stdout.write(JSON.stringify({ ambiguous, missingRollbackSelector }));
    `)) as { ambiguous: string | null; missingRollbackSelector: string | null };

    expect(result.ambiguous).toContain('Provide only one artifact version selector');
    expect(result.missingRollbackSelector).toContain('Rollback requires versionId');
  });
});
