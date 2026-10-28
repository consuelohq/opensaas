import fs from 'node:fs';
import path from 'node:path';

import {
  artifactsSiteIndexPath,
  getArtifact,
  listArtifactVersions,
  readArtifactCatalog,
  type ArtifactCatalog,
  type ArtifactRecord,
} from '../../lib/artifacts';
import { resolveConsueloHome } from '../../lib/consuelo-home';

export type ArtifactFileResponse = {
  body: Uint8Array;
  contentType: string;
};

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.gif': 'image/gif',
  '.htm': 'text/html; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export function resolveArtifactsHome(): string {
  return resolveConsueloHome();
}

export function artifactsGatewayCatalog(home = resolveArtifactsHome()): ArtifactCatalog {
  return readArtifactCatalog(home);
}

export function artifactsGatewayArtifact(
  artifactId: string,
  home = resolveArtifactsHome(),
): ArtifactRecord | null {
  return getArtifact(home, artifactId);
}

export function artifactsGatewayVersions(
  artifactId: string,
  home = resolveArtifactsHome(),
) {
  return listArtifactVersions(home, artifactId);
}

function safeRelativePath(value: string): string | null {
  const decoded = decodeURIComponent(value).replace(/^\/+/, '');
  const normalized = path.posix.normalize(decoded);
  if (!normalized || normalized === '.') return '';
  if (normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) return null;
  return normalized;
}

function fileResponse(filePath: string): ArtifactFileResponse | null {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
  const extension = path.extname(filePath).toLowerCase();
  return {
    body: fs.readFileSync(filePath),
    contentType: CONTENT_TYPES[extension] ?? 'application/octet-stream',
  };
}

function resolveArtifactRoot(
  home: string,
  artifact: ArtifactRecord,
  remainder: string,
): { root: string; file: string } | null {
  const versionMatch = remainder.match(/^versions\/([^/]+)(?:\/(.*))?$/);
  if (versionMatch) {
    const versionId = versionMatch[1];
    const version = artifact.versions.find((candidate) => candidate.versionId === versionId);
    if (!version) return null;
    return {
      root: path.dirname(version.localPath),
      file: versionMatch[2] || 'index.html',
    };
  }
  return {
    root: path.join(home, 'artifacts', 'current', ...artifact.path.split('/').filter(Boolean)),
    file: remainder || 'index.html',
  };
}

export function resolveArtifactPublicFile(
  pathname: string,
  home = resolveArtifactsHome(),
): ArtifactFileResponse | null {
  const routeSuffix = pathname.replace(/^\/artifacts\/?/, '');
  if (!routeSuffix) return fileResponse(artifactsSiteIndexPath(home));

  if (routeSuffix === 'data/catalog.json') {
    return fileResponse(path.join(home, 'sites', 'artifacts', 'data', 'catalog.json'));
  }

  const relative = safeRelativePath(routeSuffix);
  if (relative === null) return null;
  const catalog = readArtifactCatalog(home);
  const artifacts = Object.values(catalog.artifacts)
    .sort((left, right) => right.path.length - left.path.length);

  for (const artifact of artifacts) {
    const artifactPrefix = artifact.path.replace(/^\//, '');
    if (relative !== artifactPrefix && !relative.startsWith(`${artifactPrefix}/`)) continue;
    const remainder = relative.slice(artifactPrefix.length).replace(/^\//, '');
    const resolved = resolveArtifactRoot(home, artifact, remainder);
    if (!resolved) return null;
    const safeFile = safeRelativePath(resolved.file);
    if (safeFile === null) return null;
    const candidate = path.resolve(resolved.root, safeFile || 'index.html');
    const root = path.resolve(resolved.root);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return null;
    return fileResponse(candidate);
  }

  return null;
}
