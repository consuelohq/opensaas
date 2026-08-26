export const DAILY_SCHEDULE_KINDS = [
  'security-scan',
  'security-workpad',
  'self-healing-workpad',
] as const;

export type DailyScheduleKind = (typeof DAILY_SCHEDULE_KINDS)[number];

export type DailyScheduleEntry = {
  date: string;
  kind: DailyScheduleKind;
  title: string;
  href: string;
  summary?: string;
  createdAt?: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function validKind(value: string): value is DailyScheduleKind {
  return (DAILY_SCHEDULE_KINDS as readonly string[]).includes(value);
}

export function createDailyScheduleEntry(input: DailyScheduleEntry): DailyScheduleEntry {
  if (!ISO_DATE.test(input.date) || Number.isNaN(Date.parse(`${input.date}T00:00:00.000Z`))) {
    throw new Error('daily schedule entry date must use YYYY-MM-DD');
  }
  if (!validKind(input.kind)) {
    throw new Error(`unsupported daily schedule kind: ${String(input.kind)}`);
  }
  if (!input.title.trim()) throw new Error('daily schedule entry title is required');
  if (!input.href.startsWith('/')) throw new Error('daily schedule entry href must be an absolute artifact route');
  return {
    ...input,
    title: input.title.trim(),
    href: input.href.trim(),
    ...(input.summary?.trim() ? { summary: input.summary.trim() } : {}),
  };
}

function kindLabel(kind: DailyScheduleKind): string {
  if (kind === 'security-scan') return 'Security scan';
  if (kind === 'security-workpad') return 'Security workpad';
  return 'Self-healing workpad';
}

function entryHtml(entry: DailyScheduleEntry): string {
  return `<li class="entry" data-schedule-date="${escapeHtml(entry.date)}" data-schedule-kind="${entry.kind}">
    <a href="${escapeHtml(entry.href)}">
      <span class="entry-kind">${escapeHtml(kindLabel(entry.kind))}</span>
      <span class="entry-title">${escapeHtml(entry.title)}</span>
      ${entry.summary ? `<span class="entry-summary">${escapeHtml(entry.summary)}</span>` : ''}
    </a>
  </li>`;
}

export function renderDailySchedulesIndex(
  entries: DailyScheduleEntry[],
  options: { title?: string } = {},
): string {
  const title = options.title?.trim() || 'Daily Schedules';
  const normalized = entries.map(createDailyScheduleEntry).sort((a, b) =>
    b.date.localeCompare(a.date) || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
  const grouped = new Map<string, DailyScheduleEntry[]>();
  for (const entry of normalized) {
    const group = grouped.get(entry.date) ?? [];
    group.push(entry);
    grouped.set(entry.date, group);
  }
  const groupsHtml = [...grouped.entries()].map(([date, items]) => `
    <section class="day" data-day="${escapeHtml(date)}">
      <h2>${escapeHtml(date)}</h2>
      <ul>${items.map(entryHtml).join('\n')}</ul>
    </section>`).join('\n');

  const body = groupsHtml || '<p class="empty">No schedule entries yet.</p>';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme:light; --paper:#f6efe4; --surface:#fff9f0; --ink:#251d17; --muted:#6f6256; --quiet:#9b8d7f; --line:#decfbc; --accent-strong:#e98262; }
    @media (prefers-color-scheme: dark) { :root { color-scheme:dark; --paper:#0f0f0d; --surface:#191814; --ink:#f2eee6; --muted:#b5aea2; --quiet:#7e776d; --line:#37322b; --accent-strong:#ff8b68; } }
    * { box-sizing:border-box; }
    html { background:var(--paper); }
    body { margin:0; background:var(--paper); color:var(--ink); font-family:"Geist Mono","Geist",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace; }
    main { width:min(720px, calc(100% - 40px)); margin:0 auto; padding:0 0 72px; }
    .topbar { min-height:74px; display:flex; align-items:center; justify-content:space-between; gap:18px; border-bottom:1px solid var(--line); }
    .brand { color:var(--ink); text-decoration:none; font-size:15px; font-weight:800; }
    .brand:hover, .entry a:hover { color:var(--accent-strong); text-decoration-line:underline; text-decoration-style:dotted; text-underline-offset:4px; }
    header { display:flex; align-items:end; justify-content:space-between; gap:24px; padding:52px 0 24px; border-bottom:1px solid var(--line); }
    h1 { margin:0; font-size:38px; letter-spacing:-0.055em; font-weight:850; }
    .filters { display:flex; gap:10px; flex-wrap:wrap; }
    input, select { appearance:none; border:1px solid var(--line); border-radius:8px; background:var(--surface); color:var(--ink); padding:8px 10px; font:inherit; font-size:12px; }
    .day { padding:30px 0 8px; border-bottom:1px solid var(--line); }
    .day h2 { margin:0 0 10px; font-size:13px; font-weight:700; color:var(--muted); letter-spacing:.02em; }
    ul { margin:0; padding:0; list-style:none; }
    .entry a { display:grid; grid-template-columns:160px minmax(0, 1fr); gap:14px; padding:12px 0; color:inherit; text-decoration:none; }
    .entry-kind { color:var(--quiet); font-size:12px; }
    .entry-title { font-size:14px; }
    .entry-summary { grid-column:2; margin-top:-8px; color:var(--quiet); font-size:12px; line-height:1.5; }
    .empty { color:var(--quiet); padding:34px 0; }
    [hidden] { display:none !important; }
    @media (max-width:640px) { main{width:min(100% - 36px,720px)} .topbar{min-height:64px} header{align-items:start;flex-direction:column;padding-top:40px}.entry a{grid-template-columns:1fr}.entry-summary{grid-column:1;margin-top:-6px} }
  </style>
</head>
<body>
<main>
  <div class="topbar"><a class="brand" href="/artifacts">Consuelo Artifacts</a></div>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <div class="filters">
      <input id="date-filter" type="date" aria-label="Filter by date" />
      <select id="kind-filter" aria-label="Filter by type">
        <option value="">All types</option>
        ${DAILY_SCHEDULE_KINDS.map((kind) => `<option value="${kind}">${escapeHtml(kindLabel(kind))}</option>`).join('')}
      </select>
    </div>
  </header>
  <div id="entries">${body}</div>
</main>
<script>
  const dateFilter = document.getElementById('date-filter');
  const kindFilter = document.getElementById('kind-filter');
  const apply = () => {
    const date = dateFilter.value;
    const kind = kindFilter.value;
    document.querySelectorAll('.entry').forEach((entry) => {
      entry.hidden = Boolean((date && entry.dataset.scheduleDate !== date) || (kind && entry.dataset.scheduleKind !== kind));
    });
    document.querySelectorAll('.day').forEach((day) => {
      day.hidden = !Array.from(day.querySelectorAll('.entry')).some((entry) => !entry.hidden);
    });
  };
  dateFilter.addEventListener('change', apply);
  kindFilter.addEventListener('change', apply);
</script>
</body>
</html>`;
}
