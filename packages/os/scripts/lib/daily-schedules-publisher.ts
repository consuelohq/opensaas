import fs from 'node:fs';
import path from 'node:path';

import { publishArtifact, readArtifactCatalog } from './artifacts';
import { resolveConsueloHome, resolveConsueloHomeLayout } from './consuelo-home';
import {
  DAILY_SCHEDULE_KINDS,
  createDailyScheduleEntry,
  renderDailySchedulesIndex,
  type DailyScheduleKind,
} from './daily-schedules';

export type DailyScheduleFormat = 'auto' | 'json' | 'markdown' | 'text';

export type PublishDailyScheduleInput = {
  kind: DailyScheduleKind;
  sourceFile?: string;
  content?: string;
  format?: DailyScheduleFormat;
  date?: string;
  title?: string;
  home?: string;
  now?: Date;
};

export type PublishDailyScheduleResult = {
  date: string;
  kind: DailyScheduleKind;
  detailArtifactId: string;
  detailVersionId: string;
  detailUrl: string;
  indexArtifactId: string;
  indexVersionId: string;
  indexUrl: string;
  entryCount: number;
};

export type DailyScheduleName = 'security' | 'self-healing';

export type PublishDailyScheduleBundleInput = {
  schedule: DailyScheduleName;
  reportFile: string;
  workpadFile: string;
  date?: string;
  home?: string;
  now?: Date;
};

export type PublishDailyScheduleBundleResult = {
  schedule: DailyScheduleName;
  date: string;
  indexUrl: string;
  entries: Array<{
    kind: DailyScheduleKind;
    url: string;
    artifactId: string;
    versionId: string;
  }>;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function localDate(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function kindSlug(kind: DailyScheduleKind): string {
  if (kind === 'security-scan') return 'security-scan';
  if (kind === 'security-workpad') return 'security';
  if (kind === 'self-healing-report') return 'self-healing-report';
  return 'self-healing';
}

function kindLabel(kind: DailyScheduleKind): string {
  if (kind === 'security-scan') return 'Security scan';
  if (kind === 'security-workpad') return 'Security workpad';
  if (kind === 'self-healing-report') return 'Self-healing report';
  return 'Self-healing workpad';
}

function jsonRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function numeric(record: Record<string, unknown> | undefined, key: string): number {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function reportBars(items: Array<{ label: string; value: number }>, ariaLabel: string): string {
  const positive = items.filter((item) => item.value > 0);
  const max = Math.max(1, ...positive.map((item) => item.value));
  if (positive.length < 3) {
    return `<p class="comparison" aria-label="${escapeHtml(ariaLabel)}">${positive.map((item) => `${escapeHtml(item.label)} ${item.value.toLocaleString()}`).join(' · ') || 'No classified findings'}</p>`;
  }
  return `<div class="bars" role="img" aria-label="${escapeHtml(ariaLabel)}">${positive.map((item) => {
    const width = Math.max(2, (item.value / max) * 100);
    return `<div class="bar-row"><span class="bar-label">${escapeHtml(item.label)}</span><span class="bar-track"><span class="bar-fill" style="width:${width.toFixed(2)}%"></span></span><span class="bar-value">${item.value.toLocaleString()}</span></div>`;
  }).join('')}</div>`;
}

function renderSecurityReport(payload: Record<string, unknown>): string {
  const summary = jsonRecord(payload.uniqueSummary) ?? jsonRecord(payload.summary);
  const delta = jsonRecord(payload.delta);
  const scanners = Array.isArray(payload.scanners) ? payload.scanners : [];
  const newCount = Array.isArray(delta?.newGroupKeys) ? delta.newGroupKeys.length : 0;
  const persistentCount = Array.isArray(delta?.persistentGroupKeys) ? delta.persistentGroupKeys.length : 0;
  const resolvedCount = Array.isArray(delta?.resolvedGroupKeys) ? delta.resolvedGroupKeys.length : 0;
  const scannerRows = scanners.map((value) => jsonRecord(value)).filter(Boolean).map((scanner) =>
    `<tr><td>${escapeHtml(String(scanner?.name ?? 'scanner'))}</td><td>${escapeHtml(String(scanner?.status ?? 'unknown'))}</td><td class="num">${numeric(scanner, 'findingCount').toLocaleString()}</td></tr>`).join('');
  return `<section class="report" aria-label="Security scan summary">
    <p class="lede"><strong>${newCount.toLocaleString()} new</strong>, ${resolvedCount.toLocaleString()} resolved, ${persistentCount.toLocaleString()} persistent grouped candidates.</p>
    <p class="comparison">Compared with the previous scan; scanner evidence is triage input, not a verified exploit count.</p>
    ${reportBars([
      { label: 'Critical', value: numeric(summary, 'critical') },
      { label: 'High', value: numeric(summary, 'high') },
      { label: 'Medium', value: numeric(summary, 'medium') },
      { label: 'Low', value: numeric(summary, 'low') },
      { label: 'Unknown', value: numeric(summary, 'unknown') },
    ], 'Security severity distribution')}
    <h2>Scanner completion</h2>
    <table><thead><tr><th>Scanner</th><th>Status</th><th class="num">Findings</th></tr></thead><tbody>${scannerRows}</tbody></table>
  </section>`;
}

function renderSelfHealingReport(payload: Record<string, unknown>): string {
  const summary = jsonRecord(payload.summary);
  const total = numeric(summary, 'total');
  const actionable = numeric(summary, 'actionable');
  return `<section class="report" aria-label="Self-healing monitor summary">
    <p class="lede"><strong>${actionable.toLocaleString()} actionable</strong> groups from ${total.toLocaleString()} classified non-OK trace groups.</p>
    <p class="comparison">Compared with the full 24-hour non-OK trace set; expected policy and caller-input failures remain visible but are not treated as defects.</p>
    ${reportBars([
      { label: 'Defect candidate', value: numeric(summary, 'defectCandidate') },
      { label: 'Runtime drift', value: numeric(summary, 'runtimeContractDrift') },
      { label: 'Expected policy', value: numeric(summary, 'expectedPolicy') },
      { label: 'Caller input', value: numeric(summary, 'callerInput') },
      { label: 'Transient', value: numeric(summary, 'transient') },
      { label: 'External', value: numeric(summary, 'external') },
      { label: 'Unknown', value: numeric(summary, 'unknown') },
    ], 'Self-healing error classification distribution')}
  </section>`;
}

function resolveSourceFile(sourceFile: string): string {
  const absolute = path.isAbsolute(sourceFile) ? sourceFile : path.resolve(process.cwd(), sourceFile);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new Error(`daily schedule source file does not exist: ${sourceFile}`);
  }
  return absolute;
}

function detectFormat(sourceFile: string | undefined, format: DailyScheduleFormat): Exclude<DailyScheduleFormat, 'auto'> {
  if (format !== 'auto') return format;
  const extension = sourceFile ? path.extname(sourceFile).toLowerCase() : '';
  if (extension === '.json') return 'json';
  if (extension === '.md' || extension === '.mdx') return 'markdown';
  return 'text';
}

function normalizeBody(content: string, format: Exclude<DailyScheduleFormat, 'auto'>): string {
  if (format !== 'json') return content;
  try {
    return JSON.stringify(JSON.parse(content) as unknown, null, 2);
  } catch {
    throw new Error('daily schedule content declared as JSON is not valid JSON');
  }
}

function renderDetail(input: {
  title: string;
  date: string;
  kind: DailyScheduleKind;
  content: string;
  format: Exclude<DailyScheduleFormat, 'auto'>;
}): string {
  let renderedBody = `<pre>${escapeHtml(input.content)}</pre>`;
  if (input.format === 'json' && (input.kind === 'security-scan' || input.kind === 'self-healing-report')) {
    try {
      const payload = jsonRecord(JSON.parse(input.content) as unknown);
      if (payload) renderedBody = input.kind === 'security-scan' ? renderSecurityReport(payload) : renderSelfHealingReport(payload);
    } catch {
      // The publish contract validates JSON before rendering; retain escaped text as a defensive fallback.
    }
  }
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)} · Daily Schedules</title>
  <style>
    :root { color-scheme:light; --paper:#fffff8; --surface:#fffdf5; --ink:#111; --muted:#666; --quiet:#777; --line:#ccc; --series:#666; --accent-strong:#e41a1c; }
    @media (prefers-color-scheme: dark) { :root { color-scheme:dark; --paper:#151515; --surface:#1b1b1b; --ink:#ddd; --muted:#999; --quiet:#999; --line:#444; --series:#999; --accent-strong:#fc8d62; } }
    * { box-sizing:border-box; }
    html { background:var(--paper); }
    body { margin:0; background:var(--paper); color:var(--ink); font-family:"Geist Mono","Geist",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace; }
    main { width:min(860px, calc(100% - 40px)); margin:0 auto; padding:0 0 80px; }
    nav { min-height:74px; display:flex; align-items:center; border-bottom:1px solid var(--line); font-size:13px; }
    a { color:var(--ink); text-decoration:none; }
    a:hover { color:var(--accent-strong); text-decoration-line:underline; text-decoration-style:dotted; text-underline-offset:4px; }
    .heading { padding:42px 0 22px; }
    .meta { color:var(--quiet); font-size:12px; margin-bottom:10px; }
    h1, h2 { font-family:"ET Book","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif; }
    h1 { margin:0; font-size:30px; letter-spacing:-.03em; font-weight:600; }
    h2 { margin:34px 0 10px; font-size:18px; font-weight:600; }
    pre { margin:0; white-space:pre-wrap; overflow-wrap:anywhere; border-top:1px solid var(--line); padding:24px 0; color:var(--ink); font:12.5px/1.7 "Geist Mono",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; }
    .report { border-top:1px solid var(--line); padding:24px 0; font-family:"ET Book","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif; }
    .lede { margin:0 0 6px; font-size:20px; line-height:1.4; }
    .comparison { margin:0 0 26px; color:var(--muted); font-size:14px; line-height:1.55; }
    .bars { display:grid; gap:9px; margin:22px 0 30px; }
    .bar-row { display:grid; grid-template-columns:minmax(120px, 1fr) minmax(120px, 3fr) 64px; gap:10px; align-items:center; font-size:13px; }
    .bar-label { color:var(--muted); }
    .bar-track { height:8px; display:block; background:transparent; }
    .bar-fill { display:block; height:8px; background:var(--series); }
    .bar-value, .num { text-align:right; font-variant-numeric:tabular-nums; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th { color:var(--muted); font-weight:500; text-align:left; border-bottom:1px solid var(--line); padding:7px 0; }
    td { padding:8px 0; border-bottom:1px solid color-mix(in srgb, var(--line) 55%, transparent); }
    @media (max-width:640px) { main{width:min(100% - 36px,860px)} nav{min-height:64px}.heading{padding-top:34px} }
  </style>
</head>
<body>
<main>
  <nav><a href="/artifacts/daily-schedules">← Daily Schedules</a></nav>
  <div class="heading"><div class="meta">${escapeHtml(input.date)} · ${escapeHtml(kindLabel(input.kind))} · ${escapeHtml(input.format)}</div>
  <h1>${escapeHtml(input.title)}</h1></div>
  ${renderedBody}
</main>
</body>
</html>`;
}

function writeHtml(directory: string, html: string): string {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const filePath = path.join(directory, 'index.html');
  fs.writeFileSync(filePath, html, { mode: 0o600 });
  return directory;
}

function scheduleEntries(home: string) {
  const catalog = readArtifactCatalog(home);
  return catalog.entries.flatMap((artifact) => {
    if (!artifact.category.startsWith('daily-schedule:')) return [];
    const kind = artifact.category.slice('daily-schedule:'.length) as DailyScheduleKind;
    if (!DAILY_SCHEDULE_KINDS.includes(kind)) return [];
    const match = artifact.path.match(/^\/daily-schedules\/(\d{4}-\d{2}-\d{2})\/(?:security-scan|security|self-healing-report|self-healing)$/);
    if (!match) return [];
    return [createDailyScheduleEntry({
      date: match[1]!,
      kind,
      title: artifact.title,
      href: artifact.url,
      createdAt: artifact.updatedAt,
    })];
  });
}

function currentVersionForPath(home: string, artifactPath: string): string | undefined {
  return readArtifactCatalog(home).entries.find((entry) => entry.path === artifactPath)?.currentVersionId;
}

export function publishDailySchedule(input: PublishDailyScheduleInput): PublishDailyScheduleResult {
  if (Boolean(input.sourceFile) === (input.content !== undefined)) {
    throw new Error('daily schedule publish requires exactly one of sourceFile or content');
  }
  const home = resolveConsueloHome(input.home);
  const layout = resolveConsueloHomeLayout(home);
  const now = input.now ?? new Date();
  const date = input.date ?? localDate(now);
  const title = input.title?.trim() || kindLabel(input.kind);
  createDailyScheduleEntry({ date, kind: input.kind, title, href: '/validation' });
  const format = detectFormat(input.sourceFile, input.format ?? 'auto');
  const sourceFile = input.sourceFile ? resolveSourceFile(input.sourceFile) : undefined;
  const sourceContent = sourceFile ? fs.readFileSync(sourceFile, 'utf8') : input.content;
  if (sourceContent === undefined) throw new Error('daily schedule publish requires sourceFile or content');
  const content = normalizeBody(sourceContent, format);
  const slug = kindSlug(input.kind);
  const detailPath = `/daily-schedules/${date}/${slug}`;
  const runRoot = path.join(layout.nodeTmpDir, 'daily-schedules', `${Date.now()}-${process.pid}`);
  const detailDir = writeHtml(path.join(runRoot, 'detail'), renderDetail({
    title,
    date,
    kind: input.kind,
    content,
    format,
  }));
  const detail = publishArtifact({
    home,
    target: detailDir,
    path: detailPath,
    title,
    category: `daily-schedule:${input.kind}`,
    template: 'uncategorized',
    baseVersion: currentVersionForPath(home, detailPath),
    reason: `daily schedule ${input.kind} for ${date}`,
    now: now.toISOString(),
  });

  const entries = scheduleEntries(home);
  const indexDir = writeHtml(
    path.join(runRoot, 'index'),
    renderDailySchedulesIndex(entries, { title: 'Daily Schedules' }),
  );
  const index = publishArtifact({
    home,
    target: indexDir,
    path: '/daily-schedules',
    title: 'Daily Schedules',
    category: 'daily-schedules',
    template: 'website',
    baseVersion: currentVersionForPath(home, '/daily-schedules'),
    reason: `refresh daily schedules after ${input.kind} ${date}`,
    now: now.toISOString(),
  });

  fs.rmSync(runRoot, { recursive: true, force: true });
  return {
    date,
    kind: input.kind,
    detailArtifactId: detail.artifact.id,
    detailVersionId: detail.version.versionId,
    detailUrl: `/artifacts${detail.artifact.path}`,
    indexArtifactId: index.artifact.id,
    indexVersionId: index.version.versionId,
    indexUrl: '/artifacts/daily-schedules',
    entryCount: entries.length,
  };
}

export function publishDailyScheduleBundle(input: PublishDailyScheduleBundleInput): PublishDailyScheduleBundleResult {
  const reportKind: DailyScheduleKind = input.schedule === 'security' ? 'security-scan' : 'self-healing-report';
  const workpadKind: DailyScheduleKind = input.schedule === 'security' ? 'security-workpad' : 'self-healing-workpad';
  const report = publishDailySchedule({
    home: input.home,
    date: input.date,
    kind: reportKind,
    sourceFile: input.reportFile,
    format: 'json',
    now: input.now,
  });
  const workpad = publishDailySchedule({
    home: input.home,
    date: input.date,
    kind: workpadKind,
    sourceFile: input.workpadFile,
    format: 'markdown',
    now: input.now,
  });
  return {
    schedule: input.schedule,
    date: report.date,
    indexUrl: workpad.indexUrl,
    entries: [
      { kind: reportKind, url: report.detailUrl, artifactId: report.detailArtifactId, versionId: report.detailVersionId },
      { kind: workpadKind, url: workpad.detailUrl, artifactId: workpad.detailArtifactId, versionId: workpad.detailVersionId },
    ],
  };
}
