import { clean, parseMaybeJson, type TraceRecord } from './model';

type Fields = Record<string, unknown>;
export type TraceToolProfile = {
  family: string;
  input: string[];
  output: string[];
  secondary: string[];
};

// Profiles rank the information needed to understand a call; they never execute it.
const profiles: Record<string, TraceToolProfile> = {
  files: {
    family: 'files',
    input: [
      'path',
      'files',
      'pattern',
      'query',
      'from',
      'to',
      'content',
      'patchText',
    ],
    output: ['files', 'path', 'content', 'matches', 'entries', 'stdout'],
    secondary: ['encoding', 'mime', 'offset', 'limit', 'totalLines'],
  },
  search: {
    family: 'search',
    input: ['query', 'keyword', 'pattern', 'path', 'category', 'limit'],
    output: ['results', 'tools', 'matches', 'items'],
    secondary: [
      'index_stats',
      'policy',
      'voi_challenger',
      'promotion_gate',
      'telemetry',
    ],
  },
  steering: {
    family: 'steering',
    input: ['reason'],
    output: ['content', 'message', 'decision'],
    secondary: ['chars', 'estimatedOutputTokens'],
  },
  github: {
    family: 'github',
    input: ['reason', 'operation', 'repo', 'pr', 'branch', 'rawArgs'],
    output: [
      'summary',
      'details',
      'findings',
      'checks',
      'jobs',
      'items',
      'text',
    ],
    secondary: ['command', 'raw', 'schema', 'dryRun'],
  },
  browser: {
    family: 'browser',
    input: ['action', 'url', 'selector', 'ref', 'text', 'js', 'expression'],
    output: ['url', 'title', 'screenshot', 'snapshot', 'result', 'raw'],
    secondary: ['sessionId', 'browserId', 'tabId'],
  },
  code: {
    family: 'code',
    input: ['language', 'mode', 'code', 'command', 'cwd'],
    output: ['stdout', 'result', 'output', 'filesChanged', 'stderr'],
    secondary: [
      'stdoutLogPath',
      'stderrLogPath',
      'operations',
      'console',
      'runtime',
    ],
  },
  batch: {
    family: 'batch',
    input: ['steps'],
    output: ['results', 'completed'],
    secondary: [],
  },
  validation: {
    family: 'validation',
    input: ['base', 'pr', 'reason', 'strict'],
    output: [
      'summary',
      'issues',
      'failures',
      'checks',
      'suites',
      'results',
      'nextSteps',
      'raw',
    ],
    secondary: ['files', 'artifacts'],
  },
  task: {
    family: 'task',
    input: ['title', 'kind', 'area', 'message', 'branch', 'pr', 'startFrom'],
    output: [
      'branch',
      'stream',
      'prUrl',
      'reviewPrUrl',
      'message',
      'taskPrMerged',
      'worktreePath',
      'nextSteps',
    ],
    secondary: [
      'manifestBundle',
      'hookEvent',
      'hookResult',
      'tmuxSession',
      'streamContext',
    ],
  },
  stream: {
    family: 'stream',
    input: ['area', 'branch', 'reason'],
    output: [
      'stream',
      'aheadBehind',
      'openTaskPullRequests',
      'recentCommits',
      'instructions',
    ],
    secondary: ['recentWorkpads', 'worktrees', 'decisions'],
  },
  runtime: {
    family: 'runtime',
    input: ['action', 'channel', 'version', 'pr', 'reason'],
    output: [
      'version',
      'phase',
      'message',
      'installState',
      'raw',
      'result',
      'nextSteps',
    ],
    secondary: ['preferences', 'detail', 'bundleId'],
  },
  linear: {
    family: 'linear',
    input: ['id', 'identifier', 'title', 'description', 'query', 'status'],
    output: [
      'identifier',
      'title',
      'status',
      'url',
      'description',
      'issues',
      'results',
    ],
    secondary: ['team', 'project', 'labels', 'assignee'],
  },
  diff: {
    family: 'diff',
    input: ['base', 'paths', 'files', 'head'],
    output: ['summary', 'stat', 'files', 'patch', 'diff'],
    secondary: [],
  },
  generic: {
    family: 'generic',
    input: ['reason', 'query', 'path', 'url', 'command', 'action', 'operation'],
    output: [
      'error',
      'message',
      'content',
      'stdout',
      'result',
      'results',
      'summary',
      'raw',
    ],
    secondary: [],
  },
};
export function traceToolProfile(row: TraceRecord): TraceToolProfile {
  const tool = clean(row.name ?? row.traceName ?? row.tool);
  if (/^(?:get_steering|refresh_steering)$/.test(tool))
    return profiles.steering;
  if (/^(?:fs\.|workpad\.)/.test(tool)) return profiles.files;
  if (/^(?:tools\.search|explore|memory)$/.test(tool)) return profiles.search;
  if (/^github(?:\.|$)/.test(tool)) return profiles.github;
  if (/^browser(?:\.|$)/.test(tool)) return profiles.browser;
  if (/^(?:code\.|mac\.call)/.test(tool)) return profiles.code;
  if (tool === 'batch') return profiles.batch;
  if (/^(?:verify|review|aiReview|prReview|audit|checkFiles|doctor)/.test(tool))
    return profiles.validation;
  if (/^(?:task\.|session\.)/.test(tool)) return profiles.task;
  if (/^stream\./.test(tool)) return profiles.stream;
  if (/^(?:lifecycle\.|server|release)/.test(tool)) return profiles.runtime;
  if (/^linear\./.test(tool)) return profiles.linear;
  if (/^git\./.test(tool)) return profiles.diff;
  return profiles.generic;
}

export function traceObject(value: unknown): Fields | null {
  const parsed = parseMaybeJson(value);
  return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Fields)
    : null;
}
const inputTransport = new Set([
  'requestId',
  'taskSession',
  'workSession',
  'taskWorktree',
  'parentTraceId',
  'maxResultChars',
]);
const outputTransport = new Set([
  'now',
  'apiVersion',
  'traceId',
  'requestId',
  'parentTraceId',
  'durationMs',
  'exitCode',
  'inputTokens',
  'outputTokens',
  'totalTokens',
]);
const genericSuccess =
  /^(?:(?:command|code\.call|mac command) )?complete[d]?\.?$|^(?:OK|success|done)$/i;

export type PreparedTraceReading = {
  input: unknown;
  output: unknown;
  bookkeeping: Fields;
  alerts: string[];
  profile: TraceToolProfile;
};

export function prepareTraceReading(row: TraceRecord): PreparedTraceReading {
  const profile = traceToolProfile(row);
  const rawInput = [
    row.rawResolvedInputJson,
    row.resolvedInputObj,
    row.rawInputJson,
    row.inputObj,
    row.input,
  ]
    .map(parseMaybeJson)
    .find((value) => value !== undefined && value !== null && value !== '');
  let input = rawInput;
  const bookkeeping: Fields = {};
  const fields = traceObject(input);
  if (fields) {
    input = Object.fromEntries(
      Object.entries(fields).filter(([key]) => {
        if (!inputTransport.has(key)) return true;
        bookkeeping[key] = fields[key];
        return false;
      }),
    );
    const usable = input as Fields;
    if (usable.filesJson) {
      if (!Array.isArray(usable.files))
        usable.files = parseMaybeJson(usable.filesJson);
      delete usable.filesJson;
    }
    // Invocation context is already in the header; it is not a tool parameter.
    if (usable.branch === row.branch) delete usable.branch;
  }
  let output = [
    row.rawResultJson,
    row.outputObj,
    row.resultObj,
    row.output,
    row.summary,
  ]
    .map(parseMaybeJson)
    .find((value) => value !== undefined && value !== null && value !== '');
  const alerts: string[] = [];
  // Both canonical DB rows and embedded batch results can carry serialized envelopes.
  for (let depth = 0; depth < 12; depth++) {
    const obj = traceObject(output);
    if (!obj) break;
    if (obj.ok === false) {
      for (const key of ['message', 'error', 'detail', 'reason']) {
        if (typeof obj[key] === 'string' && obj[key])
          alerts.push(String(obj[key]));
      }
    }
    if (
      Array.isArray(obj.content) &&
      obj.content.every((item) => traceObject(item)?.type === 'text')
    ) {
      output = parseMaybeJson(
        obj.content.map((item) => traceObject(item)?.text ?? '').join('\n'),
      );
      continue;
    }
    const transport =
      typeof obj.ok === 'boolean' &&
      ('data' in obj || 'result' in obj) &&
      (typeof obj.code === 'string' ||
        'now' in obj ||
        'apiVersion' in obj ||
        'exitCode' in obj);
    if (!transport) break;
    const next = 'data' in obj ? obj.data : obj.result;
    bookkeeping['envelope' + depth] = Object.fromEntries(
      Object.entries(obj).filter(([key]) => key !== 'data' && key !== 'result'),
    );
    output = parseMaybeJson(next);
  }
  const out = traceObject(output);
  if (out) {
    const success =
      out.ok !== false && row.ok !== false && row.status !== 'error';
    output = Object.fromEntries(
      Object.entries(out).filter(([key, value]) => {
        if (
          outputTransport.has(key) ||
          (success &&
            ((key === 'ok' && value === true) ||
              (key === 'code' && /^(?:OK|SUCCESS)$/.test(String(value))) ||
              (key === 'message' && genericSuccess.test(String(value))) ||
              (key === 'stderr' && (!value || /^\$\s/.test(String(value))))))
        ) {
          bookkeeping[key] = value;
          return false;
        }
        return true;
      }),
    );
    const result = output as Fields;
    if (profile.family === 'github') {
      const packet = traceObject(result.packet);
      if (packet) {
        if (!result.summary && packet.summary) result.summary = packet.summary;
        if (packet.details) result.details = packet.details;
        bookkeeping.packet = packet;
        delete result.packet;
      }
      for (const key of ['operation', 'repo', 'dryRun', 'command']) {
        if (key in result) {
          bookkeeping[key] = result[key];
          delete result[key];
        }
      }
    }
    if (profile.family === 'browser' && typeof result.raw === 'string') {
      const lines = result.raw.split('\n');
      const remaining: string[] = [];
      for (const line of lines) {
        const match = line.match(/^(url|title|screenshot):\s*(.+)$/i);
        if (match) result[match[1].toLowerCase()] = match[2];
        else remaining.push(line);
      }
      result.snapshot = remaining.join('\n').trim();
      delete result.raw;
    }
    if (profile.family === 'steering' && !('content' in result)) {
      result.content =
        'The steering document was not saved for this historical call.';
    }
  }
  return { input, output, bookkeeping, alerts: [...new Set(alerts)], profile };
}
