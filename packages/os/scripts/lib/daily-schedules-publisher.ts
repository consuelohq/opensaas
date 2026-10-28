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
  return 'self-healing';
}

function kindLabel(kind: DailyScheduleKind): string {
  if (kind === 'security-scan') return 'Security scan';
  if (kind === 'security-workpad') return 'Security workpad';
  return 'Self-healing workpad';
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
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)} · Daily Schedules</title>
  <style>
    :root { color-scheme:light; --paper:#f6efe4; --surface:#fff9f0; --ink:#251d17; --muted:#6f6256; --quiet:#9b8d7f; --line:#decfbc; --accent-strong:#e98262; }
    @media (prefers-color-scheme: dark) { :root { color-scheme:dark; --paper:#0f0f0d; --surface:#191814; --ink:#f2eee6; --muted:#b5aea2; --quiet:#7e776d; --line:#37322b; --accent-strong:#ff8b68; } }
    * { box-sizing:border-box; }
    html { background:var(--paper); }
    body { margin:0; background:var(--paper); color:var(--ink); font-family:"Geist Mono","Geist",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace; }
    main { width:min(860px, calc(100% - 40px)); margin:0 auto; padding:0 0 80px; }
    nav { min-height:74px; display:flex; align-items:center; border-bottom:1px solid var(--line); font-size:13px; }
    a { color:var(--ink); text-decoration:none; }
    a:hover { color:var(--accent-strong); text-decoration-line:underline; text-decoration-style:dotted; text-underline-offset:4px; }
    .heading { padding:42px 0 22px; }
    .meta { color:var(--quiet); font-size:12px; margin-bottom:10px; }
    h1 { margin:0; font-size:30px; letter-spacing:-.04em; }
    pre { margin:0; white-space:pre-wrap; overflow-wrap:anywhere; border-top:1px solid var(--line); padding:24px 0; color:var(--ink); font:12.5px/1.7 "Geist Mono",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; }
    @media (max-width:640px) { main{width:min(100% - 36px,860px)} nav{min-height:64px}.heading{padding-top:34px} }
  </style>
</head>
<body>
<main>
  <nav><a href="/artifacts/daily-schedules">← Daily Schedules</a></nav>
  <div class="heading"><div class="meta">${escapeHtml(input.date)} · ${escapeHtml(kindLabel(input.kind))} · ${escapeHtml(input.format)}</div>
  <h1>${escapeHtml(input.title)}</h1></div>
  <pre>${escapeHtml(input.content)}</pre>
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
    const match = artifact.path.match(/^\/daily-schedules\/(\d{4}-\d{2}-\d{2})\/(?:security-scan|security|self-healing)$/);
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
