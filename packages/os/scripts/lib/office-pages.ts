import { Database } from 'bun:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export type OfficePageAction = {
  type: 'create_dir' | 'create_file';
  path: string;
  status: 'planned' | 'created' | 'preserved';
  message: string;
};

export type OfficeArtifact = {
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

export type OfficePageData = {
  version: 1;
  generatedAt: string;
  artifacts: OfficeArtifact[];
};

export type OfficePagePaths = {
  pagesDir: string;
  officeDir: string;
  dataDir: string;
  assetsDir: string;
  indexPath: string;
  dataPath: string;
  tracesDir: string;
  tracesIndexPath: string;
  diffsDir: string;
  diffsIndexPath: string;
  githubDir: string;
  githubIndexPath: string;
};

export type MaterializeOfficePagesOptions = {
  home: string;
  dbPath: string;
  dryRun: boolean;
};

export type MaterializeOfficePagesResult = {
  indexPath: string;
  dataPath: string;
  assetsDir: string;
  data: OfficePageData;
  actions: OfficePageAction[];
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

type ReservedSurface = {
  slug: 'traces' | 'diffs' | 'github';
  title: string;
  description: string;
};

const RESERVED_SURFACES: ReservedSurface[] = [
  {
    slug: 'traces',
    title: 'Traces',
    description: 'Execution traces will show how Office work was produced.',
  },
  {
    slug: 'diffs',
    title: 'Diffs',
    description: 'Diff pages will show generated changes and review context.',
  },
  {
    slug: 'github',
    title: 'GitHub Workflows',
    description: 'GitHub pages will show PRs, tasks, and workflow views.',
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

function addDirectoryAction(
  actions: OfficePageAction[],
  dirPath: string,
  dryRun: boolean,
): void {
  const exists = fs.existsSync(dirPath);
  actions.push({
    type: 'create_dir',
    path: dirPath,
    status: exists ? 'preserved' : dryRun ? 'planned' : 'created',
    message: exists ? 'directory exists' : 'directory created',
  });
  if (!dryRun) fs.mkdirSync(dirPath, { recursive: true });
}

function addFileAction(
  actions: OfficePageAction[],
  filePath: string,
  dryRun: boolean,
  message: string,
): void {
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

function toOfficeArtifact(row: ArtifactRow): OfficeArtifact {
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
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
    .card h2 { font-size: 16px; margin-bottom: 6px; }
  `;
}

function buildOfficePage(data: OfficePageData): string {
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

  const cards = RESERVED_SURFACES.map((surface) => `
      <article class="card">
        <h2>${escapeHtml(surface.title)}</h2>
        <p>${escapeHtml(surface.description)}</p>
      </article>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Office</title>
  <style>${baseStyles()}</style>
</head>
<body>
  <main>
    <header>
      <h1>Office</h1>
      <p>Office stores generated docs, reports, files, pages, traces, diffs, GitHub/workflow views, and future database-backed documents and tables. Artifacts are the durable provenance records behind Office.</p>
    </header>
    <div class="grid">${cards}
    </div>
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

function buildReservedSurfacePage(surface: ReservedSurface): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(surface.title)} - Office</title>
  <style>${baseStyles()}</style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(surface.title)}</h1>
      <p>${escapeHtml(surface.description)}</p>
    </header>
    <section>
      <div class="section-header">
        <h2>Reserved Office surface</h2>
      </div>
      <p style="padding: 18px;">This local page slot is reserved by Consuelo OS Office and can be safely regenerated.</p>
    </section>
  </main>
</body>
</html>
`;
}

export function getOfficePagePaths(home: string): OfficePagePaths {
  const pagesDir = path.join(home, 'pages');
  const officeDir = path.join(pagesDir, 'office');
  const dataDir = path.join(officeDir, 'data');
  const assetsDir = path.join(officeDir, 'assets');
  const tracesDir = path.join(pagesDir, 'traces');
  const diffsDir = path.join(pagesDir, 'diffs');
  const githubDir = path.join(pagesDir, 'github');
  return {
    pagesDir,
    officeDir,
    dataDir,
    assetsDir,
    indexPath: path.join(officeDir, 'index.html'),
    dataPath: path.join(dataDir, 'artifacts.json'),
    tracesDir,
    tracesIndexPath: path.join(tracesDir, 'index.html'),
    diffsDir,
    diffsIndexPath: path.join(diffsDir, 'index.html'),
    githubDir,
    githubIndexPath: path.join(githubDir, 'index.html'),
  };
}

export function readOfficePageData(dbPath: string): OfficePageData {
  return {
    version: 1,
    generatedAt: nowIso(),
    artifacts: readArtifactRows(dbPath).map(toOfficeArtifact),
  };
}

export function materializeOfficePages(
  options: MaterializeOfficePagesOptions,
): MaterializeOfficePagesResult {
  const paths = getOfficePagePaths(options.home);
  const actions: OfficePageAction[] = [];

  for (const dirPath of [
    paths.pagesDir,
    paths.officeDir,
    paths.dataDir,
    paths.assetsDir,
    paths.tracesDir,
    paths.diffsDir,
    paths.githubDir,
  ]) {
    addDirectoryAction(actions, dirPath, options.dryRun);
  }

  const data = readOfficePageData(options.dbPath);
  addFileAction(actions, paths.dataPath, options.dryRun, 'Office artifact data generated');
  addFileAction(actions, paths.indexPath, options.dryRun, 'Office page generated');
  for (const surface of RESERVED_SURFACES) {
    const surfacePath = path.join(paths.pagesDir, surface.slug, 'index.html');
    addFileAction(actions, surfacePath, options.dryRun, `${surface.title} page generated`);
  }

  if (!options.dryRun) {
    fs.writeFileSync(paths.dataPath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
    fs.writeFileSync(paths.indexPath, buildOfficePage(data), { mode: 0o600 });
    for (const surface of RESERVED_SURFACES) {
      fs.writeFileSync(
        path.join(paths.pagesDir, surface.slug, 'index.html'),
        buildReservedSurfacePage(surface),
        { mode: 0o600 },
      );
    }
  }

  return {
    indexPath: paths.indexPath,
    dataPath: paths.dataPath,
    assetsDir: paths.assetsDir,
    data,
    actions,
  };
}
