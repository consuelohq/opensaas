import type { GroupMode, TraceHomeBuildOptions, TraceHomeModel } from '../types';

export type ActivePane = 'table' | 'inspect';

export type TraceHomeState = {
  paused: boolean;
  selectedIndex: number;
  selectedTraceId?: string;
  search: string;
  failedOnly: boolean;
  branchFilter?: string;
  toolFilter?: string;
  group: GroupMode;
  help: boolean;
  rawJson: boolean;
  activePane: ActivePane;
};

export type TraceHomeAction =
  | { type: 'pause' }
  | { type: 'move'; delta: number; rowCount: number }
  | { type: 'failed' }
  | { type: 'group' }
  | { type: 'help' }
  | { type: 'close' }
  | { type: 'open' }
  | { type: 'search'; value: string }
  | { type: 'branch'; value?: string }
  | { type: 'tool'; value?: string }
  | { type: 'raw-json' };

export const initialTraceHomeState: TraceHomeState = {
  paused: false,
  selectedIndex: 0,
  search: '',
  failedOnly: false,
  group: 'none',
  help: false,
  rawJson: false,
  activePane: 'table',
};

function clampSelectedIndex(selectedIndex: number, rowCount: number): number {
  return Math.min(Math.max(selectedIndex, 0), Math.max(rowCount - 1, 0));
}

export function reduceTraceHomeState(
  state: TraceHomeState,
  action: TraceHomeAction,
): TraceHomeState {
  switch (action.type) {
    case 'pause':
      return { ...state, paused: !state.paused };
    case 'move':
      return {
        ...state,
        selectedTraceId: undefined,
        selectedIndex: clampSelectedIndex(state.selectedIndex + action.delta, action.rowCount),
      };
    case 'failed':
      return { ...state, failedOnly: !state.failedOnly, selectedTraceId: undefined, selectedIndex: 0 };
    case 'group':
      return { ...state, group: state.group === 'none' ? 'branch' : state.group === 'branch' ? 'tool' : 'none' };
    case 'help':
      return { ...state, help: !state.help };
    case 'close':
      return { ...state, help: false, activePane: 'table' };
    case 'open':
      return { ...state, activePane: 'inspect' };
    case 'search':
      return { ...state, search: action.value, selectedTraceId: undefined, selectedIndex: 0 };
    case 'branch':
      return { ...state, branchFilter: action.value || undefined, selectedTraceId: undefined, selectedIndex: 0 };
    case 'tool':
      return { ...state, toolFilter: action.value || undefined, selectedTraceId: undefined, selectedIndex: 0 };
    case 'raw-json':
      return { ...state, rawJson: !state.rawJson };
    default:
      return state;
  }
}

export function stateToBuildOptions(
  state: TraceHomeState,
  model?: TraceHomeModel,
): TraceHomeBuildOptions {
  return {
    live: !state.paused,
    selectedTraceId: state.selectedTraceId,
    selectedIndex: clampSelectedIndex(
      state.selectedIndex,
      model?.visibleRows.length || 1,
    ),
    search: state.search,
    failedOnly: state.failedOnly,
    branchFilter: state.branchFilter,
    toolFilter: state.toolFilter,
    group: state.group,
    rawJson: state.rawJson,
  };
}
