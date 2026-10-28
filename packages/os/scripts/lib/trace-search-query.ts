export type TraceSearchField =
  | 'tool'
  | 'branch'
  | 'status'
  | 'node'
  | 'route'
  | 'trace'
  | 'code'
  | 'date';

export type TraceSearchTerm = {
  field: TraceSearchField | null;
  value: string;
};

export type CompiledTraceHistorySearch = {
  sql: string;
  values: Array<string | number>;
};

const TRACE_SEARCH_FIELD_ALIASES: Record<string, TraceSearchField> = {
  tool: 'tool',
  branch: 'branch',
  session: 'branch',
  status: 'status',
  node: 'node',
  route: 'route',
  trace: 'trace',
  id: 'trace',
  code: 'code',
  date: 'date',
  time: 'date',
};

const TRACE_SEARCH_TIME_ZONE = 'America/New_York';
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parseTraceSearchTerms(query: string): TraceSearchTerm[] {
  const terms: TraceSearchTerm[] = [];
  const pattern = /([a-z][a-z0-9_-]*):(?:"([^"]+)"|'([^']+)'|([^\s]+))|"([^"]+)"|'([^']+)'|([^\s]+)/gi;
  for (const match of query.trim().matchAll(pattern)) {
    const rawField = clean(match[1]).toLowerCase();
    const field = rawField ? TRACE_SEARCH_FIELD_ALIASES[rawField] ?? null : null;
    const rawValue = clean(
      match[2] ?? match[3] ?? match[4] ?? match[5] ?? match[6] ?? match[7],
    );
    if (!rawValue) continue;
    if (rawField && !field) {
      terms.push({ field: null, value: `${rawField}:${rawValue}`.toLowerCase() });
      continue;
    }
    terms.push({ field, value: rawValue.toLowerCase() });
  }
  return terms;
}

export function compileTraceHistorySearch(query: string): CompiledTraceHistorySearch {
  const clauses: string[] = [];
  const values: Array<string | number> = [];
  for (const term of parseTraceSearchTerms(query)) {
    const compiled = compileTerm(term);
    if (!compiled) continue;
    clauses.push(compiled.sql);
    values.push(...compiled.values);
  }
  return {
    sql: clauses.length ? clauses.map((clause) => `(${clause})`).join(' AND ') : '1 = 1',
    values,
  };
}

function compileTerm(term: TraceSearchTerm): CompiledTraceHistorySearch | null {
  const like = `%${escapeLike(term.value)}%`;
  switch (term.field) {
    case 'tool':
      return likeClause(["lower(coalesce(tool, ''))"], like);
    case 'branch':
      return likeClause(
        [
          "lower(coalesce(branch, ''))",
          "lower(coalesce(task_session, ''))",
          "lower(coalesce(work_session, ''))",
          "lower(coalesce(work_path, ''))",
        ],
        like,
      );
    case 'node':
      return likeClause(
        [
          "lower(coalesce(requested_node_id, ''))",
          "lower(coalesce(resolved_node_id, ''))",
          "lower(coalesce(resolved_node_name, ''))",
          "lower(coalesce(default_node_id, ''))",
        ],
        like,
      );
    case 'route':
      return likeClause(["lower(coalesce(route_source, ''))"], like);
    case 'trace':
      return likeClause(
        [
          "lower(coalesce(id, ''))",
          "lower(coalesce(trace_id, ''))",
          "lower(coalesce(mcp_trace_id, ''))",
        ],
        like,
      );
    case 'code':
      return likeClause(["lower(coalesce(code, ''))"], like);
    case 'status':
      return compileStatusTerm(term.value, like);
    case 'date':
      return compileDateTerm(term.value, like);
    case null:
      return likeClause(
        [
          "lower(coalesce(tool, ''))",
          "lower(coalesce(branch, ''))",
          "lower(coalesce(task_session, ''))",
          "lower(coalesce(work_session, ''))",
          "lower(coalesce(work_path, ''))",
          "lower(coalesce(status, ''))",
          "lower(coalesce(code, ''))",
          "lower(coalesce(trace_id, ''))",
          "lower(coalesce(mcp_trace_id, ''))",
          "lower(coalesce(resolved_node_name, ''))",
          "lower(coalesce(route_source, ''))",
          "lower(coalesce(ts, ''))",
        ],
        like,
      );
  }
}

function compileStatusTerm(value: string, like: string): CompiledTraceHistorySearch {
  const normalized = value.toLowerCase();
  if (normalized === 'error' || normalized === 'failed' || normalized === 'failure') {
    return {
      sql: [
        "lower(coalesce(status, '')) LIKE ? ESCAPE '\\'",
        'coalesce(ok, 1) = 0',
        'coalesce(exit_code, 0) != 0',
        "lower(coalesce(code, 'OK')) != 'ok'",
      ].join(' OR '),
      values: [like],
    };
  }
  if (normalized === 'success' || normalized === 'succeeded' || normalized === 'ok') {
    return {
      sql: [
        "lower(coalesce(status, '')) LIKE ? ESCAPE '\\'",
        "(coalesce(ok, 1) = 1 AND coalesce(exit_code, 0) = 0 AND lower(coalesce(code, 'OK')) = 'ok')",
      ].join(' OR '),
      values: [like],
    };
  }
  return likeClause(["lower(coalesce(status, ''))"], like);
}

function compileDateTerm(value: string, like: string): CompiledTraceHistorySearch {
  if (!ISO_DAY.test(value)) {
    return likeClause(["lower(coalesce(ts, ''))"], like);
  }
  const [start, end] = easternDayBounds(value);
  return {
    sql: 'ts >= ? AND ts < ?',
    values: [start, end],
  };
}

function likeClause(columns: string[], value: string): CompiledTraceHistorySearch {
  return {
    sql: columns.map((column) => `${column} LIKE ? ESCAPE '\\'`).join(' OR '),
    values: columns.map(() => value),
  };
}

function escapeLike(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

function easternDayBounds(day: string): [string, string] {
  const [year, month, date] = day.split('-').map(Number);
  const start = zonedLocalToUtc(year, month, date, TRACE_SEARCH_TIME_ZONE);
  const nextLocal = new Date(Date.UTC(year, month - 1, date + 1));
  const end = zonedLocalToUtc(
    nextLocal.getUTCFullYear(),
    nextLocal.getUTCMonth() + 1,
    nextLocal.getUTCDate(),
    TRACE_SEARCH_TIME_ZONE,
  );
  return [start.toISOString(), end.toISOString()];
}

function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  const desired = Date.UTC(year, month - 1, day, 0, 0, 0);
  let candidate = desired - timeZoneOffsetMs(new Date(desired), timeZone);
  candidate = desired - timeZoneOffsetMs(new Date(candidate), timeZone);
  return new Date(candidate);
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour === 24 ? 0 : parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}
