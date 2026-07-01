import type { KeyEvent } from '@opentui/core';
import { loadRows } from '../db';
import { buildTraceHomeModel } from '../model';
import { renderTraceHome } from '../text-renderer';
import type { TraceHomeModel } from '../types';
import { keyToIntent } from './keymap';
import { terminalSize } from './layout';
import {
  initialTraceHomeState,
  reduceTraceHomeState,
  stateToBuildOptions,
  type TraceHomeState,
} from './state';

type OpenTuiCore = typeof import('@opentui/core');

export type TraceHomeAppOptions = {
  db: string;
  limit: number;
  interval: number;
  color: boolean;
  selectedTraceId?: string;
  rawJson?: boolean;
};

export type ConstructedTraceHomeApp = {
  model: TraceHomeModel;
  state: TraceHomeState;
  frame: string;
};

export function constructTraceHomeApp(
  model: TraceHomeModel,
  state: TraceHomeState = initialTraceHomeState,
): ConstructedTraceHomeApp {
  return {
    model,
    state,
    frame: renderTraceHome(model, { width: 151, height: 44, color: false }),
  };
}

function loadOpenTui(): Promise<OpenTuiCore> {
  const packageName = '@opentui/' + 'core';
  return import(packageName) as Promise<OpenTuiCore>;
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export async function runTraceHomeTui(options: TraceHomeAppOptions): Promise<void> {
  try {
    const { TextRenderable, createCliRenderer } = await loadOpenTui();
    const renderer = await createCliRenderer({
      screenMode: 'alternate-screen',
      exitOnCtrlC: false,
      consoleMode: 'disabled',
      targetFps: 20,
      useMouse: false,
      backgroundColor: '#020617',
    });

    let state: TraceHomeState = {
      ...initialTraceHomeState,
      selectedTraceId: options.selectedTraceId,
      rawJson: options.rawJson ?? false,
    };
    let current: TraceHomeModel | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let destroyed = false;

    const size = () => terminalSize(process.stdout);
    const initial = size();
    const frame = new TextRenderable(renderer, {
      id: 'trace-home-frame',
      content: '',
      width: initial.width,
      height: initial.height,
      fg: '#e5e7eb',
    });
    renderer.root.add(frame);

    const quitApp = () => {
      if (destroyed) return;
      destroyed = true;
      if (timer) clearInterval(timer);
      renderer.destroy();
    };

    const refresh = () => {
      try {
        const rows = loadRows(options.db, options.limit);
        current = buildTraceHomeModel(rows, stateToBuildOptions(state, current));
        state.selectedIndex = current.selectedIndex;
        state.selectedTraceId = current.selected?.traceId;
        const next = size();
        frame.width = next.width;
        frame.height = next.height;
        frame.content = renderTraceHome(current, {
          width: next.width,
          height: next.height,
          color: options.color,
        });
      } catch (error: unknown) {
        quitApp();
        throw normalizeError(error);
      }
    };

    const handleKey = (key: KeyEvent) => {
      const intent = keyToIntent(key);
      if (intent === 'quit') return quitApp();
      if (intent === 'pause') state = reduceTraceHomeState(state, { type: 'pause' });
      if (intent === 'up') state = reduceTraceHomeState(state, { type: 'move', delta: -1, rowCount: current?.visibleRows.length || 0 });
      if (intent === 'down') state = reduceTraceHomeState(state, { type: 'move', delta: 1, rowCount: current?.visibleRows.length || 0 });
      if (intent === 'failed') state = reduceTraceHomeState(state, { type: 'failed' });
      if (intent === 'group') state = reduceTraceHomeState(state, { type: 'group' });
      if (intent === 'help') state = reduceTraceHomeState(state, { type: 'help' });
      if (intent === 'escape') state = reduceTraceHomeState(state, { type: 'close' });
      if (intent === 'open') state = reduceTraceHomeState(state, { type: 'open' });
      if (intent === 'search') state = reduceTraceHomeState(state, { type: 'search', value: state.search ? '' : current?.selected?.tool || '' });
      if (intent === 'branch') state = reduceTraceHomeState(state, { type: 'branch', value: state.branchFilter ? undefined : current?.selected?.branch });
      if (intent === 'tool') state = reduceTraceHomeState(state, { type: 'tool', value: state.toolFilter ? undefined : current?.selected?.tool });
      if (intent === 'raw-json') state = reduceTraceHomeState(state, { type: 'raw-json' });
      if (intent === 'copy' && current?.selected?.traceId) {
        process.stdout.write(`\x1b]52;c;${Buffer.from(current.selected.traceId).toString('base64')}\x07`);
      }
      refresh();
    };

    renderer.keyInput.on('keypress', handleKey);
    timer = setInterval(() => { if (!state.paused) refresh(); }, options.interval);
    refresh();
  } catch (error: unknown) {
    throw normalizeError(error);
  }
}
