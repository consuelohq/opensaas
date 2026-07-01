import { fetchConsueloWorkspaceSnapshot } from '../lib/consuelo-workspace-client';
import type { CallOutput, SkillContext } from '../lib/types';

type SnapshotInput = {
  limit?: number;
};

function normalizeInput(input: unknown): SnapshotInput {
  return input != null && typeof input === 'object' && !Array.isArray(input)
    ? input as SnapshotInput
    : {};
}

function errorCode(status: string): string {
  if (status === 'missing_capability') return 'MISSING_CAPABILITY';
  if (status === 'auth_failed') return 'AUTH_FAILED';
  if (status === 'schema_gap') return 'SCHEMA_GAP';
  return 'QUERY_FAILED';
}

function isFailureStatus(status: string): boolean {
  return ['missing_capability', 'auth_failed', 'query_failed', 'schema_gap'].includes(status);
}

export async function runConsueloWorkspaceSnapshot(input: unknown, context: SkillContext): Promise<CallOutput> {
  const normalizedInput = normalizeInput(input);
  let snapshot: Awaited<ReturnType<typeof fetchConsueloWorkspaceSnapshot>>;
  try {
    snapshot = await fetchConsueloWorkspaceSnapshot({
      limit: normalizedInput.limit,
      workspaceId: context.workspaceId,
      userId: context.userId,
    });
  } catch (error: unknown) {
    return {
      ok: false,
      name: context.manifestEntry.name,
      permission: context.manifestEntry.permission,
      requiresApproval: context.manifestEntry.requiresApproval,
      proposedWrites: [],
      error: {
        code: 'QUERY_FAILED',
        message:
          error instanceof Error
            ? error.message.slice(0, 240)
            : 'Consuelo workspace snapshot failed safely.',
      },
    };
  }

  const result = {
    summary: snapshot.status === 'ok'
      ? 'Consuelo workspace snapshot loaded.'
      : snapshot.status === 'empty_workspace'
        ? 'Consuelo workspace snapshot loaded, but no workspace objects were returned.'
        : 'Consuelo workspace snapshot could not be loaded safely.',
    status: snapshot.status,
    snapshot,
    objectRefs: {
      workspace: snapshot.workspace,
      people: snapshot.people,
      companies: snapshot.companies,
      lists: snapshot.lists,
      calls: snapshot.calls,
      files: snapshot.files,
      attachments: snapshot.attachments,
      tasks: snapshot.tasks,
      notes: snapshot.notes,
      workflows: snapshot.workflows,
      workflowRuns: snapshot.workflowRuns,
      dashboards: snapshot.dashboards,
      artifacts: snapshot.artifacts,
      recentActivity: snapshot.recentActivity,
    },
    warnings: snapshot.warnings,
    nextActions: [
      'Use objectRefs as stable source references for downstream reports, briefs, design work, and future cloud artifacts.',
      'Keep this first slice read-only; use a separate approval-gated task for app writes or cloud artifact creation.',
      'Evaluate Mirage only after app-native Files/Attachments and artifact references are stable.',
    ],
  };

  if (isFailureStatus(snapshot.status)) {
    return {
      ok: false,
      name: context.manifestEntry.name,
      permission: context.manifestEntry.permission,
      requiresApproval: context.manifestEntry.requiresApproval,
      result,
      proposedWrites: [],
      error: {
        code: errorCode(snapshot.status),
        message: snapshot.safeMessage ?? 'Consuelo workspace snapshot failed safely.',
      },
    };
  }

  return {
    ok: true,
    name: context.manifestEntry.name,
    permission: context.manifestEntry.permission,
    requiresApproval: context.manifestEntry.requiresApproval,
    result,
    proposedWrites: [],
  };
}
