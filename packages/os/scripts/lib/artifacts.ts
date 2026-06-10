import { Database } from 'bun:sqlite';
import { randomUUID } from 'node:crypto';
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

function nowIso(): string {
  return new Date().toISOString();
}

function createArtifactId(): string {
  return `art_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
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

    CREATE INDEX IF NOT EXISTS artifacts_trace_id_idx ON artifacts(skill_execution_trace_id);
    CREATE INDEX IF NOT EXISTS artifacts_workspace_id_idx ON artifacts(workspace_id);
  `);
  return db;
}

export function createWorkspaceArtifact(input: CreateArtifactInput): ArtifactDescriptor {
  const paths = ensureRuntimePaths();
  const id = createArtifactId();
  const safeTraceId = sanitizePathPart(input.traceId);
  const safeFileName = sanitizePathPart(input.fileName);
  const storageKey = path.posix.join('artifacts', safeTraceId, safeFileName);
  const localPath = path.join(paths.home, storageKey);

  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, serializeContent(input.content, input.format));

  const createdAt = nowIso();
  const insertArtifactSql = [
    'INSERT INTO artifacts (',
    'id, workspace_id, created_by_user_id, skill_execution_trace_id, skill_name, title, type, format,',
    'status, storage_mode, storage_key, local_path, source_object_refs_json, input_summary_json,',
    'skill_version, script_version, created_at, updated_at',
    ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ].join(' ');

  const db = openArtifactDatabase();
  try {
    db.query(insertArtifactSql).run(
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
    );
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
    localPath,
    traceId: input.traceId,
    skillName: input.skillName,
    createdAt,
  };
}

export function createWorkspaceArtifactDescriptor(name: string, type: string): ArtifactDescriptor {
  return {
    name,
    type,
    path: path.posix.join('artifacts', name),
  };
}
