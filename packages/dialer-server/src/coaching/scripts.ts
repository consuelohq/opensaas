import type { LeadConnectorDatabase } from '@consuelo/lead-connector';
import type { DialerIdentity } from '../contracts';
export const COACHING_SCRIPTS_MIGRATION_ID = '20261030_015_coaching_scripts';
export const CREATE_COACHING_SCRIPTS_SQL = `CREATE TABLE IF NOT EXISTS dialer_coaching_scripts (
 workspace_id text NOT NULL, id uuid NOT NULL, created_by text NOT NULL,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
 content text NOT NULL CHECK(octet_length(content) BETWEEN 1 AND 100000),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,id)
)`;
export type ScriptDraft = {
  id: string;
  title: string;
  content: string;
  expectedRevision: number;
};
export type CoachingScript = {
  id: string;
  title: string;
  content: string;
  revision: number;
  updatedAt: string;
  canEdit: boolean;
};
export class ScriptConflictError extends Error {}
export const validateScriptDraft = (
  value: unknown,
): Omit<ScriptDraft, 'id'> => {
  const input =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const content = typeof input.content === 'string' ? input.content : '';
  const expectedRevision = input.expectedRevision;
  if (
    !title ||
    title.length > 120 ||
    !content.trim() ||
    content.includes('\0') ||
    new TextEncoder().encode(content).length > 100000 ||
    !Number.isSafeInteger(expectedRevision) ||
    Number(expectedRevision) < 0
  )
    throw new Error(
      'Use a script name and nonempty text or Markdown up to 100 KB.',
    );
  return { title, content, expectedRevision: Number(expectedRevision) };
};
export type CoachingScripts = {
  list: (identity: DialerIdentity) => Promise<CoachingScript[]>;
  save: (
    identity: DialerIdentity,
    draft: ScriptDraft,
  ) => Promise<CoachingScript>;
};
type ScriptRow = {
  id: string;
  title: string;
  content: string;
  revision: number;
  updated_at: Date | string;
  created_by: string;
};
const isAdmin = (identity: DialerIdentity) => identity.role === 'admin';
const project = (row: ScriptRow, identity: DialerIdentity): CoachingScript => ({
  id: row.id,
  title: row.title,
  content: row.content,
  revision: row.revision,
  updatedAt: new Date(row.updated_at).toISOString(),
  canEdit: isAdmin(identity) || row.created_by === identity.userId,
});
export const createCoachingScripts = (
  database: LeadConnectorDatabase,
): CoachingScripts => ({
  list: async (identity) => {
    try {
      const result = await database.query<ScriptRow>(
        'SELECT id,title,content,revision,updated_at,created_by FROM dialer_coaching_scripts WHERE workspace_id=$1 ORDER BY updated_at DESC,id',
        [identity.workspaceId],
      );
      return result.rows.map((row) => project(row, identity));
    } catch (cause: unknown) {
      throw new Error('Workspace script library read failed', { cause });
    }
  },
  save: async (identity, draft) => {
    try {
      const valid = validateScriptDraft(draft);
      // Existing edits use UPDATE so a missing or foreign-tenant id is never inserted.
      if (valid.expectedRevision > 0) {
        const updated = await database.query<ScriptRow>(
          `UPDATE dialer_coaching_scripts SET title=$4,content=$5,revision=revision+1,updated_at=now()
    WHERE workspace_id=$1 AND id=$2::uuid AND revision=$6 AND (created_by=$3 OR $7::boolean)
    RETURNING id,title,content,revision,updated_at,created_by`,
          [
            identity.workspaceId,
            draft.id,
            identity.userId,
            valid.title,
            valid.content,
            valid.expectedRevision,
            isAdmin(identity),
          ],
        );
        if (!updated.rows[0])
          throw new ScriptConflictError(
            'The script changed or you cannot edit it. Reopen it before saving.',
          );
        return project(updated.rows[0], identity);
      }
      const result = await database.query<ScriptRow>(
        `INSERT INTO dialer_coaching_scripts(workspace_id,id,created_by,title,content) VALUES($1,$2::uuid,$3,$4,$5) ON CONFLICT(workspace_id,id) DO NOTHING RETURNING id,title,content,revision,updated_at,created_by`,
        [
          identity.workspaceId,
          draft.id,
          identity.userId,
          valid.title,
          valid.content,
        ],
      );
      if (!result.rows[0])
        throw new ScriptConflictError(
          'The script changed or you cannot edit it. Reopen it before saving.',
        );
      return project(result.rows[0], identity);
    } catch (cause: unknown) {
      if (cause instanceof ScriptConflictError) throw cause;
      throw new Error('Workspace script save failed', { cause });
    }
  },
});
