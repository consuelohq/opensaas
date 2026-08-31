import {
  branchSummary,
  childTraceRecords,
  clean,
  dedupeTraceRows,
  extractTraceError,
  isBatchChild,
  isFailure,
  parseMaybeJson,
  stableTraceKey,
  traceNodeLabel,
  traceRouteLabel,
  totalTokens,
  type TraceRecord,
} from './model';
import {
  filterInspectorCalls,
  inspectorContentSignature,
  inspectorSections,
  inspectorStore,
  isWorkpadTrace,
  normalizeBranchBreadcrumb,
  workpadTraceValue,
  type InspectorSection,
} from './inspector-state';
import {
  deriveTraceHistoryCursor,
  deriveTraceLiveCursor,
  installTracePaginationTransport,
  parseTraceLiveResponse,
  traceLiveUrl,
} from './pagination-browser';
import { installTraceVirtualList } from './virtual-list-browser';
import { formatTraceTableRow } from './table-formatters';
import { nextTraceInteractionIndex, traceIdentityCopyText } from './interactions';

type TraceWindow = Window & {
  __traceRowsByTraceId?: Map<string, TraceRecord>;
  __traceSelectedKey?: string;
  __consueloTraceHistoryTransport?: {
    fetchJson: (url: string) => Promise<unknown>;
  };
  __traceVirtualList?: {
    select: (key: string) => void;
    moveFocus: (direction: -1 | 1) => string;
    openFocused: () => string;
    clearSelection: () => void;
    scrollToTop: () => void;
    openFilters: () => void;
    closeFilters: () => void;
    toggleFilters: () => void;
    filtersOpen: () => boolean;
    setQuery: (query: string) => void;
    query: () => string;
    prependRows: (rows: TraceRecord[]) => void;
    replaceRows: (rows: TraceRecord[], nextCursor?: string | null) => void;
  };
};

type FlatValue = {
  path: string;
  value: unknown;
  depth: number;
};

let rendering = false;
let scheduled = false;
let callSearchFrame = 0;
let liveCursor = '';
let livePollInFlight = false;
let livePollTimer = 0;
type TraceInteractionScope = 'main' | 'child';
type TraceInteractionSource = 'hover' | 'keyboard';
type TraceInteraction = {
  key: string;
  scope: TraceInteractionScope;
  source: TraceInteractionSource;
};
let lastTraceInteraction: TraceInteraction | null = null;
const INSPECTOR_WIDTH_KEY = 'consuelo.trace-inspector.width';
const RETURN_HOME_PREFERENCE_KEY = 'consuelo.trace-return-home.preference';
const TRACE_CLOCK_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatCompact(value: unknown): string {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return '0';
  if (Math.abs(number) >= 1_000_000)
    return `${(number / 1_000_000).toFixed(2)}M`;
  if (Math.abs(number) >= 1_000) return `${(number / 1_000).toFixed(1)}K`;
  return String(Math.round(number));
}

function formatDuration(value: unknown): string {
  const duration = Number(value ?? 0);
  if (!Number.isFinite(duration)) return '—';
  if (duration >= 60_000) return `${(duration / 60_000).toFixed(1)}m`;
  if (duration >= 1_000) return `${(duration / 1_000).toFixed(2)}s`;
  return `${Math.round(duration)}ms`;
}

function updateTraceClock(): void {
  const node = document.querySelector<HTMLElement>('[data-trace-clock]');
  if (!node) return;
  const parts = TRACE_CLOCK_FORMATTER.formatToParts(new Date());
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '--';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '--';
  node.textContent = `${hour === '24' ? '00' : hour}:${minute}`;
}

function installTraceClock(): void {
  updateTraceClock();
  window.setInterval(updateTraceClock, 15_000);
}

function ensureTraceSearchStyle(): void {
  if (document.querySelector('[data-trace-search-style]')) return;
  const style = document.createElement('style');
  style.dataset.traceSearchStyle = '';
  style.textContent = `
    .trxChromeActions { position: relative; }
    .trxClock { transition: opacity 110ms ease, transform 110ms ease; }
    .trxClock[data-trace-search-hidden="true"] { opacity: 0; transform: translateY(2px); pointer-events: none; }
    [data-trace-search-shell] {
      position: absolute; right: 0; top: 50%; z-index: 4;
      width: min(280px, 42vw); height: 22px; box-sizing: border-box;
      display: flex; align-items: center; gap: 5px;
      border: 1px solid rgba(154,149,132,.38); border-radius: 5px;
      background: rgba(14,14,12,.96); color: inherit; padding: 0 4px 0 7px;
      opacity: 0; transform: translateY(-50%) translateX(3px) scale(.985);
      transform-origin: right center;
      transition: opacity 110ms ease, transform 110ms ease;
    }
    [data-trace-search-shell].is-open { opacity: 1; transform: translateY(-50%) translateX(0) scale(1); }
    [data-trace-search] {
      min-width: 0; width: 100%; height: 18px; border: 0; outline: 0;
      background: transparent; color: inherit; padding: 0; margin: 0;
      font: inherit; font-size: 11px; line-height: 18px;
    }
    [data-trace-search]::placeholder { color: rgba(192,186,166,.48); }
    [data-trace-search-close] {
      flex: 0 0 auto; width: 16px; height: 16px; border: 0; border-radius: 3px;
      background: transparent; color: rgba(216,211,197,.62); padding: 0;
      font: 13px/16px ui-monospace, SFMono-Regular, Menlo, monospace; cursor: pointer;
    }
    [data-trace-search-close]:hover, [data-trace-search-close]:focus-visible {
      color: #d8d3c5; background: rgba(255,255,255,.06); outline: none;
    }
    @media (max-width: 640px) { [data-trace-search-shell] { width: min(220px, 58vw); } }
    @media (prefers-reduced-motion: reduce) {
      [data-trace-search-shell], .trxClock { transition: none; }
    }
  `;
  document.head.append(style);
}

function traceSearchIsOpen(): boolean {
  return Boolean(document.querySelector('[data-trace-search-shell].is-open'));
}

function openTraceSearch(): void {
  const virtualList = (window as TraceWindow).__traceVirtualList;
  const actions = document.querySelector<HTMLElement>('.trxChromeActions');
  const clock = document.querySelector<HTMLElement>('[data-trace-clock]');
  if (!actions || !clock) return;
  ensureTraceSearchStyle();
  let shell = actions.querySelector<HTMLElement>('[data-trace-search-shell]');
  if (!shell) {
    shell = document.createElement('div');
    shell.dataset.traceSearchShell = '';
    shell.innerHTML = '<input type="search" data-trace-search data-search autocomplete="off" spellcheck="false" placeholder="Search traces" aria-label="Search traces"><button type="button" data-trace-search-close aria-label="Close trace search" title="Close search">×</button>';
    const input = shell.querySelector<HTMLInputElement>('[data-trace-search]');
    input?.addEventListener('input', () => virtualList?.setQuery(input.value));
    shell.querySelector<HTMLButtonElement>('[data-trace-search-close]')?.addEventListener('click', () => closeTraceSearch());
    actions.append(shell);
  }
  shell.classList.remove('is-closing');
  clock.dataset.traceSearchHidden = 'true';
  const input = shell.querySelector<HTMLInputElement>('[data-trace-search]');
  if (input) input.value = virtualList?.query() ?? '';
  requestAnimationFrame(() => shell?.classList.add('is-open'));
  input?.focus({ preventScroll: true });
}

function closeTraceSearch(clearQuery = true): void {
  const virtualList = (window as TraceWindow).__traceVirtualList;
  const shell = document.querySelector<HTMLElement>('[data-trace-search-shell]');
  const clock = document.querySelector<HTMLElement>('[data-trace-clock]');
  if (clearQuery) virtualList?.setQuery('');
  if (clock) delete clock.dataset.traceSearchHidden;
  if (!shell) return;
  shell.classList.remove('is-open');
  shell.classList.add('is-closing');
  window.setTimeout(() => {
    if (shell.classList.contains('is-closing')) shell.remove();
  }, 120);
}

function traceMap(): Map<string, TraceRecord> {
  const current = (window as TraceWindow).__traceRowsByTraceId;
  if (current instanceof Map) return current;
  const fallback = new Map<string, TraceRecord>();
  const seed = document.getElementById('trace-seed-data');
  if (seed?.textContent) {
    try {
      const payload = JSON.parse(seed.textContent) as { rows?: TraceRecord[] };
      for (const row of payload.rows ?? []) {
        addRowToMap(fallback, row);
        for (const child of childTraceRecords(row))
          addRowToMap(fallback, child);
      }
    } catch {}
  }
  return fallback;
}

function addRowToMap(map: Map<string, TraceRecord>, row: TraceRecord): void {
  const key = stableTraceKey(row);
  if (key) map.set(key, row);
  const traceId = clean(row.traceId ?? row.trace);
  if (traceId && !map.has(traceId)) map.set(traceId, row);
}

function allRows(): TraceRecord[] {
  return dedupeTraceRows(traceMap().values()).filter(
    (row) => !isBatchChild(row),
  );
}

function resetInitialTraceSurface(): void {
  const target = window as TraceWindow;
  target.__traceSelectedKey = '';
  const traceSurface = document.getElementById('tbmLiveTraceModal');
  traceSurface?.style.setProperty('display', 'block', 'important');
  traceSurface?.setAttribute('aria-hidden', 'false');
  document.querySelector(':scope > body > .screen')?.remove();
  document.querySelector('.trxShell > .trxToolbar')?.remove();
  for (const row of document.querySelectorAll<HTMLElement>(
    '.trxRow.selected, .trxRow.isSelected, .trxRow[aria-selected="true"], .lfStep.active',
  )) {
    row.classList.remove('selected', 'isSelected', 'active');
    row.setAttribute('aria-selected', 'false');
  }
  if (new URLSearchParams(location.hash.slice(1)).has('trace')) {
    try {
      history.replaceState(null, '', `${location.pathname}${location.search}`);
    } catch {
      location.hash = '';
    }
  }
}

function syncRowsFromMap(): void {
  inspectorStore.dispatch({
    type: 'rows-replaced',
    rows: dedupeTraceRows(traceMap().values()),
  });
}

function rowSummary(row: TraceRecord): string {
  return (
    clean(row.summary ?? row.output ?? row.input) ||
    'No summary recorded for this trace.'
  );
}

function statusLabel(row: TraceRecord): string {
  return isFailure(row) ? 'error' : clean(row.status) || 'success';
}

function fact(label: string, value: unknown): string {
  return `<div class="tiFact"><span>${escapeHtml(label)}</span><b>${escapeHtml(value ?? '—')}</b></div>`;
}

function flattenValue(
  value: unknown,
  path = '',
  depth = 0,
  output: FlatValue[] = [],
): FlatValue[] {
  if (output.length >= 300) return output;
  const parsed = typeof value === 'string' ? parseMaybeJson(value) : value;
  if (Array.isArray(parsed)) {
    if (!parsed.length)
      output.push({ path: path || 'value', value: [], depth });
    for (const [index, item] of parsed.entries())
      flattenValue(
        item,
        path ? `${path}.${index}` : String(index),
        depth + 1,
        output,
      );
    return output;
  }
  if (parsed && typeof parsed === 'object') {
    const entries = Object.entries(parsed as Record<string, unknown>);
    if (!entries.length)
      output.push({ path: path || 'value', value: {}, depth });
    for (const [key, item] of entries)
      flattenValue(item, path ? `${path}.${key}` : key, depth + 1, output);
    return output;
  }
  output.push({ path: path || 'value', value: parsed, depth });
  return output;
}

function valueType(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  return 'string';
}

function valueMarkup(value: unknown): string {
  if (value === null || value === undefined)
    return '<em class="tiValue tiValue-null">null</em>';
  if (Array.isArray(value))
    return '<em class="tiValue tiValue-null">empty array</em>';
  if (typeof value === 'object')
    return '<em class="tiValue tiValue-null">empty object</em>';
  const valueText = String(value);
  const className = `tiValue tiValue-${valueType(value)}`;
  return valueText.includes('\n') || valueText.length > 180
    ? `<pre class="${className}">${escapeHtml(valueText)}</pre>`
    : `<code class="${className}">${escapeHtml(valueText)}</code>`;
}

function structuredTable(value: unknown): string {
  const rows = flattenValue(value);
  if (!rows.length) return '<p class="tiEmptyValue">No value recorded.</p>';
  return `<div class="tiDataTable"><div class="tiDataHead"><span>Path</span><span>Value</span></div>
    ${rows
      .map(
        (entry) => `<div class="tiDataRow">
          <code class="tiDataPath" style="--ti-depth:${entry.depth}">${escapeHtml(entry.path)}</code>
          <div class="tiDataValue">${valueMarkup(entry.value)}</div>
        </div>`,
      )
      .join('')}
    ${rows.length >= 300 ? '<p class="tiDataLimit">Preview limited to 300 values.</p>' : ''}
  </div>`;
}

function sectionMarkup(section: InspectorSection): string {
  const emptyError = section.id === 'error' && section.value === null;
  return `<section class="tiSection tone-${section.tone}" data-ti-section="${section.id}">
    <header><h3>${escapeHtml(section.title)}</h3><button type="button" data-ti-copy aria-label="Copy ${escapeHtml(section.title)}">Copy</button></header>
    <div class="tiSectionBody">${emptyError ? '<p class="tiEmptyValue">No error recorded.</p>' : structuredTable(section.value)}</div>
  </section>`;
}

function summaryMarkup(
  row: TraceRecord,
  branch: ReturnType<typeof branchSummary>,
): string {
  const failed = isFailure(row);
  const insight = failed ? extractTraceError(row) : null;
  return `<section class="tiSummaryHero ${failed ? 'is-error' : ''}">
    <div>
      <span class="tiSummaryStatus">${escapeHtml(failed ? 'Actionable failure' : 'Completed')}</span>
      <h2>${escapeHtml(row.name ?? row.traceName ?? row.tool ?? 'trace')}</h2>
      <p>${escapeHtml(insight?.detail || rowSummary(row))}</p>
    </div>
    <section class="tiFactsGrid" aria-label="Selected call metrics">
      ${fact('Status', statusLabel(row))}
      ${fact('Code', clean(row.code) || 'OK')}
      ${fact('Latency', clean(row.latency) || formatDuration(row.durationMs))}
      ${fact('Tokens', formatCompact(totalTokens(row)))}
      ${fact('Node', traceNodeLabel(row) || '—')}
      ${fact('Route', traceRouteLabel(row) || '—')}
      ${fact('Branch calls', branch.calls)}
      ${fact('Failures', branch.failures)}
    </section>
  </section>`;
}

function jsonMarkup(row: TraceRecord): string {
  let value = '';
  try {
    value = JSON.stringify(row, null, 2);
  } catch {
    value = String(row);
  }
  return `<section class="tiSection tiJsonSection" data-ti-section="json">
    <header><h3>Raw trace JSON</h3><button type="button" data-ti-copy>Copy</button></header>
    <div class="tiSectionBody"><pre class="tiRawJson">${escapeHtml(value)}</pre></div>
  </section>`;
}

function workpadMarkup(row: TraceRecord): string {
  return `<section class="tiSection tiWorkpadSection tone-success" data-ti-section="workpad">
    <header><h3>Workpad</h3><button type="button" data-ti-copy aria-label="Copy workpad">Copy</button></header>
    <div class="tiSectionBody"><pre class="tiWorkpadValue">${escapeHtml(workpadTraceValue(row))}</pre></div>
  </section>`;
}

function peerTime(row: TraceRecord): string {
  const value = clean(row.displayTime ?? row.time ?? row.startTime);
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value.slice(-15)
    : date.toLocaleTimeString([], { hour12: false });
}

function branchPeers(
  branch: ReturnType<typeof branchSummary>,
  selected: TraceRecord,
  query: string,
): string {
  const selectedId = stableTraceKey(selected);
  const calls = branch.peers.flatMap((peer) => [
    peer,
    ...childTraceRecords(peer),
  ]);
  const filtered = filterInspectorCalls(calls, query);
  if (!filtered.length)
    return '<div class="tiEmptyCompact">No calls match this search.</div>';
  return filtered
    .map((peer) => {
      const key = stableTraceKey(peer);
      const status = statusLabel(peer);
      const child = isBatchChild(peer);
      const formatted = formatTraceTableRow(peer);
      return `<button class="tiPeer ${child ? 'tiPeerChild' : ''} ${key === selectedId ? 'active' : ''}" type="button" data-trace-key="${escapeHtml(key)}">
        <span class="tiPeerStatus ${status === 'error' ? 'error' : 'success'}" aria-label="${escapeHtml(status)}"></span>
        <span class="tiPeerMain"><b>${escapeHtml(formatted.toolLabel)}</b><small>${escapeHtml(peerTime(peer))}</small></span>
        <span class="tiPeerTokens">${escapeHtml(formatCompact(totalTokens(peer)))} tok</span>
        <span class="tiPeerDuration">${escapeHtml(clean(peer.latency) || formatDuration(peer.durationMs))}</span>
      </button>`;
    })
    .join('');
}

function branchPeersSignature(
  branch: ReturnType<typeof branchSummary>,
  selected: TraceRecord,
  query: string,
): string {
  return [
    stableTraceKey(selected),
    query,
    ...branch.peers.flatMap((peer) => [
      stableTraceKey(peer),
      peer.status,
      peer.code,
      peer.durationMs,
      totalTokens(peer),
      ...childTraceRecords(peer).flatMap((child) => [
        stableTraceKey(child),
        child.status,
        child.code,
        child.durationMs,
        totalTokens(child),
      ]),
    ]),
  ].join(':');
}

function headerMetricsMarkup(branch: ReturnType<typeof branchSummary>): string {
  const breadcrumb = normalizeBranchBreadcrumb(branch.branch);
  const metric = (label: string, value: string): string =>
    `<span class="tiHeaderMetric"><small>${escapeHtml(label)}</small><b>${escapeHtml(value)}</b></span>`;
  return [
    metric('Branch', breadcrumb.label),
    metric('Total', `${formatCompact(branch.totalTokens)} tok`),
    metric('Input', formatCompact(branch.inputTokens)),
    metric('Output', formatCompact(branch.outputTokens)),
    metric('Failures', String(branch.failures)),
    metric('Call time', formatDuration(branch.durationMs)),
  ].join('');
}

function headerMetricsSignature(
  branch: ReturnType<typeof branchSummary>,
): string {
  return [
    branch.branch,
    branch.totalTokens,
    branch.inputTokens,
    branch.outputTokens,
    branch.failures,
    branch.durationMs,
  ].join(':');
}

function searchIconMarkup(): string {
  return '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><circle cx="7" cy="7" r="4.25" fill="none" stroke="currentColor" stroke-width="1.5"></circle><path d="m10.2 10.2 3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg>';
}

function selectedContentMarkup(
  row: TraceRecord,
  branch: ReturnType<typeof branchSummary>,
): string {
  const state = inspectorStore.getSnapshot();
  if (state.displayMode === 'json') return jsonMarkup(row);
  if (state.displayMode === 'workpad') return workpadMarkup(row);
  return `${summaryMarkup(row, branch)}${inspectorSections(row).map(sectionMarkup).join('')}`;
}

function selectedContentSignature(row: TraceRecord): string {
  return [
    inspectorContentSignature(
      row,
      inspectorStore.getSnapshot().displayMode,
    ),
    traceNodeLabel(row),
    traceRouteLabel(row),
  ].join(':');
}

function inspectorMarkup(row: TraceRecord): string {
  const state = inspectorStore.getSnapshot();
  const key = stableTraceKey(row);
  const branch = branchSummary(allRows(), row);
  const content = selectedContentMarkup(row, branch);
  const workpad = isWorkpadTrace(row);
  return `<div class="tiInspector ${state.callRailCollapsed ? 'is-call-rail-collapsed' : ''}" data-ti-trace-key="${escapeHtml(key)}" data-ti-display-mode="${state.displayMode}">
    <header class="tiToolbar">
      <div class="tiToolbarIdentity">
        <div class="tiHeaderMetrics" aria-label="Branch metrics" data-ti-metrics-signature="${escapeHtml(headerMetricsSignature(branch))}">${headerMetricsMarkup(branch)}</div>
        <div class="tiSelectedMeta"><strong>${escapeHtml(row.name ?? row.traceName ?? row.tool ?? 'trace')}</strong><span class="tiStatusDot ${statusLabel(row)}"></span><span>${escapeHtml(statusLabel(row))}</span><span>${escapeHtml(clean(row.latency) || formatDuration(row.durationMs))}</span><span>${escapeHtml(formatCompact(totalTokens(row)))} tok</span></div>
      </div>
      <div class="tiToolbarActions">
        <div class="tiModeSwitch" role="group" aria-label="Trace display mode">
          <button type="button" data-ti-mode="formatted" class="${state.displayMode === 'formatted' ? 'active' : ''}">Formatted</button>
          <button type="button" data-ti-mode="json" class="${state.displayMode === 'json' ? 'active' : ''}">JSON</button>
          ${workpad ? `<button type="button" data-ti-mode="workpad" class="${state.displayMode === 'workpad' ? 'active' : ''}">Workpad</button>` : ''}
        </div>
        <button type="button" class="tiIconButton" data-ti-call-rail aria-label="${state.callRailCollapsed ? 'Expand tool calls' : 'Collapse tool calls'}" title="${state.callRailCollapsed ? 'Expand tool calls' : 'Collapse tool calls'}">☰</button>
        <button type="button" class="tiIconButton" data-ti-fullscreen aria-label="${state.layout === 'fullscreen' ? 'Exit full screen' : 'Full screen'}" title="${state.layout === 'fullscreen' ? 'Exit full screen' : 'Full screen'}">${state.layout === 'fullscreen' ? '↙' : '↗'}</button>
        <button type="button" class="tiIconButton tiCloseButton" data-ti-close aria-label="Close trace inspector" title="Close">×</button>
      </div>
    </header>
    <div class="tiInspectorBody">
      <aside class="tiSidebar" aria-label="Branch calls">
        <section class="tiCallRail">
          <label class="tiCallSearch"><span>${searchIconMarkup()}</span><input type="search" data-ti-call-search value="${escapeHtml(state.callQuery)}" placeholder="Search tool calls" aria-label="Search tool calls"></label>
          <div class="tiPeerList" aria-label="Tool calls" data-ti-peer-signature="${escapeHtml(branchPeersSignature(branch, row, state.callQuery))}">${branchPeers(branch, row, state.callQuery)}</div>
        </section>
      </aside>
      <main class="tiPreview" aria-label="Trace details">
        <div class="tiContent">${content}</div>
      </main>
    </div>
  </div>`;
}

function applyLayout(): void {
  const state = inspectorStore.getSnapshot();
  const shell = document.querySelector<HTMLElement>('.trxShell');
  const rail = document.querySelector<HTMLElement>('.trxRail');
  if (!shell || !rail) return;
  const body = rail.parentElement;
  const availableWidth = body?.clientWidth ?? shell.clientWidth;
  const compactLayout = availableWidth <= 760;
  const maxWidth = compactLayout
    ? availableWidth
    : Math.max(420, availableWidth - 8);
  const inspectorWidth = Math.min(state.width, maxWidth);
  const tableWidth = compactLayout
    ? availableWidth
    : Math.max(0, availableWidth - inspectorWidth - 8);
  shell.style.setProperty('--ti-inspector-width', `${inspectorWidth}px`);
  const open = Boolean(state.selectedKey) && state.layout !== 'collapsed';
  body?.style.setProperty(
    'grid-template-columns',
    open && !compactLayout
      ? `${Math.floor(tableWidth)}px 8px minmax(420px, ${inspectorWidth}px)`
      : 'minmax(0, 1fr)',
    'important',
  );
  shell.classList.toggle('ti-inspector-open', open);
  shell.classList.toggle(
    'ti-inspector-fullscreen',
    open && state.layout === 'fullscreen',
  );
  shell.classList.toggle('closed', !open);
  shell.classList.toggle('detail-open', open);
  rail.setAttribute('aria-hidden', String(!open));
  ensureDivider();
}

function ensureDivider(): void {
  const rail = document.querySelector<HTMLElement>('.trxRail');
  const parent = rail?.parentElement;
  if (!rail || !parent) return;
  let divider = parent.querySelector<HTMLElement>(
    ':scope > .tiDivider[data-ti-installed="true"]',
  );
  if (!divider) {
    divider = document.createElement('button');
    divider.className = 'trxResizer tiDivider';
    divider.setAttribute('type', 'button');
    divider.setAttribute('aria-label', 'Resize or collapse trace inspector');
    divider.setAttribute('title', 'Drag to resize · click to close');
    const retiredDivider = parent.querySelector<HTMLElement>(
      ':scope > .tiDivider, :scope > .trxResizer',
    );
    if (retiredDivider) retiredDivider.replaceWith(divider);
    else parent.insertBefore(divider, rail);
  }
  if (divider.dataset.tiInstalled === 'true') return;
  divider.dataset.tiInstalled = 'true';
  divider.addEventListener('click', (event) => event.preventDefault());
  divider.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = inspectorStore.getSnapshot().width;
    const availableWidth = parent.clientWidth;
    const maxWidth = Math.max(420, availableWidth - 8);
    let moved = false;
    let pendingWidth = startWidth;
    let resizeFrame = 0;
    divider?.setPointerCapture(event.pointerId);
    document.documentElement.classList.add('ti-is-resizing');
    const move = (moveEvent: PointerEvent) => {
      const delta = startX - moveEvent.clientX;
      if (Math.abs(delta) > 4) moved = true;
      if (moved) {
        pendingWidth = Math.min(startWidth + delta, maxWidth);
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
          inspectorStore.dispatch({ type: 'resize', width: pendingWidth });
        });
      }
    };
    const up = (upEvent: PointerEvent) => {
      divider?.releasePointerCapture(upEvent.pointerId);
      divider?.removeEventListener('pointermove', move);
      divider?.removeEventListener('pointerup', up);
      divider?.removeEventListener('pointercancel', up);
      document.documentElement.classList.remove('ti-is-resizing');
      if (!moved) {
        inspectorStore.dispatch({ type: 'toggle-collapse' });
      } else {
        cancelAnimationFrame(resizeFrame);
        inspectorStore.dispatch({ type: 'resize', width: pendingWidth });
        persistInspectorWidth(inspectorStore.getSnapshot().width);
      }
    };
    divider?.addEventListener('pointermove', move);
    divider?.addEventListener('pointerup', up);
    divider?.addEventListener('pointercancel', up);
  });
}

function persistInspectorWidth(width: number): void {
  try {
    localStorage.setItem(INSPECTOR_WIDTH_KEY, String(Math.round(width)));
  } catch {
    // Storage is optional in sandboxed previews.
  }
}

function hydrateInspectorWidth(): void {
  try {
    const width = Number(localStorage.getItem(INSPECTOR_WIDTH_KEY));
    if (Number.isFinite(width) && width >= 420) {
      inspectorStore.dispatch({ type: 'resize', width });
    }
  } catch {
    // Storage is optional in sandboxed previews.
  }
}

function render(): void {
  if (rendering) return;
  const inspector = document.querySelector<HTMLElement>('[data-inspector]');
  if (!inspector) return;
  let state = inspectorStore.getSnapshot();
  if (!state.selectedRow) {
    syncRowsFromMap();
    state = inspectorStore.getSnapshot();
    if (!state.selectedRow) return;
  }
  const row = state.selectedRow;
  const signature = [state.selectedKey, state.displayMode].join(':');
  const existing = inspector.querySelector<HTMLElement>('.tiInspector');
  if (
    existing?.dataset.tiTraceKey === state.selectedKey &&
    existing.dataset.tiDisplayMode === state.displayMode
  ) {
    const branch = branchSummary(allRows(), row);
    existing.classList.toggle(
      'is-call-rail-collapsed',
      state.callRailCollapsed,
    );
    const metrics = existing.querySelector<HTMLElement>('.tiHeaderMetrics');
    const metricsSignature = headerMetricsSignature(branch);
    if (metrics && metrics.dataset.tiMetricsSignature !== metricsSignature) {
      metrics.innerHTML = headerMetricsMarkup(branch);
      metrics.dataset.tiMetricsSignature = metricsSignature;
    }
    const peers = existing.querySelector<HTMLElement>('.tiPeerList');
    const peerSignature = branchPeersSignature(branch, row, state.callQuery);
    if (peers && peers.dataset.tiPeerSignature !== peerSignature) {
      peers.innerHTML = branchPeers(branch, row, state.callQuery);
      peers.dataset.tiPeerSignature = peerSignature;
    }
    const search = existing.querySelector<HTMLInputElement>(
      '[data-ti-call-search]',
    );
    if (search && document.activeElement !== search)
      search.value = state.callQuery;
    const contentSignature = selectedContentSignature(row);
    if (existing.dataset.tiContentSignature !== contentSignature) {
      const content = existing.querySelector<HTMLElement>('.tiContent');
      if (content) content.innerHTML = selectedContentMarkup(row, branch);
      existing.dataset.tiContentSignature = contentSignature;
    }
    const fullscreen = existing.querySelector<HTMLButtonElement>(
      '[data-ti-fullscreen]',
    );
    if (fullscreen) {
      const active = state.layout === 'fullscreen';
      fullscreen.textContent = active ? '↙' : '↗';
      fullscreen.title = active ? 'Exit full screen' : 'Full screen';
      fullscreen.setAttribute('aria-label', fullscreen.title);
    }
    const railToggle = existing.querySelector<HTMLButtonElement>(
      '[data-ti-call-rail]',
    );
    if (railToggle) {
      railToggle.setAttribute(
        'aria-label',
        state.callRailCollapsed ? 'Expand tool calls' : 'Collapse tool calls',
      );
    }
    inspector.dataset.tiSignature = signature;
    applyLayout();
    return;
  }

  const panelScroll =
    inspector.querySelector<HTMLElement>('.tiPreview')?.scrollTop ?? 0;
  const callScroll =
    inspector.querySelector<HTMLElement>('.tiPeerList')?.scrollTop ?? 0;
  const searchFocused =
    document.activeElement instanceof HTMLInputElement &&
    document.activeElement.matches('[data-ti-call-search]');
  const cursor =
    searchFocused && document.activeElement instanceof HTMLInputElement
      ? document.activeElement.selectionStart
      : null;

  rendering = true;
  try {
    inspector.innerHTML = inspectorMarkup(row);
    inspector.dataset.tiSignature = signature;
    const mounted = inspector.querySelector<HTMLElement>('.tiInspector');
    if (mounted)
      mounted.dataset.tiContentSignature = selectedContentSignature(row);
    const panel = inspector.querySelector<HTMLElement>('.tiPreview');
    const calls = inspector.querySelector<HTMLElement>('.tiPeerList');
    if (panel) panel.scrollTop = panelScroll;
    if (calls) calls.scrollTop = callScroll;
    if (searchFocused) {
      const input = inspector.querySelector<HTMLInputElement>(
        '[data-ti-call-search]',
      );
      input?.focus({ preventScroll: true });
      if (input && cursor !== null) input.setSelectionRange(cursor, cursor);
    }
  } finally {
    rendering = false;
  }
  applyLayout();
}

function scheduleRender(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    syncRowsFromMap();
    render();
    applyLayout();
  });
}

async function pollLiveRows(): Promise<void> {
  if (livePollInFlight || document.visibilityState === 'hidden') return;
  const transport = (window as TraceWindow).__consueloTraceHistoryTransport;
  if (!transport) return;
  if (!liveCursor) liveCursor = deriveTraceLiveCursor(allRows());
  livePollInFlight = true;
  try {
    const page = parseTraceLiveResponse(
      await transport.fetchJson(traceLiveUrl(liveCursor)),
    );
    if (page.rows.length) {
      (window as TraceWindow).__traceVirtualList?.prependRows(page.rows);
    }
    if (page.nextCursor) liveCursor = page.nextCursor;
  } catch {
    // Keep the cursor unchanged so the next one-second tick retries safely.
  } finally {
    livePollInFlight = false;
  }
}

async function hydrateLiveSnapshot(): Promise<void> {
  const transport = (window as TraceWindow).__consueloTraceHistoryTransport;
  if (!transport) return;
  try {
    const payload = (await transport.fetchJson(
      '/trace-burn-intelligence/live-traces.json',
    )) as { rows?: TraceRecord[]; traces?: TraceRecord[] } | TraceRecord[];
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.rows)
        ? payload.rows
        : Array.isArray(payload.traces)
          ? payload.traces
          : [];
    if (!rows.length) return;
    (window as TraceWindow).__traceVirtualList?.replaceRows(
      rows,
      deriveTraceHistoryCursor(rows),
    );
    liveCursor = deriveTraceLiveCursor(rows);
  } catch {
    // The serialized seed remains the offline fallback.
  }
}

function installLivePolling(): void {
  const refresh = () => void pollLiveRows();
  window.clearInterval(livePollTimer);
  void hydrateLiveSnapshot().finally(() => {
    if (!liveCursor) liveCursor = deriveTraceLiveCursor(allRows());
    livePollTimer = window.setInterval(refresh, 1_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh();
    });
    refresh();
  });
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function traceRowForInteraction(key: string): TraceRecord | null {
  const rows = (window as TraceWindow).__traceRowsByTraceId;
  if (!(rows instanceof Map)) return null;
  return (
    rows.get(key) ??
    [...rows.values()].find((row) => stableTraceKey(row) === key) ??
    null
  );
}

function rememberTraceInteraction(
  key: string,
  scope: TraceInteractionScope,
  source: TraceInteractionSource,
): void {
  if (!key) return;
  lastTraceInteraction = { key, scope, source };
}

function inspectorIsOpen(): boolean {
  const state = inspectorStore.getSnapshot();
  return Boolean(state.selectedRow && state.layout !== 'collapsed');
}

function clearPeerKeyboardTarget(): void {
  for (const peer of document.querySelectorAll<HTMLElement>('.tiPeer[data-keyboard-target]')) {
    delete peer.dataset.keyboardTarget;
  }
}

function moveInspectorPeer(direction: -1 | 1): string {
  const peers = [
    ...document.querySelectorAll<HTMLButtonElement>('.tiPeer[data-trace-key]'),
  ].filter((peer) => !peer.hidden && peer.offsetParent !== null);
  if (!peers.length) return '';
  const preferredKey =
    lastTraceInteraction?.scope === 'child' && lastTraceInteraction.source === 'keyboard'
      ? lastTraceInteraction.key
      : inspectorStore.getSnapshot().selectedKey;
  const currentIndex = peers.findIndex((peer) => peer.dataset.traceKey === preferredKey);
  const nextIndex = nextTraceInteractionIndex(peers.length, currentIndex, direction);
  const peer = nextIndex >= 0 ? peers[nextIndex] : undefined;
  const key = peer?.dataset.traceKey ?? '';
  if (!peer || !key) return '';
  clearPeerKeyboardTarget();
  peer.dataset.keyboardTarget = 'true';
  peer.focus({ preventScroll: true });
  peer.scrollIntoView({ block: 'nearest' });
  rememberTraceInteraction(key, 'child', 'keyboard');
  return key;
}

async function copyLastTraceInteraction(): Promise<boolean> {
  const interaction = lastTraceInteraction;
  if (!interaction) return false;
  const row = traceRowForInteraction(interaction.key);
  if (!row) return false;
  const text = traceIdentityCopyText(row);
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function storedReturnHomePreference(): 'home' | 'stay' | null {
  try {
    const value = localStorage.getItem(RETURN_HOME_PREFERENCE_KEY);
    return value === 'home' || value === 'stay' ? value : null;
  } catch {
    return null;
  }
}

function persistReturnHomePreference(value: 'home' | 'stay'): void {
  try {
    localStorage.setItem(RETURN_HOME_PREFERENCE_KEY, value);
  } catch {
    // Storage is optional in sandboxed previews.
  }
}

function ensureReturnHomeStyle(): void {
  if (document.querySelector('[data-trace-home-style]')) return;
  const style = document.createElement('style');
  style.dataset.traceHomeStyle = '';
  style.textContent = `
    @keyframes traceHomeAstroIn {
      from { opacity: 0; transform: translateY(8px) scale(.985); filter: blur(2px); }
      to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
    }
    [data-trace-home-confirm] { position: fixed; inset: 0; z-index: 2147483646; display: grid; place-items: center; background: rgba(0,0,0,.56); backdrop-filter: blur(4px); }
    [data-trace-home-card] { width: min(360px, calc(100vw - 32px)); border: 1px solid #3a382f; border-radius: 12px; background: #11110f; color: #d8d3c5; padding: 20px; box-shadow: 0 24px 80px rgba(0,0,0,.55); animation: traceHomeAstroIn 180ms cubic-bezier(.2,.8,.2,1) both; }
    [data-trace-home-card] h2 { margin: 0 0 16px; font: 600 18px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; }
    [data-trace-home-card] label { display: flex; gap: 9px; align-items: center; margin: 0 0 18px; font: 13px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace; color: #aaa493; }
    [data-trace-home-actions] { display: flex; justify-content: flex-end; gap: 8px; }
    [data-trace-home-actions] button { border: 1px solid #3a382f; border-radius: 8px; background: #191915; color: #d8d3c5; padding: 8px 14px; font: 13px/1 ui-monospace, SFMono-Regular, Menlo, monospace; cursor: pointer; }
    [data-trace-home-actions] button[data-home-yes] { color: #d8b260; }
    .tiPeer[data-keyboard-target="true"] { outline: 1px solid currentColor; outline-offset: -2px; }
  `;
  document.head.append(style);
}

function closeReturnHomeConfirm(): void {
  document.querySelector('[data-trace-home-confirm]')?.remove();
}

function showReturnHomeConfirm(): void {
  const preference = storedReturnHomePreference();
  if (preference === 'home') {
    location.assign('/');
    return;
  }
  if (preference === 'stay') return;
  if (document.querySelector('[data-trace-home-confirm]')) return;
  ensureReturnHomeStyle();
  const overlay = document.createElement('div');
  overlay.dataset.traceHomeConfirm = '';
  overlay.setAttribute('role', 'presentation');
  overlay.innerHTML = `<section data-trace-home-card role="dialog" aria-modal="true" aria-labelledby="trace-return-home-title">
    <h2 id="trace-return-home-title">Return home?</h2>
    <label><input type="checkbox" data-home-remember> <span>Do not ask again</span></label>
    <div data-trace-home-actions><button type="button" data-home-no>No</button><button type="button" data-home-yes>Yes</button></div>
  </section>`;
  overlay.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const remember = overlay.querySelector<HTMLInputElement>('[data-home-remember]')?.checked === true;
    if (target.closest('[data-home-no]')) {
      if (remember) persistReturnHomePreference('stay');
      closeReturnHomeConfirm();
      return;
    }
    if (target.closest('[data-home-yes]')) {
      if (remember) persistReturnHomePreference('home');
      location.assign('/');
    }
  });
  document.body.append(overlay);
  overlay.querySelector<HTMLButtonElement>('[data-home-no]')?.focus();
}

document.addEventListener('pointerover', (event) => {
  const target = event.target as HTMLElement;
  const peer = target.closest<HTMLElement>('.tiPeer[data-trace-key]');
  if (peer?.dataset.traceKey) {
    rememberTraceInteraction(peer.dataset.traceKey, 'child', 'hover');
    return;
  }
  const row = target.closest<HTMLElement>('.trxRow[data-trace-key]');
  if (row?.dataset.traceKey) rememberTraceInteraction(row.dataset.traceKey, 'main', 'hover');
});

document.addEventListener('keydown', (event) => {
  const virtualList = (window as TraceWindow).__traceVirtualList;
  const editing = isTextEditingTarget(event.target);

  if (event.key === 'Escape') {
    if (traceSearchIsOpen() || document.querySelector('[data-trace-search-shell]')) {
      event.preventDefault();
      closeTraceSearch();
      return;
    }
    if (document.querySelector('[data-trace-home-confirm]')) {
      event.preventDefault();
      closeReturnHomeConfirm();
      return;
    }
    if (virtualList?.filtersOpen()) {
      event.preventDefault();
      virtualList.closeFilters();
      return;
    }
    if (inspectorIsOpen()) {
      event.preventDefault();
      clearPeerKeyboardTarget();
      lastTraceInteraction = null;
      virtualList?.clearSelection();
      return;
    }
    event.preventDefault();
    showReturnHomeConfirm();
    return;
  }

  if (editing) return;

  if (event.metaKey && event.key === 'ArrowUp') {
    event.preventDefault();
    virtualList?.scrollToTop();
    return;
  }

  if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key === '/') {
    event.preventDefault();
    openTraceSearch();
    return;
  }

  if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    virtualList?.toggleFilters();
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
    const selection = window.getSelection()?.toString() ?? '';
    if (selection) return;
    if (lastTraceInteraction) {
      event.preventDefault();
      void copyLastTraceInteraction();
    }
    return;
  }

  const moveUp = event.key === 'ArrowUp' || event.key.toLowerCase() === 'k';
  const moveDown = event.key === 'ArrowDown' || event.key.toLowerCase() === 'j';
  if (!event.metaKey && !event.ctrlKey && !event.altKey && (moveUp || moveDown)) {
    event.preventDefault();
    const direction: -1 | 1 = moveUp ? -1 : 1;
    if (inspectorIsOpen()) {
      moveInspectorPeer(direction);
      return;
    }
    const key = virtualList?.moveFocus(direction) ?? '';
    if (key) rememberTraceInteraction(key, 'main', 'keyboard');
    return;
  }

  if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key === 'Enter') {
    if (inspectorIsOpen()) {
      if (lastTraceInteraction?.scope === 'child' && lastTraceInteraction.source === 'keyboard') {
        event.preventDefault();
        clearPeerKeyboardTarget();
        virtualList?.select(lastTraceInteraction.key);
      }
      return;
    }
    const key = virtualList?.openFocused() ?? '';
    if (key) {
      event.preventDefault();
      rememberTraceInteraction(key, 'main', 'keyboard');
    }
  }
});

document.addEventListener('click', async (event) => {
  const target = event.target as HTMLElement;
  const peer = target.closest<HTMLElement>('.tiPeer[data-trace-key]');
  if (peer?.dataset.traceKey) {
    event.preventDefault();
    event.stopPropagation();
    rememberTraceInteraction(peer.dataset.traceKey, 'child', 'hover');
    clearPeerKeyboardTarget();
    (window as TraceWindow).__traceVirtualList?.select(peer.dataset.traceKey);
    return;
  }
  const mode = target.closest<HTMLElement>('[data-ti-mode]');
  if (
    mode?.dataset.tiMode === 'formatted' ||
    mode?.dataset.tiMode === 'json' ||
    mode?.dataset.tiMode === 'workpad'
  ) {
    event.preventDefault();
    event.stopPropagation();
    inspectorStore.dispatch({
      type: 'set-display-mode',
      mode: mode.dataset.tiMode,
    });
    return;
  }
  if (target.closest('[data-ti-call-rail]')) {
    event.preventDefault();
    event.stopPropagation();
    inspectorStore.dispatch({ type: 'toggle-call-rail' });
    return;
  }
  if (target.closest('[data-ti-fullscreen]')) {
    event.preventDefault();
    event.stopPropagation();
    inspectorStore.dispatch({ type: 'toggle-fullscreen' });
    return;
  }
  if (target.closest('[data-ti-close], [data-ti-back]')) {
    event.preventDefault();
    event.stopPropagation();
    clearPeerKeyboardTarget();
    lastTraceInteraction = null;
    (window as TraceWindow).__traceVirtualList?.clearSelection();
    return;
  }
  const copy = target.closest<HTMLElement>('[data-ti-copy]');
  if (copy) {
    event.preventDefault();
    event.stopPropagation();
    const copyText =
      copy.closest('.tiSection')?.querySelector('.tiSectionBody')
        ?.textContent ?? '';
    try {
      await navigator.clipboard.writeText(copyText);
      copy.textContent = 'Copied';
      window.setTimeout(() => {
        copy.textContent = 'Copy';
      }, 1_200);
    } catch {
      copy.textContent = 'Copy failed';
    }
  }
});

document.addEventListener('input', (event) => {
  const target = event.target;
  if (
    target instanceof HTMLInputElement &&
    target.matches('[data-ti-call-search]')
  ) {
    inspectorStore.dispatch({ type: 'set-call-query', query: target.value });
    cancelAnimationFrame(callSearchFrame);
    callSearchFrame = requestAnimationFrame(render);
  }
});

const observer = new MutationObserver((mutations) => {
  if (rendering) return;
  if (
    mutations.every(
      (mutation) =>
        mutation.target instanceof Element &&
        mutation.target.closest('[data-inspector] .tiInspector'),
    )
  )
    return;
  scheduleRender();
});
const observerRoot =
  document.querySelector<HTMLElement>('.trxShell, #tbmLiveTraceModal') ??
  document.documentElement;
observer.observe(observerRoot, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['class', 'aria-selected'],
});

inspectorStore.subscribe((state) => {
  (window as TraceWindow).__traceSelectedKey = state.selectedKey;
  scheduleRender();
  applyLayout();
});

resetInitialTraceSurface();
syncRowsFromMap();
installTracePaginationTransport();
installTraceVirtualList();
hydrateInspectorWidth();
installTraceClock();
installLivePolling();
document.addEventListener('trace:selection-change', scheduleRender);
window.addEventListener('resize', applyLayout);
window.setInterval(scheduleRender, 2_000);
applyLayout();
scheduleRender();
