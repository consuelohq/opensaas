import { Database } from 'bun:sqlite';
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

export type SitesPaths = {
  sitesDir: string;
  indexPath: string;
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
  officeIndexPath: string;
  officeDataPath: string;
  officeAssetsDir: string;
  data: OfficeSiteData;
  actions: SitesAction[];
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
  {
    slug: 'traces',
    title: 'Traces',
    description: 'Execution traces will show how Sites work was produced.',
  },
  {
    slug: 'diffs',
    title: 'Diffs',
    description: 'Diff pages will show generated changes and review context.',
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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
  actions.push({
    type: 'create_file',
    path: filePath,
    status: dryRun ? 'planned' : 'created',
    message,
  });
}

function hasArtifactsTable(db: Database): boolean {
  const row = db
    .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'artifacts'")
    .get() as { name?: string } | null;
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

function baseStyles(): string {
  return `
    :root {
      color-scheme: light;
      --background: #f7f8fa;
      --surface: #ffffff;
      --border: #d6dae1;
      --text: #1d2430;
      --muted: #5a6575;
      --accent: #0f766e;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: var(--background);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.5;
    }

    main {
      width: min(1120px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 32px 0;
    }

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
    {
      href: 'office/',
      title: 'Office',
      description: 'Artifact-backed generated docs, reports, files, pages, and future local workspace output.',
    },
    {
      href: 'traces/',
      title: 'Traces',
      description: 'Reserved local site for execution traces and provenance review.',
    },
    {
      href: 'diffs/',
      title: 'Diffs',
      description: 'Reserved local site for generated changes and review context.',
    },
  ].map((site) => `
      <a class="card" href="${escapeHtml(site.href)}">
        <h2>${escapeHtml(site.title)}</h2>
        <p>${escapeHtml(site.description)}</p>
      </a>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sites</title>
  <style>${baseStyles()}</style>
</head>
<body>
  <main>
    <header>
      <h1>Sites</h1>
      <p>Sites is the local Consuelo OS site system. Office is one site category under Sites, while artifacts remain the durable provenance records behind generated output.</p>
    </header>
    <div class="grid">${cards}
    </div>
  </main>
</body>
</html>
`;
}

function buildOfficeSite(data: OfficeSiteData): string {
  const artifactRows = data.artifacts.map((artifact) => `
          <tr>
            <td>${escapeHtml(artifact.title)}</td>
            <td>${escapeHtml(artifact.type)}</td>
            <td>${escapeHtml(artifact.format)}</td>
            <td>${escapeHtml(artifact.skillName)}</td>
            <td><code>${escapeHtml(artifact.traceId)}</code></td>
          </tr>`).join('');
  const artifactBody = artifactRows.length > 0
    ? artifactRows
    : `
          <tr>
            <td colspan="5" class="empty">No local Office artifacts have been created yet.</td>
          </tr>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Office - Sites</title>
  <style>${baseStyles()}</style>
</head>
<body>
  <main>
    <header>
      <h1>Office</h1>
      <p>Office is the Sites category for generated docs, reports, files, and pages. Artifacts are the durable provenance records behind this site.</p>
    </header>
    <section aria-labelledby="artifacts-title">
      <div class="section-header">
        <h2 id="artifacts-title">Artifacts</h2>
        <span class="count">${data.artifacts.length} total</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Format</th>
              <th>Skill</th>
              <th>Trace</th>
            </tr>
          </thead>
          <tbody>${artifactBody}
          </tbody>
        </table>
      </div>
    </section>
  </main>
</body>
</html>
`;
}

function buildReservedSitePage(site: ReservedSite): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(site.title)} - Sites</title>
  <style>${baseStyles()}</style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(site.title)}</h1>
      <p>${escapeHtml(site.description)}</p>
    </header>
    <section>
      <div class="section-header">
        <h2>Reserved Sites page</h2>
      </div>
      <p style="padding: 18px;">This local page slot is reserved by Consuelo OS Sites and can be safely regenerated.</p>
    </section>
  </main>
</body>
</html>
`;
}

export function getSitesPaths(home: string): SitesPaths {
  const sitesDir = path.join(home, 'sites');
  const officeDir = path.join(sitesDir, 'office');
  const officeDataDir = path.join(officeDir, 'data');
  const officeAssetsDir = path.join(officeDir, 'assets');
  const tracesDir = path.join(sitesDir, 'traces');
  const diffsDir = path.join(sitesDir, 'diffs');
  return {
    sitesDir,
    indexPath: path.join(sitesDir, 'index.html'),
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
  return {
    version: 1,
    generatedAt: nowIso(),
    artifacts: readArtifactRows(dbPath).map(toSiteArtifact),
  };
}

export function materializeSites(options: MaterializeSitesOptions): MaterializeSitesResult {
  const paths = getSitesPaths(options.home);
  const actions: SitesAction[] = [];

  for (const dirPath of [
    paths.sitesDir,
    paths.officeDir,
    paths.officeDataDir,
    paths.officeAssetsDir,
    paths.tracesDir,
    paths.diffsDir,
  ]) {
    addDirectoryAction(actions, dirPath, options.dryRun);
  }

  const data = readOfficeSiteData(options.dbPath);
  addFileAction(actions, paths.indexPath, options.dryRun, 'Sites index generated');
  addFileAction(actions, paths.officeDataPath, options.dryRun, 'Office site artifact data generated');
  addFileAction(actions, paths.officeIndexPath, options.dryRun, 'Office site generated');
  for (const site of RESERVED_SITES) {
    const sitePath = path.join(paths.sitesDir, site.slug, 'index.html');
    addFileAction(actions, sitePath, options.dryRun, `${site.title} site generated`);
  }

  if (!options.dryRun) {
    fs.writeFileSync(paths.indexPath, buildSitesIndex(), { mode: 0o600 });
    fs.writeFileSync(paths.officeDataPath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
    fs.writeFileSync(paths.officeIndexPath, buildOfficeSite(data), { mode: 0o600 });
    for (const site of RESERVED_SITES) {
      fs.writeFileSync(path.join(paths.sitesDir, site.slug, 'index.html'), buildReservedSitePage(site), { mode: 0o600 });
    }
  }

  return {
    sitesDir: paths.sitesDir,
    indexPath: paths.indexPath,
    officeIndexPath: paths.officeIndexPath,
    officeDataPath: paths.officeDataPath,
    officeAssetsDir: paths.officeAssetsDir,
    data,
    actions,
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
