import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
  type VirtualItem,
  type VirtualizerOptions,
} from '@tanstack/virtual-core';

import {
  clean,
  dedupeTraceRows,
  isFailure,
  number,
  parseMaybeJson,
  stableTraceKey,
  totalTokens,
  type TraceRecord,
} from './model';
import { mergeTraceRows, shouldPrefetchTracePage } from './trace-list';

const MAX_RETAINED_ROWS = 5_000;
const PREFETCH_THRESHOLD = 25;
const ESTIMATED_ROW_HEIGHT = 44;
const OVERSCAN = 12;

type TraceFeedPayload = {
  meta?: { nextCursor?: unknown };
  rows?: TraceRecord[];
};

type TraceFilterState = {
  query: string;
  branch: string | null;
  tool: string | null;
  status: string | null;
};

type TraceListTarget = {
  scroller: HTMLElement;
  content: HTMLElement;
};

type TraceListDiagnostics = {
  retained: number;
  filtered: number;
  items: number;
  mounted: number;
  range: string;
  nextCursor: string | null;
};

type TracePrefetchRequestDetail = {
  cursor: string;
  rowCount: number;
  lastVirtualIndex: number;
  accept: (rows: TraceRecord[], nextCursor: string | null) => void;
  fail: () => void;
};

type ChildOperation = TraceRecord & {
  children?: ChildOperation[];
  depth: number;
  path: string;
};

type VirtualTraceItem = {
  key: string;
  traceKey: string;
  rootIndex: number;
  row: TraceRecord;
  child: ChildOperation | null;
};

export type TraceVirtualListApi = {
  appendPage: (rows: TraceRecord[], nextCursor: string | null) => void;
  prependRows: (rows: TraceRecord[]) => void;
  replaceRows: (rows: TraceRecord[], nextCursor?: string | null) => void;
  setNextCursor: (nextCursor: string | null) => void;
  scrollToKey: (key: string) => void;
  diagnostics: () => TraceListDiagnostics | null;
};

type TraceWindow = Window & {
  __traceRowsByTraceId?: Map<string, TraceRecord>;
  __traceSelectedKey?: string;
  __traceVirtualList?: TraceVirtualListApi;
};

type TraceVirtualizer = Virtualizer<HTMLElement, HTMLButtonElement>;

const filters: TraceFilterState = {
  query: '',
  branch: null,
  tool: null,
  status: null,
};

class TraceVirtualListController {
  private rows: TraceRecord[];
  private filteredRows: TraceRecord[] = [];
  private items: VirtualTraceItem[] = [];
  private nextCursor: string | null;
  private lastRequestedCursor: string | null = null;
  private fetching = false;
  private ownedMap = new Map<string, TraceRecord>();
  private ownedFingerprint = '';
  private mountedCount = 0;
  private range = 'empty';
  private readonly virtualizer: TraceVirtualizer;
  private readonly unmount: () => void;

  constructor(
    private readonly target: TraceListTarget,
    rows: TraceRecord[],
    nextCursor: string | null,
  ) {
    this.rows = mergeTraceRows([], rows, {
      direction: 'append',
      maxRows: MAX_RETAINED_ROWS,
      selectedKey: currentSelectedKey(),
    });
    this.nextCursor = nextCursor;
    this.target.scroller.dataset.traceVirtualList = 'active';
    this.target.content.dataset.traceVirtualContent = '';
    this.target.content.replaceChildren();
    this.refreshItems();

    this.virtualizer = new Virtualizer(this.virtualizerOptions());
    this.unmount = this.virtualizer._didMount();
    this.virtualizer._willUpdate();
    this.replaceOwnedMap();
    this.render(this.virtualizer);
  }

  isMountedOn(target: TraceListTarget): boolean {
    return (
      this.target.scroller === target.scroller &&
      this.target.content === target.content &&
      this.target.content.isConnected
    );
  }

  destroy(): void {
    this.unmount();
    this.target.scroller.removeAttribute('data-trace-virtual-list');
    this.target.content.removeAttribute('data-trace-virtual-content');
  }

  syncFromWindow(): void {
    const map = traceWindow().__traceRowsByTraceId;
    if (!(map instanceof Map)) return;
    const fingerprint = mapFingerprint(map);
    if (map === this.ownedMap && fingerprint === this.ownedFingerprint) return;
    this.replaceRows(dedupeTraceRows(map.values()));
  }

  syncFilters(): void {
    this.refreshItems();
    this.commitItems(true);
  }

  appendPage(rows: TraceRecord[], nextCursor: string | null): void {
    this.nextCursor = nextCursor;
    this.lastRequestedCursor = null;
    this.fetching = false;
    this.setRows(rows, 'append');
  }

  prependRows(rows: TraceRecord[]): void {
    this.setRows(rows, 'prepend');
  }

  replaceRows(rows: TraceRecord[], nextCursor = this.nextCursor): void {
    this.nextCursor = nextCursor;
    this.lastRequestedCursor = null;
    this.fetching = false;
    this.rows = mergeTraceRows([], rows, {
      direction: 'append',
      maxRows: MAX_RETAINED_ROWS,
      selectedKey: currentSelectedKey(),
    });
    this.refreshItems();
    this.commitItems(false);
  }

  setNextCursor(nextCursor: string | null): void {
    if (nextCursor !== this.nextCursor) this.lastRequestedCursor = null;
    this.nextCursor = nextCursor;
    this.updateDiagnostics();
    this.maybeRequestNextPage(this.lastVisibleRootIndex());
  }

  scrollToKey(key: string): void {
    const index = this.items.findIndex((item) => item.traceKey === key);
    if (index >= 0) this.virtualizer.scrollToIndex(index, { align: 'auto' });
  }

  diagnostics(): TraceListDiagnostics {
    return {
      retained: this.rows.length,
      filtered: this.filteredRows.length,
      items: this.items.length,
      mounted: this.mountedCount,
      range: this.range,
      nextCursor: this.nextCursor,
    };
  }

  select(key: string): void {
    const target = traceWindow();
    target.__traceSelectedKey = key;
    for (const row of this.target.content.querySelectorAll<HTMLElement>(
      '.trxRow',
    )) {
      const active = row.dataset.traceKey === key;
      row.classList.toggle('selected', active);
      row.setAttribute('aria-selected', String(active));
    }
    document.dispatchEvent(
      new CustomEvent('trace:selection-change', { detail: { key } }),
    );
  }

  clearSelection(): void {
    traceWindow().__traceSelectedKey = '';
    for (const row of this.target.content.querySelectorAll<HTMLElement>(
      '.trxRow',
    )) {
      row.classList.remove('selected');
      row.setAttribute('aria-selected', 'false');
    }
    document.dispatchEvent(
      new CustomEvent('trace:selection-change', { detail: { key: '' } }),
    );
  }

  private setRows(rows: TraceRecord[], direction: 'append' | 'prepend'): void {
    this.rows = mergeTraceRows(this.rows, rows, {
      direction,
      maxRows: MAX_RETAINED_ROWS,
      selectedKey: currentSelectedKey(),
    });
    this.refreshItems();
    this.commitItems(false);
  }

  private refreshItems(): void {
    this.filteredRows = this.rows.filter(matchesCurrentFilters);
    this.items = flattenTraceItems(this.filteredRows);
  }

  private commitItems(resetScroll: boolean): void {
    this.replaceOwnedMap();
    this.virtualizer.setOptions(this.virtualizerOptions());
    this.virtualizer._willUpdate();
    this.virtualizer.measure();
    if (resetScroll) this.virtualizer.scrollToOffset(0);
    this.render(this.virtualizer);
  }

  private replaceOwnedMap(): void {
    this.ownedMap = traceMapForRows(this.rows);
    this.ownedFingerprint = mapFingerprint(this.ownedMap);
    traceWindow().__traceRowsByTraceId = this.ownedMap;
  }

  private virtualizerOptions(): VirtualizerOptions<
    HTMLElement,
    HTMLButtonElement
  > {
    return {
      count: this.items.length,
      getScrollElement: () => this.target.scroller,
      estimateSize: () => ESTIMATED_ROW_HEIGHT,
      getItemKey: (index) => this.items[index]?.key ?? index,
      overscan: OVERSCAN,
      scrollMargin: this.target.content.offsetTop,
      observeElementRect,
      observeElementOffset,
      scrollToFn: elementScroll,
      onChange: (instance) => this.render(instance),
    };
  }

  private render(instance: TraceVirtualizer): void {
    const virtualItems = instance.getVirtualItems();
    const fragment = document.createDocumentFragment();
    const selectedKey = currentSelectedKey();
    const scrollMargin = instance.options.scrollMargin ?? 0;

    for (const virtualItem of virtualItems) {
      const item = this.items[virtualItem.index];
      if (!item) continue;
      fragment.append(
        createTraceRow(item, virtualItem, selectedKey, scrollMargin),
      );
    }

    this.target.content.style.height = `${Math.max(
      0,
      Math.ceil(instance.getTotalSize() - scrollMargin),
    )}px`;
    this.target.content.replaceChildren(fragment);
    this.mountedCount = virtualItems.length;
    const first = virtualItems.at(0)?.index;
    const last = virtualItems.at(-1)?.index;
    this.range =
      first === undefined || last === undefined ? 'empty' : `${first}-${last}`;
    this.updateDiagnostics();
    this.updateFooter();
    this.maybeRequestNextPage(this.lastVisibleRootIndex(virtualItems));
  }

  private updateDiagnostics(): void {
    this.target.scroller.dataset.traceTotal = String(this.rows.length);
    this.target.scroller.dataset.traceFiltered = String(
      this.filteredRows.length,
    );
    this.target.scroller.dataset.traceItems = String(this.items.length);
    this.target.scroller.dataset.traceMounted = String(this.mountedCount);
    this.target.scroller.dataset.traceRange = this.range;
    this.target.scroller.dataset.traceNextCursor = this.nextCursor ?? '';
  }

  private updateFooter(): void {
    const footer = this.target.scroller
      .closest('.trxTablePane')
      ?.querySelector<HTMLElement>('.trxFooter');
    if (!footer) return;
    footer.dataset.traceVirtualFooter = '';
    const count = footer.querySelector<HTMLElement>('[data-trace-count]');
    if (count) count.textContent = String(this.filteredRows.length);
  }

  private lastVisibleRootIndex(
    virtualItems = this.virtualizer.getVirtualItems(),
  ): number | null {
    const itemIndex = virtualItems.at(-1)?.index;
    return itemIndex === undefined
      ? null
      : (this.items[itemIndex]?.rootIndex ?? null);
  }

  private maybeRequestNextPage(lastVirtualIndex: number | null): void {
    if (
      this.nextCursor === this.lastRequestedCursor ||
      !shouldPrefetchTracePage({
        lastVirtualIndex,
        rowCount: this.filteredRows.length,
        threshold: PREFETCH_THRESHOLD,
        nextCursor: this.nextCursor,
        fetching: this.fetching,
      })
    )
      return;

    const cursor = this.nextCursor;
    if (!cursor) return;
    this.lastRequestedCursor = cursor;
    this.fetching = true;
    this.target.scroller.dataset.tracePrefetch = 'requested';
    const event = new CustomEvent<TracePrefetchRequestDetail>(
      'trace:prefetch-request',
      {
        cancelable: true,
        detail: {
          cursor,
          rowCount: this.rows.length,
          lastVirtualIndex: lastVirtualIndex ?? -1,
          accept: (rows, nextCursor) => this.appendPage(rows, nextCursor),
          fail: () => {
            this.fetching = false;
            this.target.scroller.dataset.tracePrefetch = 'failed';
          },
        },
      },
    );
    document.dispatchEvent(event);
    queueMicrotask(() => {
      if (!this.fetching) return;
      this.fetching = false;
      this.target.scroller.dataset.tracePrefetch = event.defaultPrevented
        ? 'handled'
        : 'unhandled';
    });
  }
}

function flattenTraceItems(rows: TraceRecord[]): VirtualTraceItem[] {
  const items: VirtualTraceItem[] = [];
  rows.forEach((row, rootIndex) => {
    const traceKey = stableTraceKey(row);
    items.push({
      key: `${traceKey}::trace`,
      traceKey,
      rootIndex,
      row,
      child: null,
    });
    for (const child of childOperations(row)) {
      items.push({
        key: `${traceKey}::${child.path}`,
        traceKey,
        rootIndex,
        row,
        child,
      });
    }
  });
  return items;
}

function childOperations(row: TraceRecord): ChildOperation[] {
  const parsed = parseMaybeJson(row.batchResultsJson);
  const source = Array.isArray(parsed)
    ? parsed
    : (asRecord(parsed)?.children ?? asRecord(parsed)?.results);
  if (!Array.isArray(source)) return [];

  const result: ChildOperation[] = [];
  const walk = (value: unknown, depth: number, parentPath: string) => {
    const record = asRecord(value);
    if (!record) return;
    const label = clean(
      record.path ?? record.tool ?? record.name ?? record.label,
    );
    const path = label || `${parentPath || 'child'}-${result.length + 1}`;
    const operation = {
      ...record,
      depth,
      path: parentPath ? `${parentPath}/${path}` : path,
    } as ChildOperation;
    result.push(operation);
    const children = parseMaybeJson(record.children);
    if (Array.isArray(children))
      children.forEach((child) => walk(child, depth + 1, operation.path));
  };
  source.forEach((child) => walk(child, 1, ''));
  return result;
}

function createTraceRow(
  item: VirtualTraceItem,
  virtualItem: VirtualItem,
  selectedKey: string,
  scrollMargin: number,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = item.child
    ? `trxRow trxNestedRow depth-${item.child.depth}`
    : 'trxRow';
  button.type = 'button';
  button.dataset.traceKey = item.traceKey;
  button.dataset.rowKey = item.key;
  button.dataset.virtualIndex = String(virtualItem.index);
  if (item.child) button.dataset.operationPath = item.child.path;
  button.setAttribute('aria-selected', String(item.traceKey === selectedKey));
  button.classList.toggle('selected', item.traceKey === selectedKey);
  button.style.transform = `translateY(${Math.round(
    virtualItem.start - scrollMargin,
  )}px)`;

  if (item.child) appendChildCells(button, item.row, item.child);
  else appendRootCells(button, item.row);
  return button;
}

function appendRootCells(button: HTMLElement, row: TraceRecord): void {
  const branch = clean(row.branch ?? row.taskSession) || 'no-branch';
  const status = isFailure(row) ? 'error' : clean(row.status) || 'success';
  button.style.setProperty('--branch-color', branchColor(branch));

  appendCell(button, '', '', (cell) => {
    const check = document.createElement('span');
    check.className = 'trxCheck';
    cell.append(check);
  });
  appendCell(
    button,
    'trxStart mono',
    clean(row.displayTime ?? row.time) || '—',
  );
  appendCell(button, 'trxToolCell', '', (cell) => {
    cell.title = clean(row.name ?? row.traceName);
    const icon = document.createElement('span');
    icon.className = `trxToolIcon ${status}`;
    icon.textContent = '✤';
    const name = document.createElement('span');
    name.className = 'trxToolName';
    name.textContent = clean(row.name ?? row.traceName) || 'trace';
    cell.append(icon, name);
  });
  appendCell(button, 'trxLatency', formatDuration(row.durationMs, row.latency));
  appendCell(button, 'trxTokens', formatCompact(totalTokens(row)));
  appendCell(button, 'trxBranch', stripTaskPrefix(branch), (cell) => {
    cell.title = branch;
    cell.style.setProperty('--branch-color', branchColor(branch));
  });
  appendCell(button, 'trxJson', clean(row.input), (cell) => {
    cell.title = clean(row.input);
  });
  appendCell(button, 'trxJson', clean(row.output ?? row.summary), (cell) => {
    cell.title = clean(row.output ?? row.summary);
  });
  appendCell(button, 'trxJson', itemTraceId(row));
  appendCell(button, '', '', (cell) => {
    const badge = document.createElement('span');
    badge.className = `trxStatus ${status}`;
    badge.textContent = status;
    cell.append(badge);
  });
  appendCell(
    button,
    'trxCost',
    clean(row.costLabel) || `$${number(row.cost).toFixed(4)}`,
  );
}

function appendChildCells(
  button: HTMLElement,
  parent: TraceRecord,
  child: ChildOperation,
): void {
  const branch = clean(parent.branch ?? parent.taskSession) || 'no-branch';
  const status = isFailure(child) ? 'error' : clean(child.status) || 'success';
  button.style.setProperty('--depth', String(child.depth));
  button.style.setProperty('--branch-color', branchColor(branch));

  appendCell(button, 'trxTreeCell', '');
  appendCell(button, 'trxStart mono', '');
  appendCell(button, 'trxToolCell trxNestedToolCell', '', (cell) => {
    const connector = document.createElement('span');
    connector.className = 'trxNestedConnector';
    connector.setAttribute('aria-hidden', 'true');
    connector.textContent = '->';
    const name = document.createElement('span');
    name.className = 'trxToolName';
    name.textContent =
      clean(child.tool ?? child.name ?? child.label) || 'child';
    cell.append(connector, name);
  });
  appendCell(
    button,
    'trxLatency',
    formatDuration(child.durationMs, child.latency),
  );
  appendCell(button, 'trxTokens', formatCompact(totalTokens(child)));
  appendCell(button, 'trxBranch', stripTaskPrefix(branch));
  appendCell(button, 'trxJson', clean(child.input), (cell) => {
    cell.title = clean(child.input);
  });
  appendCell(button, 'trxJson', clean(child.output), (cell) => {
    cell.title = clean(child.output);
  });
  appendCell(button, 'trxJson', clean(child.traceId));
  appendCell(button, '', '', (cell) => {
    const badge = document.createElement('span');
    badge.className = `trxStatus ${status}`;
    badge.textContent = status;
    cell.append(badge);
  });
  appendCell(button, 'trxCost', clean(child.costLabel) || '—');
}

function appendCell(
  row: HTMLElement,
  className: string,
  text: string,
  decorate?: (cell: HTMLDivElement) => void,
): void {
  const cell = document.createElement('div');
  if (className) cell.className = className;
  if (text) cell.textContent = text;
  decorate?.(cell);
  row.append(cell);
}

function matchesCurrentFilters(row: TraceRecord): boolean {
  const branch = clean(row.branch ?? row.taskSession) || 'no-branch';
  const tool = clean(row.name ?? row.traceName) || 'unknown';
  const status = isFailure(row) ? 'error' : clean(row.status) || 'success';
  if (filters.branch && branch !== filters.branch) return false;
  if (filters.tool && tool !== filters.tool) return false;
  if (filters.status && status !== filters.status) return false;
  if (!filters.query) return true;
  const haystack = [
    row.displayTime,
    row.time,
    tool,
    branch,
    status,
    row.input,
    row.output,
    row.summary,
    stableTraceKey(row),
  ]
    .map((value) => clean(value).toLowerCase())
    .join(' ');
  return haystack.includes(filters.query);
}

function formatCompact(value: unknown): string {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return '0';
  if (Math.abs(parsed) >= 1_000_000)
    return `${(parsed / 1_000_000).toFixed(2)}M`;
  if (Math.abs(parsed) >= 1_000) return `${(parsed / 1_000).toFixed(1)}K`;
  return String(Math.round(parsed));
}

function formatDuration(value: unknown, fallback: unknown): string {
  const duration = Number(value ?? Number.NaN);
  if (!Number.isFinite(duration)) return clean(fallback) || '—';
  if (duration >= 60_000) return `${(duration / 60_000).toFixed(1)}m`;
  if (duration >= 1_000) return `${(duration / 1_000).toFixed(2)}s`;
  return `${Math.round(duration)}ms`;
}

function itemTraceId(row: TraceRecord): string {
  return clean(row.traceId ?? row.trace ?? stableTraceKey(row));
}

function stripTaskPrefix(value: string): string {
  return value.replace(/^task\//, '');
}

function branchColor(value: string): string {
  if (!value || value === 'no-branch') return '';
  const palette = ['#c87958', '#b88b4a', '#8fa17a', '#b06f8f', '#7f9b9a'];
  let hash = 0;
  for (const character of value)
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length] ?? palette[0];
}

function traceWindow(): TraceWindow {
  return window as TraceWindow;
}

function currentSelectedKey(): string {
  const target = traceWindow();
  if (target.__traceSelectedKey) return target.__traceSelectedKey;
  const selected = document.querySelector<HTMLElement>(
    '.trxRow.selected, .trxRow.isSelected, .trxRow[aria-selected="true"], .lfStep.active',
  );
  if (selected?.dataset.traceKey) {
    target.__traceSelectedKey = selected.dataset.traceKey;
    return target.__traceSelectedKey;
  }
  const hashKey =
    new URLSearchParams(location.hash.slice(1)).get('trace') ?? '';
  target.__traceSelectedKey = hashKey;
  return hashKey;
}

function initialRows(): TraceRecord[] {
  const map = traceWindow().__traceRowsByTraceId;
  if (map instanceof Map) return dedupeTraceRows(map.values());
  return dedupeTraceRows(seedPayload().rows ?? []);
}

function initialNextCursor(): string | null {
  const value = seedPayload().meta?.nextCursor;
  return typeof value === 'string' && value ? value : null;
}

function seedPayload(): TraceFeedPayload {
  const seed = document.getElementById('trace-seed-data');
  if (!seed?.textContent) return {};
  try {
    return JSON.parse(seed.textContent) as TraceFeedPayload;
  } catch {
    return {};
  }
}

function traceMapForRows(rows: TraceRecord[]): Map<string, TraceRecord> {
  const map = new Map<string, TraceRecord>();
  for (const row of rows) {
    const stableKey = stableTraceKey(row);
    if (stableKey) map.set(stableKey, row);
    const traceId = clean(row.traceId ?? row.trace);
    if (traceId) map.set(traceId, row);
  }
  return map;
}

function mapFingerprint(map: Map<string, TraceRecord>): string {
  const values = dedupeTraceRows(map.values());
  return [
    map.size,
    values.length,
    stableTraceKey(values[0]),
    stableTraceKey(values.at(-1)),
  ].join(':');
}

function findTraceListTarget(): TraceListTarget | null {
  const explicit = document.querySelector<HTMLElement>(
    '[data-trace-virtual-list]',
  );
  if (explicit) {
    let content = explicit.querySelector<HTMLElement>(
      '[data-trace-virtual-content]',
    );
    if (!content) {
      content = document.createElement('div');
      explicit.append(content);
    }
    return { scroller: explicit, content };
  }

  const content = document.querySelector<HTMLElement>('[data-trace-rows]');
  const scroller = content?.closest<HTMLElement>('.trxTableScroll');
  return content && scroller ? { scroller, content } : null;
}

function asRecord(value: unknown): TraceRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as TraceRecord)
    : null;
}

function resetFilters(): void {
  filters.query = '';
  filters.branch = null;
  filters.tool = null;
  filters.status = null;
}

export function installTraceVirtualList(): () => void {
  let controller: TraceVirtualListController | null = null;
  let scheduled = false;

  const sync = () => {
    scheduled = false;
    const target = findTraceListTarget();
    if (!target) return;
    if (!controller?.isMountedOn(target)) {
      controller?.destroy();
      controller = new TraceVirtualListController(
        target,
        initialRows(),
        initialNextCursor(),
      );
    } else {
      controller.syncFromWindow();
    }
  };

  const scheduleSync = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  };

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  document.addEventListener('input', (event) => {
    const target = event.target;
    if (
      !(target instanceof HTMLInputElement) ||
      !target.matches('[data-search]')
    )
      return;
    filters.query = target.value.trim().toLowerCase();
    controller?.syncFilters();
  });

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target as HTMLElement;
      const branch = target.closest<HTMLElement>('[data-filter-branch]');
      const tool = target.closest<HTMLElement>('[data-filter-tool]');
      const status = target.closest<HTMLElement>('[data-filter-status]');
      if (branch) filters.branch = branch.dataset.filterBranch || null;
      if (tool) filters.tool = tool.dataset.filterTool || null;
      if (status) filters.status = status.dataset.filterStatus || null;
      if (target.closest('[data-clear-filters], [data-cockpit-page]')) {
        resetFilters();
      }
      if (branch || tool || status || target.closest('[data-clear-filters]')) {
        queueMicrotask(() => controller?.syncFilters());
      }

      const row = target.closest<HTMLElement>('.trxRow');
      if (row?.dataset.traceKey) controller?.select(row.dataset.traceKey);
      if (target.closest('[data-ti-back]')) controller?.clearSelection();
    },
    true,
  );

  traceWindow().__traceVirtualList = {
    appendPage: (rows, nextCursor) => controller?.appendPage(rows, nextCursor),
    prependRows: (rows) => controller?.prependRows(rows),
    replaceRows: (rows, nextCursor) =>
      controller?.replaceRows(rows, nextCursor),
    setNextCursor: (nextCursor) => controller?.setNextCursor(nextCursor),
    scrollToKey: (key) => controller?.scrollToKey(key),
    diagnostics: () => controller?.diagnostics() ?? null,
  };

  const interval = window.setInterval(scheduleSync, 2_000);
  scheduleSync();
  return () => {
    window.clearInterval(interval);
    observer.disconnect();
    controller?.destroy();
    delete traceWindow().__traceVirtualList;
  };
}
