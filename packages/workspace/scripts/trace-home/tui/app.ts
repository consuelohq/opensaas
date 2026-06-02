import { loadRows } from '../db';
import { buildTraceHomeModel } from '../model';
import { renderTraceHome } from '../text-renderer';
import type { TraceHomeModel } from '../types';
import { keyToIntent } from './keymap';
import { initialTraceHomeState, reduceTraceHomeState, stateToBuildOptions, type TraceHomeState } from './state';
import { terminalSize } from './layout';

export type TraceHomeAppOptions = { db: string; limit: number; interval: number; color: boolean };
export type ConstructedTraceHomeApp = { model: TraceHomeModel; state: TraceHomeState; frame: string };
export function constructTraceHomeApp(model: TraceHomeModel, state: TraceHomeState = initialTraceHomeState): ConstructedTraceHomeApp { return { model, state, frame: renderTraceHome(model, { width: 151, height: 44, color: false }) }; }

async function loadOpenTui(): Promise<any> {
  const packageName = '@opentui/' + 'core';
  return import(packageName);
}

export async function runTraceHomeTui(options: TraceHomeAppOptions): Promise<void> {
  const { TextRenderable, createCliRenderer } = await loadOpenTui();
  const renderer = await createCliRenderer({ screenMode: 'alternate-screen', exitOnCtrlC: false, consoleMode: 'disabled', targetFps: 20, useMouse: false, backgroundColor: '#020617' });
  let state = { ...initialTraceHomeState };
  let current: TraceHomeModel | undefined;
  const size = () => terminalSize(process.stdout);
  const initial = size();
  const frame = new TextRenderable(renderer, { id: 'trace-home-frame', content: '', width: initial.width, height: initial.height, fg: '#e5e7eb' });
  renderer.root.add(frame);
  let timer: ReturnType<typeof setInterval>;
  const refresh = () => { const rows = loadRows(options.db, options.limit); current = buildTraceHomeModel(rows, stateToBuildOptions(state, current)); state.selectedIndex = current.selectedIndex; const next = size(); frame.width = next.width; frame.height = next.height; frame.content = renderTraceHome(current, { width: next.width, height: next.height, color: options.color }); };
  const quitApp = () => { clearInterval(timer); renderer.destroy(); };
  const handleKey = (key: any) => { const intent = keyToIntent(key); if (intent === 'quit') return quitApp(); if (intent === 'pause') state = reduceTraceHomeState(state, { type: 'pause' }); if (intent === 'up') state = reduceTraceHomeState(state, { type: 'move', delta: -1, rowCount: current?.visibleRows.length || 0 }); if (intent === 'down') state = reduceTraceHomeState(state, { type: 'move', delta: 1, rowCount: current?.visibleRows.length || 0 }); if (intent === 'failed') state = reduceTraceHomeState(state, { type: 'failed' }); if (intent === 'group') state = reduceTraceHomeState(state, { type: 'group' }); if (intent === 'help') state = reduceTraceHomeState(state, { type: 'help' }); if (intent === 'escape') state = reduceTraceHomeState(state, { type: 'close' }); if (intent === 'search') state = reduceTraceHomeState(state, { type: 'search', value: state.search ? '' : current?.selected?.tool || '' }); if (intent === 'branch') state = reduceTraceHomeState(state, { type: 'branch', value: state.branchFilter ? undefined : current?.selected?.branch }); if (intent === 'tool') state = reduceTraceHomeState(state, { type: 'tool', value: state.toolFilter ? undefined : current?.selected?.tool }); if (intent === 'raw-json') state = reduceTraceHomeState(state, { type: 'raw-json' }); if (intent === 'copy' && current?.selected?.traceId) process.stdout.write(`\x1b]52;c;${Buffer.from(current.selected.traceId).toString('base64')}\x07`); refresh(); };
  renderer.keyInput.on('keypress', handleKey);
  timer = setInterval(() => { if (!state.paused) refresh(); }, options.interval);
  refresh();
}
