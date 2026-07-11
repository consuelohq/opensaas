import {
  branchSummary,
  clean,
  dedupeTraceRows,
  extractTraceError,
  isFailure,
  parseMaybeJson,
  stableTraceKey,
  totalTokens,
  type TraceRecord,
} from './model';
import { installTraceVirtualList } from './virtual-list-browser';

type PreviewTab = 'summary' | 'input' | 'output' | 'error' | 'metadata' | 'raw';

type TraceWindow = Window & {
  __traceRowsByTraceId?: Map<string, TraceRecord>;
  __traceSelectedKey?: string;
};

const tabs: Array<{ id: PreviewTab; label: string }> = [
  { id: 'summary', label: 'Summary' },
  { id: 'input', label: 'Input' },
  { id: 'output', label: 'Output' },
  { id: 'error', label: 'Error' },
  { id: 'metadata', label: 'Metadata' },
  { id: 'raw', label: 'Raw' },
];

const tabState = new Map<string, PreviewTab>();
let rendering = false;
let scheduled = false;
let mobileMenuOpen = false;
let wrapped = true;

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

function pretty(value: unknown): string {
  if (value === null || value === undefined || value === '')
    return 'No payload recorded.';
  const parsed = parseMaybeJson(value);
  if (typeof parsed === 'string') return parsed || 'No payload recorded.';
  try {
    return JSON.stringify(parsed, null, 2);
  } catch {
    return String(parsed);
  }
}

function boundedPretty(value: unknown): string {
  const text = pretty(value);
  const limit = 200_000;
  return text.length > limit
    ? `${text.slice(0, limit)}\n\n… preview limited to ${limit.toLocaleString()} characters`
    : text;
}

function selectedKey(): string {
  const target = window as TraceWindow;
  if (target.__traceSelectedKey) return target.__traceSelectedKey;
  const node = document.querySelector<HTMLElement>(
    '.trxRow.selected, .trxRow.isSelected, .trxRow[aria-selected="true"], .lfStep.active',
  );
  const key =
    node?.dataset.traceKey ??
    new URLSearchParams(location.hash.slice(1)).get('trace') ??
    '';
  target.__traceSelectedKey = key;
  return key;
}

function traceMap(): Map<string, TraceRecord> {
  const map = (window as TraceWindow).__traceRowsByTraceId;
  if (map instanceof Map) return map;
  const fallback = new Map<string, TraceRecord>();
  const seed = document.getElementById('trace-seed-data');
  if (seed?.textContent) {
    try {
      const payload = JSON.parse(seed.textContent) as { rows?: TraceRecord[] };
      for (const row of payload.rows ?? []) {
        const key = stableTraceKey(row);
        if (key) fallback.set(key, row);
        if (row.traceId) fallback.set(String(row.traceId), row);
      }
    } catch {}
  }
  return fallback;
}

function selectedRow(): TraceRecord | null {
  const key = selectedKey();
  if (!key) return null;
  const map = traceMap();
  return (
    map.get(key) ??
    [...map.values()].find((row) => stableTraceKey(row) === key) ??
    null
  );
}

function allRows(): TraceRecord[] {
  return dedupeTraceRows(traceMap().values());
}

function defaultTab(row: TraceRecord): PreviewTab {
  return isFailure(row) ? 'error' : 'summary';
}

function storedTab(key: string, row: TraceRecord): PreviewTab {
  const memory = tabState.get(key);
  if (memory) return memory;
  try {
    const stored = sessionStorage.getItem(
      `trace-inspector-tab:${key}`,
    ) as PreviewTab | null;
    if (stored && tabs.some((tab) => tab.id === stored)) {
      tabState.set(key, stored);
      return stored;
    }
  } catch {}
  const fallback = defaultTab(row);
  tabState.set(key, fallback);
  return fallback;
}

function saveTab(key: string, tab: PreviewTab): void {
  tabState.set(key, tab);
  try {
    sessionStorage.setItem(`trace-inspector-tab:${key}`, tab);
  } catch {}
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

function payload(title: string, value: unknown, extraClass = ''): string {
  const content = boundedPretty(value);
  return `<section class="tiPayload ${extraClass}">
    <header><h3>${escapeHtml(title)}</h3><button type="button" data-ti-copy>Copy</button></header>
    <pre>${escapeHtml(content)}</pre>
  </section>`;
}

function failedChildren(row: TraceRecord): TraceRecord[] {
  const raw = parseMaybeJson(row.batchResultsJson);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is TraceRecord =>
        typeof item === 'object' && item !== null && !Array.isArray(item),
    )
    .filter(isFailure);
}

function errorPanel(row: TraceRecord): string {
  if (!isFailure(row)) {
    return '<section class="tiEmpty"><h3>No failure recorded</h3><p>This trace completed without an error payload.</p></section>';
  }
  const insight = extractTraceError(row);
  const children = failedChildren(row);
  const childMarkup = children.length
    ? `<section class="tiFailedChildren"><header><h3>Failed child calls</h3><span>${children.length}</span></header>
      ${children
        .map((child) => {
          const childInsight = extractTraceError(child);
          return `<article><div><b>${escapeHtml(childInsight.failedTool || child.tool || 'child call')}</b><span>${escapeHtml(childInsight.code)}</span></div><p>${escapeHtml(childInsight.detail)}</p></article>`;
        })
        .join('')}
    </section>`
    : '';
  return `<section class="tiErrorHero">
      <span class="tiErrorEyebrow">Actionable failure</span>
      <h3>${escapeHtml(insight.headline)}</h3>
      <p>${escapeHtml(insight.detail)}</p>
    </section>
    ${childMarkup}
    ${payload('stderr', row.rawStderr, 'tiErrorPayload')}
    ${payload('Result envelope', row.rawResultJson ?? row.outputObj ?? row.output, 'tiErrorPayload')}`;
}

function summaryPanel(
  row: TraceRecord,
  branch: ReturnType<typeof branchSummary>,
): string {
  return `<section class="tiSummaryHero">
      <div class="tiSummaryTool">${escapeHtml(row.name ?? row.traceName ?? 'trace')}</div>
      <p>${escapeHtml(rowSummary(row))}</p>
    </section>
    <section class="tiFactsGrid">
      ${fact('Status', statusLabel(row))}
      ${fact('Code', clean(row.code) || 'OK')}
      ${fact('Exit', row.exitCode ?? '—')}
      ${fact('Latency', clean(row.latency) || formatDuration(row.durationMs))}
      ${fact('Tokens', formatCompact(totalTokens(row)))}
      ${fact('Input tokens', formatCompact(row.inputTokens))}
      ${fact('Output tokens', formatCompact(row.outputTokens))}
      ${fact('Branch calls', branch.calls)}
      ${fact('Branch failures', branch.failures)}
      ${fact('Trace ID', row.traceId ?? row.trace ?? '—')}
    </section>`;
}

function metadataPanel(
  row: TraceRecord,
  branch: ReturnType<typeof branchSummary>,
): string {
  const metadata = {
    traceId: row.traceId ?? row.trace,
    recordId: row.recordId ?? row.id,
    branch: branch.branch,
    taskSession: row.taskSession,
    worktree: row.worktree,
    startTime: row.startTime ?? row.time ?? row.ts,
    status: row.status,
    code: row.code,
    exitCode: row.exitCode,
    durationMs: row.durationMs,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    totalTokens: totalTokens(row),
    cost: row.cost,
    metadata: row.metadata,
  };
  return payload('Execution metadata', metadata);
}

function rawPanel(row: TraceRecord): string {
  return [
    payload('Resolved input', row.rawResolvedInputJson ?? row.resolvedInputObj),
    payload('Raw input', row.rawInputJson ?? row.inputObj ?? row.input),
    payload('Raw result', row.rawResultJson ?? row.outputObj ?? row.output),
    payload('stderr', row.rawStderr),
    payload('Batch / child results', row.batchResultsJson),
  ].join('');
}

function panel(
  tab: PreviewTab,
  row: TraceRecord,
  branch: ReturnType<typeof branchSummary>,
): string {
  switch (tab) {
    case 'summary':
      return summaryPanel(row, branch);
    case 'input':
      return [
        payload(
          'Resolved input',
          row.rawResolvedInputJson ??
            row.resolvedInputObj ??
            row.inputObj ??
            row.input,
        ),
        payload(
          'Original input',
          row.rawInputJson ?? row.inputObj ?? row.input,
        ),
      ].join('');
    case 'output':
      return payload(
        'Output',
        row.rawResultJson ?? row.outputObj ?? row.output ?? row.summary,
      );
    case 'error':
      return errorPanel(row);
    case 'metadata':
      return metadataPanel(row, branch);
    case 'raw':
      return rawPanel(row);
  }
}

function branchPeers(
  branch: ReturnType<typeof branchSummary>,
  selected: TraceRecord,
): string {
  const selectedId = stableTraceKey(selected);
  return (
    branch.peers
      .map((peer) => {
        const key = stableTraceKey(peer);
        const status = statusLabel(peer);
        return `<button class="tiPeer ${key === selectedId ? 'active' : ''}" type="button" data-trace-key="${escapeHtml(key)}">
      <span class="tiPeerStatus ${status === 'error' ? 'error' : 'success'}">✤</span>
      <span class="tiPeerMain"><b>${escapeHtml(peer.name ?? peer.traceName ?? 'trace')}</b><small>${escapeHtml(clean(peer.displayTime ?? peer.time ?? peer.startTime).slice(-15) || '—')}</small></span>
      <span class="tiPeerTokens">${escapeHtml(formatCompact(totalTokens(peer)))} tok</span>
      <span class="tiPeerDuration">${escapeHtml(clean(peer.latency) || formatDuration(peer.durationMs))}</span>
    </button>`;
      })
      .join('') ||
    '<div class="tiEmptyCompact">No branch peers in this feed window.</div>'
  );
}

function inspectorMarkup(row: TraceRecord): string {
  const key = stableTraceKey(row);
  const branch = branchSummary(allRows(), row);
  const active = storedTab(key, row);
  const status = statusLabel(row);
  return `<div class="tiInspector ${wrapped ? 'is-wrapped' : ''} ${mobileMenuOpen ? 'mobile-menu-open' : ''}" data-ti-trace-key="${escapeHtml(key)}" data-ti-active-tab="${active}">
    <header class="tiMobileBar">
      <button type="button" class="tiMobileBack" data-ti-back data-drawer-handle>Back</button>
      <span>Trace detail</span>
      <button type="button" class="tiMobileMenu" data-ti-menu>${mobileMenuOpen ? 'Preview' : 'Menu'}</button>
    </header>
    <aside class="tiSidebar" aria-label="Trace and branch context">
      <section class="tiTraceCard">
        <div class="tiEyebrow">Trace</div>
        <div class="tiTraceTitle"><span class="tiStatus ${status === 'error' ? 'error' : 'success'}">✤</span><h2>${escapeHtml(row.name ?? row.traceName ?? 'trace')}</h2></div>
        <p>${escapeHtml(rowSummary(row))}</p>
        <div class="tiTraceMetrics">
          <span>${escapeHtml(clean(row.code) || 'OK')}</span>
          <span>${escapeHtml(clean(row.latency) || formatDuration(row.durationMs))}</span>
          <span>${escapeHtml(formatCompact(totalTokens(row)))} tok</span>
        </div>
        <code>${escapeHtml(row.traceId ?? row.trace ?? key)}</code>
      </section>
      <section class="tiBranchCard">
        <header>
          <div><div class="tiEyebrow">Branch</div><h3 title="${escapeHtml(branch.branch)}">${escapeHtml(branch.branch)}</h3></div>
          <span class="tiBranchCalls">${branch.calls} calls</span>
        </header>
        <div class="tiBranchTotals">
          ${fact('Total', `${formatCompact(branch.totalTokens)} tok`)}
          ${fact('Input', formatCompact(branch.inputTokens))}
          ${fact('Output', formatCompact(branch.outputTokens))}
          ${fact('Failures', branch.failures)}
          ${fact('Call time', formatDuration(branch.durationMs))}
        </div>
        <div class="tiPeerList" aria-label="Branch calls">${branchPeers(branch, row)}</div>
      </section>
    </aside>
    <main class="tiPreview" aria-label="Trace preview">
      <header class="tiPreviewHeader">
        <div><div class="tiEyebrow">Preview</div><h2>${escapeHtml(row.name ?? row.traceName ?? 'trace')}</h2></div>
        <div class="tiPreviewActions"><button type="button" data-ti-wrap>${wrapped ? 'No wrap' : 'Wrap'}</button></div>
      </header>
      <nav class="tiTabs" aria-label="Trace preview sections">
        ${tabs.map((tab) => `<button type="button" class="${tab.id === active ? 'active' : ''}" data-ti-tab="${tab.id}">${tab.label}${tab.id === 'error' && isFailure(row) ? '<i></i>' : ''}</button>`).join('')}
      </nav>
      <div class="tiPanel" data-ti-panel="${active}">${panel(active, row, branch)}</div>
    </main>
  </div>`;
}

function render(force = false): void {
  if (rendering) return;
  const inspector = document.querySelector<HTMLElement>('[data-inspector]');
  const row = selectedRow();
  if (!inspector || !row) return;
  const key = stableTraceKey(row);
  const active = storedTab(key, row);
  const signature = [
    key,
    active,
    row.status,
    row.code,
    row.durationMs,
    totalTokens(row),
    mobileMenuOpen,
    wrapped,
  ].join(':');
  if (
    !force &&
    inspector.dataset.tiSignature === signature &&
    inspector.querySelector('.tiInspector')
  )
    return;
  rendering = true;
  try {
    const scroll =
      inspector.querySelector<HTMLElement>('.tiPanel')?.scrollTop ?? 0;
    inspector.innerHTML = inspectorMarkup(row);
    inspector.dataset.tiSignature = signature;
    const panel = inspector.querySelector<HTMLElement>('.tiPanel');
    if (panel) panel.scrollTop = scroll;
  } finally {
    rendering = false;
  }
}

function scheduleRender(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    render();
  });
}

document.addEventListener('click', async (event) => {
  const target = event.target as HTMLElement;
  const tab = target.closest<HTMLElement>('[data-ti-tab]');
  if (tab) {
    event.preventDefault();
    event.stopPropagation();
    const row = selectedRow();
    const next = tab.dataset.tiTab as PreviewTab;
    if (row && tabs.some((item) => item.id === next)) {
      saveTab(stableTraceKey(row), next);
      mobileMenuOpen = false;
      render(true);
    }
    return;
  }
  if (target.closest('[data-ti-menu]')) {
    event.preventDefault();
    event.stopPropagation();
    mobileMenuOpen = !mobileMenuOpen;
    render(true);
    return;
  }
  if (target.closest('[data-ti-wrap]')) {
    event.preventDefault();
    event.stopPropagation();
    wrapped = !wrapped;
    render(true);
    return;
  }
  const copy = target.closest<HTMLElement>('[data-ti-copy]');
  if (copy) {
    event.preventDefault();
    event.stopPropagation();
    const text =
      copy.closest('.tiPayload')?.querySelector('pre')?.textContent ?? '';
    try {
      await navigator.clipboard.writeText(text);
      copy.textContent = 'Copied';
      window.setTimeout(() => {
        copy.textContent = 'Copy';
      }, 1200);
    } catch {
      copy.textContent = 'Copy failed';
    }
    return;
  }
  if (target.closest('[data-ti-back]')) {
    mobileMenuOpen = false;
  }
});

const observer = new MutationObserver((mutations) => {
  if (rendering) return;
  if (
    mutations.some(
      (mutation) =>
        mutation.target instanceof Element &&
        mutation.target.closest(
          '[data-inspector] .tiInspector, [data-trace-virtual-content]',
        ),
    )
  )
    return;
  scheduleRender();
});
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['class', 'aria-selected'],
});

installTraceVirtualList();
document.addEventListener('trace:selection-change', () => render(true));
window.addEventListener('resize', scheduleRender);
window.setInterval(scheduleRender, 2_000);
scheduleRender();
