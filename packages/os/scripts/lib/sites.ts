import { Database } from 'bun:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type SitesAction = {
  type: 'create_dir' | 'create_file';
  path: string;
  status: 'planned' | 'created' | 'preserved';
  message: string;
};

export type SiteArtifact = {
  id: string;
  title: string;
  type: string;
  format: string;
  status: string;
  storageMode: string;
  path: string;
  localPath: string;
  traceId: string;
  skillName: string;
  workspaceId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OfficeSiteData = {
  version: 1;
  generatedAt: string;
  artifacts: SiteArtifact[];
};

export type SitePageKind = 'spec' | 'plan' | 'guide' | 'trace' | 'diff' | 'office' | 'uncategorized';

export type SitePageVersion = {
  versionId: string;
  parentVersionId: string | null;
  title: string;
  kind: SitePageKind;
  sourcePath: string;
  sourceHash: string;
  renderedPath: string;
  changedSectionIds: string[];
  agentId: string | null;
  traceId: string | null;
  createdAt: string;
};

export type SitePage = {
  pageId: string;
  slug: string;
  path: string;
  title: string;
  kind: SitePageKind;
  currentVersionId: string;
  versionCount: number;
  createdAt: string;
  updatedAt: string;
  versions: SitePageVersion[];
};

export type SitePageRegistry = {
  version: 1;
  generatedAt: string;
  pages: Record<string, SitePage>;
};

export type SitesPaths = {
  sitesDir: string;
  indexPath: string;
  pagesDir: string;
  pagesDataDir: string;
  pagesRegistryPath: string;
  officeDir: string;
  officeDataDir: string;
  officeAssetsDir: string;
  officeIndexPath: string;
  officeDataPath: string;
  tracesDir: string;
  tracesIndexPath: string;
  diffsDir: string;
  diffsIndexPath: string;
};

export type MaterializeSitesOptions = {
  home: string;
  dbPath: string;
  dryRun: boolean;
};

export type MaterializeSitesResult = {
  sitesDir: string;
  indexPath: string;
  pagesDir: string;
  pagesRegistryPath: string;
  officeIndexPath: string;
  officeDataPath: string;
  officeAssetsDir: string;
  data: OfficeSiteData;
  actions: SitesAction[];
};

export type PublishSitePageOptions = {
  home: string;
  dbPath: string;
  target: string;
  pagePath: string;
  title: string;
  kind: SitePageKind;
  baseVersion?: string | null;
  forcePublish?: boolean;
  dryRun?: boolean;
  agentId?: string | null;
  traceId?: string | null;
  changedSectionIds?: string[];
};

export type PublishSitePageResult = {
  ok: boolean;
  pageId: string;
  path: string;
  title: string;
  kind: SitePageKind;
  currentVersionId: string | null;
  publishedVersionId: string | null;
  requiredBaseVersion: string | null;
  versionCount: number;
  registryPath: string;
  currentPath: string;
  versionPath: string;
  message: string;
  error?: { code: string; message: string };
};

type ArtifactRow = {
  id: string;
  workspace_id: string | null;
  skill_execution_trace_id: string;
  skill_name: string;
  title: string;
  type: string;
  format: string;
  status: string;
  storage_mode: string;
  storage_key: string;
  local_path: string;
  created_at: string;
  updated_at: string;
};

type ReservedSite = {
  slug: 'traces' | 'diffs';
  title: string;
  description: string;
};

const RESERVED_SITES: ReservedSite[] = [
  { slug: 'traces', title: 'Traces', description: 'Execution traces will show how Sites work was produced.' },
  { slug: 'diffs', title: 'Diffs', description: 'Diff pages will show generated changes and review context.' },
];

function nowIso(): string {
  return new Date().toISOString();
}

function createVersionId(): string {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().replaceAll('-', '').slice(0, 6)}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeSitePagePath(value: string): { pageId: string; slug: string; path: string } {
  const withoutQuery = value.split('?')[0]?.split('#')[0] ?? value;
  const cleaned = withoutQuery.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  const withoutPagesPrefix = cleaned.startsWith('pages/') ? cleaned.slice('pages/'.length) : cleaned;
  const slug = withoutPagesPrefix
    .split('/')
    .filter(Boolean)
    .join('/')
    .replace(/[^a-zA-Z0-9/_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/\/+/g, '/');
  if (!slug) throw new Error('sites publish requires --path with a page slug');
  return { pageId: slug, slug, path: `/pages/${slug}` };
}

function addDirectoryAction(actions: SitesAction[], dirPath: string, dryRun: boolean): void {
  const exists = fs.existsSync(dirPath);
  actions.push({
    type: 'create_dir',
    path: dirPath,
    status: exists ? 'preserved' : dryRun ? 'planned' : 'created',
    message: exists ? 'directory exists' : 'directory created',
  });
  if (!dryRun) fs.mkdirSync(dirPath, { recursive: true });
}

function addFileAction(actions: SitesAction[], filePath: string, dryRun: boolean, message: string): void {
  actions.push({ type: 'create_file', path: filePath, status: dryRun ? 'planned' : 'created', message });
}

function hasArtifactsTable(db: Database): boolean {
  const row = db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'artifacts'").get() as { name?: string } | null;
  return row?.name === 'artifacts';
}

function readArtifactRows(dbPath: string): ArtifactRow[] {
  if (!fs.existsSync(dbPath)) return [];
  const db = new Database(dbPath, { readonly: true });
  try {
    if (!hasArtifactsTable(db)) return [];
    const selectArtifactsSql = [
      'SELECT',
      'id, workspace_id, skill_execution_trace_id, skill_name, title, type, format,',
      'status, storage_mode, storage_key, local_path, created_at, updated_at',
      'FROM artifacts',
      "WHERE status != 'deleted'",
      'ORDER BY created_at DESC, id DESC',
    ].join(' ');
    return db.query(selectArtifactsSql).all() as ArtifactRow[];
  } finally {
    db.close();
  }
}

function toSiteArtifact(row: ArtifactRow): SiteArtifact {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    format: row.format,
    status: row.status,
    storageMode: row.storage_mode,
    path: row.storage_key,
    localPath: row.local_path,
    traceId: row.skill_execution_trace_id,
    skillName: row.skill_name,
    workspaceId: row.workspace_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function hashFile(filePath: string, hash: ReturnType<typeof createHash>): void {
  hash.update(fs.readFileSync(filePath));
}

function hashPath(targetPath: string): string {
  const hash = createHash('sha256');
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    hash.update(path.basename(targetPath));
    hashFile(targetPath, hash);
    return hash.digest('hex');
  }
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir).sort()) {
      const entryPath = path.join(dir, entry);
      const entryStat = fs.statSync(entryPath);
      if (entryStat.isDirectory()) walk(entryPath);
      else if (entryStat.isFile()) files.push(entryPath);
    }
  };
  walk(targetPath);
  for (const file of files) {
    hash.update(path.relative(targetPath, file));
    hashFile(file, hash);
  }
  return hash.digest('hex');
}

function copyTargetToDirectory(target: string, destination: string): void {
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true });
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    fs.cpSync(target, destination, { recursive: true });
    return;
  }
  const fileName = path.basename(target).endsWith('.html') ? 'index.html' : path.basename(target);
  fs.copyFileSync(target, path.join(destination, fileName));
}

function replaceCurrentPage(target: string, currentDir: string): void {
  fs.mkdirSync(currentDir, { recursive: true });
  for (const entry of fs.readdirSync(currentDir)) {
    if (entry === 'versions') continue;
    fs.rmSync(path.join(currentDir, entry), { recursive: true, force: true });
  }
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target)) {
      fs.cpSync(path.join(target, entry), path.join(currentDir, entry), { recursive: true });
    }
    return;
  }
  const fileName = path.basename(target).endsWith('.html') ? 'index.html' : path.basename(target);
  fs.copyFileSync(target, path.join(currentDir, fileName));
}

function emptySitePageRegistry(): SitePageRegistry {
  return { version: 1, generatedAt: nowIso(), pages: {} };
}

export function readSitePageRegistry(registryPath: string): SitePageRegistry {
  if (!fs.existsSync(registryPath)) return emptySitePageRegistry();
  try {
    const parsed = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as Partial<SitePageRegistry>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptySitePageRegistry();
    return {
      version: 1,
      generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : nowIso(),
      pages: parsed.pages && typeof parsed.pages === 'object' && !Array.isArray(parsed.pages) ? parsed.pages as Record<string, SitePage> : {},
    };
  } catch {
    return emptySitePageRegistry();
  }
}

function writeSitePageRegistry(registryPath: string, registry: SitePageRegistry): void {
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, { mode: 0o600 });
}

function baseStyles(): string {
  return `
    :root { color-scheme: light; --background: #f7f8fa; --surface: #ffffff; --border: #d6dae1; --text: #1d2430; --muted: #5a6575; --accent: #0f766e; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--background); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.5; }
    main { width: min(1120px, calc(100vw - 32px)); margin: 0 auto; padding: 32px 0; }
    header { display: grid; gap: 8px; margin-bottom: 24px; }
    h1 { margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 0; }
    p { margin: 0; color: var(--muted); }
    a { color: inherit; text-decoration: none; }
    section { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
    .section-header { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding: 16px 18px; border-bottom: 1px solid var(--border); }
    h2 { margin: 0; font-size: 18px; font-weight: 650; letter-spacing: 0; }
    .count { color: var(--accent); font-weight: 650; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 760px; }
    th, td { padding: 12px 18px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; font-size: 14px; }
    th { color: var(--muted); font-size: 12px; font-weight: 700; text-transform: uppercase; }
    code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; font-size: 12px; color: var(--muted); white-space: nowrap; }
    .empty { color: var(--muted); text-align: center; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 18px 0 24px; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px; display: grid; gap: 6px; }
    .card h2 { font-size: 16px; }
  `;
}

function buildSitesIndex(): string {
  const cards = [
    { href: 'pages/', title: 'Pages', description: 'Versioned local Sites pages with current pointers and immutable history.' },
    { href: 'office/', title: 'Office', description: 'Artifact-backed generated docs, reports, files, pages, and future local workspace output.' },
    { href: 'traces/', title: 'Traces', description: 'Reserved local site for execution traces and provenance review.' },
    { href: 'diffs/', title: 'Diffs', description: 'Reserved local site for generated changes and review context.' },
  ].map((site) => `
      <a class="card" href="${escapeHtml(site.href)}">
        <h2>${escapeHtml(site.title)}</h2>
        <p>${escapeHtml(site.description)}</p>
      </a>`).join('');

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sites</title><style>${baseStyles()}</style></head>
<body><main><header><h1>Sites</h1><p>Sites is the local Consuelo OS site system. Office is one site category under Sites, while artifacts remain the durable provenance records behind generated output.</p></header><div class="grid">${cards}
    </div></main></body></html>
`;
}

function buildPagesIndex(registry: SitePageRegistry): string {
  const pages = Object.values(registry.pages).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const rows = pages.length > 0 ? pages.map((page) => `
          <tr>
            <td><a href="${escapeHtml(page.slug)}/">${escapeHtml(page.title)}</a></td>
            <td>${escapeHtml(page.kind)}</td>
            <td><code>${escapeHtml(page.currentVersionId)}</code></td>
            <td>${page.versionCount}</td>
          </tr>`).join('') : '<tr><td colspan="4" class="empty">No Sites pages have been published yet.</td></tr>';
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pages - Sites</title><style>${baseStyles()}</style></head>
<body><main><header><h1>Pages</h1><p>Versioned local Sites pages. Existing pages require base-version before publish.</p></header><section><div class="section-header"><h2>Published pages</h2><span class="count">${pages.length} total</span></div><div class="table-wrap"><table><thead><tr><th>Title</th><th>Kind</th><th>Current version</th><th>Versions</th></tr></thead><tbody>${rows}</tbody></table></div></section></main></body></html>
`;
}

function buildOfficeSite(data: OfficeSiteData): string {
  const artifactRows = data.artifacts.map((artifact) => `
          <tr><td>${escapeHtml(artifact.title)}</td><td>${escapeHtml(artifact.type)}</td><td>${escapeHtml(artifact.format)}</td><td>${escapeHtml(artifact.skillName)}</td><td><code>${escapeHtml(artifact.traceId)}</code></td></tr>`).join('');
  const artifactBody = artifactRows.length > 0 ? artifactRows : '<tr><td colspan="5" class="empty">No local Office artifacts have been created yet.</td></tr>';
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Office - Sites</title><style>${baseStyles()}</style></head>
<body><main><header><h1>Office</h1><p>Office is the Sites category for generated docs, reports, files, and pages. Artifacts are the durable provenance records behind this site.</p></header><section aria-labelledby="artifacts-title"><div class="section-header"><h2 id="artifacts-title">Artifacts</h2><span class="count">${data.artifacts.length} total</span></div><div class="table-wrap"><table><thead><tr><th>Title</th><th>Type</th><th>Format</th><th>Skill</th><th>Trace</th></tr></thead><tbody>${artifactBody}</tbody></table></div></section></main></body></html>
`;
}

function buildReservedSitePage(site: ReservedSite): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(site.title)} - Sites</title><style>${baseStyles()}</style></head>
<body><main><header><h1>${escapeHtml(site.title)}</h1><p>${escapeHtml(site.description)}</p></header><section><div class="section-header"><h2>Reserved Sites page</h2></div><p style="padding: 18px;">This local page slot is reserved by Consuelo OS Sites and can be safely regenerated.</p></section></main></body></html>
`;
}

export function getSitesPaths(home: string): SitesPaths {
  const sitesDir = path.join(home, 'sites');
  const pagesDir = path.join(sitesDir, 'pages');
  const pagesDataDir = path.join(sitesDir, '.data', 'pages');
  const officeDir = path.join(sitesDir, 'office');
  const officeDataDir = path.join(officeDir, 'data');
  const officeAssetsDir = path.join(officeDir, 'assets');
  const tracesDir = path.join(sitesDir, 'traces');
  const diffsDir = path.join(sitesDir, 'diffs');
  return {
    sitesDir,
    indexPath: path.join(sitesDir, 'index.html'),
    pagesDir,
    pagesDataDir,
    pagesRegistryPath: path.join(pagesDataDir, 'registry.json'),
    officeDir,
    officeDataDir,
    officeAssetsDir,
    officeIndexPath: path.join(officeDir, 'index.html'),
    officeDataPath: path.join(officeDataDir, 'artifacts.json'),
    tracesDir,
    tracesIndexPath: path.join(tracesDir, 'index.html'),
    diffsDir,
    diffsIndexPath: path.join(diffsDir, 'index.html'),
  };
}

export function readOfficeSiteData(dbPath: string): OfficeSiteData {
  return { version: 1, generatedAt: nowIso(), artifacts: readArtifactRows(dbPath).map(toSiteArtifact) };
}

export function materializeSites(options: MaterializeSitesOptions): MaterializeSitesResult {
  const paths = getSitesPaths(options.home);
  const actions: SitesAction[] = [];
  for (const dirPath of [paths.sitesDir, paths.pagesDir, paths.pagesDataDir, paths.officeDir, paths.officeDataDir, paths.officeAssetsDir, paths.tracesDir, paths.diffsDir]) {
    addDirectoryAction(actions, dirPath, options.dryRun);
  }
  const data = readOfficeSiteData(options.dbPath);
  const registry = readSitePageRegistry(paths.pagesRegistryPath);
  addFileAction(actions, paths.indexPath, options.dryRun, 'Sites index generated');
  addFileAction(actions, path.join(paths.pagesDir, 'index.html'), options.dryRun, 'Pages site generated');
  addFileAction(actions, paths.officeDataPath, options.dryRun, 'Office site artifact data generated');
  addFileAction(actions, paths.officeIndexPath, options.dryRun, 'Office site generated');
  for (const site of RESERVED_SITES) addFileAction(actions, path.join(paths.sitesDir, site.slug, 'index.html'), options.dryRun, `${site.title} site generated`);
  if (!options.dryRun) {
    fs.writeFileSync(paths.indexPath, buildSitesIndex(), { mode: 0o600 });
    fs.writeFileSync(path.join(paths.pagesDir, 'index.html'), buildPagesIndex(registry), { mode: 0o600 });
    fs.writeFileSync(paths.officeDataPath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
    fs.writeFileSync(paths.officeIndexPath, buildOfficeSite(data), { mode: 0o600 });
    for (const site of RESERVED_SITES) fs.writeFileSync(path.join(paths.sitesDir, site.slug, 'index.html'), buildReservedSitePage(site), { mode: 0o600 });
  }
  return { sitesDir: paths.sitesDir, indexPath: paths.indexPath, pagesDir: paths.pagesDir, pagesRegistryPath: paths.pagesRegistryPath, officeIndexPath: paths.officeIndexPath, officeDataPath: paths.officeDataPath, officeAssetsDir: paths.officeAssetsDir, data, actions };
}

export function publishSitePage(options: PublishSitePageOptions): PublishSitePageResult {
  const paths = getSitesPaths(options.home);
  const normalized = normalizeSitePagePath(options.pagePath);
  const currentDir = path.join(paths.pagesDir, normalized.slug);
  const registry = readSitePageRegistry(paths.pagesRegistryPath);
  const existing = registry.pages[normalized.pageId] ?? null;
  const currentVersionId = existing?.currentVersionId ?? null;
  const requiredBaseVersion = currentVersionId;

  const fail = (code: string, message: string): PublishSitePageResult => ({
    ok: false,
    pageId: normalized.pageId,
    path: normalized.path,
    title: options.title,
    kind: options.kind,
    currentVersionId,
    publishedVersionId: null,
    requiredBaseVersion,
    versionCount: existing?.versionCount ?? 0,
    registryPath: paths.pagesRegistryPath,
    currentPath: currentDir,
    versionPath: '',
    message,
    error: { code, message },
  });

  if (!fs.existsSync(options.target)) return fail('TARGET_NOT_FOUND', `Sites publish target not found: ${options.target}`);
  if (currentVersionId && !options.forcePublish) {
    if (!options.baseVersion) return fail('STALE_SITES_PUBLISH', `stale OS Sites publish rejected for ${normalized.path}: existing page is at ${currentVersionId}. Re-run with --base-version ${currentVersionId} after reading the latest page, or use --force-publish only for an intentional overwrite.`);
    if (options.baseVersion !== currentVersionId) return fail('STALE_SITES_PUBLISH', `stale OS Sites publish rejected for ${normalized.path}: base version ${options.baseVersion} does not match current version ${currentVersionId}.`);
  }

  const versionId = createVersionId();
  const versionDataDir = path.join(paths.pagesDataDir, normalized.slug, 'versions', versionId);
  const publicVersionDir = path.join(currentDir, 'versions', versionId);
  const createdAt = nowIso();
  const version: SitePageVersion = {
    versionId,
    parentVersionId: currentVersionId,
    title: options.title,
    kind: options.kind,
    sourcePath: options.target,
    sourceHash: hashPath(options.target),
    renderedPath: publicVersionDir,
    changedSectionIds: options.changedSectionIds ?? [],
    agentId: options.agentId ?? null,
    traceId: options.traceId ?? null,
    createdAt,
  };
  const versions = [...(existing?.versions ?? []), version];
  const page: SitePage = {
    pageId: normalized.pageId,
    slug: normalized.slug,
    path: normalized.path,
    title: options.title,
    kind: options.kind,
    currentVersionId: versionId,
    versionCount: versions.length,
    createdAt: existing?.createdAt ?? createdAt,
    updatedAt: createdAt,
    versions,
  };

  if (!options.dryRun) {
    for (const dirPath of [paths.sitesDir, paths.pagesDir, paths.pagesDataDir]) fs.mkdirSync(dirPath, { recursive: true });
    copyTargetToDirectory(options.target, versionDataDir);
    copyTargetToDirectory(options.target, publicVersionDir);
    replaceCurrentPage(options.target, currentDir);
    registry.pages[normalized.pageId] = page;
    registry.generatedAt = createdAt;
    writeSitePageRegistry(paths.pagesRegistryPath, registry);
    fs.writeFileSync(path.join(paths.pagesDir, 'index.html'), buildPagesIndex(registry), { mode: 0o600 });
  }

  return {
    ok: true,
    pageId: normalized.pageId,
    path: normalized.path,
    title: options.title,
    kind: options.kind,
    currentVersionId,
    publishedVersionId: versionId,
    requiredBaseVersion,
    versionCount: page.versionCount,
    registryPath: paths.pagesRegistryPath,
    currentPath: currentDir,
    versionPath: publicVersionDir,
    message: options.dryRun ? `Sites publish planned: ${normalized.path}` : `Sites page published: ${normalized.path}`,
  };
}

export type OfficePageAction = SitesAction;
export type OfficeArtifact = SiteArtifact;
export type OfficePageData = OfficeSiteData;
export type OfficePagePaths = SitesPaths;
export type MaterializeOfficePagesOptions = MaterializeSitesOptions;
export type MaterializeOfficePagesResult = MaterializeSitesResult;

export const getOfficePagePaths = getSitesPaths;
export const readOfficePageData = readOfficeSiteData;
export const materializeOfficePages = materializeSites;
