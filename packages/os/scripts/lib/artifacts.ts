import { Database } from 'bun:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { materializeSites } from './sites';
import { ensureRuntimePaths } from './runtime-state';
import type { ArtifactDescriptor } from './types';

export type ArtifactType = 'report' | 'brief' | 'draft' | 'document' | 'export' | 'dataset' | 'image' | 'html' | 'other';
export type ArtifactFormat = 'markdown' | 'pdf' | 'docx' | 'html' | 'json' | 'csv' | 'png' | 'other';
export type ArtifactStatus = 'draft' | 'published' | 'archived' | 'deleted';
export type ArtifactStorageMode = 'local' | 's3' | 'external';

export type CreateArtifactInput = {
  traceId: string;
  workspaceId?: string;
  createdByUserId?: string;
  skillName: string;
  title: string;
  fileName: string;
  type: ArtifactType;
  format: ArtifactFormat;
  content: unknown;
  sourceObjectRefs?: unknown[];
  inputSummary?: unknown;
  skillVersion?: string;
  scriptVersion?: string;
};

export type UpdateArtifactInput = {
  artifactId: string;
  traceId?: string;
  createdByUserId?: string;
  title?: string;
  type?: ArtifactType;
  format?: ArtifactFormat;
  content: unknown;
  reason?: string;
  metadata?: unknown;
};

export type ArtifactVersionSelector = {
  versionId?: string;
  versionNumber?: number;
  before?: string;
};

export type RollbackArtifactInput = ArtifactVersionSelector & {
  artifactId: string;
  traceId?: string;
  createdByUserId?: string;
  reason?: string;
};

export type ArtifactVersionRecord = {
  id: string;
  artifactId: string;
  versionNumber: number;
  parentVersionId: string | null;
  restoredFromVersionId: string | null;
  createdAt: string;
  createdByUserId: string | null;
  traceId: string | null;
  reason: string | null;
  title: string;
  type: ArtifactType;
  format: ArtifactFormat;
  storageMode: ArtifactStorageMode;
  storageKey: string;
  localPath: string;
  contentSha256: string;
  byteSize: number;
  metadataJson: string | null;
  isCurrent: boolean;
};

type ArtifactRow = {
  id: string;
  workspace_id: string | null;
  created_by_user_id: string | null;
  skill_execution_trace_id: string;
  skill_name: string;
  title: string;
  type: ArtifactType;
  format: ArtifactFormat;
  status: ArtifactStatus;
  storage_mode: ArtifactStorageMode;
  storage_key: string;
  local_path: string;
  source_object_refs_json: string | null;
  input_summary_json: string | null;
  skill_version: string | null;
  script_version: string | null;
  created_at: string;
  updated_at: string;
  current_version_id: string | null;
  version_count: number;
};

type ArtifactVersionRow = {
  id: string;
  artifact_id: string;
  version_number: number;
  parent_version_id: string | null;
  restored_from_version_id: string | null;
  created_at: string;
  created_by_user_id: string | null;
  trace_id: string | null;
  reason: string | null;
  title: string;
  type: ArtifactType;
  format: ArtifactFormat;
  storage_mode: ArtifactStorageMode;
  storage_key: string;
  local_path: string;
  content_sha256: string;
  byte_size: number;
  metadata_json: string | null;
  current_version_id: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function createArtifactId(): string {
  return `art_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
}

function createArtifactVersionId(): string {
  return `av_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
}

function safeJson(value: unknown): string | null {
  if (value === undefined) return null;
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === 'bigint') return item.toString();
    return item;
  });
}

function serializeContent(content: unknown, format: ArtifactFormat): string | Buffer {
  if (Buffer.isBuffer(content)) return content;
  if (typeof content === 'string') return content;
  if (format === 'json') return `${JSON.stringify(content, null, 2)}\n`;
  return String(content);
}
function sanitizePathPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 120);
}

function versionDirectory(versionNumber: number): string {
  return String(versionNumber).padStart(6, '0');
}

function contentHash(bytes: string | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function byteLength(bytes: string | Buffer): number {
  return typeof bytes === 'string' ? Buffer.byteLength(bytes) : bytes.byteLength;
}

function artifactColumnExists(db: Database, column: string): boolean {
  const rows = db.query('PRAGMA table_info(artifacts)').all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

function addArtifactVersionColumnsIfMissing(db: Database): void {
  if (!artifactColumnExists(db, 'current_version_id')) {
    db.exec('ALTER TABLE artifacts ADD COLUMN current_version_id TEXT');
  }
  if (!artifactColumnExists(db, 'version_count')) {
    db.exec('ALTER TABLE artifacts ADD COLUMN version_count INTEGER NOT NULL DEFAULT 0');
  }
}

function openArtifactDatabase(): Database {
  const paths = ensureRuntimePaths();
  const db = new Database(paths.dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      workspace_id TEXT,
      created_by_user_id TEXT,
      skill_execution_trace_id TEXT NOT NULL,
      skill_name TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      format TEXT NOT NULL,
      status TEXT NOT NULL,
      storage_mode TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      local_path TEXT NOT NULL,
      source_object_refs_json TEXT,
      input_summary_json TEXT,
      skill_version TEXT,
      script_version TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  addArtifactVersionColumnsIfMissing(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS artifact_versions (
      id TEXT PRIMARY KEY,
      artifact_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      parent_version_id TEXT,
      restored_from_version_id TEXT,
      created_at TEXT NOT NULL,
      created_by_user_id TEXT,
      trace_id TEXT,
      reason TEXT,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      format TEXT NOT NULL,
      storage_mode TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      local_path TEXT NOT NULL,
      content_sha256 TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      metadata_json TEXT,
      FOREIGN KEY(artifact_id) REFERENCES artifacts(id),
      UNIQUE(artifact_id, version_number)
    );

    CREATE INDEX IF NOT EXISTS artifacts_trace_id_idx ON artifacts(skill_execution_trace_id);
    CREATE INDEX IF NOT EXISTS artifacts_workspace_id_idx ON artifacts(workspace_id);
    CREATE INDEX IF NOT EXISTS artifact_versions_artifact_idx ON artifact_versions(artifact_id, version_number);
    CREATE INDEX IF NOT EXISTS artifact_versions_created_at_idx ON artifact_versions(artifact_id, created_at);
  `);
  return db;
}

function versionStorageKey(artifactId: string, versionNumber: number, fileName: string): string {
  return path.posix.join('artifacts', sanitizePathPart(artifactId), 'versions', versionDirectory(versionNumber), sanitizePathPart(fileName));
}

function insertVersion(db: Database, version: Omit<ArtifactVersionRecord, 'isCurrent' | 'artifactId'> & { artifactId: string }): void {
  db.query([
    'INSERT INTO artifact_versions (',
    'id, artifact_id, version_number, parent_version_id, restored_from_version_id, created_at,',
    'created_by_user_id, trace_id, reason, title, type, format, storage_mode, storage_key,',
    'local_path, content_sha256, byte_size, metadata_json',
    ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ].join(' ')).run(
    version.id,
    version.artifactId,
    version.versionNumber,
    version.parentVersionId,
    version.restoredFromVersionId,
    version.createdAt,
    version.createdByUserId,
    version.traceId,
    version.reason,
    version.title,
    version.type,
    version.format,
    version.storageMode,
    version.storageKey,
    version.localPath,
    version.contentSha256,
    version.byteSize,
    version.metadataJson,
  );
}

function getArtifactRow(db: Database, artifactId: string): ArtifactRow {
  const row = db.query('SELECT * FROM artifacts WHERE id = ?').get(artifactId) as ArtifactRow | null;
  if (!row) throw new Error(`Artifact not found: ${artifactId}`);
  return row;
}

function rowToVersion(row: ArtifactVersionRow): ArtifactVersionRecord {
  return {
    id: row.id,
    artifactId: row.artifact_id,
    versionNumber: row.version_number,
    parentVersionId: row.parent_version_id,
    restoredFromVersionId: row.restored_from_version_id,
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id,
    traceId: row.trace_id,
    reason: row.reason,
    title: row.title,
    type: row.type,
    format: row.format,
    storageMode: row.storage_mode,
    storageKey: row.storage_key,
    localPath: row.local_path,
    contentSha256: row.content_sha256,
    byteSize: row.byte_size,
    metadataJson: row.metadata_json,
    isCurrent: row.current_version_id === row.id,
  };
}

function descriptorFromArtifact(row: ArtifactRow): ArtifactDescriptor {
  return {
    id: row.id,
    name: path.basename(row.storage_key),
    title: row.title,
    type: row.type,
    format: row.format,
    status: row.status,
    storageMode: row.storage_mode,
    path: row.storage_key,
    storageKey: row.storage_key,
    localPath: row.local_path,
    traceId: row.skill_execution_trace_id,
    skillName: row.skill_name,
    createdAt: row.created_at,
    currentVersionId: row.current_version_id ?? undefined,
    versionCount: row.version_count,
  };
}

export function createWorkspaceArtifact(input: CreateArtifactInput): ArtifactDescriptor {
  const paths = ensureRuntimePaths();
  const id = createArtifactId();
  const versionId = createArtifactVersionId();
  const versionNumber = 1;
  const safeFileName = sanitizePathPart(input.fileName);
  const storageKey = versionStorageKey(id, versionNumber, safeFileName);
  const localPath = path.join(paths.home, storageKey);
  const bytes = serializeContent(input.content, input.format);
  const createdAt = nowIso();

  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, bytes);

  const db = openArtifactDatabase();
  try {
    db.transaction(() => {
      db.query([
        'INSERT INTO artifacts (',
        'id, workspace_id, created_by_user_id, skill_execution_trace_id, skill_name, title, type, format,',
        'status, storage_mode, storage_key, local_path, source_object_refs_json, input_summary_json,',
        'skill_version, script_version, created_at, updated_at, current_version_id, version_count',
        ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ].join(' ')).run(
        id,
        input.workspaceId ?? null,
        input.createdByUserId ?? null,
        input.traceId,
        input.skillName,
        input.title,
        input.type,
        input.format,
        'draft',
        'local',
        storageKey,
        localPath,
        safeJson(input.sourceObjectRefs),
        safeJson(input.inputSummary),
        input.skillVersion ?? null,
        input.scriptVersion ?? null,
        createdAt,
        createdAt,
        versionId,
        versionNumber,
      );
      insertVersion(db, {
        id: versionId,
        artifactId: id,
        versionNumber,
        parentVersionId: null,
        restoredFromVersionId: null,
        createdAt,
        createdByUserId: input.createdByUserId ?? null,
        traceId: input.traceId,
        reason: 'create',
        title: input.title,
        type: input.type,
        format: input.format,
        storageMode: 'local',
        storageKey,
        localPath,
        contentSha256: contentHash(bytes),
        byteSize: byteLength(bytes),
        metadataJson: safeJson({ sourceObjectRefs: input.sourceObjectRefs, inputSummary: input.inputSummary }),
      });
    })();
  } finally {
    db.close();
  }

  materializeSites({ home: paths.home, dbPath: paths.dbPath, dryRun: false });

  return {
    id,
    name: input.fileName,
    title: input.title,
    type: input.type,
    format: input.format,
    status: 'draft',
    storageMode: 'local',
    path: storageKey,
    storageKey,
    localPath,
    traceId: input.traceId,
    skillName: input.skillName,
    createdAt,
    currentVersionId: versionId,
    versionCount: versionNumber,
  };
}

export function updateWorkspaceArtifact(input: UpdateArtifactInput): ArtifactDescriptor {
  const paths = ensureRuntimePaths();
  const db = openArtifactDatabase();
  let updated: ArtifactDescriptor;
  try {
    const artifact = getArtifactRow(db, input.artifactId);
    const nextVersionNumber = artifact.version_count + 1;
    const versionId = createArtifactVersionId();
    const title = input.title ?? artifact.title;
    const type = input.type ?? artifact.type;
    const format = input.format ?? artifact.format;
    const fileName = path.basename(artifact.storage_key);
    const storageKey = versionStorageKey(artifact.id, nextVersionNumber, fileName);
    const localPath = path.join(paths.home, storageKey);
    const bytes = serializeContent(input.content, format);
    const updatedAt = nowIso();

    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, bytes);

    db.transaction(() => {
      insertVersion(db, {
        id: versionId,
        artifactId: artifact.id,
        versionNumber: nextVersionNumber,
        parentVersionId: artifact.current_version_id,
        restoredFromVersionId: null,
        createdAt: updatedAt,
        createdByUserId: input.createdByUserId ?? null,
        traceId: input.traceId ?? artifact.skill_execution_trace_id,
        reason: input.reason ?? 'update',
        title,
        type,
        format,
        storageMode: 'local',
        storageKey,
        localPath,
        contentSha256: contentHash(bytes),
        byteSize: byteLength(bytes),
        metadataJson: safeJson(input.metadata),
      });
      db.query([
        'UPDATE artifacts SET title = ?, type = ?, format = ?, storage_mode = ?, storage_key = ?, local_path = ?,',
        'skill_execution_trace_id = ?, updated_at = ?, current_version_id = ?, version_count = ?',
        'WHERE id = ?',
      ].join(' ')).run(
        title,
        type,
        format,
        'local',
        storageKey,
        localPath,
        input.traceId ?? artifact.skill_execution_trace_id,
        updatedAt,
        versionId,
        nextVersionNumber,
        artifact.id,
      );
    })();
    updated = descriptorFromArtifact({
      ...artifact,
      title,
      type,
      format,
      storage_mode: 'local',
      storage_key: storageKey,
      local_path: localPath,
      skill_execution_trace_id: input.traceId ?? artifact.skill_execution_trace_id,
      updated_at: updatedAt,
      current_version_id: versionId,
      version_count: nextVersionNumber,
    });
  } finally {
    db.close();
  }

  materializeSites({ home: paths.home, dbPath: paths.dbPath, dryRun: false });
  return updated;
}

export function listWorkspaceArtifactVersions(artifactId: string): ArtifactVersionRecord[] {
  const db = openArtifactDatabase();
  try {
    getArtifactRow(db, artifactId);
    const rows = db.query([
      'SELECT artifact_versions.*, artifacts.current_version_id FROM artifact_versions',
      'JOIN artifacts ON artifacts.id = artifact_versions.artifact_id',
      'WHERE artifact_id = ? ORDER BY version_number ASC',
    ].join(' ')).all(artifactId) as ArtifactVersionRow[];
    return rows.map(rowToVersion);
  } finally {
    db.close();
  }
}

export function getWorkspaceArtifactVersion(artifactId: string, selector: ArtifactVersionSelector): ArtifactVersionRecord {
  const db = openArtifactDatabase();
  try {
    getArtifactRow(db, artifactId);
    let row: ArtifactVersionRow | null = null;
    if (selector.versionId) {
      row = db.query([
        'SELECT artifact_versions.*, artifacts.current_version_id FROM artifact_versions',
        'JOIN artifacts ON artifacts.id = artifact_versions.artifact_id',
        'WHERE artifact_id = ? AND artifact_versions.id = ?',
      ].join(' ')).get(artifactId, selector.versionId) as ArtifactVersionRow | null;
    } else if (selector.versionNumber != null) {
      row = db.query([
        'SELECT artifact_versions.*, artifacts.current_version_id FROM artifact_versions',
        'JOIN artifacts ON artifacts.id = artifact_versions.artifact_id',
        'WHERE artifact_id = ? AND version_number = ?',
      ].join(' ')).get(artifactId, selector.versionNumber) as ArtifactVersionRow | null;
    } else if (selector.before) {
      row = db.query([
        'SELECT artifact_versions.*, artifacts.current_version_id FROM artifact_versions',
        'JOIN artifacts ON artifacts.id = artifact_versions.artifact_id',
        'WHERE artifact_id = ? AND artifact_versions.created_at <= ?',
        'ORDER BY artifact_versions.created_at DESC, version_number DESC LIMIT 1',
      ].join(' ')).get(artifactId, selector.before) as ArtifactVersionRow | null;
    } else {
      row = db.query([
        'SELECT artifact_versions.*, artifacts.current_version_id FROM artifact_versions',
        'JOIN artifacts ON artifacts.id = artifact_versions.artifact_id',
        'WHERE artifact_id = ? AND artifacts.current_version_id = artifact_versions.id',
      ].join(' ')).get(artifactId) as ArtifactVersionRow | null;
    }
    if (!row) throw new Error(`Artifact version not found for ${artifactId}`);
    return rowToVersion(row);
  } finally {
    db.close();
  }
}

export function rollbackWorkspaceArtifact(input: RollbackArtifactInput): ArtifactDescriptor & { restoredFromVersionId: string } {
  const paths = ensureRuntimePaths();
  const db = openArtifactDatabase();
  let rolledBack: ArtifactDescriptor & { restoredFromVersionId: string };
  try {
    const artifact = getArtifactRow(db, input.artifactId);
    const target = getWorkspaceArtifactVersion(input.artifactId, input);
    if (!fs.existsSync(target.localPath)) throw new Error(`Artifact version bytes missing: ${target.localPath}`);
    const bytes = fs.readFileSync(target.localPath);
    if (contentHash(bytes) !== target.contentSha256) throw new Error(`Artifact version hash mismatch: ${target.id}`);

    const nextVersionNumber = artifact.version_count + 1;
    const versionId = createArtifactVersionId();
    const fileName = path.basename(target.storageKey);
    const storageKey = versionStorageKey(artifact.id, nextVersionNumber, fileName);
    const localPath = path.join(paths.home, storageKey);
    const createdAt = nowIso();

    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, bytes);

    db.transaction(() => {
      insertVersion(db, {
        id: versionId,
        artifactId: artifact.id,
        versionNumber: nextVersionNumber,
        parentVersionId: artifact.current_version_id,
        restoredFromVersionId: target.id,
        createdAt,
        createdByUserId: input.createdByUserId ?? null,
        traceId: input.traceId ?? artifact.skill_execution_trace_id,
        reason: input.reason ?? `rollback to ${target.versionNumber}`,
        title: target.title,
        type: target.type,
        format: target.format,
        storageMode: 'local',
        storageKey,
        localPath,
        contentSha256: target.contentSha256,
        byteSize: target.byteSize,
        metadataJson: safeJson({ restoredFromVersionId: target.id, restoredFromVersionNumber: target.versionNumber }),
      });
      db.query([
        'UPDATE artifacts SET title = ?, type = ?, format = ?, storage_mode = ?, storage_key = ?, local_path = ?,',
        'skill_execution_trace_id = ?, updated_at = ?, current_version_id = ?, version_count = ?',
        'WHERE id = ?',
      ].join(' ')).run(
        target.title,
        target.type,
        target.format,
        'local',
        storageKey,
        localPath,
        input.traceId ?? artifact.skill_execution_trace_id,
        createdAt,
        versionId,
        nextVersionNumber,
        artifact.id,
      );
    })();
    rolledBack = {
      id: artifact.id,
      name: path.basename(storageKey),
      title: target.title,
      type: target.type,
      format: target.format,
      status: artifact.status,
      storageMode: 'local',
      path: storageKey,
      storageKey,
      localPath,
      traceId: input.traceId ?? artifact.skill_execution_trace_id,
      skillName: artifact.skill_name,
      createdAt: artifact.created_at,
      currentVersionId: versionId,
      versionCount: nextVersionNumber,
      restoredFromVersionId: target.id,
    };
  } finally {
    db.close();
  }

  materializeSites({ home: paths.home, dbPath: paths.dbPath, dryRun: false });
  return rolledBack;
}

export function createWorkspaceArtifactDescriptor(name: string, type: string): ArtifactDescriptor {
  return {
    name,
    type,
    path: path.posix.join('artifacts', name),
  };
}
