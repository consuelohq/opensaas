import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
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

export type SitePageLease = {
  leaseId: string;
  pageId: string;
  sectionId: string;
  agentId: string;
  acquiredAt: string;
  expiresAt: string;
};

export type SitePageLeaseRegistry = {
  version: 1;
  generatedAt: string;
  leases: Record<string, SitePageLease>;
};

export type SitesPaths = {
  sitesDir: string;
  indexPath: string;
  pagesDir: string;
  pagesDataDir: string;
  pagesRegistryPath: string;
  pagesLeasesPath: string;
  officeDir: string;
  officeDataDir: string;
  officeAssetsDir: string;
  officeIndexPath: string;
  officeDataPath: string;
  tracesDir: string;
  tracesIndexPath: string;
  diffsDir: string;
  diffsIndexPath: string;
  docsDir: string;
  docsIndexPath: string;
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
  docsIndexPath: string;
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

export type PrepareSitePagePatchOptions = {
  home: string;
  pagePath: string;
  sectionId: string;
  input: string;
  baseVersion?: string | null;
  forcePublish?: boolean;
  agentId?: string | null;
};

export type PrepareSitePagePatchResult = {
  ok: boolean;
  pageId: string;
  path: string;
  sectionId: string;
  title: string | null;
  kind: SitePageKind | null;
  currentVersionId: string | null;
  baseVersion: string | null;
  rebased: boolean;
  stagedTarget: string;
  contentPath: string;
  registryPath: string;
  message: string;
  error?: { code: string; message: string };
};

export type SitePageLeaseResult = {
  ok: boolean;
  pageId: string;
  sectionId: string | null;
  agentId: string | null;
  leaseAction: 'acquire' | 'release' | 'status';
  lease: SitePageLease | null;
  leases: SitePageLease[];
  leasesPath: string;
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

type BunSqliteDatabase = {
  query: (statement: string) => {
    get: (...params: unknown[]) => unknown;
    all: (...params: unknown[]) => unknown[];
  };
  close: () => void;
};

type BunSqliteDatabaseConstructor = new (
  dbPath: string,
  options?: { readonly?: boolean },
) => BunSqliteDatabase;

const BUN_SQLITE_SPECIFIER = `bun:${'sqlite'}`;
const requireFromSites = createRequire(import.meta.url);

function loadBunSqliteDatabase(): BunSqliteDatabaseConstructor {
  try {
    const module = requireFromSites(BUN_SQLITE_SPECIFIER) as {
      Database?: BunSqliteDatabaseConstructor;
    };
    if (!module.Database) throw new Error('Database export is missing');
    return module.Database;
  } catch (error: unknown) {
    throw new Error(
      `Sites artifact database requires Bun SQLite: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

type ReservedSite = {
  slug: 'traces' | 'diffs' | 'docs';
  title: string;
  description: string;
};

const RESERVED_SITES: ReservedSite[] = [
  { slug: 'diffs', title: 'Diffs', description: 'Review generated changes and decision context.' },
  { slug: 'traces', title: 'Tracing', description: 'Review execution traces and provenance.' },
  { slug: 'docs', title: 'Documentation', description: 'Open Consuelo OS operating documentation.' },
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

function hasArtifactsTable(db: BunSqliteDatabase): boolean {
  const row = db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'artifacts'").get() as { name?: string } | null;
  return row?.name === 'artifacts';
}

function readArtifactRows(dbPath: string): ArtifactRow[] {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(dbPath);
  } catch {
    return [];
  }
  if (!stat.isFile() || stat.size === 0) return [];
  const Database = loadBunSqliteDatabase();
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
      if (entry === 'versions') continue;
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
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('expected object root');
    }
    if (!parsed.pages || typeof parsed.pages !== 'object' || Array.isArray(parsed.pages)) {
      throw new Error('expected object pages registry');
    }
    return {
      version: 1,
      generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : nowIso(),
      pages: parsed.pages as Record<string, SitePage>,
    };
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Malformed Sites page registry at ${registryPath}: ${reason}`);
  }
}

function writeSitePageRegistry(registryPath: string, registry: SitePageRegistry): void {
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, { mode: 0o600 });
}

function emptySitePageLeaseRegistry(): SitePageLeaseRegistry {
  return { version: 1, generatedAt: nowIso(), leases: {} };
}

function leaseKey(pageId: string, sectionId: string): string {
  return `${pageId}#${sectionId}`;
}

function isLeaseActive(lease: SitePageLease, now = new Date()): boolean {
  return new Date(lease.expiresAt).getTime() > now.getTime();
}

export function readSitePageLeaseRegistry(leasesPath: string): SitePageLeaseRegistry {
  if (!fs.existsSync(leasesPath)) return emptySitePageLeaseRegistry();
  try {
    const parsed = JSON.parse(fs.readFileSync(leasesPath, 'utf8')) as Partial<SitePageLeaseRegistry>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptySitePageLeaseRegistry();
    const leases = parsed.leases && typeof parsed.leases === 'object' && !Array.isArray(parsed.leases)
      ? parsed.leases as Record<string, SitePageLease>
      : {};
    return { version: 1, generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : nowIso(), leases };
  } catch {
    return emptySitePageLeaseRegistry();
  }
}

function writeSitePageLeaseRegistry(leasesPath: string, registry: SitePageLeaseRegistry): void {
  fs.mkdirSync(path.dirname(leasesPath), { recursive: true });
  fs.writeFileSync(leasesPath, `${JSON.stringify(registry, null, 2)}\n`, { mode: 0o600 });
}

function activeLeases(registry: SitePageLeaseRegistry): SitePageLease[] {
  return Object.values(registry.leases).filter((lease) => isLeaseActive(lease));
}

function findContentJson(sourcePath: string): string | null {
  if (!sourcePath || !fs.existsSync(sourcePath)) return null;
  const stat = fs.statSync(sourcePath);
  if (stat.isFile()) return path.basename(sourcePath) === 'content.json' ? sourcePath : null;
  const direct = path.join(sourcePath, 'content.json');
  return fs.existsSync(direct) ? direct : null;
}

function readJsonObject(filePath: string): Record<string, unknown> {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`Expected JSON object in ${filePath}`);
  return parsed as Record<string, unknown>;
}

function sectionFromPatchInput(inputPath: string, sectionId: string): Record<string, unknown> {
  const parsed = readJsonObject(inputPath);
  const section = parsed.section && typeof parsed.section === 'object' && !Array.isArray(parsed.section)
    ? parsed.section as Record<string, unknown>
    : parsed;
  return { ...section, id: typeof section.id === 'string' ? section.id : sectionId };
}

function replaceSection(content: Record<string, unknown>, sectionId: string, section: Record<string, unknown>): Record<string, unknown> {
  const sections = Array.isArray(content.sections) ? content.sections : [];
  let replaced = false;
  const nextSections = sections.map((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return candidate;
    const existing = candidate as Record<string, unknown>;
    if (existing.id !== sectionId) return candidate;
    replaced = true;
    return section;
  });
  if (!replaced) nextSections.push(section);
  return { ...content, sections: nextSections };
}

function changedSectionsSince(page: SitePage, baseVersion: string): Set<string> | null {
  const baseIndex = page.versions.findIndex((version) => version.versionId === baseVersion);
  if (baseIndex === -1) return null;
  const changed = new Set<string>();
  for (const version of page.versions.slice(baseIndex + 1)) {
    for (const sectionId of version.changedSectionIds) changed.add(sectionId);
  }
  return changed;
}

function failPatch(
  normalized: { pageId: string; path: string },
  sectionId: string,
  currentVersionId: string | null,
  baseVersion: string | null,
  registryPath: string,
  code: string,
  message: string,
): PrepareSitePagePatchResult {
  return { ok: false, pageId: normalized.pageId, path: normalized.path, sectionId, title: null, kind: null, currentVersionId, baseVersion, rebased: false, stagedTarget: '', contentPath: '', registryPath, message, error: { code, message } };
}

function conflictingLease(paths: SitesPaths, pageId: string, sectionId: string, agentId: string | null): SitePageLease | null {
  const registry = readSitePageLeaseRegistry(paths.pagesLeasesPath);
  const lease = registry.leases[leaseKey(pageId, sectionId)];
  if (!lease || !isLeaseActive(lease)) return null;
  if (agentId && lease.agentId === agentId) return null;
  return lease;
}

export function prepareSitePagePatch(options: PrepareSitePagePatchOptions): PrepareSitePagePatchResult {
  const paths = getSitesPaths(options.home);
  const normalized = normalizeSitePagePath(options.pagePath);
  const registry = readSitePageRegistry(paths.pagesRegistryPath);
  const page = registry.pages[normalized.pageId] ?? null;
  const sectionId = options.sectionId.trim();
  const baseVersion = options.baseVersion ?? null;
  const currentVersionId = page?.currentVersionId ?? null;
  if (!sectionId) return failPatch(normalized, sectionId, currentVersionId, baseVersion, paths.pagesRegistryPath, 'INVALID_PATCH_ARGS', 'sites patch requires --section');
  if (!page) return failPatch(normalized, sectionId, currentVersionId, baseVersion, paths.pagesRegistryPath, 'PAGE_NOT_FOUND', `Sites page not found: ${normalized.path}`);
  if (!currentVersionId) return failPatch(normalized, sectionId, currentVersionId, baseVersion, paths.pagesRegistryPath, 'PAGE_NOT_FOUND', `Sites page has no current version: ${normalized.path}`);
  if (!fs.existsSync(options.input)) return failPatch(normalized, sectionId, currentVersionId, baseVersion, paths.pagesRegistryPath, 'PATCH_INPUT_NOT_FOUND', `Sites patch input not found: ${options.input}`);
  if (!baseVersion && !options.forcePublish) return failPatch(normalized, sectionId, currentVersionId, baseVersion, paths.pagesRegistryPath, 'STALE_SITES_PATCH', `stale OS Sites patch rejected for ${normalized.path}: existing page is at ${currentVersionId}. Re-run with --base-version ${currentVersionId}.`);
  let rebased = false;
  if (baseVersion && baseVersion !== currentVersionId && !options.forcePublish) {
    const changed = changedSectionsSince(page, baseVersion);
    if (!changed) return failPatch(normalized, sectionId, currentVersionId, baseVersion, paths.pagesRegistryPath, 'UNKNOWN_BASE_VERSION', `Sites patch base version ${baseVersion} was not found for ${normalized.path}.`);
    if (changed.has(sectionId)) return failPatch(normalized, sectionId, currentVersionId, baseVersion, paths.pagesRegistryPath, 'SECTION_CONFLICT', `Section ${sectionId} changed since base version ${baseVersion}; rebase before patching.`);
    rebased = true;
  }
  const lease = conflictingLease(paths, normalized.pageId, sectionId, options.agentId ?? null);
  if (lease && !options.forcePublish) return failPatch(normalized, sectionId, currentVersionId, baseVersion, paths.pagesRegistryPath, 'LEASE_CONFLICT', `Section ${sectionId} is leased by ${lease.agentId} until ${lease.expiresAt}.`);
  const currentVersion = page.versions.find((version) => version.versionId === currentVersionId);
  const sourcePath = currentVersion?.sourcePath ?? '';
  const contentPath = findContentJson(sourcePath);
  if (!contentPath) return failPatch(normalized, sectionId, currentVersionId, baseVersion, paths.pagesRegistryPath, 'CONTENT_JSON_NOT_FOUND', `Current Sites page source has no content.json: ${sourcePath}`);
  const stagedTarget = path.join(paths.pagesDataDir, normalized.slug, 'patches', createVersionId());
  copyTargetToDirectory(sourcePath, stagedTarget);
  const stagedContentPath = path.join(stagedTarget, path.relative(sourcePath, contentPath));
  const content = readJsonObject(stagedContentPath);
  const nextSection = sectionFromPatchInput(options.input, sectionId);
  fs.writeFileSync(stagedContentPath, `${JSON.stringify(replaceSection(content, sectionId, nextSection), null, 2)}\n`, { mode: 0o600 });
  return { ok: true, pageId: normalized.pageId, path: normalized.path, sectionId, title: page.title, kind: page.kind, currentVersionId, baseVersion, rebased, stagedTarget, contentPath: stagedContentPath, registryPath: paths.pagesRegistryPath, message: rebased ? `Sites patch rebased onto ${currentVersionId}.` : `Sites patch prepared for ${normalized.path}.` };
}

export function acquireSitePageLease(options: { home: string; pagePath: string; sectionId: string; agentId: string; ttlMinutes: number }): SitePageLeaseResult {
  const paths = getSitesPaths(options.home);
  const normalized = normalizeSitePagePath(options.pagePath);
  const registry = readSitePageLeaseRegistry(paths.pagesLeasesPath);
  const key = leaseKey(normalized.pageId, options.sectionId);
  const active = registry.leases[key] && isLeaseActive(registry.leases[key]) ? registry.leases[key] : null;
  if (active && active.agentId !== options.agentId) return { ok: false, pageId: normalized.pageId, sectionId: options.sectionId, agentId: options.agentId, leaseAction: 'acquire', lease: active, leases: activeLeases(registry), leasesPath: paths.pagesLeasesPath, message: `Section ${options.sectionId} is leased by ${active.agentId}.`, error: { code: 'LEASE_CONFLICT', message: `Section ${options.sectionId} is leased by ${active.agentId} until ${active.expiresAt}.` } };
  const acquiredAt = nowIso();
  const expiresAt = new Date(Date.now() + Math.max(1, options.ttlMinutes) * 60_000).toISOString();
  const lease: SitePageLease = { leaseId: active?.leaseId ?? `lease_${randomUUID().replaceAll('-', '').slice(0, 12)}`, pageId: normalized.pageId, sectionId: options.sectionId, agentId: options.agentId, acquiredAt, expiresAt };
  registry.leases[key] = lease;
  registry.generatedAt = acquiredAt;
  writeSitePageLeaseRegistry(paths.pagesLeasesPath, registry);
  return { ok: true, pageId: normalized.pageId, sectionId: options.sectionId, agentId: options.agentId, leaseAction: 'acquire', lease, leases: activeLeases(registry), leasesPath: paths.pagesLeasesPath, message: `Lease acquired for ${normalized.pageId}#${options.sectionId}.` };
}

export function releaseSitePageLease(options: { home: string; pagePath: string; sectionId: string; agentId?: string | null; force?: boolean }): SitePageLeaseResult {
  const paths = getSitesPaths(options.home);
  const normalized = normalizeSitePagePath(options.pagePath);
  const registry = readSitePageLeaseRegistry(paths.pagesLeasesPath);
  const key = leaseKey(normalized.pageId, options.sectionId);
  const existing = registry.leases[key] ?? null;
  if (existing && options.agentId && existing.agentId !== options.agentId && !options.force) return { ok: false, pageId: normalized.pageId, sectionId: options.sectionId, agentId: options.agentId, leaseAction: 'release', lease: existing, leases: activeLeases(registry), leasesPath: paths.pagesLeasesPath, message: `Lease belongs to ${existing.agentId}.`, error: { code: 'LEASE_CONFLICT', message: `Lease belongs to ${existing.agentId}; use --force-publish to override.` } };
  delete registry.leases[key];
  registry.generatedAt = nowIso();
  writeSitePageLeaseRegistry(paths.pagesLeasesPath, registry);
  return { ok: true, pageId: normalized.pageId, sectionId: options.sectionId, agentId: options.agentId ?? null, leaseAction: 'release', lease: existing, leases: activeLeases(registry), leasesPath: paths.pagesLeasesPath, message: existing ? `Lease released for ${normalized.pageId}#${options.sectionId}.` : `No lease existed for ${normalized.pageId}#${options.sectionId}.` };
}

export function sitePageLeaseStatus(options: { home: string; pagePath?: string | null; sectionId?: string | null }): SitePageLeaseResult {
  const paths = getSitesPaths(options.home);
  const registry = readSitePageLeaseRegistry(paths.pagesLeasesPath);
  const normalized = options.pagePath ? normalizeSitePagePath(options.pagePath) : null;
  const leases = activeLeases(registry).filter((lease) => (!normalized || lease.pageId === normalized.pageId) && (!options.sectionId || lease.sectionId === options.sectionId));
  return { ok: true, pageId: normalized?.pageId ?? '', sectionId: options.sectionId ?? null, agentId: null, leaseAction: 'status', lease: leases[0] ?? null, leases, leasesPath: paths.pagesLeasesPath, message: `${leases.length} active Sites leases.` };
}

function baseStyles(): string {
  return `
    :root { color-scheme: dark; background: #070708; color: #f2eee6; font-family: "Geist Mono", "Geist", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    * { box-sizing: border-box; }
    html, body { min-height: 100%; }
    body { margin: 0; min-height: 100vh; background: #070708; color: #f2eee6; font-size: 13px; line-height: 1.35; font-weight: 400; letter-spacing: 0.02em; }
    @media (max-width: 1024px) { body { font-size: clamp(10.3px, 2.62vw, 12.7px); line-height: 1.34; } main { padding: clamp(28px, 5.4vw, 42px) clamp(10px, 2.5vw, 24px); } .block { margin: 22px 0; } .rule { margin: 22px 0; } li { margin: 2.35px 0; } }
    @media (max-width: 430px) { body { font-size: clamp(9.9px, 2.42vw, 11.5px); line-height: 1.32; } main { padding: 40px 10px; } li, .blog-item { white-space: nowrap; } }
    main { padding: 32px 30px; max-width: none; }
    h1, h2, p, ul, li { margin: 0; padding: 0; }
    h1, h2 { font: inherit; text-transform: uppercase; }
    h1 { margin-bottom: 24px; }
    .block { margin: 22px 0; }
    .rule { margin: 22px 0; color: inherit; }
    .label { text-transform: uppercase; }
    ul { list-style: none; margin: 0; padding: 0 0 0 18px; }
    li { margin: 2px 0; white-space: nowrap; }
    li::before { content: "- "; }
    a { color: #9aa6ff; text-decoration: underline; text-underline-offset: 2px; }
    .md-label { color: #f2eee6; }
    .blog-item { white-space: nowrap; }
    @media (max-width: 720px) { .blog-item { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.35; } }
    .table-wrap { overflow-x: auto; margin-top: 12px; }
    table { border-collapse: collapse; min-width: 760px; }
    th, td { padding: 4px 12px 4px 0; text-align: left; vertical-align: top; font-size: 12px; }
    th { color: #a8a095; text-transform: uppercase; }
    code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; color: #a8a095; white-space: nowrap; }
    section { margin-top: 18px; }
    .section-header { margin-bottom: 8px; }
    .empty { color: #a8a095; }
  `;
}

function buildMarkdownLink(options: { label: string; href: string; text: string; hotkey?: string }): string {
  const hotkeyAttribute = options.hotkey ? ` data-hotkey="${escapeHtml(options.hotkey)}"` : '';
  return `<li><span class="md-label">[${escapeHtml(options.label)}](</span><a href="${escapeHtml(options.href)}"${hotkeyAttribute} target="_blank" rel="noopener noreferrer">${escapeHtml(options.text)}</a><span class="md-label">)</span></li>`;
}

function buildSitesIndex(): string {
  const siteLinks = [
    { label: 'GTM', href: 'https://app.consuelohq.com/welcome', text: 'https://sites.consuelohq.com/gtm', hotkey: '1' },
    { label: 'Office', href: 'office/', text: 'https://sites.consuelohq.com/office', hotkey: '2' },
    { label: 'Tracing', href: 'traces/', text: 'https://sites.consuelohq.com/tracing', hotkey: '3' },
    { label: 'Diffs', href: 'diffs/', text: 'https://sites.consuelohq.com/diffs', hotkey: '4' },
    { label: 'Documentation', href: 'docs/', text: 'https://docs.consuelohq.com/', hotkey: '5' },
  ].map(buildMarkdownLink).join('\n        ');
  const siteHotkeys = {
    '1': 'https://app.consuelohq.com/welcome',
    '2': 'office/',
    '3': 'traces/',
    '4': 'diffs/',
    '5': 'docs/',
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Consuelo OS Sites</title>
  <style>${baseStyles()}</style>
</head>
<body>
  <main>
    <h1>CONSUELO OS █</h1>
    <p class="rule">~~~</p>
    <section class="block" aria-label="Profile">
      <p><span class="label">CONTACT:</span> SUPPORT@CONSUELOHQ.COM</p>
      <p><span class="label">LOCATION:</span> USA</p>
      <p><span class="label">STATUS:</span> ONLINE</p>
      <p><span class="label">OPEN POSITION:</span></p>
      <ul>
        ${buildMarkdownLink({ label: 'Systems Engineer', href: '/jobs', text: '/careers/systems-engineer' })}
      </ul>
    </section>
    <p class="rule">~~~</p>
    <section class="block" aria-label="Sites">
      <p class="label">SITES:</p>
      <ul>
        ${siteLinks}
      </ul>
    </section>
    <p class="rule">~~~</p>
    <section class="block" aria-label="Writing">
      <p class="label">WRITING:</p>
      <ul>
        ${buildMarkdownLink({ label: 'On Decision Loops', href: '/writing/on-decision-loops', text: '/writing/on-decision-loops' })}
      </ul>
    </section>
  </main>
  <script>
    const siteHotkeys = ${JSON.stringify(siteHotkeys, null, 6)};

    document.addEventListener("keydown", (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const target = event.target;
      const tagName = target && target.tagName ? target.tagName.toLowerCase() : "";
      if (tagName === "input" || tagName === "textarea" || (target && target.isContentEditable)) return;
      const href = siteHotkeys[event.key];
      if (!href) return;
      event.preventDefault();
      window.location.assign(href);
    });
  </script>
</body>
</html>
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
  const docsDir = path.join(sitesDir, 'docs');
  return {
    sitesDir,
    indexPath: path.join(sitesDir, 'index.html'),
    pagesDir,
    pagesDataDir,
    pagesRegistryPath: path.join(pagesDataDir, 'registry.json'),
    pagesLeasesPath: path.join(pagesDataDir, 'leases.json'),
    officeDir,
    officeDataDir,
    officeAssetsDir,
    officeIndexPath: path.join(officeDir, 'index.html'),
    officeDataPath: path.join(officeDataDir, 'artifacts.json'),
    tracesDir,
    tracesIndexPath: path.join(tracesDir, 'index.html'),
    diffsDir,
    diffsIndexPath: path.join(diffsDir, 'index.html'),
    docsDir,
    docsIndexPath: path.join(docsDir, 'index.html'),
  };
}

export function readOfficeSiteData(dbPath: string): OfficeSiteData {
  return { version: 1, generatedAt: nowIso(), artifacts: readArtifactRows(dbPath).map(toSiteArtifact) };
}

export function materializeSites(options: MaterializeSitesOptions): MaterializeSitesResult {
  const paths = getSitesPaths(options.home);
  const actions: SitesAction[] = [];
  for (const dirPath of [paths.sitesDir, paths.pagesDir, paths.pagesDataDir, paths.officeDir, paths.officeDataDir, paths.officeAssetsDir, paths.tracesDir, paths.diffsDir, paths.docsDir]) {
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
  return { sitesDir: paths.sitesDir, indexPath: paths.indexPath, pagesDir: paths.pagesDir, pagesRegistryPath: paths.pagesRegistryPath, officeIndexPath: paths.officeIndexPath, officeDataPath: paths.officeDataPath, officeAssetsDir: paths.officeAssetsDir, docsIndexPath: paths.docsIndexPath, data, actions };
}

export function publishSitePage(options: PublishSitePageOptions): PublishSitePageResult {
  const paths = getSitesPaths(options.home);
  const normalized = normalizeSitePagePath(options.pagePath);
  const currentDir = path.join(paths.pagesDir, normalized.slug);
  let registry: SitePageRegistry;
  try {
    registry = readSitePageRegistry(paths.pagesRegistryPath);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      pageId: normalized.pageId,
      path: normalized.path,
      title: options.title,
      kind: options.kind,
      currentVersionId: null,
      publishedVersionId: null,
      requiredBaseVersion: null,
      versionCount: 0,
      registryPath: paths.pagesRegistryPath,
      currentPath: currentDir,
      versionPath: '',
      message,
      error: { code: 'MALFORMED_SITES_PAGE_REGISTRY', message },
    };
  }
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
    currentVersionId: page.currentVersionId,
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

