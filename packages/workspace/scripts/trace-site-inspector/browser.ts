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
  totalTokens,
  type TraceRecord,
} from './model';
import {
  filterInspectorCalls,
  inspectorSections,
  inspectorStore,
  normalizeBranchBreadcrumb,
  type InspectorSection,
} from './inspector-state';
import { installTracePaginationTransport } from './pagination-browser';
import { installTraceVirtualList } from './virtual-list-browser';

type TraceWindow = Window & {
  __traceRowsByTraceId?: Map<string, TraceRecord>;
  __traceSelectedKey?: string;
  __consueloTraceHistoryTransport?: {
    fetchJson: (url: string) => Promise<unknown>;
  };
  __traceVirtualList?: {
    select: (key: string) => void;
    replaceRows: (rows: TraceRecord[], nextCursor?: string | null) => void;
  };
};

type TraceFeedPayload = {
  meta?: { nextCursor?: unknown };
  rows?: TraceRecord[];
  traces?: TraceRecord[];
};

type FlatValue = {
  path: string;
  value: unknown;
  depth: number;
};

let rendering = false;
let scheduled = false;
let callSearchFrame = 0;

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

function initialSelectionKey(): string {
  const target = window as TraceWindow;
  if (Object.hasOwn(target, '__traceSelectedKey'))
    return target.__traceSelectedKey ?? '';
  return (
    document.querySelector<HTMLElement>(
      '.trxRow.selected, .trxRow.isSelected, .trxRow[aria-selected="true"], .lfStep.active',
    )?.dataset.traceKey ??
    new URLSearchParams(location.hash.slice(1)).get('trace') ??
    ''
  );
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
    : `<code class="${className}">${escapeHtml(
        typeof value === 'string' ? `"${valueText}"` : valueText,
      )}</code>`;
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
      return `<button class="tiPeer ${child ? 'tiPeerChild' : ''} ${key === selectedId ? 'active' : ''}" type="button" data-trace-key="${escapeHtml(key)}">
        <span class="tiPeerStatus ${status === 'error' ? 'error' : 'success'}" aria-label="${escapeHtml(status)}"></span>
        <span class="tiPeerMain"><b>${escapeHtml(peer.name ?? peer.traceName ?? peer.tool ?? 'trace')}</b><small>${escapeHtml(peerTime(peer))}</small></span>
        <span class="tiPeerTokens">${escapeHtml(formatCompact(totalTokens(peer)))} tok</span>
        <span class="tiPeerDuration">${escapeHtml(clean(peer.latency) || formatDuration(peer.durationMs))}</span>
      </button>`;
    })
    .join('');
}

function inspectorMarkup(row: TraceRecord): string {
  const state = inspectorStore.getSnapshot();
  const key = stableTraceKey(row);
  const branch = branchSummary(allRows(), row);
  const breadcrumb = normalizeBranchBreadcrumb(branch.branch);
  const formatted = inspectorSections(row).map(sectionMarkup).join('');
  const content =
    state.displayMode === 'json'
      ? jsonMarkup(row)
      : `${summaryMarkup(row, branch)}${formatted}`;
  return `<div class="tiInspector ${state.callRailCollapsed ? 'is-call-rail-collapsed' : ''}" data-ti-trace-key="${escapeHtml(key)}" data-ti-display-mode="${state.displayMode}">
    <header class="tiToolbar">
      <div class="tiToolbarIdentity">
        <div class="tiBreadcrumb" title="${escapeHtml(branch.branch)}"><span>${escapeHtml(breadcrumb.stream)}</span>${breadcrumb.task ? `<i>/</i><b>${escapeHtml(breadcrumb.task)}</b>` : ''}</div>
        <div class="tiSelectedMeta"><strong>${escapeHtml(row.name ?? row.traceName ?? row.tool ?? 'trace')}</strong><span class="tiStatusDot ${statusLabel(row)}"></span><span>${escapeHtml(statusLabel(row))}</span><span>${escapeHtml(clean(row.latency) || formatDuration(row.durationMs))}</span><span>${escapeHtml(formatCompact(totalTokens(row)))} tok</span></div>
      </div>
      <div class="tiToolbarActions">
        <div class="tiModeSwitch" role="group" aria-label="Trace display mode">
          <button type="button" data-ti-mode="formatted" class="${state.displayMode === 'formatted' ? 'active' : ''}">Formatted</button>
          <button type="button" data-ti-mode="json" class="${state.displayMode === 'json' ? 'active' : ''}">JSON</button>
        </div>
        <button type="button" class="tiIconButton" data-ti-call-rail aria-label="${state.callRailCollapsed ? 'Expand tool calls' : 'Collapse tool calls'}" title="${state.callRailCollapsed ? 'Expand tool calls' : 'Collapse tool calls'}">☰</button>
        <button type="button" class="tiIconButton" data-ti-fullscreen aria-label="${state.layout === 'fullscreen' ? 'Exit full screen' : 'Full screen'}" title="${state.layout === 'fullscreen' ? 'Exit full screen' : 'Full screen'}">${state.layout === 'fullscreen' ? '↙' : '↗'}</button>
        <button type="button" class="tiIconButton tiCloseButton" data-ti-close aria-label="Close trace inspector" title="Close">×</button>
      </div>
    </header>
    <div class="tiInspectorBody">
      <aside class="tiSidebar" aria-label="Branch calls">
        <section class="tiBranchCard">
          <header><div><div class="tiEyebrow">Branch</div><h3>${escapeHtml(breadcrumb.label)}</h3></div><span class="tiBranchCalls">${branch.calls} calls</span></header>
          <div class="tiBranchTotals">
            ${fact('Total', `${formatCompact(branch.totalTokens)} tok`)}
            ${fact('Input', formatCompact(branch.inputTokens))}
            ${fact('Output', formatCompact(branch.outputTokens))}
            ${fact('Failures', branch.failures)}
            ${fact('Call time', formatDuration(branch.durationMs))}
          </div>
          <label class="tiCallSearch"><span aria-hidden="true">⌕</span><input type="search" data-ti-call-search value="${escapeHtml(state.callQuery)}" placeholder="Search tool calls" aria-label="Search tool calls"></label>
          <div class="tiPeerList" aria-label="Tool calls">${branchPeers(branch, row, state.callQuery)}</div>
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
  shell.style.setProperty('--ti-inspector-width', `${state.width}px`);
  const open = Boolean(state.selectedKey) && state.layout !== 'collapsed';
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
    ':scope > .tiDivider, :scope > .trxResizer',
  );
  if (divider) divider.classList.add('tiDivider');
  if (!divider) {
    divider = document.createElement('button');
    divider.className = 'tiDivider';
    divider.setAttribute('type', 'button');
    divider.setAttribute('aria-label', 'Resize or collapse trace inspector');
    divider.setAttribute('title', 'Drag to resize · click to close');
    parent.insertBefore(divider, rail);
  }
  if (divider.dataset.tiInstalled === 'true') return;
  divider.dataset.tiInstalled = 'true';
  divider.addEventListener('click', (event) => event.preventDefault());
  divider.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = inspectorStore.getSnapshot().width;
    let moved = false;
    divider?.setPointerCapture(event.pointerId);
    document.documentElement.classList.add('ti-is-resizing');
    const move = (moveEvent: PointerEvent) => {
      const delta = startX - moveEvent.clientX;
      if (Math.abs(delta) > 4) moved = true;
      if (moved)
        inspectorStore.dispatch({ type: 'resize', width: startWidth + delta });
    };
    const up = (upEvent: PointerEvent) => {
      divider?.releasePointerCapture(upEvent.pointerId);
      divider?.removeEventListener('pointermove', move);
      divider?.removeEventListener('pointerup', up);
      divider?.removeEventListener('pointercancel', up);
      document.documentElement.classList.remove('ti-is-resizing');
      if (!moved) inspectorStore.dispatch({ type: 'toggle-collapse' });
    };
    divider?.addEventListener('pointermove', move);
    divider?.addEventListener('pointerup', up);
    divider?.addEventListener('pointercancel', up);
  });
}

function render(force = false): void {
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
  const signature = [
    state.selectedKey,
    state.displayMode,
    state.callQuery,
    state.callRailCollapsed,
    state.layout,
    state.width,
    row.status,
    row.code,
    row.durationMs,
    totalTokens(row),
    allRows().length,
  ].join(':');
  if (
    !force &&
    inspector.dataset.tiSignature === signature &&
    inspector.querySelector('.tiInspector')
  )
    return;

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

async function refreshLiveRows(): Promise<void> {
  try {
    const transport = (window as TraceWindow).__consueloTraceHistoryTransport;
    if (!transport) return;
    const payload = (await transport.fetchJson(
      '/trace-burn-intelligence/live-traces.json',
    )) as TraceFeedPayload | TraceRecord[];
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.rows)
        ? payload.rows
        : Array.isArray(payload.traces)
          ? payload.traces
          : [];
    if (!rows.length) return;
    const nextCursor = Array.isArray(payload)
      ? undefined
      : clean(payload.meta?.nextCursor) || null;
    (window as TraceWindow).__traceVirtualList?.replaceRows(rows, nextCursor);
    inspectorStore.dispatch({ type: 'rows-replaced', rows });
  } catch {
    // The static seed remains a complete offline fallback.
  }
}

document.addEventListener('click', async (event) => {
  const target = event.target as HTMLElement;
  const peer = target.closest<HTMLElement>('.tiPeer[data-trace-key]');
  if (peer?.dataset.traceKey) {
    event.preventDefault();
    event.stopPropagation();
    (window as TraceWindow).__traceVirtualList?.select(peer.dataset.traceKey);
    return;
  }
  const mode = target.closest<HTMLElement>('[data-ti-mode]');
  if (mode?.dataset.tiMode === 'formatted' || mode?.dataset.tiMode === 'json') {
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
    inspectorStore.dispatch({ type: 'close' });
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
    callSearchFrame = requestAnimationFrame(() => render(true));
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

const initialKey = initialSelectionKey();
if (initialKey)
  inspectorStore.dispatch({ type: 'hydrate-selection', key: initialKey });
syncRowsFromMap();
installTracePaginationTransport();
installTraceVirtualList();
void refreshLiveRows();
document.addEventListener('trace:selection-change', scheduleRender);
window.addEventListener('resize', applyLayout);
window.setInterval(scheduleRender, 2_000);
scheduleRender();
