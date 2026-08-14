import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type ArtifactTemplate =
  | 'research'
  | 'spec'
  | 'plan'
  | 'guide'
  | 'website'
  | 'uncategorized'
  | (string & {});

export type ArtifactVersion = {
  id: string;
  artifactId: string;
  versionId: string;
  previousVersionId: string | null;
  restoredFromVersionId: string | null;
  title: string;
  path: string;
  category: string;
  template: ArtifactTemplate;
  sourceTarget: string;
  sourceKind: 'materialized' | 'external';
  externalUrl: string | null;
  storageKey: string;
  localPath: string;
  contentSha256: string;
  byteSize: number;
  fileCount: number;
  traceId: string | null;
  skillName: string | null;
  reason: string;
  publishedAt: string;
  updatedAt: string;
};

export type ArtifactRecord = {
  id: string;
  title: string;
  path: string;
  category: string;
  template: ArtifactTemplate;
  currentVersionId: string;
  versionCount: number;
  createdAt: string;
  updatedAt: string;
  versions: ArtifactVersion[];
};

export type ArtifactEntry = {
  id: string;
  title: string;
  path: string;
  url: string;
  category: string;
  template: ArtifactTemplate;
  currentVersionId: string;
  versionCount: number;
  publishedAt: string;
  updatedAt: string;
};

export type ArtifactCatalog = {
  version: 3;
  updatedAt: string;
  entries: ArtifactEntry[];
  artifacts: Record<string, ArtifactRecord>;
};

export type PublishArtifactInput = {
  home: string;
  target: string;
  path: string;
  title: string;
  category?: string;
  template?: ArtifactTemplate;
  baseVersion?: string | null;
  forcePublish?: boolean;
  traceId?: string | null;
  skillName?: string | null;
  reason?: string;
  now?: string;
};

export type PublishArtifactResult = {
  artifact: ArtifactRecord;
  version: ArtifactVersion;
  catalog: ArtifactCatalog;
  siteIndexPath: string;
};

export type RollbackArtifactInput = {
  home: string;
  artifactId: string;
  versionId: string;
  reason?: string;
  traceId?: string | null;
  skillName?: string | null;
  now?: string;
};

export type ImportLegacyArtifactArchiveInput = {
  home: string;
  sourceRoot: string;
};

export type ImportLegacyArtifactArchiveResult = {
  entries: number;
  artifacts: number;
  versions: number;
  materializedVersions: number;
  externalVersions: number;
  files: number;
  orphanPages: Array<{
    pageId: string;
    title: string;
    path: string;
    currentVersionId: string;
    reason: 'not-present-in-visible-archive';
  }>;
  catalogPath: string;
  migrationReportPath: string;
  siteIndexPath: string;
};

type LegacyArchiveVersion = {
  versionId: string;
  previousVersionId?: string | null;
  title: string;
  path: string;
  target?: string;
  sourceTarget?: string;
  artifactPath?: string | null;
  template?: string;
  category?: string;
  publishedAt?: string;
  updatedAt?: string;
};

type LegacyArchivePage = {
  id?: string;
  pageId?: string;
  title: string;
  path: string;
  currentVersionId: string;
  versions: LegacyArchiveVersion[];
};

type LegacyArchiveEntry = {
  id?: string;
  pageId?: string;
  title: string;
  path: string;
  target?: string;
  sourceTarget?: string;
  artifactPath?: string | null;
  template?: string;
  category?: string;
  publishedAt?: string;
  updatedAt?: string;
  currentVersionId: string;
  versionCount?: number;
};

type LegacyArchivePayload = {
  version: number;
  updatedAt?: string;
  entries?: LegacyArchiveEntry[];
  pages?: Record<string, LegacyArchivePage>;
};

type TreeDigest = {
  sha256: string;
  byteSize: number;
  fileCount: number;
};

const ARTIFACTS_ROUTE = '/artifacts';
const ARTIFACTS_TITLE = 'Consuelo Artifacts';
const ARTIFACTS_DESCRIPTION = 'Private Consuelo artifacts, guides, specifications, plans, websites, and durable generated outputs.';
const CONSUELO_MARK_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../assets/consuelo-mark.png',
);

function consueloMarkDataUri(): string {
  if (!fs.existsSync(CONSUELO_MARK_PATH)) {
    throw new Error(`Consuelo mark asset is missing: ${CONSUELO_MARK_PATH}`);
  }
  return `data:image/png;base64,${fs.readFileSync(CONSUELO_MARK_PATH).toString('base64')}`;
}

function nowIso(value?: string): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`invalid artifact timestamp: ${value}`);
  return parsed.toISOString();
}

function versionIdFromTimestamp(value: string): string {
  return value.replace(/[:.]/g, '-');
}

function normalizeRoutePath(value: string): string {
  const pathname = value.trim().split(/[?#]/, 1)[0] ?? '';
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) throw new Error('artifact path must contain at least one segment');
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error('artifact path cannot contain dot segments');
  }
  return `/${segments.map((segment) => segment.replace(/[^A-Za-z0-9._-]/g, '-')).join('/')}`;
}

function pathSegments(routePath: string): string[] {
  return normalizeRoutePath(routePath).split('/').filter(Boolean);
}

function artifactIdForPath(routePath: string): string {
  return `artifact-${createHash('sha256').update(normalizeRoutePath(routePath)).digest('hex').slice(0, 16)}`;
}

function artifactsRoot(home: string): string {
  return path.join(home, 'artifacts');
}

export function artifactCatalogPath(home: string): string {
  return path.join(artifactsRoot(home), 'catalog.json');
}

export function artifactsSiteIndexPath(home: string): string {
  return path.join(home, 'sites', 'artifacts', 'index.html');
}

export function artifactsSiteDataPath(home: string): string {
  return path.join(home, 'sites', 'artifacts', 'data', 'catalog.json');
}

function artifactCurrentDir(home: string, routePath: string): string {
  return path.join(artifactsRoot(home), 'current', ...pathSegments(routePath));
}

function artifactVersionDir(home: string, routePath: string, versionId: string): string {
  return path.join(artifactsRoot(home), 'versions', ...pathSegments(routePath), versionId);
}

function emptyCatalog(updatedAt = new Date(0).toISOString()): ArtifactCatalog {
  return { version: 3, updatedAt, entries: [], artifacts: {} };
}

function atomicWrite(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporaryPath, content, { mode: 0o600 });
  fs.renameSync(temporaryPath, filePath);
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateCatalog(value: unknown): ArtifactCatalog {
  if (!isRecord(value) || value.version !== 3 || !Array.isArray(value.entries) || !isRecord(value.artifacts)) {
    throw new Error('artifact catalog is invalid');
  }
  return value as ArtifactCatalog;
}

export function readArtifactCatalog(home: string): ArtifactCatalog {
  const filePath = artifactCatalogPath(home);
  if (!fs.existsSync(filePath)) return emptyCatalog();
  return validateCatalog(readJsonFile(filePath));
}

function writeArtifactCatalog(home: string, catalog: ArtifactCatalog): void {
  atomicWrite(artifactCatalogPath(home), `${JSON.stringify(catalog, null, 2)}\n`);
}

function copyPublishTarget(target: string, destinationDir: string): void {
  const sourcePath = path.resolve(target);
  if (!fs.existsSync(sourcePath)) throw new Error(`artifact publish target does not exist: ${target}`);
  if (fs.existsSync(destinationDir)) throw new Error(`artifact version already exists: ${destinationDir}`);

  const stat = fs.statSync(sourcePath);
  fs.mkdirSync(destinationDir, { recursive: true });
  if (stat.isDirectory()) {
    fs.cpSync(sourcePath, destinationDir, { recursive: true, errorOnExist: true });
  } else if (stat.isFile()) {
    fs.copyFileSync(sourcePath, path.join(destinationDir, 'index.html'));
  } else {
    throw new Error(`artifact publish target must be a file or directory: ${target}`);
  }

  if (!fs.existsSync(path.join(destinationDir, 'index.html'))) {
    fs.rmSync(destinationDir, { recursive: true, force: true });
    throw new Error(`artifact directory publish target must contain index.html: ${target}`);
  }
}

function replaceDirectory(sourceDir: string, destinationDir: string): void {
  fs.rmSync(destinationDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destinationDir), { recursive: true });
  fs.cpSync(sourceDir, destinationDir, { recursive: true, errorOnExist: true });
}

function restoreDescendantCurrentArtifacts(
  home: string,
  catalog: ArtifactCatalog,
  parentPath: string,
): void {
  const normalizedParentPath = normalizeRoutePath(parentPath);
  const prefix = `${normalizedParentPath}/`;
  const descendants = Object.values(catalog.artifacts)
    .filter((artifact) => artifact.path.startsWith(prefix))
    .sort((left, right) => pathSegments(left.path).length - pathSegments(right.path).length);

  for (const artifact of descendants) {
    const versionDir = artifactVersionDir(home, artifact.path, artifact.currentVersionId);
    if (!fs.existsSync(versionDir)) {
      throw new Error(
        `artifact current version is missing for descendant ${artifact.path}: ${artifact.currentVersionId}`,
      );
    }
    replaceDirectory(versionDir, artifactCurrentDir(home, artifact.path));
  }
}

function listTreeFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`artifact trees cannot contain symbolic links: ${absolutePath}`);
      if (entry.isDirectory()) visit(absolutePath);
      else if (entry.isFile()) files.push(absolutePath);
    }
  };
  visit(root);
  return files.sort((left, right) => left.localeCompare(right));
}

function digestTree(root: string): TreeDigest {
  const hash = createHash('sha256');
  let byteSize = 0;
  const files = listTreeFiles(root);
  for (const filePath of files) {
    const relativePath = path.relative(root, filePath).split(path.sep).join('/');
    const bytes = fs.readFileSync(filePath);
    hash.update(relativePath);
    hash.update('\0');
    hash.update(bytes);
    hash.update('\0');
    byteSize += bytes.byteLength;
  }
  return { sha256: hash.digest('hex'), byteSize, fileCount: files.length };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function artifactPublicUrl(routePath: string): string {
  return `${ARTIFACTS_ROUTE}${normalizeRoutePath(routePath)}`;
}

function displayFilter(entry: ArtifactEntry): string {
  if (entry.template && entry.template !== 'uncategorized') return entry.template;
  const category = entry.category.toLowerCase();
  if (category.includes('website') || category.includes('landing')) return 'website';
  return 'uncategorized';
}

function renderArtifactsIndex(catalog: ArtifactCatalog): string {
  const logoDataUri = consueloMarkDataUri();
  const entries = [...catalog.entries].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const cards = entries.map((entry) => `
        <article class="post-item" data-template="${escapeHtml(displayFilter(entry))}" data-category="${escapeHtml(entry.category)}">
          <h3><a href="${escapeHtml(entry.url)}">${escapeHtml(entry.title)}</a></h3>
          <div class="post-meta">▣ Updated <time datetime="${escapeHtml(entry.updatedAt)}">${escapeHtml(new Date(entry.updatedAt).toLocaleDateString('en-US'))}</time> · ${entry.versionCount} version${entry.versionCount === 1 ? '' : 's'}</div>
          <p>${escapeHtml(entry.path)}</p>
        </article>`).join('');
  const searchData = JSON.stringify(entries.map((entry) => ({
    id: entry.id,
    title: entry.title,
    path: entry.path,
    url: entry.url,
    category: entry.category,
    template: displayFilter(entry),
    updatedAt: entry.updatedAt,
  }))).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${ARTIFACTS_TITLE}</title>
  <meta name="description" content="${ARTIFACTS_DESCRIPTION}" />
  <link rel="canonical" href="/artifacts" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${ARTIFACTS_TITLE}" />
  <meta property="og:description" content="${ARTIFACTS_DESCRIPTION}" />
  <meta property="og:url" content="/artifacts" />
  <meta name="twitter:card" content="summary" />
  <link rel="icon" type="image/png" href="${logoDataUri}" />
  <link rel="apple-touch-icon" href="${logoDataUri}" />
  <style>
    :root { color-scheme: light; --paper:#f6efe4; --surface:#fff9f0; --ink:#251d17; --muted:#6f6256; --quiet:#9b8d7f; --line:#decfbc; --soft:#efe3d2; --accent:#78533d; --accent-strong:#e98262; --accent-soft:#ead5bd; --shadow:0 18px 60px rgba(55,37,20,.14); }
    @media (prefers-color-scheme: dark) { :root { color-scheme:dark; --paper:#0f0f0d; --surface:#191814; --ink:#f2eee6; --muted:#b5aea2; --quiet:#7e776d; --line:#37322b; --soft:#221f1a; --accent:#f0c66d; --accent-strong:#ff8b68; --accent-soft:#352a1c; --shadow:0 28px 90px rgba(0,0,0,.42); } }
    * { box-sizing:border-box; }
    html { scroll-behavior:smooth; background:var(--paper); }
    body { margin:0; font-family:"Geist Mono","Geist",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace; color:var(--ink); background:var(--paper); }
    ::selection { background:var(--accent-soft); color:var(--ink); }
    .shell { max-width:720px; margin:0 auto; padding:0 22px 40px; }
    .topbar { position:sticky; top:0; z-index:20; display:flex; align-items:center; justify-content:space-between; gap:18px; min-height:74px; border-bottom:1px solid var(--line); background:color-mix(in srgb,var(--paper) 86%,transparent); backdrop-filter:blur(18px); }
    .brand { display:inline-flex; align-items:center; gap:10px; color:var(--ink); font-size:18px; font-weight:800; text-decoration:none; }
    .brand img { width:24px; height:24px; object-fit:contain; }
    .nav, .filter-row, .search-row { display:flex; align-items:center; gap:9px; flex-wrap:wrap; font-size:14px; }
    .nav a, .post-item h3 a { color:inherit; text-decoration:none; }
    .nav a:hover, .brand:hover, .post-item h3 a:hover, button:hover { color:var(--accent-strong); text-decoration-line:underline; text-decoration-style:dotted; text-underline-offset:4px; }
    header.hero { padding:58px 0 28px; border-bottom:1px solid var(--line); }
    h1 { margin:0 0 20px; font-size:48px; line-height:.98; letter-spacing:-.06em; font-weight:850; }
    .lead { margin:0 0 20px; color:var(--muted); font-size:15px; line-height:1.7; max-width:62ch; }
    .filter-label { color:var(--muted); }
    button { appearance:none; border:0; background:transparent; color:var(--ink); padding:0; font:inherit; cursor:pointer; }
    button.active { color:var(--accent-strong); font-weight:800; }
    button.active::before { content:"["; color:var(--quiet); } button.active::after { content:"]"; color:var(--quiet); }
    .search-row { margin-top:18px; padding:10px 12px; border:1px solid var(--line); border-radius:14px; background:var(--surface); box-shadow:var(--shadow); }
    .search-input { min-width:0; flex:1 1 220px; border:0; border-bottom:1px solid var(--line); padding:2px 0 5px; background:transparent; color:var(--ink); font:inherit; outline:none; }
    .section { padding:44px 0 34px; border-bottom:1px solid var(--line); }
    h2 { margin:0 0 24px; font-size:25px; letter-spacing:-.04em; }
    .post-list { display:grid; gap:26px; }
    .post-item h3 { margin:0 0 6px; font-size:17px; line-height:1.45; }
    .post-meta, .post-item p { margin:0 0 4px; color:var(--quiet); font-size:13px; line-height:1.5; }
    .empty { color:var(--quiet); }
    footer { padding:24px 0 0; color:var(--muted); font-size:13px; }
    [hidden] { display:none !important; }
    @media (max-width:680px) { .shell { padding-inline:18px; } .topbar { align-items:flex-start; flex-direction:column; padding:20px 0; } header.hero { padding-top:44px; } h1 { font-size:42px; } }
  </style>
</head>
<body>
  <div class="shell">
    <div class="topbar">
      <a class="brand" href="/artifacts">
        <img data-consuelo-logo src="${logoDataUri}" alt="Consuelo" width="24" height="24" />
        <span>Consuelo Artifacts</span>
      </a>
      <nav class="nav" aria-label="Primary"><a href="#recently-updated">Recently Updated</a><button type="button" data-search-toggle>Search</button></nav>
    </div>
    <header class="hero">
      <h1>Artifacts</h1>
      <p class="lead">Durable sites, guides, specifications, plans, reports, files, and generated outputs from Consuelo.</p>
      <div class="filter-row" aria-label="Filters"><span class="filter-label">Filters:</span><button class="active" data-filter="all">All</button><button data-filter="website">Website</button><button data-filter="guide">Guide</button><button data-filter="spec">Spec</button><button data-filter="plan">Plan</button><button data-filter="uncategorized">Uncategorized</button></div>
      <label class="search-row" hidden><span class="filter-label">Search:</span><input class="search-input" type="search" placeholder="filter artifacts" autocomplete="off" /></label>
    </header>
    <section class="section" id="recently-updated"><h2>Recently Updated</h2><div class="post-list" data-results>${cards || '<p class="empty">No artifacts published yet.</p>'}</div></section>
    <footer>© ${new Date(catalog.updatedAt).getUTCFullYear() || new Date().getUTCFullYear()} Consuelo. All rights reserved.</footer>
  </div>
  <script type="application/json" id="artifact-search-data">${searchData}</script>
  <script>
    const items = Array.from(document.querySelectorAll('.post-item'));
    const buttons = Array.from(document.querySelectorAll('[data-filter]'));
    const searchRow = document.querySelector('.search-row');
    const input = document.querySelector('.search-input');
    let activeFilter = 'all';
    const apply = () => { const query = String(input && input.value || '').trim().toLowerCase(); for (const item of items) { const matchesFilter = activeFilter === 'all' || item.dataset.template === activeFilter; const matchesQuery = !query || item.textContent.toLowerCase().includes(query); item.hidden = !(matchesFilter && matchesQuery); } };
    for (const button of buttons) button.addEventListener('click', () => { activeFilter = button.dataset.filter || 'all'; for (const candidate of buttons) candidate.classList.toggle('active', candidate === button); apply(); });
    document.querySelector('[data-search-toggle]')?.addEventListener('click', () => { searchRow.hidden = !searchRow.hidden; if (!searchRow.hidden) input.focus(); });
    input?.addEventListener('input', apply);
  </script>
</body>
</html>`;
}

export function refreshArtifactsSite(home: string, catalog = readArtifactCatalog(home)): string {
  const indexPath = artifactsSiteIndexPath(home);
  atomicWrite(indexPath, renderArtifactsIndex(catalog));
  atomicWrite(artifactsSiteDataPath(home), `${JSON.stringify(catalog, null, 2)}\n`);
  return indexPath;
}

function entryFromArtifact(artifact: ArtifactRecord): ArtifactEntry {
  return {
    id: artifact.id,
    title: artifact.title,
    path: artifact.path,
    url: artifactPublicUrl(artifact.path),
    category: artifact.category,
    template: artifact.template,
    currentVersionId: artifact.currentVersionId,
    versionCount: artifact.versionCount,
    publishedAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
  };
}

function nextVersionId(artifact: ArtifactRecord | undefined, timestamp: string): string {
  const base = versionIdFromTimestamp(timestamp);
  if (!artifact?.versions.some((version) => version.versionId === base)) return base;
  let suffix = 2;
  while (artifact.versions.some((version) => version.versionId === `${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function assertRevisionWritable(
  artifact: ArtifactRecord | undefined,
  baseVersion: string | null | undefined,
  forcePublish: boolean,
): void {
  if (!artifact || forcePublish) return;
  if (!baseVersion) throw new Error(`base version ${artifact.currentVersionId} is required for ${artifact.path}`);
  if (baseVersion !== artifact.currentVersionId) {
    throw new Error(`base version ${baseVersion} does not match current ${artifact.currentVersionId} for ${artifact.path}`);
  }
}

export function publishArtifact(input: PublishArtifactInput): PublishArtifactResult {
  const routePath = normalizeRoutePath(input.path);
  const artifactId = artifactIdForPath(routePath);
  const timestamp = nowIso(input.now);
  const catalog = readArtifactCatalog(input.home);
  const existing = catalog.artifacts[artifactId];
  assertRevisionWritable(existing, input.baseVersion, input.forcePublish === true);

  const versionId = nextVersionId(existing, timestamp);
  const versionDir = artifactVersionDir(input.home, routePath, versionId);
  copyPublishTarget(input.target, versionDir);
  const digest = digestTree(versionDir);
  const currentDir = artifactCurrentDir(input.home, routePath);
  replaceDirectory(versionDir, currentDir);
  restoreDescendantCurrentArtifacts(input.home, catalog, routePath);

  const category = input.category?.trim() || pathSegments(routePath)[0] || 'uncategorized';
  const template = input.template ?? 'uncategorized';
  const version: ArtifactVersion = {
    id: `${artifactId}:${versionId}`,
    artifactId,
    versionId,
    previousVersionId: existing?.currentVersionId ?? null,
    restoredFromVersionId: null,
    title: input.title,
    path: routePath,
    category,
    template,
    sourceTarget: path.resolve(input.target),
    sourceKind: 'materialized',
    externalUrl: null,
    storageKey: path.relative(input.home, versionDir).split(path.sep).join('/'),
    localPath: path.join(versionDir, 'index.html'),
    contentSha256: digest.sha256,
    byteSize: digest.byteSize,
    fileCount: digest.fileCount,
    traceId: input.traceId ?? null,
    skillName: input.skillName ?? null,
    reason: input.reason ?? (existing ? 'publish update' : 'publish create'),
    publishedAt: timestamp,
    updatedAt: timestamp,
  };
  const artifact: ArtifactRecord = {
    id: artifactId,
    title: input.title,
    path: routePath,
    category,
    template,
    currentVersionId: versionId,
    versionCount: (existing?.versionCount ?? 0) + 1,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    versions: [version, ...(existing?.versions ?? [])],
  };
  catalog.artifacts[artifactId] = artifact;
  catalog.entries = [
    entryFromArtifact(artifact),
    ...catalog.entries.filter((entry) => entry.id !== artifactId),
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  catalog.updatedAt = timestamp;
  writeArtifactCatalog(input.home, catalog);
  const siteIndexPath = refreshArtifactsSite(input.home, catalog);
  return { artifact, version, catalog, siteIndexPath };
}

export function rollbackArtifact(input: RollbackArtifactInput): PublishArtifactResult {
  const catalog = readArtifactCatalog(input.home);
  const artifact = catalog.artifacts[input.artifactId];
  if (!artifact) throw new Error(`artifact not found: ${input.artifactId}`);
  const target = artifact.versions.find((version) => version.versionId === input.versionId);
  if (!target) throw new Error(`artifact version not found: ${input.versionId}`);

  const sourceDir = path.dirname(target.localPath);
  const digest = digestTree(sourceDir);
  if (digest.sha256 !== target.contentSha256) {
    throw new Error(`artifact version integrity check failed: ${target.versionId}`);
  }

  const timestamp = nowIso(input.now);
  const versionId = nextVersionId(artifact, timestamp);
  const versionDir = artifactVersionDir(input.home, artifact.path, versionId);
  fs.mkdirSync(path.dirname(versionDir), { recursive: true });
  fs.cpSync(sourceDir, versionDir, { recursive: true, errorOnExist: true });
  replaceDirectory(versionDir, artifactCurrentDir(input.home, artifact.path));
  restoreDescendantCurrentArtifacts(input.home, catalog, artifact.path);

  const version: ArtifactVersion = {
    ...target,
    id: `${artifact.id}:${versionId}`,
    versionId,
    previousVersionId: artifact.currentVersionId,
    restoredFromVersionId: target.versionId,
    storageKey: path.relative(input.home, versionDir).split(path.sep).join('/'),
    localPath: path.join(versionDir, 'index.html'),
    traceId: input.traceId ?? target.traceId,
    skillName: input.skillName ?? target.skillName,
    reason: input.reason ?? `rollback to ${target.versionId}`,
    publishedAt: timestamp,
    updatedAt: timestamp,
  };
  const updated: ArtifactRecord = {
    ...artifact,
    title: target.title,
    category: target.category,
    template: target.template,
    currentVersionId: versionId,
    versionCount: artifact.versionCount + 1,
    updatedAt: timestamp,
    versions: [version, ...artifact.versions],
  };
  catalog.artifacts[artifact.id] = updated;
  catalog.entries = [
    entryFromArtifact(updated),
    ...catalog.entries.filter((entry) => entry.id !== artifact.id),
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  catalog.updatedAt = timestamp;
  writeArtifactCatalog(input.home, catalog);
  const siteIndexPath = refreshArtifactsSite(input.home, catalog);
  return { artifact: updated, version, catalog, siteIndexPath };
}

export function getArtifact(home: string, artifactId: string): ArtifactRecord | null {
  return readArtifactCatalog(home).artifacts[artifactId] ?? null;
}

export function getArtifactByPath(home: string, routePath: string): ArtifactRecord | null {
  const normalized = normalizeRoutePath(routePath);
  return Object.values(readArtifactCatalog(home).artifacts)
    .find((artifact) => artifact.path === normalized) ?? null;
}

export function listArtifactVersions(home: string, artifactId: string): ArtifactVersion[] {
  const artifact = getArtifact(home, artifactId);
  if (!artifact) throw new Error(`artifact not found: ${artifactId}`);
  return [...artifact.versions];
}

export function resolveArtifactCurrentIndex(home: string, routePath: string): string {
  return path.join(artifactCurrentDir(home, routePath), 'index.html');
}

function legacyPayload(sourceRoot: string): LegacyArchivePayload {
  const archivePath = path.join(sourceRoot, 'archive.json');
  if (!fs.existsSync(archivePath)) throw new Error(`legacy artifact archive is missing archive.json: ${sourceRoot}`);
  const value = readJsonFile(archivePath);
  if (!isRecord(value) || typeof value.version !== 'number') throw new Error('legacy artifact archive is invalid');
  return value as LegacyArchivePayload;
}

function legacyVersionDir(sourceRoot: string, routePath: string, versionId: string): string {
  return path.join(sourceRoot, 'artifacts', 'versions', ...pathSegments(routePath), versionId);
}

function legacyCurrentDir(sourceRoot: string, routePath: string): string {
  return path.join(sourceRoot, 'artifacts', 'current', ...pathSegments(routePath));
}

type LegacyArtifactSource =
  | { kind: 'materialized'; sourcePath: string }
  | { kind: 'external'; url: string };

function isHttpUrl(value: string | undefined): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function resolveLegacyArtifactSource(input: {
  sourceRoot: string;
  artifactPath?: string | null;
  target?: string;
  fallbackPath: string;
}): LegacyArtifactSource {
  const sourceRoot = path.resolve(input.sourceRoot);
  if (input.artifactPath) {
    const sourcePath = path.resolve(sourceRoot, input.artifactPath);
    if (sourcePath !== sourceRoot && !sourcePath.startsWith(`${sourceRoot}${path.sep}`)) {
      throw new Error(`legacy artifact path escapes source root: ${input.artifactPath}`);
    }
    if (fs.existsSync(sourcePath)) return { kind: 'materialized', sourcePath };
  }
  if (isHttpUrl(input.target)) return { kind: 'external', url: input.target };
  if (input.target && path.isAbsolute(input.target)) {
    const sourcePath = path.resolve(input.target);
    if ((sourcePath === sourceRoot || sourcePath.startsWith(`${sourceRoot}${path.sep}`)) && fs.existsSync(sourcePath)) {
      return { kind: 'materialized', sourcePath };
    }
  }
  if (fs.existsSync(input.fallbackPath)) {
    return { kind: 'materialized', sourcePath: input.fallbackPath };
  }
  throw new Error(`legacy artifact files are missing for ${input.artifactPath ?? input.target ?? input.fallbackPath}`);
}

function renderExternalArtifactReference(title: string, url: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="0; url=${escapeHtml(url)}" />
  <title>${escapeHtml(title)} · Consuelo Artifacts</title>
  <link rel="canonical" href="${escapeHtml(url)}" />
</head>
<body>
  <main>
    <p>This artifact is served by an external local application.</p>
    <p><a href="${escapeHtml(url)}">Open ${escapeHtml(title)}</a></p>
  </main>
</body>
</html>`;
}

function materializeLegacySource(
  source: LegacyArtifactSource,
  destination: string,
  title: string,
): { files: number; sourceKind: ArtifactVersion['sourceKind']; externalUrl: string | null } {
  if (fs.existsSync(destination)) throw new Error(`legacy artifact destination already exists: ${destination}`);
  if (source.kind === 'external') {
    atomicWrite(path.join(destination, 'index.html'), renderExternalArtifactReference(title, source.url));
    return { files: 1, sourceKind: 'external', externalUrl: source.url };
  }

  const sourceStat = fs.statSync(source.sourcePath);
  fs.mkdirSync(destination, { recursive: true });
  if (sourceStat.isDirectory()) {
    fs.cpSync(source.sourcePath, destination, { recursive: true, errorOnExist: true });
  } else if (sourceStat.isFile()) {
    fs.copyFileSync(source.sourcePath, path.join(destination, 'index.html'));
  } else {
    throw new Error(`legacy artifact source must be a file or directory: ${source.sourcePath}`);
  }
  if (!fs.existsSync(path.join(destination, 'index.html'))) {
    throw new Error(`legacy artifact source has no index.html: ${source.sourcePath}`);
  }
  return {
    files: listTreeFiles(destination).length,
    sourceKind: 'materialized',
    externalUrl: null,
  };
}

export function importLegacyArtifactArchive(
  input: ImportLegacyArtifactArchiveInput,
): ImportLegacyArtifactArchiveResult {
  const catalogPath = artifactCatalogPath(input.home);
  if (fs.existsSync(catalogPath)) throw new Error('artifact catalog is already initialized');

  const payload = legacyPayload(input.sourceRoot);
  const pageEntries = Object.entries(payload.pages ?? {});
  const visibleEntries: LegacyArchiveEntry[] = (payload.entries?.length ?? 0) > 0
    ? payload.entries ?? []
    : pageEntries.map(([pageId, page]) => ({
      id: pageId,
      pageId,
      title: page.title,
      path: page.path,
      currentVersionId: page.currentVersionId,
      versionCount: page.versions.length,
      category: page.versions[0]?.category,
      template: page.versions[0]?.template,
      publishedAt: page.versions.at(-1)?.publishedAt,
      updatedAt: page.versions[0]?.updatedAt,
    }));
  const catalog = emptyCatalog(nowIso(payload.updatedAt));
  const importedPageIds = new Set<string>();
  let versionCount = 0;
  let materializedVersionCount = 0;
  let externalVersionCount = 0;
  let fileCount = 0;

  for (const legacyEntry of visibleEntries) {
    const matchedPageEntry = pageEntries.find(([pageId, page]) => (
      pageId === legacyEntry.pageId
      || page.pageId === legacyEntry.pageId
      || normalizeRoutePath(page.path) === normalizeRoutePath(legacyEntry.path)
    ));
    if (!matchedPageEntry) {
      throw new Error(`legacy artifact page is missing for visible entry: ${legacyEntry.path}`);
    }
    const [matchedPageId, page] = matchedPageEntry;
    importedPageIds.add(matchedPageId);
    const routePath = normalizeRoutePath(page.path);
    const artifactId = artifactIdForPath(routePath);
    const category = legacyEntry.category ?? page.versions[0]?.category ?? pathSegments(routePath)[0] ?? 'uncategorized';
    const template = legacyEntry.template ?? page.versions[0]?.template ?? 'uncategorized';
    const versions: ArtifactVersion[] = [];

    for (const legacyVersion of page.versions) {
      const destinationVersionDir = artifactVersionDir(input.home, routePath, legacyVersion.versionId);
      const source = resolveLegacyArtifactSource({
        sourceRoot: input.sourceRoot,
        artifactPath: legacyVersion.artifactPath,
        target: legacyVersion.target,
        fallbackPath: legacyVersionDir(input.sourceRoot, routePath, legacyVersion.versionId),
      });
      const materialized = materializeLegacySource(
        source,
        destinationVersionDir,
        legacyVersion.title || page.title,
      );
      fileCount += materialized.files;
      if (materialized.sourceKind === 'external') externalVersionCount += 1;
      else materializedVersionCount += 1;
      const digest = digestTree(destinationVersionDir);
      const timestamp = nowIso(legacyVersion.updatedAt ?? legacyVersion.publishedAt ?? payload.updatedAt);
      versions.push({
        id: `${artifactId}:${legacyVersion.versionId}`,
        artifactId,
        versionId: legacyVersion.versionId,
        previousVersionId: legacyVersion.previousVersionId ?? null,
        restoredFromVersionId: null,
        title: legacyVersion.title || page.title,
        path: routePath,
        category: legacyVersion.category ?? category,
        template: legacyVersion.template ?? template,
        sourceTarget: legacyVersion.sourceTarget ?? legacyVersion.target ?? '',
        sourceKind: materialized.sourceKind,
        externalUrl: materialized.externalUrl,
        storageKey: path.relative(input.home, destinationVersionDir).split(path.sep).join('/'),
        localPath: path.join(destinationVersionDir, 'index.html'),
        contentSha256: digest.sha256,
        byteSize: digest.byteSize,
        fileCount: digest.fileCount,
        traceId: null,
        skillName: null,
        reason: 'legacy artifact archive import',
        publishedAt: nowIso(legacyVersion.publishedAt ?? legacyVersion.updatedAt ?? payload.updatedAt),
        updatedAt: timestamp,
      });
      versionCount += 1;
    }

    const destinationCurrentDir = artifactCurrentDir(input.home, routePath);
    const current = versions.find((version) => version.versionId === page.currentVersionId) ?? versions[0];
    if (!current) throw new Error(`legacy artifact has no versions: ${routePath}`);
    const currentSource = resolveLegacyArtifactSource({
      sourceRoot: input.sourceRoot,
      artifactPath: legacyEntry.artifactPath,
      target: legacyEntry.target,
      fallbackPath: legacyCurrentDir(input.sourceRoot, routePath),
    });
    fileCount += materializeLegacySource(
      currentSource,
      destinationCurrentDir,
      legacyEntry.title || page.title,
    ).files;
    const createdAt = versions.reduce((oldest, version) => version.publishedAt < oldest ? version.publishedAt : oldest, current.publishedAt);
    const updatedAt = legacyEntry.updatedAt ?? current.updatedAt;
    const artifact: ArtifactRecord = {
      id: artifactId,
      title: legacyEntry.title || page.title,
      path: routePath,
      category,
      template,
      currentVersionId: page.currentVersionId,
      versionCount: versions.length,
      createdAt,
      updatedAt: nowIso(updatedAt),
      versions: versions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    };
    catalog.artifacts[artifactId] = artifact;
    catalog.entries.push(entryFromArtifact(artifact));
  }

  const orphanPages = pageEntries
    .filter(([pageId]) => !importedPageIds.has(pageId))
    .map(([pageId, page]) => ({
      pageId: page.pageId ?? page.id ?? pageId,
      title: page.title,
      path: normalizeRoutePath(page.path),
      currentVersionId: page.currentVersionId,
      reason: 'not-present-in-visible-archive' as const,
    }));
  catalog.entries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  writeArtifactCatalog(input.home, catalog);
  const migrationReportPath = path.join(artifactsRoot(input.home), 'migration-report.json');
  atomicWrite(migrationReportPath, `${JSON.stringify({
    version: 1,
    importedAt: new Date().toISOString(),
    sourceRoot: path.resolve(input.sourceRoot),
    visibleEntries: visibleEntries.length,
    importedArtifacts: Object.keys(catalog.artifacts).length,
    importedVersions: versionCount,
    materializedVersions: materializedVersionCount,
    externalVersions: externalVersionCount,
    importedFiles: fileCount,
    orphanPages,
  }, null, 2)}\n`);
  const siteIndexPath = refreshArtifactsSite(input.home, catalog);
  return {
    entries: catalog.entries.length,
    artifacts: Object.keys(catalog.artifacts).length,
    versions: versionCount,
    materializedVersions: materializedVersionCount,
    externalVersions: externalVersionCount,
    files: fileCount,
    orphanPages,
    catalogPath,
    migrationReportPath,
    siteIndexPath,
  };
}
