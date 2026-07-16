import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
  type VirtualItem,
  type VirtualizerOptions,
} from '@tanstack/virtual-core';

import {
  childTraceRecords,
  clean,
  dedupeTraceRows,
  isBatchChild,
  number,
  stableTraceKey,
  traceParentKey,
  totalTokens,
  type TraceChildRecord,
  type TraceRecord,
} from './model';
import { inspectorStore } from './inspector-state';
import {
  deriveTraceHistoryCursor,
  type TracePrefetchRequestDetail,
} from './pagination-browser';
import {
  mergeTraceRows,
  shouldPrefetchTracePage,
  type TracePageDirection,
} from './trace-list';
import {
  formatTraceTableRow,
  matchesTraceTableFilters,
  traceFilterFacets,
  type TraceFilterFacet,
  type TraceFilterFacets,
} from './table-formatters';

const MAX_RETAINED_ROWS = 100_000;
const PREFETCH_THRESHOLD = 25;
const ESTIMATED_ROW_HEIGHT = 44;
const OVERSCAN = 12;
const TRACE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

type TraceFeedPayload = {
  meta?: { nextCursor?: unknown };
  rows?: TraceRecord[];
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

type VirtualTraceItem = {
  key: string;
  traceKey: string;
  rootIndex: number;
  row: TraceRecord;
  child: TraceChildRecord | null;
};

export type TraceVirtualListApi = {
  appendPage: (rows: TraceRecord[], nextCursor: string | null) => void;
  prependRows: (rows: TraceRecord[]) => void;
  replaceRows: (rows: TraceRecord[], nextCursor?: string | null) => void;
  setNextCursor: (nextCursor: string | null) => void;
  scrollToKey: (key: string) => void;
  scrollToTop: () => void;
  select: (key: string) => void;
  diagnostics: () => TraceListDiagnostics | null;
};

type TraceWindow = Window & {
  __traceRowsByTraceId?: Map<string, TraceRecord>;
  __traceSelectedKey?: string;
  __traceVirtualList?: TraceVirtualListApi;
};

type TraceVirtualizer = Virtualizer<HTMLElement, HTMLButtonElement>;

const NO_FILTER_MATCH = '__trace-none__';
const FILTER_PREVIEW_COUNT = 10;
type MutableTraceTableFilterState = {
  query: string;
  branches: Set<string>;
  tools: Set<string>;
  statuses: Set<string>;
};
const filters: MutableTraceTableFilterState = {
  query: '',
  branches: new Set(),
  tools: new Set(),
  statuses: new Set(),
};
const expandedFilterKinds = new Set<keyof TraceFilterFacets>();
let filterSearch = '';
let filterPanelOpen = false;
let fontPreferenceInitialized = false;
let hoverOpenTimer = 0;
let hoverCloseTimer = 0;
let hoverTarget: HTMLElement | null = null;
let currentFacets: TraceFilterFacets = {
  tools: [],
  branches: [],
  statuses: [],
};

class TraceVirtualListController {
  private rows: TraceRecord[];
  private filteredRows: TraceRecord[] = [];
  private items: VirtualTraceItem[] = [];
  private nextCursor: string | null;
  private lastRequestedCursor: string | null = null;
  private fetching = false;
  private ownedMap = new Map<string, TraceRecord>();
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
      selectedKey: currentSelectedRootKey(),
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

  reassertOwnership(): void {
    if (traceWindow().__traceRowsByTraceId === this.ownedMap) return;
    traceWindow().__traceRowsByTraceId = this.ownedMap;
  }

  syncFilters(): void {
    this.refreshItems();
    this.commitItems(true);
  }

  appendPage(rows: TraceRecord[], nextCursor: string | null): void {
    this.nextCursor = nextCursor;
    this.lastRequestedCursor = null;
    this.fetching = false;
    this.setRows(rows, 'history');
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
      selectedKey: currentSelectedRootKey(),
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

  scrollToTop(): void {
    this.target.scroller.scrollTo({ top: 0, behavior: 'smooth' });
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
    const row =
      this.ownedMap.get(key) ??
      [...this.ownedMap.values()].find(
        (candidate) => stableTraceKey(candidate) === key,
      );
    if (!row) return;
    inspectorStore.dispatch({ type: 'select', key, row });
    target.__traceSelectedKey = key;
    const shell = document.querySelector<HTMLElement>('.trxShell');
    shell?.classList.remove('closed');
    shell?.classList.add('detail-open');
    const hash = `trace=${encodeURIComponent(key)}`;
    if (location.hash.slice(1) !== hash) {
      try {
        history.replaceState(
          null,
          '',
          `${location.pathname}${location.search}#${hash}`,
        );
      } catch {
        location.hash = hash;
      }
    }
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
    inspectorStore.dispatch({ type: 'clear-selection' });
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

  private setRows(rows: TraceRecord[], direction: TracePageDirection): void {
    const previousHeight = this.target.scroller.scrollHeight;
    const previousTop = this.target.scroller.scrollTop;
    this.rows = mergeTraceRows(this.rows, rows, {
      direction,
      maxRows: MAX_RETAINED_ROWS,
      selectedKey: currentSelectedRootKey(),
    });
    this.refreshItems();
    this.commitItems(false);
    if (direction === 'prepend' && previousTop > 0) {
      this.target.scroller.scrollTop =
        previousTop +
        Math.max(0, this.target.scroller.scrollHeight - previousHeight);
    }
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
    currentFacets = traceFilterFacets(this.rows);
    ensureTraceTableControls();
    renderTraceFilterPanel();
    traceWindow().__traceRowsByTraceId = this.ownedMap;
    inspectorStore.dispatch({
      type: 'rows-replaced',
      rows: dedupeTraceRows(this.ownedMap.values()),
    });
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
    this.updateFooter(this.firstVisibleRootIndex(virtualItems));
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

  private updateFooter(firstVisibleRootIndex: number | null): void {
    const footer = this.target.scroller
      .closest('.trxTablePane')
      ?.querySelector<HTMLElement>('.trxFooter');
    if (!footer) return;
    prepareTraceFooter(footer);
    footer.dataset.traceVirtualFooter = '';
    const count = footer.querySelector<HTMLElement>('[data-trace-count]');
    if (count) count.textContent = String(this.rows.length);
    const scrollTop = footer.querySelector<HTMLButtonElement>(
      '[data-trace-scroll-top]',
    );
    if (scrollTop) {
      scrollTop.hidden =
        firstVisibleRootIndex === null || firstVisibleRootIndex < 100;
    }
  }

  private firstVisibleRootIndex(
    virtualItems = this.virtualizer.getVirtualItems(),
  ): number | null {
    const scrollTop = this.target.scroller.scrollTop;
    const visible =
      virtualItems.find((item) => item.end > scrollTop) ?? virtualItems.at(0);
    return visible ? (this.items[visible.index]?.rootIndex ?? null) : null;
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
            this.lastRequestedCursor = null;
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
    for (const child of childTraceRecords(row)) {
      items.push({
        key: `${traceKey}::${child.__tracePath}`,
        traceKey: stableTraceKey(child),
        rootIndex,
        row,
        child,
      });
    }
  });
  return items;
}

function createTraceRow(
  item: VirtualTraceItem,
  virtualItem: VirtualItem,
  selectedKey: string,
  scrollMargin: number,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = item.child
    ? `trxRow trxNestedRow depth-${item.child.__traceDepth}`
    : 'trxRow';
  button.type = 'button';
  button.dataset.traceKey = item.traceKey;
  button.dataset.rowKey = item.key;
  button.dataset.virtualIndex = String(virtualItem.index);
  if (item.child) button.dataset.operationPath = item.child.__tracePath;
  const formatted = formatTraceTableRow(item.child ?? item.row);
  button.classList.toggle('is-error', formatted.isError);
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
  const formatted = formatTraceTableRow(row);
  const status = formatted.statusLabel;
  const sourceTool = clean(row.name ?? row.traceName ?? row.tool) || 'trace';
  button.style.setProperty('--branch-color', branchColor(branch));

  appendCell(button, '', '', (cell) => {
    const check = document.createElement('span');
    check.className = 'trxCheck';
    cell.append(check);
  });
  appendCell(
    button,
    'trxStart mono',
    formatTraceTime(row),
  );
  appendCell(button, 'trxToolCell', '', (cell) => {
    setTraceTooltip(cell, `${formatted.toolLabel} · stored as ${sourceTool}`);
    const icon = document.createElement('span');
    icon.className = `trxToolIcon ${status}`;
    icon.textContent = '✤';
    const name = document.createElement('span');
    name.className = 'trxToolName';
    name.textContent = formatted.toolLabel;
    cell.append(icon, name);
  });
  appendCell(button, 'trxLatency', formatDuration(row.durationMs, row.latency));
  appendCell(button, 'trxTokens', formatCompact(totalTokens(row)));
  appendCell(button, 'trxBranch', stripTaskPrefix(branch), (cell) => {
    setTraceTooltip(cell, branch);
    cell.style.setProperty('--branch-color', branchColor(branch));
  });
  appendCell(button, 'trxJson trxInputCell', formatted.inputLabel, (cell) => {
    setTraceTooltip(cell, formatted.inputFull || formatted.inputLabel);
  });
  appendCell(button, 'trxJson trxOutputCell', formatted.outputLabel, (cell) =>
    setTraceTooltip(cell, formatted.outputFull || formatted.outputLabel),
  );
  appendCell(button, 'trxJson trxTraceCell', itemTraceId(row));
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
  child: TraceChildRecord,
): void {
  const branch = clean(parent.branch ?? parent.taskSession) || 'no-branch';
  const formatted = formatTraceTableRow(child);
  const status = formatted.statusLabel;
  const sourceTool = clean(child.tool ?? child.name ?? child.label) || 'child';
  button.style.setProperty('--depth', String(child.__traceDepth));
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
    name.textContent = formatted.toolLabel;
    setTraceTooltip(
      cell,
      `${formatted.toolLabel} · batch step stored as ${sourceTool}`,
    );
    cell.append(connector, name);
  });
  appendCell(
    button,
    'trxLatency',
    formatDuration(child.durationMs, child.latency),
  );
  appendCell(button, 'trxTokens', formatCompact(totalTokens(child)));
  appendCell(button, 'trxBranch', stripTaskPrefix(branch));
  appendCell(button, 'trxJson trxInputCell', formatted.inputLabel, (cell) => {
    setTraceTooltip(cell, formatted.inputFull || formatted.inputLabel);
  });
  appendCell(button, 'trxJson trxOutputCell', formatted.outputLabel, (cell) =>
    setTraceTooltip(cell, formatted.outputFull || formatted.outputLabel),
  );
  appendCell(button, 'trxJson trxTraceCell', clean(child.traceId));
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

function setTraceTooltip(cell: HTMLElement, value: string): void {
  const text = value.trim();
  if (!text) return;
  cell.dataset.traceTooltip = text;
}

function ensureTraceTableControls(): void {
  if (!fontPreferenceInitialized) {
    document.documentElement.classList.add('trace-system-font');
    fontPreferenceInitialized = true;
  }

  const pane = document.querySelector<HTMLElement>('.trxTablePane');
  if (!pane) return;
  let panel = pane.querySelector<HTMLElement>('.trxFilterPanel');
  if (!panel) {
    panel = document.createElement('aside');
    panel.className = 'trxFilterPanel';
    panel.setAttribute('aria-label', 'Trace filters');
    panel.innerHTML = `<header class="trxFilterHeader"><div><span>Filters</span><strong>Trace view</strong></div><div class="trxFilterHeaderActions"><button type="button" data-trace-font-toggle aria-label="Use original trace font" aria-pressed="true">Aa</button><button type="button" data-trace-filter-close aria-label="Close filters">×</button></div></header><label class="trxFilterSearch"><span aria-hidden="true"><svg viewBox="0 0 16 16" width="13" height="13"><circle cx="7" cy="7" r="4.25" fill="none" stroke="currentColor" stroke-width="1.5"></circle><path d="m10.2 10.2 3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg></span><input type="search" data-filter-search placeholder="Search filter values" aria-label="Search filter values"></label><div class="trxFilterContent" data-trace-filter-content></div><footer><button type="button" data-clear-filters>Clear filters</button></footer>`;
    pane.append(panel);
  }
  panel.hidden = !filterPanelOpen;
  pane.classList.toggle('trace-filters-open', filterPanelOpen);
  const fontButton = panel.querySelector<HTMLButtonElement>(
    '[data-trace-font-toggle]',
  );
  if (fontButton) {
    const systemFont =
      document.documentElement.classList.contains('trace-system-font');
    fontButton.setAttribute('aria-pressed', String(systemFont));
    fontButton.setAttribute(
      'aria-label',
      systemFont ? 'Use original trace font' : 'Use system font',
    );
    fontButton.title = fontButton.getAttribute('aria-label') ?? '';
  }
}

function renderTraceFilterPanel(): void {
  const panel = document.querySelector<HTMLElement>('.trxFilterPanel');
  const content = panel?.querySelector<HTMLElement>(
    '[data-trace-filter-content]',
  );
  if (!panel || !content) return;
  const fragment = document.createDocumentFragment();
  fragment.append(
    createFilterSection('tools', 'Tools', currentFacets.tools),
    createFilterSection('branches', 'Branches', currentFacets.branches),
    createFilterSection('statuses', 'Status', currentFacets.statuses),
  );
  content.replaceChildren(fragment);
  const input = panel.querySelector<HTMLInputElement>('[data-filter-search]');
  if (input && input.value !== filterSearch) input.value = filterSearch;
}

function createFilterSection(
  kind: keyof TraceFilterFacets,
  title: string,
  facets: TraceFilterFacet[],
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'trxFilterSection';
  section.dataset.filterSection = kind;
  const heading = document.createElement('h3');
  heading.textContent = title;
  section.append(heading);
  const query = filterSearch.trim().toLowerCase();
  const matching = query
    ? facets.filter((facet) => facet.value.toLowerCase().includes(query))
    : facets;
  const expanded = expandedFilterKinds.has(kind) || Boolean(query);
  const visible = expanded ? matching : matching.slice(0, FILTER_PREVIEW_COUNT);
  const selected = filterSet(kind);
  const allSelected = selected.size === 0;
  const list = document.createElement('div');
  list.className = 'trxFilterValues';
  for (const facet of visible) {
    const row = document.createElement('div');
    row.className = 'trxFilterValue';
    row.dataset.traceFilterValue = facet.value;
    row.dataset.traceFilterKind = kind;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.tabIndex = -1;
    checkbox.checked = allSelected || selected.has(facet.value);
    checkbox.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = facet.value;
    const count = document.createElement('small');
    count.textContent = String(facet.count);
    const only = document.createElement('button');
    only.type = 'button';
    only.textContent = 'Only';
    only.dataset.traceFilterOnly = facet.value;
    only.dataset.traceFilterKind = kind;
    only.setAttribute('aria-label', `Only show ${facet.value}`);
    row.append(checkbox, label, only, count);
    list.append(row);
  }
  section.append(list);
  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'trxFilterEmpty';
    empty.textContent = 'No matching values';
    section.append(empty);
  }
  if (!query && matching.length > FILTER_PREVIEW_COUNT) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'trxFilterMore';
    more.dataset.traceFilterMore = kind;
    more.textContent = expanded
      ? 'Show fewer'
      : `Show ${matching.length - FILTER_PREVIEW_COUNT} more`;
    section.append(more);
  }
  return section;
}

function filterSet(kind: keyof TraceFilterFacets): Set<string> {
  return filters[kind];
}

function toggleFilterValue(kind: keyof TraceFilterFacets, value: string): void {
  const selected = filterSet(kind);
  const available = currentFacets[kind].map((facet) => facet.value);
  if (selected.size === 0) {
    for (const facetValue of available) selected.add(facetValue);
    selected.delete(value);
  } else if (selected.has(NO_FILTER_MATCH)) {
    selected.clear();
    selected.add(value);
  } else if (selected.has(value)) {
    selected.delete(value);
  } else {
    selected.add(value);
  }
  if (selected.size === 0) selected.add(NO_FILTER_MATCH);
  if (
    available.length &&
    available.every((facetValue) => selected.has(facetValue))
  ) {
    selected.clear();
  }
}

function showOnlyFilterValue(
  kind: keyof TraceFilterFacets,
  value: string,
): void {
  const selected = filterSet(kind);
  selected.clear();
  selected.add(value);
}

function matchesCurrentFilters(row: TraceRecord): boolean {
  return matchesTraceTableFilters(row, filters);
}

function formatCompact(value: unknown): string {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return '0';
  if (Math.abs(parsed) >= 1_000_000)
    return `${(parsed / 1_000_000).toFixed(2)}M`;
  if (Math.abs(parsed) >= 1_000) return `${(parsed / 1_000).toFixed(1)}K`;
  return String(Math.round(parsed));
}

function formatTraceTime(row: TraceRecord): string {
  const raw = clean(row.displayTime ?? row.time ?? row.startTime);
  if (!raw) return '—';
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const parts = TRACE_TIME_FORMATTER.formatToParts(date);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '--';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '--';
  const second = parts.find((part) => part.type === 'second')?.value ?? '--';
  return `${hour === '24' ? '00' : hour}:${minute}:${second}`;
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
  return inspectorStore.getSnapshot().selectedKey;
}

function prepareTraceFooter(footer: HTMLElement): void {
  if (footer.dataset.traceFooterPrepared === 'true') return;
  footer.replaceChildren();
  const filtersButton = document.createElement('button');
  filtersButton.type = 'button';
  filtersButton.dataset.showFilters = '';
  filtersButton.textContent = 'filters';
  const count = document.createElement('span');
  count.className = 'trxTraceTotal';
  const value = document.createElement('b');
  value.dataset.traceCount = '';
  value.textContent = '0';
  count.append(value, ' traces');
  const scrollTop = document.createElement('button');
  scrollTop.type = 'button';
  scrollTop.dataset.traceScrollTop = '';
  scrollTop.textContent = 'Scroll to top';
  scrollTop.setAttribute('aria-label', 'Scroll trace history to top');
  scrollTop.hidden = true;
  footer.append(filtersButton, count, scrollTop);
  footer.dataset.traceFooterPrepared = 'true';
}

function currentSelectedRootKey(): string {
  const key = currentSelectedKey();
  if (!key) return '';
  const selected = traceWindow().__traceRowsByTraceId?.get(key);
  return selected ? traceParentKey(selected) : key;
}

function initialRows(): TraceRecord[] {
  const map = traceWindow().__traceRowsByTraceId;
  if (map instanceof Map)
    return dedupeTraceRows(map.values()).filter((row) => !isBatchChild(row));
  return dedupeTraceRows(seedPayload().rows ?? []);
}

function initialCursor(rows: TraceRecord[]): string | null {
  const meta = seedPayload().meta;
  if (meta && Object.hasOwn(meta, 'nextCursor')) {
    const value = meta.nextCursor;
    return deriveTraceHistoryCursor(
      rows,
      typeof value === 'string' ? value : null,
    );
  }
  return deriveTraceHistoryCursor(rows);
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
    for (const child of childTraceRecords(row)) {
      const childKey = stableTraceKey(child);
      if (childKey) map.set(childKey, child);
      const childTraceId = clean(child.traceId ?? child.trace);
      if (childTraceId && !map.has(childTraceId)) map.set(childTraceId, child);
    }
  }
  return map;
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

function resetFilters(): void {
  filters.query = '';
  filters.branches.clear();
  filters.tools.clear();
  filters.statuses.clear();
  filterSearch = '';
  expandedFilterKinds.clear();
  for (const input of document.querySelectorAll<HTMLInputElement>(
    '[data-search], [data-filter-search]',
  )) {
    input.value = '';
  }
}

function filterKind(value: string | undefined): keyof TraceFilterFacets | null {
  return value === 'tools' || value === 'branches' || value === 'statuses'
    ? value
    : null;
}

function ensureTraceHoverCard(): HTMLElement {
  let card = document.querySelector<HTMLElement>('.trxHoverCard');
  if (card) return card;
  card = document.createElement('div');
  card.className = 'trxHoverCard';
  card.id = 'trace-hover-detail';
  card.setAttribute('role', 'tooltip');
  card.hidden = true;
  document.body.append(card);
  return card;
}

function showTraceHoverCard(target: HTMLElement): void {
  const text = target.dataset.traceTooltip;
  if (!text) return;
  const card = ensureTraceHoverCard();
  card.textContent = text;
  hoverTarget = target;
  target.setAttribute('aria-describedby', card.id);
  card.hidden = false;
  const rect = target.getBoundingClientRect();
  const left = Math.max(
    12,
    Math.min(rect.left, window.innerWidth - card.offsetWidth - 12),
  );
  const below = rect.bottom + 8;
  const top =
    below + card.offsetHeight < window.innerHeight - 12
      ? below
      : Math.max(12, rect.top - card.offsetHeight - 8);
  card.style.left = `${Math.round(left)}px`;
  card.style.top = `${Math.round(top)}px`;
}

function hideTraceHoverCard(): void {
  const card = document.querySelector<HTMLElement>('.trxHoverCard');
  if (card) card.hidden = true;
  hoverTarget?.removeAttribute('aria-describedby');
  hoverTarget = null;
}

function scheduleTraceHoverOpen(target: HTMLElement): void {
  window.clearTimeout(hoverOpenTimer);
  window.clearTimeout(hoverCloseTimer);
  if (hoverTarget === target && !ensureTraceHoverCard().hidden) return;
  hoverOpenTimer = window.setTimeout(() => showTraceHoverCard(target), 1_000);
}

function scheduleTraceHoverClose(): void {
  window.clearTimeout(hoverOpenTimer);
  window.clearTimeout(hoverCloseTimer);
  hoverCloseTimer = window.setTimeout(hideTraceHoverCard, 180);
}

export function installTraceVirtualList(): () => void {
  let controller: TraceVirtualListController | null = null;
  let pendingReplacement: {
    rows: TraceRecord[];
    nextCursor?: string | null;
  } | null = null;
  let scheduled = false;

  const sync = () => {
    scheduled = false;
    const target = findTraceListTarget();
    if (!target) return;
    if (!controller?.isMountedOn(target)) {
      controller?.destroy();
      const rows = initialRows();
      controller = new TraceVirtualListController(
        target,
        rows,
        initialCursor(rows),
      );
    } else {
      controller.reassertOwnership();
    }
    if (pendingReplacement) {
      controller.replaceRows(
        pendingReplacement.rows,
        pendingReplacement.nextCursor,
      );
      pendingReplacement = null;
    }
  };

  const scheduleSync = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  };

  const observer = new MutationObserver(scheduleSync);
  const observerRoot =
    document.querySelector<HTMLElement>('.trxShell, #tbmLiveTraceModal') ??
    document.documentElement;
  observer.observe(observerRoot, {
    childList: true,
    subtree: true,
  });

  const handlePointerOver = (event: PointerEvent) => {
    if ((event.target as HTMLElement).closest('.trxHoverCard')) {
      window.clearTimeout(hoverCloseTimer);
      return;
    }
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-trace-tooltip]',
    );
    if (target) scheduleTraceHoverOpen(target);
  };
  const handlePointerOut = (event: PointerEvent) => {
    const card = (event.target as HTMLElement).closest('.trxHoverCard');
    if (card) {
      const related = event.relatedTarget;
      if (related instanceof Node && card.contains(related)) return;
      scheduleTraceHoverClose();
      return;
    }
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-trace-tooltip]',
    );
    if (!target) return;
    const related = event.relatedTarget;
    if (related instanceof Node && target.contains(related)) return;
    if (related instanceof Element && related.closest('.trxHoverCard')) return;
    scheduleTraceHoverClose();
  };
  document.addEventListener('pointerover', handlePointerOver);
  document.addEventListener('pointerout', handlePointerOut);

  document.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.matches('[data-filter-search]')) {
      filterSearch = target.value;
      renderTraceFilterPanel();
      return;
    }
    if (!target.matches('[data-search]')) return;
    filters.query = target.value.trim().toLowerCase();
    controller?.syncFilters();
  });

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-show-filters], [data-trace-filter-toggle]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        filterPanelOpen = !filterPanelOpen;
        ensureTraceTableControls();
        renderTraceFilterPanel();
        return;
      }
      if (target.closest('[data-trace-filter-close]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        filterPanelOpen = false;
        ensureTraceTableControls();
        return;
      }
      if (target.closest('[data-trace-font-toggle]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        document.documentElement.classList.toggle('trace-system-font');
        ensureTraceTableControls();
        return;
      }
      const only = target.closest<HTMLElement>('[data-trace-filter-only]');
      const filterValue = target.closest<HTMLElement>(
        '[data-trace-filter-value]',
      );
      const more = target.closest<HTMLElement>('[data-trace-filter-more]');
      if (only) {
        const kind = filterKind(only.dataset.traceFilterKind);
        const value = only.dataset.traceFilterOnly;
        if (kind && value) showOnlyFilterValue(kind, value);
        event.preventDefault();
        event.stopImmediatePropagation();
        renderTraceFilterPanel();
        controller?.syncFilters();
        return;
      }
      if (filterValue) {
        const kind = filterKind(filterValue.dataset.traceFilterKind);
        const value = filterValue.dataset.traceFilterValue;
        if (kind && value) toggleFilterValue(kind, value);
        event.preventDefault();
        event.stopImmediatePropagation();
        renderTraceFilterPanel();
        controller?.syncFilters();
        return;
      }
      if (more) {
        const kind = filterKind(more.dataset.traceFilterMore);
        if (kind) {
          if (expandedFilterKinds.has(kind)) expandedFilterKinds.delete(kind);
          else expandedFilterKinds.add(kind);
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        renderTraceFilterPanel();
        return;
      }
      const branch = target.closest<HTMLElement>('[data-filter-branch]');
      const tool = target.closest<HTMLElement>('[data-filter-tool]');
      const status = target.closest<HTMLElement>('[data-filter-status]');
      if (branch?.dataset.filterBranch)
        showOnlyFilterValue('branches', branch.dataset.filterBranch);
      if (tool?.dataset.filterTool)
        showOnlyFilterValue('tools', tool.dataset.filterTool);
      if (status?.dataset.filterStatus)
        showOnlyFilterValue('statuses', status.dataset.filterStatus);
      if (target.closest('[data-clear-filters], [data-cockpit-page]')) {
        resetFilters();
        renderTraceFilterPanel();
      }
      if (target.closest('[data-trace-scroll-top]')) {
        event.preventDefault();
        controller?.scrollToTop();
        return;
      }
      if (branch || tool || status || target.closest('[data-clear-filters]')) {
        queueMicrotask(() => controller?.syncFilters());
      }

      const row = target.closest<HTMLElement>('.trxRow');
      if (row?.dataset.traceKey) {
        event.preventDefault();
        event.stopImmediatePropagation();
        controller?.select(row.dataset.traceKey);
        return;
      }
      if (target.closest('[data-ti-back]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        inspectorStore.dispatch({ type: 'close' });
        return;
      }
    },
    true,
  );

  traceWindow().__traceVirtualList = {
    appendPage: (rows, nextCursor) => controller?.appendPage(rows, nextCursor),
    prependRows: (rows) => controller?.prependRows(rows),
    replaceRows: (rows, nextCursor) => {
      if (controller) controller.replaceRows(rows, nextCursor);
      else pendingReplacement = { rows, nextCursor };
    },
    setNextCursor: (nextCursor) => controller?.setNextCursor(nextCursor),
    scrollToKey: (key) => controller?.scrollToKey(key),
    scrollToTop: () => controller?.scrollToTop(),
    select: (key) => controller?.select(key),
    diagnostics: () => controller?.diagnostics() ?? null,
  };

  const interval = window.setInterval(scheduleSync, 2_000);
  scheduleSync();
  return () => {
    window.clearInterval(interval);
    observer.disconnect();
    document.removeEventListener('pointerover', handlePointerOver);
    document.removeEventListener('pointerout', handlePointerOut);
    document.querySelector('.trxHoverCard')?.remove();
    controller?.destroy();
    delete traceWindow().__traceVirtualList;
  };
}
