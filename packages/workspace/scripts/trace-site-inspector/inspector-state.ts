import {
  clean,
  isFailure,
  parseMaybeJson,
  stableTraceKey,
  totalTokens,
  type TraceRecord,
} from './model';

export type InspectorDisplayMode = 'formatted' | 'json';
export type InspectorLayout = 'split' | 'collapsed' | 'fullscreen';

export type InspectorState = {
  selectedKey: string;
  selectedRow: TraceRecord | null;
  layout: InspectorLayout;
  width: number;
  displayMode: InspectorDisplayMode;
  callQuery: string;
  callRailCollapsed: boolean;
};

export type InspectorSection = {
  id: 'input' | 'output' | 'error' | 'metadata';
  title: string;
  tone: 'neutral' | 'success' | 'error';
  value: unknown;
};

export type InspectorEvent =
  | { type: 'hydrate-selection'; key: string }
  | { type: 'select'; key: string; row: TraceRecord }
  | { type: 'clear-selection' }
  | { type: 'rows-replaced'; rows: TraceRecord[] }
  | { type: 'close' }
  | { type: 'toggle-collapse' }
  | { type: 'toggle-fullscreen' }
  | { type: 'toggle-call-rail' }
  | { type: 'resize'; width: number }
  | { type: 'set-display-mode'; mode: InspectorDisplayMode }
  | { type: 'set-call-query'; query: string };

const DEFAULT_WIDTH = 680;
const MIN_WIDTH = 420;
const MAX_WIDTH = 1_280;

export function createInspectorState(
  input: Partial<InspectorState> = {},
): InspectorState {
  return {
    selectedKey: '',
    selectedRow: null,
    layout: 'split',
    width: DEFAULT_WIDTH,
    displayMode: 'formatted',
    callQuery: '',
    callRailCollapsed: false,
    ...input,
  };
}

export function reduceInspectorState(
  state: InspectorState,
  event: InspectorEvent,
): InspectorState {
  switch (event.type) {
    case 'hydrate-selection':
      return event.key === state.selectedKey
        ? state
        : { ...state, selectedKey: event.key };
    case 'select':
      return {
        ...state,
        selectedKey: event.key,
        selectedRow: event.row,
        layout: state.layout === 'fullscreen' ? 'fullscreen' : 'split',
      };
    case 'clear-selection':
      return {
        ...state,
        selectedKey: '',
        selectedRow: null,
        layout: 'collapsed',
      };
    case 'rows-replaced': {
      if (!state.selectedKey) return state;
      const refreshed = findSelectedRow(event.rows, state.selectedKey);
      return refreshed ? { ...state, selectedRow: refreshed } : state;
    }
    case 'close':
      return { ...state, layout: 'collapsed' };
    case 'toggle-collapse':
      return {
        ...state,
        layout: state.layout === 'collapsed' ? 'split' : 'collapsed',
      };
    case 'toggle-call-rail':
      return { ...state, callRailCollapsed: !state.callRailCollapsed };
    case 'toggle-fullscreen':
      return {
        ...state,
        layout: state.layout === 'fullscreen' ? 'split' : 'fullscreen',
      };
    case 'resize':
      return {
        ...state,
        width: Math.min(
          MAX_WIDTH,
          Math.max(MIN_WIDTH, Math.round(event.width)),
        ),
        layout: state.layout === 'collapsed' ? 'split' : state.layout,
      };
    case 'set-display-mode':
      return { ...state, displayMode: event.mode };
    case 'set-call-query':
      return { ...state, callQuery: event.query.trim().toLowerCase() };
  }
}

export function inspectorSections(row: TraceRecord): InspectorSection[] {
  const input =
    parseMaybeJson(row.rawResolvedInputJson) ??
    row.resolvedInputObj ??
    parseMaybeJson(row.rawInputJson) ??
    row.inputObj ??
    row.input;
  const output =
    row.outputObj ??
    parseMaybeJson(row.rawResultJson) ??
    parseMaybeJson(row.output) ??
    row.summary;
  const error =
    parseMaybeJson(row.rawStderr) ??
    row.error ??
    (isFailure(row)
      ? {
          code: clean(row.code) || 'ERROR',
          message: clean(row.output ?? row.summary) || 'Trace failed.',
          exitCode: row.exitCode ?? null,
        }
      : null);
  const metadata = {
    traceId: row.traceId ?? row.trace ?? null,
    recordId: row.recordId ?? row.id ?? null,
    branch: row.branch ?? null,
    taskSession: row.taskSession ?? null,
    worktree: row.worktree ?? null,
    startTime: row.startTime ?? row.time ?? row.ts ?? null,
    status: row.status ?? null,
    code: row.code ?? null,
    exitCode: row.exitCode ?? null,
    durationMs: row.durationMs ?? null,
    inputTokens: row.inputTokens ?? null,
    outputTokens: row.outputTokens ?? null,
    totalTokens: totalTokens(row),
    cost: row.cost ?? null,
    metadata: row.metadata ?? null,
  };

  return [
    { id: 'input', title: 'Input', tone: 'neutral', value: input },
    {
      id: 'output',
      title: 'Output',
      tone: isFailure(row) ? 'neutral' : 'success',
      value: output,
    },
    {
      id: 'error',
      title: 'Error',
      tone: isFailure(row) ? 'error' : 'neutral',
      value: error,
    },
    { id: 'metadata', title: 'Metadata', tone: 'neutral', value: metadata },
  ];
}

export function normalizeBranchBreadcrumb(value: unknown): {
  stream: string;
  task: string;
  label: string;
} {
  const normalized = clean(value).replace(/^task\//, '');
  if (!normalized || normalized === 'no-branch')
    return { stream: 'no branch', task: '', label: 'no branch' };
  const [stream = normalized, ...rest] = normalized.split('/').filter(Boolean);
  const task = rest.join('/');
  return {
    stream,
    task,
    label: task ? stream + ' / ' + task : stream,
  };
}

export function filterInspectorCalls(
  rows: TraceRecord[],
  query: string,
): TraceRecord[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;
  return rows.filter((row) =>
    [
      row.name,
      row.traceName,
      row.tool,
      row.input,
      row.output,
      row.summary,
      row.status,
      row.code,
      row.displayTime,
      row.time,
      row.startTime,
    ]
      .map(clean)
      .join(' ')
      .toLowerCase()
      .includes(normalized),
  );
}

function findSelectedRow(
  rows: TraceRecord[],
  selectedKey: string,
): TraceRecord | null {
  return (
    rows.find(
      (row) =>
        stableTraceKey(row) === selectedKey ||
        clean(row.traceId ?? row.trace) === selectedKey,
    ) ?? null
  );
}

type InspectorListener = (state: InspectorState) => void;

class InspectorStore {
  private state = createInspectorState();
  private readonly listeners = new Set<InspectorListener>();

  getSnapshot(): InspectorState {
    return this.state;
  }

  dispatch(event: InspectorEvent): InspectorState {
    const next = reduceInspectorState(this.state, event);
    if (next === this.state) return this.state;
    this.state = next;
    for (const listener of this.listeners) listener(this.state);
    return this.state;
  }

  subscribe(listener: InspectorListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const inspectorStore = new InspectorStore();
