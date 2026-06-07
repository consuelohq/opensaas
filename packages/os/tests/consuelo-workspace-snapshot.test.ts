import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let tempHome: string;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-workspace-snapshot-'));
});

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true });
});

function runBunEval(code: string, env: Record<string, string> = {}): string {
  return execFileSync('bun', ['-e', code], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CONSUELO_HOME: tempHome,
      CONSUELO_GRAPHQL_URL: 'https://consuelo.example/graphql',
      CONSUELO_INTERNAL_GRAPHQL_API_KEY: 'test-key',
      CONSUELO_WORKSPACE_ID: 'workspace-id',
      CONSUELO_USER_ID: 'user-id',
      ...env,
    },
    encoding: 'utf8',
  });
}

describe('consuelo-workspace-snapshot skill', () => {
  it('returns workspace object refs with files and attachments', () => {
    const result = JSON.parse(runBunEval(`
      globalThis.fetch = async () => new Response(JSON.stringify({
        data: {
          workspace: { id: 'workspace-id', name: 'Consuelo' },
          people: { nodes: [{ id: 'person-1', name: 'Ada Lovelace', email: 'ada@example.com' }] },
          companies: [{ id: 'company-1', name: 'Acme Agency' }],
          files: { nodes: [{ id: 'file-1', name: 'README.md', mimeType: 'text/markdown', size: 42, storageKey: 'workspace/files/readme.md', downloadUrl: 'https://files.example/readme' }] },
          attachments: { edges: [{ node: { id: 'att-1', name: 'README attach', fileId: 'file-1', fileCategory: 'md', targetCompanyId: 'company-1', createdBy: { name: 'Ko' } } }] },
          tasks: { nodes: [{ id: 'task-1', title: 'Follow up' }] },
          notes: { nodes: [] },
          dashboards: { nodes: [{ id: 'dashboard-1', title: 'Revenue' }] }
        }
      }), { status: 200, headers: { 'content-type': 'application/json' } });
      const { executeCall } = await import('./scripts/os.ts');
      const result = await executeCall({
        name: 'consuelo-workspace-snapshot',
        traceId: 'trc_workspace_snapshot_success',
        workspaceId: 'workspace-id',
        userId: 'user-id',
        input: { limit: 10 },
      });
      process.stdout.write(JSON.stringify(result));
    `));

    expect(result.ok).toBe(true);
    expect(result.permission).toBe('read');
    expect(result.artifacts).toBeUndefined();
    expect(result.proposedWrites).toEqual([]);
    expect(result.result).toMatchObject({
      status: 'ok',
      snapshot: {
        workspace: { id: 'workspace-id', type: 'workspace', label: 'Consuelo' },
        counts: { people: 1, companies: 1, files: 1, attachments: 1, tasks: 1, dashboards: 1 },
        files: [{ id: 'file-1', type: 'file', label: 'README.md', mimeType: 'text/markdown', storageKey: 'workspace/files/readme.md' }],
        attachments: [{ id: 'att-1', type: 'attachment', fileId: 'file-1', target: { id: 'company-1', type: 'company' } }],
      },
    });
  });

  it('fails safely when GraphQL capability is missing', () => {
    const result = JSON.parse(runBunEval(`
      const { executeCall } = await import('./scripts/os.ts');
      const result = await executeCall({ name: 'consuelo-workspace-snapshot', traceId: 'trc_workspace_missing' });
      process.stdout.write(JSON.stringify(result));
    `, { CONSUELO_GRAPHQL_URL: '', CONSUELO_INTERNAL_GRAPHQL_API_KEY: '' }));

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ code: 'MISSING_CAPABILITY' });
    expect(result.result).toMatchObject({ status: 'missing_capability' });
  });

  it('fails safely on auth failure', () => {
    const result = JSON.parse(runBunEval(`
      globalThis.fetch = async () => new Response(JSON.stringify({ errors: [{ message: 'Unauthorized' }] }), { status: 401 });
      const { executeCall } = await import('./scripts/os.ts');
      const result = await executeCall({ name: 'consuelo-workspace-snapshot', traceId: 'trc_workspace_auth_failed' });
      process.stdout.write(JSON.stringify(result));
    `));

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ code: 'AUTH_FAILED', message: 'GraphQL HTTP 401' });
  });

  it('reports schema gap without crashing', () => {
    const result = JSON.parse(runBunEval(`
      globalThis.fetch = async () => new Response(JSON.stringify({ errors: [{ message: 'Cannot query field "files" on type "Query".' }] }), { status: 200 });
      const { executeCall } = await import('./scripts/os.ts');
      const result = await executeCall({ name: 'consuelo-workspace-snapshot', traceId: 'trc_workspace_schema_gap' });
      process.stdout.write(JSON.stringify(result));
    `));

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ code: 'SCHEMA_GAP' });
    expect(result.result).toMatchObject({ status: 'schema_gap' });
  });

  it('returns an empty workspace status for an empty response', () => {
    const result = JSON.parse(runBunEval(`
      globalThis.fetch = async () => new Response(JSON.stringify({ data: {} }), { status: 200 });
      const { executeCall } = await import('./scripts/os.ts');
      const result = await executeCall({ name: 'consuelo-workspace-snapshot', traceId: 'trc_workspace_empty' });
      process.stdout.write(JSON.stringify(result));
    `));

    expect(result.ok).toBe(true);
    expect(result.result).toMatchObject({
      status: 'empty_workspace',
      snapshot: { counts: { people: 0, companies: 0, files: 0, attachments: 0 } },
    });
  });
});
