import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let tempHome: string;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-os-call-'));
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
      CONSUELO_GRAPHQL_URL: '',
      CONSUELO_INTERNAL_GRAPHQL_API_KEY: '',
    },
    encoding: 'utf8',
  });
}

describe('executeCall artifact persistence', () => {
  it('persists the daily revenue brief artifact and links it to the execution', () => {
    const result = JSON.parse(runBunEval(`
      const { executeCall } = await import('./scripts/os.ts');
      const result = await executeCall({
        name: 'daily-revenue-brief',
        traceId: 'trc_daily_brief_test',
        workspaceId: 'workspace-id',
        userId: 'user-id',
        input: { scope: 'today' },
      });
      process.stdout.write(JSON.stringify(result));
    `));

    expect(result.ok).toBe(true);
    expect(result.traceId).toBe('trc_daily_brief_test');
    expect(result.artifacts).toHaveLength(1);

    const artifact = result.artifacts[0];
    expect(artifact).toMatchObject({
      name: 'daily-revenue-brief.json',
      title: 'Daily Revenue Brief',
      type: 'brief',
      format: 'json',
      storageMode: 'local',
      traceId: 'trc_daily_brief_test',
      skillName: 'daily-revenue-brief',
    });
    expect(existsSync(artifact.localPath)).toBe(true);

    const artifactBody = JSON.parse(readFileSync(artifact.localPath, 'utf8')) as { traceId: string; result: { graphqlStatus: string } };
    expect(artifactBody.traceId).toBe('trc_daily_brief_test');
    expect(artifactBody.result.graphqlStatus).toBe('missing_env');

    const stored = JSON.parse(runBunEval(`
      const { Database } = await import('bun:sqlite');
      const db = new Database('${join(tempHome, 'consuelo.db')}');
      const execution = db.query('SELECT trace_id, status FROM skill_executions WHERE trace_id = ?').get('trc_daily_brief_test');
      const artifact = db.query('SELECT skill_execution_trace_id, storage_key FROM artifacts WHERE id = ?').get('${artifact.id}');
      db.close();
      process.stdout.write(JSON.stringify({ execution, artifact }));
    `));

    expect(stored.execution).toEqual({ trace_id: 'trc_daily_brief_test', status: 'succeeded' });
    expect(stored.artifact).toEqual({
      skill_execution_trace_id: 'trc_daily_brief_test',
      storage_key: 'artifacts/trc_daily_brief_test/daily-revenue-brief.json',
    });
  });
});