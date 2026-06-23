import {
  applyTraceFeed,
  countBy,
  createTraceExplorerState,
  filterTraceRows,
  pageRows,
  selectTraceByKey,
  stableTraceKey,
  traceFeedSignature,
  type TraceExplorerState,
  type TraceFeed,
  type TraceRow,
} from "./traceStore";

const fallbackFeed: TraceFeed = {
  meta: { generatedAt: new Date(0).toISOString(), rowCount: 0, failureCount: 0, maxRowid: 0 },
  rows: [],
  failures: [],
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pretty(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}

function formatCompact(value: unknown): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export async function pollTraceFeed(feedUrl: string): Promise<TraceFeed | null> {
  try {
    const response = await fetch(`${feedUrl}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return null;
    const feed = (await response.json()) as TraceFeed;
    if (!Array.isArray(feed.rows)) return null;
    return feed;
  } catch {
    return null;
  }
}

function getInitialFeed(root: HTMLElement): TraceFeed {
  const seed = root.querySelector<HTMLScriptElement>("#trace-seed-data");
  if (!seed?.textContent) return fallbackFeed;
  try {
    return JSON.parse(seed.textContent) as TraceFeed;
  } catch {
    return fallbackFeed;
  }
}

function renderKpis(root: HTMLElement, state: TraceExplorerState) {
  const meta = state.meta ?? {};
  const set = (selector: string, text: string) => {
    const el = root.querySelector(selector);
    if (el) el.textContent = text;
  };
  set("[data-kpi='trace-count']", String(meta.rowCount ?? state.rows.length));
  set("[data-kpi='failure-count']", String(meta.failureCount ?? state.failures.length));
  set("[data-kpi='tokens']", formatCompact(meta.tokens ?? state.rows.reduce((sum, row) => sum + Number(row.tokens ?? 0), 0)));
  set("[data-kpi='cost']", `$${Number(meta.cost ?? state.rows.reduce((sum, row) => sum + Number(row.cost ?? 0), 0)).toFixed(2)}`);
  const health = root.querySelector("[data-feed-health]");
  if (health) health.textContent = `pseudo-live · ${meta.rowCount ?? state.rows.length} traces · ${meta.failureCount ?? state.failures.length} errors`;
}

function renderFilters(root: HTMLElement, state: TraceExplorerState) {
  const container = root.querySelector("[data-filter-list]");
  if (!container) return;
  const branchButtons = countBy(state.rows, "branch").slice(0, 10).map(([branch, count]) => `<button class="filter-chip" data-filter-branch="${escapeHtml(branch)}"><span>${escapeHtml(branch)}</span><b>${count}</b></button>`).join("");
  const toolButtons = countBy(state.rows, "tool").slice(0, 10).map(([tool, count]) => `<button class="filter-chip" data-filter-tool="${escapeHtml(tool)}"><span>${escapeHtml(tool)}</span><b>${count}</b></button>`).join("");
  container.innerHTML = `<p class="eyebrow">Branches / task sessions</p>${branchButtons}<p class="eyebrow tools-label">Tools</p>${toolButtons}`;
}

function renderRows(root: HTMLElement, state: TraceExplorerState) {
  const body = root.querySelector("[data-trace-rows]");
  const count = root.querySelector("[data-trace-count]");
  const page = root.querySelector<HTMLInputElement>("[data-page-input]");
  const pages = root.querySelector("[data-page-count]");
  if (!body) return;
  const filtered = filterTraceRows(state.rows, state.filters);
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  state.page = Math.min(state.page, totalPages);
  const visible = pageRows(filtered, state.page, state.pageSize);
  body.innerHTML = visible.map((row) => {
    const key = stableTraceKey(row);
    const branch = String(row.branch || row.taskSession || "no-branch");
    return `<button class="trace-row ${state.selectedKey === key ? "selected" : ""}" data-trace-key="${escapeHtml(key)}">
      <span class="check"></span>
      <span class="mono time">${escapeHtml(row.displayTime)}</span>
      <span class="status ${row.status === "error" ? "error" : "success"}">✤</span>
      <span class="tool">${escapeHtml(row.name)}</span>
      <span class="branch">${escapeHtml(branch)}</span>
      <span class="mono input">${escapeHtml(row.input)}</span>
      <span class="mono output">${escapeHtml(row.output || row.summary)}</span>
      <span class="mono tokens">${escapeHtml(formatCompact(row.tokens))}</span>
      <span class="mono cost">${escapeHtml(row.costLabel || `$${Number(row.cost ?? 0).toFixed(4)}`)}</span>
      <span class="mono latency">${escapeHtml(row.latency)}</span>
    </button>`;
  }).join("") || `<div class="empty-state">No traces match this view.</div>`;
  if (count) count.textContent = String(filtered.length);
  if (page) page.value = String(state.page);
  if (pages) pages.textContent = String(totalPages);
}

function renderInspector(root: HTMLElement, state: TraceExplorerState) {
  const rail = root.querySelector("[data-inspector]");
  if (!rail) return;
  if (state.mode === "filters" || !state.selectedTrace) {
    rail.innerHTML = `<div class="panel-title"><span>Filters</span><h2>Trace scope</h2><p>Click a branch, tool, or status to isolate. The table stays readable.</p></div><div data-filter-list></div>`;
    renderFilters(root, state);
    return;
  }
  const row = state.selectedTrace as TraceRow;
  rail.innerHTML = `<div class="panel-title"><span>${escapeHtml(row.status)}</span><h2>${escapeHtml(row.name)}</h2><p>${escapeHtml(row.displayTime)} · ${escapeHtml(row.code)}</p></div>
    <div class="trace-detail-tabs"><button class="active">Preview</button><button>Scores</button><button>Log View</button></div>
    <section class="payload"><h3>Input</h3><pre>${escapeHtml(row.rawResolvedInputJson || row.rawInputJson || pretty(row.inputObj || row.input))}</pre></section>
    <section class="payload"><h3>Output</h3><pre>${escapeHtml(row.rawResultJson || pretty(row.outputObj || row.output))}</pre></section>
    <section class="payload"><h3>Metadata</h3><pre>${escapeHtml(pretty(row.metadata))}</pre></section>
    ${row.rawStderr ? `<section class="payload"><h3>stderr</h3><pre>${escapeHtml(row.rawStderr)}</pre></section>` : ""}`;
}

function render(root: HTMLElement, state: TraceExplorerState) {
  renderKpis(root, state);
  renderRows(root, state);
  renderInspector(root, state);
  root.dataset.mode = state.mode;
}

export function mountTraceExplorer(root: HTMLElement = document.body) {
  const feedUrl = root.dataset.feedUrl || "/trace-burn-intelligence/live-traces.json";
  let state = createTraceExplorerState(getInitialFeed(root));
  const modal = root.querySelector<HTMLElement>("[data-trace-modal]");
  const open = () => {
    modal?.classList.add("open");
    state.mode = state.selectedTrace ? "detail" : "list";
    render(root, state);
  };
  const close = () => modal?.classList.remove("open");

  root.querySelector<HTMLElement>("[data-testid='trace-launcher']")?.addEventListener("click", (event) => {
    event.preventDefault();
    open();
  });
  root.querySelector<HTMLElement>("[data-close-traces]")?.addEventListener("click", close);
  root.querySelector<HTMLInputElement>("[data-search]")?.addEventListener("input", (event) => {
    state.filters.query = (event.target as HTMLInputElement).value;
    state.page = 1;
    render(root, state);
  });
  root.querySelector<HTMLElement>("[data-show-filters]")?.addEventListener("click", () => {
    state.mode = "filters";
    render(root, state);
  });
  root.querySelector<HTMLElement>("[data-next-page]")?.addEventListener("click", () => {
    state.page += 1;
    render(root, state);
  });
  root.querySelector<HTMLElement>("[data-prev-page]")?.addEventListener("click", () => {
    state.page = Math.max(1, state.page - 1);
    render(root, state);
  });
  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>("[data-trace-key]");
    if (row) {
      state = selectTraceByKey(state, row.dataset.traceKey || "");
      render(root, state);
      return;
    }
    const branch = target.closest<HTMLElement>("[data-filter-branch]");
    if (branch) {
      state.filters.branch = branch.dataset.filterBranch || null;
      state.page = 1;
      state.mode = "list";
      render(root, state);
      return;
    }
    const tool = target.closest<HTMLElement>("[data-filter-tool]");
    if (tool) {
      state.filters.tool = tool.dataset.filterTool || null;
      state.page = 1;
      state.mode = "list";
      render(root, state);
    }
  });

  async function refresh() {
    try {
      const feed = await pollTraceFeed(feedUrl);
      if (!feed) return;
      const nextSignature = traceFeedSignature(feed);
      if (nextSignature === state.feedSignature) {
        renderKpis(root, { ...state, meta: feed.meta });
        return;
      }
      state = applyTraceFeed(state, feed);
      render(root, state);
    } catch {
      // Keep the static fallback usable when the pseudo-live feed is temporarily unavailable.
    }
  }

  render(root, state);
  void refresh();
  window.setInterval(refresh, 15_000);
}

