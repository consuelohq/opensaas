import { Database } from 'bun:sqlite';
import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { executeTool } from '../../scripts/lib/facade/executor';
import type { CommandPlan } from '../../scripts/lib/facade/types';
import { createGatewaySecurityConfig } from '../../scripts/lib/security-gateway';
import { parseSubagentTraceEvents } from '../../scripts/lib/subagent/runtime';
import { createLocalTraceSitesReadBackend } from '../../scripts/lib/trace-sites-local-read-backend';
import {
  queueGatewayAuthenticationTraceSafely,
  recordGatewayAuthenticationTraceSafely,
  recordSubagentTraceEventsSafely,
  recordToolTraceSafely,
  resolveCanonicalTraceDbPath,
} from '../../scripts/lib/trace-persistence';
import { authorizeConsueloOAuthMcpRequest } from '../../scripts/server/services/oauth-introspection';

type TraceRow = Record<string, unknown>;

const TRACE_ROWS_SQL = [
  'SELECT trace_id, mcp_trace_id, source, tool, task_session, branch, worktree,',
  'status, ok, code, exit_code, duration_ms, input_json,',
  'resolved_input_json, result_json, stderr,',
  'input_tokens, output_tokens, total_tokens',
  'FROM tool_traces',
  'ORDER BY rowid ASC',
].join(' ');

const LEGACY_TRACE_TABLE_SQL = [
  'CREATE TABLE tool_traces (',
  'id TEXT PRIMARY KEY,',
  'ts TEXT NOT NULL,',
  'trace_id TEXT NOT NULL,',
  'source TEXT NOT NULL,',
  'tool TEXT NOT NULL,',
  'status TEXT NOT NULL,',
  'ok INTEGER NOT NULL',
  ');',
].join(' ');

const scenario = process.argv[2] ?? '';
const home = process.argv[3] ?? '';
if (!scenario || !home) throw new Error('usage: trace-persistence-runtime <scenario> <home>');
let uuidCounter = 0;

process.env.CONSUELO_HOME = home;
delete process.env.CONSUELO_TRACE_DB;
delete process.env.TRACE_DB;

function traceRows(): TraceRow[] {
  const db = new Database(resolveCanonicalTraceDbPath(), { readonly: true });
  try {
    return db.query(TRACE_ROWS_SQL).all() as TraceRow[];
  } finally {
    db.close();
  }
}

function stableFacadeOptions() {
  return {
    cwd: process.cwd(),
    env: process.env,
    runner: (_plan: CommandPlan) => Promise.resolve({
      stdout: JSON.stringify({ value: 'ok' }),
      stderr: '',
      exitCode: 0,
    }),
    branchResolver: () => ({
      ok: true as const,
      branch: 'task/os/trace-persistence-test',
      source: 'test',
    }),
    currentTask: {
      branch: 'task/os/trace-persistence-test',
      area: 'os',
      worktree: home,
    },
    now: () => 1_750_000_000_000,
    randomUUID: () => `${String(++uuidCounter).padStart(12, '0')}abcdefabcdefabcdefab`,
    logMode: 'silent' as const,
  };
}

async function run(): Promise<unknown> {
  try {
    if (scenario === 'facade') {
    const result = await executeTool('task.current', {
      apiKey: 'sk_test_secret_value_1234567890',
    }, stableFacadeOptions());
    const backend = createLocalTraceSitesReadBackend({
      dbPath: resolveCanonicalTraceDbPath(),
    });
    const recent = await backend.readRecentEvents({
      workspaceId: 'workspace_trace_test',
      workspaceHost: 'trace-test.consuelohq.com',
      site: 'trace',
      sourceMode: 'local-networked',
      cursor: '000000000000',
      limit: 10,
    });
      return { result, rows: traceRows(), recent };
    }

    if (scenario === 'migration') {
      const dbPath = resolveCanonicalTraceDbPath();
      mkdirSync(dirname(dbPath), { recursive: true });
      const db = new Database(dbPath, { create: true });
      db.exec(LEGACY_TRACE_TABLE_SQL);
      db.close();
      const recorded = recordToolTraceSafely({
      traceId: 'trc_migrated',
      mcpTraceId: 'trc_parent',
      source: 'facade',
      tool: 'fs.read',
      taskSession: 'tsk_trace',
      branch: 'task/os/trace',
      worktree: '/tmp/task-os-trace',
      status: 'ok',
      ok: true,
      code: 'OK',
      exitCode: 0,
      durationMs: 25,
      input: { path: 'README.md' },
      resolvedInput: { path: 'README.md', branch: 'task/os/trace' },
      result: { ok: true },
      inputTokens: 12,
      outputTokens: 34,
      totalTokens: 46,
    });
      return { recorded, rows: traceRows() };
    }

    if (scenario === 'internal') {
      const options = stableFacadeOptions();
      const codeCall = await executeTool('code.call', {
      language: 'bun',
      mode: 'read',
      code: 'process.stdout.write(JSON.stringify({ ok: true, source: "trace-test" }))',
    }, options);
      const batch = await executeTool('batch', {
      steps: [
        { tool: 'task.current', input: {} },
      ],
    }, options);
      return { codeCall, batch, rows: traceRows() };
    }

    if (scenario === 'fail-open') {
      process.env.CONSUELO_TRACE_DB = home;
      const result = await executeTool('task.current', {}, stableFacadeOptions());
      return { result };
    }

    if (scenario === 'subagent') {
      const stdout = [
      JSON.stringify({
        type: 'item.completed',
        item: {
          id: 'item_1',
          type: 'mcp_tool_call',
          server: 'consuelo',
          tool: 'call',
          arguments: { tool: 'fs.read', input: { path: 'README.md' } },
          result: { ok: true, code: 'OK' },
        },
      }),
      JSON.stringify({
        type: 'turn.completed',
        usage: {
          input_tokens: 100,
          output_tokens: 40,
          reasoning_output_tokens: 10,
        },
      }),
    ].join('\n');
      const events = parseSubagentTraceEvents('codex', stdout);
      const recorded = recordSubagentTraceEventsSafely({
      provider: 'codex',
      parentTraceId: 'trc_parent_subagent',
      cwd: '/tmp/task-os-subagent',
      taskSession: 'tsk_subagent',
      branch: 'task/os/subagent',
      stdoutLogPath: '/tmp/subagent.stdout.log',
      events,
    });
      return { events, recorded, rows: traceRows() };
    }

    if (scenario === 'durable-subagent') {
      const binDir = join(home, 'bin');
      mkdirSync(binDir, { recursive: true });
      const codex = join(binDir, 'codex');
      writeFileSync(codex, [
        '#!/bin/sh',
        'if [ "$1" = "exec" ] && [ "$2" = "--help" ]; then',
        '  printf "%s\\n" "Usage: codex exec [OPTIONS] [PROMPT]" "instructions are read from stdin" "--cd <DIR>" "--sandbox <SANDBOX_MODE>" "--json" "-m, --model <MODEL>" "-c, --config <key=value>"',
        '  exit 0',
        'fi',
        'cat >/dev/null',
        'printf "%s\\n" \'{"type":"item.completed","item":{"id":"item_trace","type":"mcp_tool_call","server":"consuelo","tool":"call","arguments":{"tool":"fs.read","input":{"path":"README.md"}},"result":{"ok":true,"code":"OK"}}}\'',
        `printf "%s\\n" '{"type":"item.completed","item":{"id":"item_padding","type":"agent_message","text":"${'x'.repeat(9_000)}"}}'`,
        'printf "%s\\n" \'{"type":"item.completed","item":{"id":"item_message","type":"agent_message","text":"durable trace complete"}}\'',
        'printf "%s\\n" \'{"type":"turn.completed","usage":{"input_tokens":21,"output_tokens":8,"reasoning_output_tokens":3}}\'',
      ].join('\n'));
      chmodSync(codex, 0o700);
      const handoffRoot = join(tmpdir(), 'opensaas-handoffs');
      mkdirSync(handoffRoot, { recursive: true });
      const instructionPath = join(handoffRoot, `trace-durable-${process.pid}.md`);
      writeFileSync(instructionPath, 'Return a durable trace message.');
      process.env.WORKSPACE_SUBAGENT_CODEX_BIN = codex;
      try {
        const result = await executeTool('subagent', {
          provider: 'codex',
          action: 'run',
          policy: 'read',
          instructionPath,
          requestId: 'req_durable_trace_persistence',
        }, stableFacadeOptions());
        const firstRows = traceRows().filter((row) => row.source === 'subagent');
        const status = await executeTool('subagent', {
          action: 'status',
          runId: (result.data as { runId?: string } | undefined)?.runId,
        }, stableFacadeOptions());
        const secondRows = traceRows().filter((row) => row.source === 'subagent');
        return { result, status, firstRows, secondRows };
      } finally {
        rmSync(instructionPath, { force: true });
      }
    }

    if (scenario === 'auth') {
      const config = createGatewaySecurityConfig({
      home,
      workspaceId: 'workspace_trace_auth',
      workspaceSlug: 'trace-auth',
      workspaceHost: 'trace-auth.consuelohq.com',
    });
      globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify({
      active: true,
      workspace_host: 'trace-auth.consuelohq.com',
      scopes: ['tool:*:write'],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
      }))) as typeof fetch;
      const response = await authorizeConsueloOAuthMcpRequest({
      config,
      bearerToken: 'secret-bearer-token-that-must-not-be-stored',
      requiredScope: 'tool:mac.process:read',
    });
      return {
        status: response?.status,
        body: response ? await response.json() : null,
        rows: traceRows(),
      };
    }

    if (scenario === 'auth-principal-queued') {
      const dbPath = resolveCanonicalTraceDbPath();
      for (const principalKey of ['prn_first', 'prn_second']) {
        queueGatewayAuthenticationTraceSafely({
          workspaceId: 'workspace_trace_auth',
          route: '/mcp',
          requiredScope: 'mcp:read',
          authMode: 'oauth',
          principalKey,
        });
      }
      const immediateDbExists = existsSync(dbPath);
      await Bun.sleep(25);
      return { immediateDbExists, rows: traceRows() };
    }

    if (scenario === 'auth-principal') {
      const recorded = recordGatewayAuthenticationTraceSafely({
        workspaceId: 'workspace_trace_auth',
        route: '/mcp',
        requiredScope: 'mcp:read',
        authMode: 'oauth',
        principalKey: 'prn_0123456789abcdef0123456789abcdef',
      });
      return { recorded, rows: traceRows() };
    }

    throw new Error(`unknown scenario: ${scenario}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`trace persistence fixture failed for ${scenario}: ${message}`, { cause: error });
  }
}

const output = await run();
process.stdout.write(`${JSON.stringify(output)}\n`);
