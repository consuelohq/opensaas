import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveCanonicalTraceDbPath } from '../scripts/lib/trace-persistence';

type TraceRow = {
  trace_id: string;
  mcp_trace_id: string | null;
  source: string;
  tool: string;
  task_session: string | null;
  branch: string | null;
  worktree: string | null;
  requested_node_id: string | null;
  resolved_node_id: string | null;
  resolved_node_name: string | null;
  default_node_id: string | null;
  route_source: string | null;
  status: string;
  ok: number;
  code: string | null;
  exit_code: number | null;
  duration_ms: number | null;
  input_json: string | null;
  resolved_input_json: string | null;
  result_json: string | null;
  stderr: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
};

type ScenarioResult = {
  result?: Record<string, unknown>;
  codeCall?: Record<string, unknown>;
  batch?: Record<string, unknown>;
  rows?: TraceRow[];
  firstRows?: TraceRow[];
  secondRows?: TraceRow[];
  recent?: { events?: Array<Record<string, unknown>> };
  history?: { rows?: Array<Record<string, unknown>> };
  recorded?: boolean;
  immediateDbExists?: boolean;
  events?: Array<Record<string, unknown>>;
  status?: number;
  body?: Record<string, unknown>;
};

let tempHome: string;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-trace-persistence-'));
});

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true });
});

function runScenario(name: string): ScenarioResult {
  const env = { ...process.env, CONSUELO_HOME: tempHome };
  delete env.CONSUELO_TRACE_DB;
  delete env.TRACE_DB;
  const fixture = join(process.cwd(), 'tests', 'fixtures', 'trace-persistence-runtime.ts');
  const run = spawnSync('bun', [fixture, name, tempHome], {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
  });
  if (run.status !== 0) {
    throw new Error([
      `trace persistence scenario failed: ${name}`,
      run.stdout,
      run.stderr,
    ].filter(Boolean).join('\n'));
  }
  return JSON.parse(run.stdout.trim()) as ScenarioResult;
}

describe('canonical OS trace persistence', () => {
  it('resolves one OS sidecar beside consuelo.db and honors explicit overrides', () => {
    expect(resolveCanonicalTraceDbPath({ env: { CONSUELO_HOME: tempHome } })).toBe(
      join(tempHome, 'node', 'db', 'traces.db'),
    );
    expect(resolveCanonicalTraceDbPath({
      env: {
        CONSUELO_HOME: tempHome,
        TRACE_DB: join(tempHome, 'compat.db'),
      },
    })).toBe(join(tempHome, 'compat.db'));
    expect(resolveCanonicalTraceDbPath({
      env: {
        CONSUELO_HOME: tempHome,
        TRACE_DB: join(tempHome, 'compat.db'),
        CONSUELO_TRACE_DB: join(tempHome, 'explicit.db'),
      },
    })).toBe(join(tempHome, 'explicit.db'));
  });

  it('persists a silent facade success with redacted input and serves it through the Hono read backend', () => {
    const output = runScenario('facade');
    const result = output.result ?? {};
    const rows = output.rows ?? [];
    const resultData = result.data as Record<string, unknown> | undefined;
    const resolvedBranch = String(resultData?.branch ?? '');

    expect(result).toMatchObject({ ok: true, code: 'OK' });
    expect(resolvedBranch).toMatch(/^task\/os\//);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      trace_id: result.traceId,
      source: 'facade',
      tool: 'task.current',
      branch: resolvedBranch,
      status: 'ok',
      ok: 1,
      code: 'OK',
      exit_code: 0,
      requested_node_id: 'node_cloud',
      resolved_node_id: 'node_cloud',
      resolved_node_name: 'Cloud Node',
      default_node_id: 'node_home',
      route_source: 'explicit',
    });
    expect(rows[0].input_json).toContain('[REDACTED_SECRET]');
    expect(rows[0].input_json).not.toContain('sk_test_secret_value_1234567890');
    expect(JSON.parse(rows[0].resolved_input_json ?? '{}')).toEqual({});
    expect(JSON.parse(rows[0].result_json ?? '{}')).toMatchObject({
      ok: true,
      code: 'OK',
      traceId: result.traceId,
    });
    expect(output.recent?.events).toEqual([
      expect.objectContaining({
        traceId: result.traceId,
        tool: 'task.current',
        branch: resolvedBranch,
        success: true,
      }),
    ]);
    expect(output.history?.rows).toEqual([
      expect.objectContaining({
        traceId: result.traceId,
        nodeId: 'node_cloud',
        nodeName: 'Cloud Node',
        defaultNodeId: 'node_home',
        routeSource: 'explicit',
      }),
    ]);
  });

  it('migrates an existing tool_traces table and preserves correlation and token fields', () => {
    const output = runScenario('migration');
    expect(output.recorded).toBe(true);
    expect(output.rows).toEqual([
      expect.objectContaining({
        trace_id: 'trc_migrated',
        mcp_trace_id: 'trc_parent',
        task_session: 'tsk_trace',
        worktree: '/tmp/task-os-trace',
        input_tokens: 12,
        output_tokens: 34,
        total_tokens: 46,
        resolved_node_id: 'node_migrated',
        resolved_node_name: 'Migrated Node',
        default_node_id: 'node_migrated',
        route_source: 'default',
      }),
    ]);
  });

  it('persists code.call and batch parent envelopes alongside nested child traces', () => {
    const output = runScenario('internal');
    expect(output.codeCall).toMatchObject({ ok: true, code: 'OK' });
    expect(output.batch).toMatchObject({ ok: true, code: 'OK' });
    expect(output.rows?.map((row) => row.tool)).toEqual([
      'code.call',
      'task.current',
      'batch',
    ]);
    expect(new Set(output.rows?.map((row) => row.trace_id)).size).toBe(3);
    const batchRow = output.rows?.find((row) => row.tool === 'batch');
    const batchResult = JSON.parse(batchRow?.result_json ?? '{}') as {
      data?: { results?: Array<Record<string, unknown>> };
    };
    expect(batchResult.data?.results).toEqual([
      expect.objectContaining({
        ok: true,
        code: 'OK',
        inputTokens: expect.any(Number),
        outputTokens: expect.any(Number),
        totalTokens: expect.any(Number),
      }),
    ]);
  });

  it('fails open when the trace path is unavailable', () => {
    const output = runScenario('fail-open');
    expect(output.result).toMatchObject({ ok: true, code: 'OK' });
  });

  it('persists parsed subagent child events with parent correlation and exact turn usage', () => {
    const output = runScenario('subagent');
    expect(output.events).toHaveLength(2);
    expect(output.recorded).toBe(true);
    expect(output.rows).toHaveLength(2);
    expect(output.rows?.[0]).toMatchObject({
      mcp_trace_id: 'trc_parent_subagent',
      source: 'subagent',
      tool: 'codex.fs.read',
      task_session: 'tsk_subagent',
      branch: 'task/os/subagent',
    });
    expect(output.rows?.[1]).toMatchObject({
      mcp_trace_id: 'trc_parent_subagent',
      tool: 'codex.turn.completed',
      input_tokens: 100,
      output_tokens: 40,
      total_tokens: 150,
    });
  });

  it('persists durable Codex child events once under the originating trace across later attachments', () => {
    const output = runScenario('durable-subagent');
    const result = output.result ?? {};
    const firstRows = output.firstRows ?? [];
    const secondRows = output.secondRows ?? [];

    expect(result).toMatchObject({ ok: true, code: 'OK' });
    expect(firstRows.length).toBeGreaterThanOrEqual(2);
    expect(firstRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        mcp_trace_id: result.traceId,
        source: 'subagent',
        tool: 'codex.fs.read',
      }),
      expect.objectContaining({
        mcp_trace_id: result.traceId,
        source: 'subagent',
        tool: 'codex.turn.completed',
      }),
    ]));
    expect(secondRows).toHaveLength(firstRows.length);
    expect(new Set(secondRows.map((row) => row.mcp_trace_id))).toEqual(new Set([result.traceId as string]));
  });

  it('records MISSING_SCOPE without persisting the bearer token', () => {
    const output = runScenario('auth');
    expect(output.status).toBe(403);
    expect(output.body).toMatchObject({ error: { code: 'MISSING_SCOPE' } });
    expect(output.rows).toHaveLength(1);
    expect(output.rows?.[0]).toMatchObject({
      source: 'gateway',
      tool: 'authorization.mcp',
      status: 'error',
      ok: 0,
      code: 'MISSING_SCOPE',
      exit_code: 403,
    });
    const serialized = JSON.stringify(output.rows?.[0]);
    expect(serialized).not.toContain('secret-bearer-token-that-must-not-be-stored');
    expect(JSON.parse(output.rows?.[0]?.input_json ?? '{}')).toMatchObject({
      workspaceId: 'workspace_trace_auth',
      requiredScope: 'tool:mac.process:read',
      route: '/mcp',
    });
  });

  it('should batch authentication traces after the request path returns', () => {
    const output = runScenario('auth-principal-queued');

    expect(output.immediateDbExists).toBe(false);
    expect(output.rows).toHaveLength(2);
    expect(output.rows?.map((row) => row.tool)).toEqual([
      'authentication.mcp',
      'authentication.mcp',
    ]);
  });

  it('should record a safe principal correlation key when authentication succeeds without raw identity material', () => {
    const output = runScenario('auth-principal');
    expect(output.recorded).toBe(true);
    expect(output.rows).toHaveLength(1);
    expect(output.rows?.[0]).toMatchObject({
      source: 'gateway',
      tool: 'authentication.mcp',
      status: 'ok',
      ok: 1,
    });
    const input = JSON.parse(output.rows?.[0]?.input_json ?? '{}') as Record<string, unknown>;
    expect(input).toMatchObject({
      workspaceId: 'workspace_trace_auth',
      route: '/mcp',
      requiredScope: 'mcp:read',
      authMode: 'oauth',
      principalKey: 'prn_0123456789abcdef0123456789abcdef',
      requestedNodeId: 'node_cloud',
      resolvedNodeId: 'node_cloud',
      resolvedNodeName: 'Cloud Node',
      defaultNodeId: 'node_home',
      routeSource: 'explicit',
    });
    expect(output.rows?.[0]).toMatchObject({
      requested_node_id: 'node_cloud',
      resolved_node_id: 'node_cloud',
      resolved_node_name: 'Cloud Node',
      default_node_id: 'node_home',
      route_source: 'explicit',
    });
    expect(JSON.stringify(input)).not.toContain('google:');
    expect(JSON.stringify(input)).not.toContain('chatgpt.com');
  });

  it('exports the canonical trace path for the installed daemon', () => {
    const daemon = readFileSync(join(process.cwd(), 'scripts', 'start-consuelo-daemon.sh'), 'utf8');
    expect(daemon).toContain('CONSUELO_TRACE_DB');
    expect(daemon).toContain('$CONSUELO_HOME/node/db/traces.db');
  });
});
