import { Database } from 'bun:sqlite';
import fs from 'node:fs';
import path from 'node:path';

import { toolPackages } from '../../tools/registry';
import { resolveConsueloHomeLayout } from './consuelo-home';
import { resolveCanonicalTraceDbPath } from './trace-persistence';
import {
  classifyTraceFailure,
  summarizeTraceFailures,
  type ClassifiedTraceFailure,
  type MonitorToolContract,
  type MonitorTraceFailure,
} from './monitor-errors';

type TraceRow = {
  trace_id: string;
  ts: string;
  tool: string;
  code: string | null;
  status: string | null;
  branch: string | null;
  task_session: string | null;
};

export type MonitorErrorsReport = {
  schemaVersion: 1;
  generatedAt: string;
  window: '24h';
  traceDb: string;
  reportPath: string;
  summary: ReturnType<typeof summarizeTraceFailures>;
  groups: ClassifiedTraceFailure[];
};

function reportTimestamp(now: Date): string {
  return now.toISOString().replace(/[:.]/g, '-');
}

function writePrivateJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function toolContracts(): Map<string, MonitorToolContract> {
  const contracts = new Map<string, MonitorToolContract>();
  for (const toolPackage of toolPackages) {
    for (const definition of toolPackage.definitions) {
      const capabilities = definition.capabilities as Record<string, unknown> | undefined;
      contracts.set(definition.name, {
        name: definition.name,
        readOnly: capabilities?.readOnly === true,
        mutating: capabilities?.mutating === true,
        sessionRequired: definition.sessionRequired === true,
      });
    }
  }
  return contracts;
}

function aggregate(rows: TraceRow[]): MonitorTraceFailure[] {
  const grouped = new Map<string, {
    latest: TraceRow;
    occurrences: number;
    branches: Set<string>;
    sessions: Set<string>;
  }>();
  for (const row of rows) {
    const code = (row.code ?? row.status ?? 'UNKNOWN').trim() || 'UNKNOWN';
    const key = `${row.tool}\u0000${code}`;
    const existing = grouped.get(key);
    const next = existing ?? {
      latest: row,
      occurrences: 0,
      branches: new Set<string>(),
      sessions: new Set<string>(),
    };
    next.occurrences += 1;
    if (row.ts > next.latest.ts) next.latest = row;
    if (row.branch) next.branches.add(row.branch);
    if (row.task_session) next.sessions.add(row.task_session);
    grouped.set(key, next);
  }
  return [...grouped.values()].map((group) => ({
    traceId: group.latest.trace_id,
    ts: group.latest.ts,
    tool: group.latest.tool,
    code: group.latest.code ?? group.latest.status ?? 'UNKNOWN',
    status: group.latest.status ?? 'error',
    ...(group.latest.branch ? { branch: group.latest.branch } : {}),
    ...(group.latest.task_session ? { taskSession: group.latest.task_session } : {}),
    occurrences: group.occurrences,
    affectedBranches: group.branches.size,
    affectedSessions: group.sessions.size,
  }));
}

export function buildMonitorErrorsReport(options: {
  home?: string;
  env?: NodeJS.ProcessEnv;
  now?: Date;
} = {}): MonitorErrorsReport {
  const traceDb = resolveCanonicalTraceDbPath({ home: options.home, env: options.env });
  const now = options.now ?? new Date();
  const layout = resolveConsueloHomeLayout(options.home);
  const reportPath = path.join(layout.nodeCacheDir, 'monitor-errors', `${reportTimestamp(now)}.json`);
  const database = new Database(traceDb, { readonly: true, strict: true });
  try {
    const rows = database.query<TraceRow, []>(`
      SELECT trace_id, ts, tool, code, status, branch, task_session
      FROM tool_traces
      WHERE ts >= datetime('now', '-24 hours')
        AND (
          coalesce(status, '') != 'ok'
          OR coalesce(code, '') != 'OK'
        )
      ORDER BY ts DESC
      LIMIT 10000
    `).all();
    const contracts = toolContracts();
    const groups = aggregate(rows)
      .map((failure) => classifyTraceFailure(failure, contracts.get(failure.tool)))
      .sort((left, right) => {
        if (left.actionable !== right.actionable) return left.actionable ? -1 : 1;
        if ((left.occurrences ?? 0) !== (right.occurrences ?? 0)) {
          return (right.occurrences ?? 0) - (left.occurrences ?? 0);
        }
        return right.ts.localeCompare(left.ts);
      });
    const report: MonitorErrorsReport = {
      schemaVersion: 1,
      generatedAt: now.toISOString(),
      window: '24h',
      traceDb,
      reportPath,
      summary: summarizeTraceFailures(groups),
      groups,
    };
    writePrivateJson(reportPath, report);
    return report;
  } finally {
    database.close();
  }
}
