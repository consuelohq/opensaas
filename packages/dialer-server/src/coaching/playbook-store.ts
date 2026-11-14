import type { LeadConnectorDatabase } from '@consuelo/lead-connector';
import type { DialerIdentity } from '../contracts';
import { compilePlaybook, type CompiledPlaybook } from './playbooks';
import { ScriptConflictError, type CoachingScript } from './scripts';
export const PLAYBOOK_PUBLICATIONS_MIGRATION_ID =
  '20261113_021_coaching_playbook_publications';
export const CREATE_PLAYBOOK_PUBLICATIONS_SQL = `
ALTER TABLE dialer_coaching_scripts ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE TABLE IF NOT EXISTS dialer_coaching_script_publications(
 workspace_id text NOT NULL, script_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 source_revision integer NOT NULL CHECK(source_revision>0), compiled jsonb NOT NULL,
 published_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,script_id,version),
 FOREIGN KEY(workspace_id,script_id) REFERENCES dialer_coaching_scripts(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS dialer_coaching_script_pins(
 workspace_id text NOT NULL, scope_key text NOT NULL, call_session_id text NOT NULL, call_generation integer NOT NULL CHECK(call_generation>0),
 user_id text NOT NULL, script_id uuid NOT NULL, version integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 worker_owner text, worker_generation integer NOT NULL DEFAULT 0, worker_lease_until timestamptz, ended_at timestamptz,
 PRIMARY KEY(workspace_id,scope_key),
 FOREIGN KEY(workspace_id,script_id,version) REFERENCES dialer_coaching_script_publications(workspace_id,script_id,version)
);`;
export class PlaybookAccessError extends Error {}
export class PlaybookValidationError extends Error {}
export type PublishInput = {
  expectedRevision: number;
  expectedPublishedVersion: number;
  approved: boolean;
  industryPackVersion?: string;
  companyPolicyVersion?: string;
  rules?: unknown;
};
export type PreviewInput = Omit<
  PublishInput,
  'expectedPublishedVersion' | 'approved'
>;
export type Publication = {
  version: number;
  sourceRevision: number;
  createdAt: string;
  compiled: CompiledPlaybook;
};
export type PlaybookStore = {
  preview(
    identity: DialerIdentity,
    id: string,
    input: PreviewInput,
  ): Promise<CompiledPlaybook>;
  publish(
    identity: DialerIdentity,
    id: string,
    input: PublishInput,
  ): Promise<Publication>;
  versions(identity: DialerIdentity, id: string): Promise<Publication[]>;
  pin(
    identity: DialerIdentity,
    input: {
      scopeKey: string;
      callSessionId: string;
      callGeneration: number;
      scriptId: string;
      version?: number;
    },
  ): Promise<Publication>;
  claim(
    identity: DialerIdentity,
    scopeKey: string,
    workerOwner: string,
    restart?: boolean,
  ): Promise<number | null>;
  archive(
    identity: DialerIdentity,
    id: string,
    expectedRevision: number,
  ): Promise<void>;
};
type ScriptRow = {
  id: string;
  title: string;
  content: string;
  revision: number;
  created_by: string;
};
type PubRow = {
  version: number;
  source_revision: number;
  created_at: Date | string;
  compiled: CompiledPlaybook;
};
const project = (r: PubRow): Publication => ({
  version: r.version,
  sourceRevision: r.source_revision,
  createdAt: new Date(r.created_at).toISOString(),
  compiled: r.compiled,
});
export function createPlaybookStore(
  database: LeadConnectorDatabase,
): PlaybookStore {
  const load = async (identity: DialerIdentity, id: string, edit: boolean) => {
    try {
      const row = (
        await database.query<ScriptRow>(
          'SELECT id,title,content,revision,created_by FROM dialer_coaching_scripts WHERE workspace_id=$1 AND id=$2::uuid AND archived_at IS NULL',
          [identity.workspaceId, id],
        )
      ).rows[0];
      if (
        !row ||
        (edit &&
          row.created_by !== identity.userId &&
          identity.role !== 'admin')
      )
        throw new PlaybookAccessError(
          'Script unavailable or author access required',
        );
      return row;
    } catch (cause: unknown) {
      throw cause instanceof Error
        ? cause
        : new Error('Coaching operation failed', { cause });
    }
  };
  const compile = async (
    identity: DialerIdentity,
    id: string,
    input: PublishInput,
  ) => {
    try {
      if (
        !Number.isSafeInteger(input.expectedRevision) ||
        input.expectedRevision < 1 ||
        !Number.isSafeInteger(input.expectedPublishedVersion) ||
        input.expectedPublishedVersion < 0
      )
        throw new Error('Use current saved and published revisions');
      const source = await load(identity, id, true);
      if (source.revision !== input.expectedRevision)
        throw new ScriptConflictError(
          'The saved script changed. Reopen before publishing.',
        );
      try {
        return compilePlaybook({
          workspaceId: identity.workspaceId,
          scriptId: id,
          sourceRevision: source.revision,
          version: input.expectedPublishedVersion + 1,
          title: source.title,
          content: source.content,
          industryPackVersion: 'unclassified-tenant-text-v1',
          companyPolicyVersion: 'tenant-source:' + id + ':' + source.revision,
          rules: input.rules,
        });
      } catch (error: unknown) {
        throw new PlaybookValidationError(
          error instanceof Error ? error.message : 'Invalid approved playbook',
        );
      }
    } catch (cause: unknown) {
      throw cause instanceof Error
        ? cause
        : new Error('Coaching operation failed', { cause });
    }
  };
  return {
    async preview(identity, id, input) {
      try {
        await load(identity, id, true);
        const row = (
          await database.query<{ version: number }>(
            'SELECT COALESCE(MAX(version),0) AS version FROM dialer_coaching_script_publications WHERE workspace_id=$1 AND script_id=$2::uuid',
            [identity.workspaceId, id],
          )
        ).rows[0];
        const ordinal = Number(row?.version ?? 0);
        if (!Number.isSafeInteger(ordinal) || ordinal < 0)
          throw new Error('Stored publication ordinal is invalid');
        return await compile(identity, id, {
          ...input,
          expectedPublishedVersion: ordinal,
          approved: false,
        });
      } catch (cause: unknown) {
        throw cause instanceof Error
          ? cause
          : new Error('Playbook preview failed', { cause });
      }
    },
    async publish(identity, id, input) {
      try {
        if (input.approved !== true)
          throw new Error('Explicit author approval is required');
        const compiled = await compile(identity, id, input);
        const row = (
          await database.query<PubRow>(
            `INSERT INTO dialer_coaching_script_publications(workspace_id,script_id,version,source_revision,compiled,published_by)
 SELECT $1,$2::uuid,$3,$4,$5::jsonb,$6
 WHERE EXISTS(SELECT 1 FROM dialer_coaching_scripts WHERE workspace_id=$1 AND id=$2::uuid AND revision=$4 AND archived_at IS NULL AND(created_by=$6 OR $7::boolean))
 AND (SELECT COALESCE(MAX(version),0) FROM dialer_coaching_script_publications WHERE workspace_id=$1 AND script_id=$2::uuid)=$8
 ON CONFLICT DO NOTHING RETURNING version,source_revision,compiled,created_at`,
            [
              identity.workspaceId,
              id,
              compiled.version,
              input.expectedRevision,
              JSON.stringify(compiled),
              identity.userId,
              identity.role === 'admin',
              input.expectedPublishedVersion,
            ],
          )
        ).rows[0];
        if (!row)
          throw new ScriptConflictError(
            'Script or publication changed. Reload before publishing.',
          );
        return project(row);
      } catch (cause: unknown) {
        throw cause instanceof Error
          ? cause
          : new Error('Coaching operation failed', { cause });
      }
    },
    async versions(identity, id) {
      try {
        await load(identity, id, false);
        return (
          await database.query<PubRow>(
            'SELECT version,source_revision,compiled,created_at FROM dialer_coaching_script_publications WHERE workspace_id=$1 AND script_id=$2::uuid ORDER BY version DESC LIMIT 100',
            [identity.workspaceId, id],
          )
        ).rows.map(project);
      } catch (cause: unknown) {
        throw cause instanceof Error
          ? cause
          : new Error('Coaching operation failed', { cause });
      }
    },
    async pin(identity, input) {
      try {
        const existing = (
          await database.query<{
            script_id: string;
            version: number;
            user_id: string;
            ended_at: unknown;
          }>(
            'SELECT script_id,version,user_id,ended_at FROM dialer_coaching_script_pins WHERE workspace_id=$1 AND scope_key=$2',
            [identity.workspaceId, input.scopeKey],
          )
        ).rows[0];
        if (
          existing &&
          (existing.user_id !== identity.userId ||
            existing.script_id !== input.scriptId ||
            existing.ended_at ||
            (input.version !== undefined && existing.version !== input.version))
        )
          throw new ScriptConflictError(
            'This call already has an immutable script pin',
          );
        if (!existing) await load(identity, input.scriptId, false);
        let version = existing?.version ?? input.version;
        if (version === undefined) {
          await load(identity, input.scriptId, false);
          version = (
            await database.query<{ version: number }>(
              'SELECT MAX(version) AS version FROM dialer_coaching_script_publications WHERE workspace_id=$1 AND script_id=$2::uuid',
              [identity.workspaceId, input.scriptId],
            )
          ).rows[0]?.version;
        }
        if (!version)
          throw new PlaybookAccessError(
            'Publish this script before using approved cues',
          );
        if (!existing)
          await database.query(
            `INSERT INTO dialer_coaching_script_pins(workspace_id,scope_key,call_session_id,call_generation,user_id,script_id,version) VALUES($1,$2,$3,$4,$5,$6::uuid,$7) ON CONFLICT DO NOTHING`,
            [
              identity.workspaceId,
              input.scopeKey,
              input.callSessionId,
              input.callGeneration,
              identity.userId,
              input.scriptId,
              version,
            ],
          );
        const row = (
          await database.query<PubRow>(
            `SELECT p.version,p.source_revision,p.compiled,p.created_at FROM dialer_coaching_script_pins pin JOIN dialer_coaching_script_publications p ON p.workspace_id=pin.workspace_id AND p.script_id=pin.script_id AND p.version=pin.version WHERE pin.workspace_id=$1 AND pin.scope_key=$2 AND pin.user_id=$3 AND pin.script_id=$4::uuid AND pin.version=$5 AND pin.ended_at IS NULL`,
            [
              identity.workspaceId,
              input.scopeKey,
              identity.userId,
              input.scriptId,
              version,
            ],
          )
        ).rows[0];
        if (!row)
          throw new ScriptConflictError(
            'This call script changed or is unavailable',
          );
        return project(row);
      } catch (cause: unknown) {
        throw cause instanceof Error
          ? cause
          : new Error('Coaching operation failed', { cause });
      }
    },
    async claim(identity, scopeKey, workerOwner, restart = false) {
      try {
        const row = (
          await database.query<{ worker_generation: number }>(
            `UPDATE dialer_coaching_script_pins SET worker_generation=CASE WHEN worker_owner=$4 AND NOT $5::boolean THEN worker_generation ELSE worker_generation+1 END,worker_owner=$4,worker_lease_until=now()+interval '10 seconds' WHERE workspace_id=$1 AND scope_key=$2 AND user_id=$3 AND ended_at IS NULL AND(worker_owner=$4 OR worker_lease_until IS NULL OR worker_lease_until<now()) RETURNING worker_generation`,
            [
              identity.workspaceId,
              scopeKey,
              identity.userId,
              workerOwner,
              restart,
            ],
          )
        ).rows[0];
        return row?.worker_generation ?? null;
      } catch (cause: unknown) {
        throw cause instanceof Error
          ? cause
          : new Error('Coaching operation failed', { cause });
      }
    },
    async archive(identity, id, expectedRevision) {
      try {
        const row = (
          await database.query(
            `UPDATE dialer_coaching_scripts SET archived_at=now(),revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND id=$2::uuid AND revision=$3 AND(created_by=$4 OR $5::boolean) AND archived_at IS NULL RETURNING id`,
            [
              identity.workspaceId,
              id,
              expectedRevision,
              identity.userId,
              identity.role === 'admin',
            ],
          )
        ).rows[0];
        if (!row)
          throw new ScriptConflictError(
            'Script changed or author access is missing',
          );
      } catch (cause: unknown) {
        throw cause instanceof Error
          ? cause
          : new Error('Coaching operation failed', { cause });
      }
    },
  };
}
