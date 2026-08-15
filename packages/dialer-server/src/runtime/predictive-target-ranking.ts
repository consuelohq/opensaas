import {
  PredictiveSelectionModel,
  type CallableTarget,
} from '@consuelo/dialer';

import {
  createPostgresPredictiveModelStore,
  type PredictiveLearningDatabase,
} from '../learning/postgres-predictive-model-store';

type AttemptRow = {
  contact_id: string;
  attempts_total: number | string;
  last_attempt_at: string | Date | null;
};

type RankingFallbackLogger = (details: {
  workspaceId: string;
  error: string;
}) => void;

type RankingOptions = {
  database: PredictiveLearningDatabase;
  workspaceId: string;
  segmentId: string;
  targets: CallableTarget[];
  timezone: string;
  callableWindowEndHour: number;
  now?: Date;
  onFallback?: RankingFallbackLogger;
};

const nonNegativeAttemptCount = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(Math.trunc(parsed), 0) : 0;
};

const parseAttemptDate = (value: string | Date | null | undefined) => {
  if (!value) return null;
  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatErrorChain = (cause: unknown) => {
  const messages: string[] = [];
  let current: unknown = cause;
  const seen = new Set<unknown>();

  while (current instanceof Error && !seen.has(current)) {
    seen.add(current);
    messages.push(current.message);
    current = current.cause;
  }

  if (messages.length > 0) return messages.join(': ');
  return String(cause);
};

export const rankPredictiveTargets = async ({
  database,
  workspaceId,
  segmentId,
  targets,
  timezone,
  callableWindowEndHour,
  now = new Date(),
  onFallback,
}: RankingOptions): Promise<CallableTarget[]> => {
  if (targets.length === 0) return [];

  try {
    const contactIds = targets.map((target) => target.contactId);
    const attemptsResult = await database.query<AttemptRow>(
      `SELECT contact_id, attempts_total, last_attempt_at
       FROM contact_attempt_ledger
       WHERE workspace_id = $1
         AND contact_id = ANY($2::text[])`,
      [workspaceId, contactIds],
    );
    const attemptsByContact = new Map(
      attemptsResult.rows.map((row) => [String(row.contact_id), row]),
    );

    const model = new PredictiveSelectionModel(
      createPostgresPredictiveModelStore(database),
    );
    const selection = await model.rankCandidates({
      workspaceId,
      segmentId,
      localTimezone: timezone,
      callableWindowEndHour,
      evaluatedAt: now,
      candidates: targets.map((target, position) => {
        const attempt = attemptsByContact.get(target.contactId);
        return {
          contactId: target.contactId,
          position,
          attemptsUsed: nonNegativeAttemptCount(attempt?.attempts_total),
          lastAttemptAt: parseAttemptDate(attempt?.last_attempt_at),
        };
      }),
    });

    return selection.ranked
      .map((candidate) => targets[candidate.position])
      .filter((target): target is CallableTarget => target !== undefined);
  } catch (cause: unknown) {
    onFallback?.({
      workspaceId,
      error: formatErrorChain(cause),
    });
    return targets;
  }
};
