import { randomUUID } from 'node:crypto';

import {
  PredictiveSelectionModel,
  resolveLocalCalendarSlot,
  type CallableTarget,
  type PredictiveDecisionContext,
  type PredictiveRankedCandidate,
  type PredictiveSuppressedCandidate,
} from '@consuelo/dialer';

import {
  recordPredictiveDecision,
  type PredictiveDecisionRecord,
} from '../learning/predictive-decision-log';
import {
  createPostgresPredictiveModelStore,
  type PredictiveLearningDatabase,
} from '../learning/postgres-predictive-model-store';

type AttemptRow = {
  contact_id: string;
  attempts_total: number | string;
  attempts_today?: number | string;
  attempts_this_week?: number | string;
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
  preferLocalPresence?: boolean;
  now?: Date;
  onFallback?: RankingFallbackLogger;
};

export type PredictiveRankingDecisionResult = {
  rankedTargets: CallableTarget[];
  decision: PredictiveDecisionRecord;
  decisionLogPersisted: boolean;
  decisionLogError: string | null;
};

const D3_POLICY_VERSION = 'd3-canonical-v1';
const D3_MODEL_VERSION = 'd3-canonical-v1';
const D4_FEATURE_SCHEMA_VERSION = 2 as const;

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

const resolveDecisionTimezone = (
  target: CallableTarget,
  workspaceTimezone: string,
  evaluatedAt: Date,
) => {
  const contactTimezone = target.sourceContext?.contactTimezone?.trim();
  if (contactTimezone) {
    try {
      const slot = resolveLocalCalendarSlot(evaluatedAt, contactTimezone);
      return {
        timezone: contactTimezone,
        timezoneSource: 'contact' as const,
        slot,
      };
    } catch (_cause: unknown) {
      // A malformed provider timezone is not promoted into scientific context.
    }
  }
  return {
    timezone: workspaceTimezone,
    timezoneSource: 'workspace_fallback' as const,
    slot: resolveLocalCalendarSlot(evaluatedAt, workspaceTimezone),
  };
};

const minutesSinceAttempt = (lastAttemptAt: Date | null, evaluatedAt: Date) => {
  if (!lastAttemptAt) return null;
  return Math.max(
    (evaluatedAt.getTime() - lastAttemptAt.getTime()) / (60 * 1000),
    0,
  );
};

const buildDecisionContext = (input: {
  target: CallableTarget;
  attempt: AttemptRow | undefined;
  workspaceTimezone: string;
  evaluatedAt: Date;
  preferLocalPresence: boolean;
  ranked?: PredictiveRankedCandidate;
  suppressed?: PredictiveSuppressedCandidate;
}): PredictiveDecisionContext | null => {
  const attemptsUsed = nonNegativeAttemptCount(input.attempt?.attempts_total);
  const lastAttemptAt = parseAttemptDate(input.attempt?.last_attempt_at);
  const local = resolveDecisionTimezone(
    input.target,
    input.workspaceTimezone,
    input.evaluatedAt,
  );
  const evidence = input.ranked ?? input.suppressed;
  if (!evidence) return null;

  return {
    schemaVersion: D4_FEATURE_SCHEMA_VERSION,
    capturedAt: input.evaluatedAt.toISOString(),
    timezone: local.timezone,
    timezoneSource: local.timezoneSource,
    localHour: local.slot.hourOfDay,
    localDayOfWeek: local.slot.dayOfWeek,
    attemptsUsed,
    attemptsToday: nonNegativeAttemptCount(input.attempt?.attempts_today),
    attemptsThisWeek: nonNegativeAttemptCount(
      input.attempt?.attempts_this_week,
    ),
    minutesSinceLastAttempt: minutesSinceAttempt(lastAttemptAt, input.evaluatedAt),
    localPresenceRequested: input.preferLocalPresence,
    source: { ...(input.target.sourceContext ?? {}) },
    d3: {
      nextAttemptNumber: evidence.nextAttemptNumber,
      answerProbability: evidence.answerProbability,
      answerProbabilityUpperBound: evidence.answerProbabilityUpperBound,
      score: input.ranked?.score ?? null,
      hazardSource: input.ranked?.hazardSource ?? null,
      suppressed: Boolean(input.suppressed),
    },
  };
};

export const rankPredictiveTargetsWithDecision = async ({
  database,
  workspaceId,
  segmentId,
  targets,
  timezone,
  callableWindowEndHour,
  preferLocalPresence = true,
  now = new Date(),
  onFallback,
}: RankingOptions): Promise<PredictiveRankingDecisionResult> => {
  if (targets.length === 0) {
    const decision: PredictiveDecisionRecord = {
      decisionId: randomUUID(),
      workspaceId,
      segmentId,
      evaluatedAt: now.toISOString(),
      policyVersion: D3_POLICY_VERSION,
      modelVersion: D3_MODEL_VERSION,
      featureSchemaVersion: D4_FEATURE_SCHEMA_VERSION,
      policyMode: 'deterministic',
      eligible: [],
      ranked: [],
      suppressed: [],
      selectionProbabilities: null,
    };
    return {
      rankedTargets: [],
      decision,
      decisionLogPersisted: false,
      decisionLogError: null,
    };
  }

  try {
    const contactIds = targets.map((target) => target.contactId);
    const attemptsResult = await database.query<AttemptRow>(
      `SELECT contact_id, attempts_total, attempts_today, attempts_this_week, last_attempt_at
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

    const rankedByPosition = new Map(
      selection.ranked.map((candidate) => [candidate.position, candidate]),
    );
    const suppressedByPosition = new Map(
      selection.suppressed.map((candidate) => [candidate.position, candidate]),
    );
    const contextByPosition = new Map<number, PredictiveDecisionContext>();
    for (const [position, target] of targets.entries()) {
      const context = buildDecisionContext({
        target,
        attempt: attemptsByContact.get(target.contactId),
        workspaceTimezone: timezone,
        evaluatedAt: now,
        preferLocalPresence,
        ranked: rankedByPosition.get(position),
        suppressed: suppressedByPosition.get(position),
      });
      if (context) contextByPosition.set(position, context);
    }

    const decisionId = randomUUID();
    const decision: PredictiveDecisionRecord = {
      decisionId,
      workspaceId,
      segmentId,
      evaluatedAt: now.toISOString(),
      policyVersion: D3_POLICY_VERSION,
      modelVersion: D3_MODEL_VERSION,
      featureSchemaVersion: D4_FEATURE_SCHEMA_VERSION,
      policyMode: 'deterministic',
      eligible: targets.map((target, position) => {
        const decisionContext = contextByPosition.get(position);
        return {
          contactId: target.contactId,
          position,
          ...(decisionContext
            ? {
                nextAttemptNumber: decisionContext.d3.nextAttemptNumber,
                decisionContext,
              }
            : {}),
        };
      }),
      ranked: selection.ranked.map((candidate) => ({
        contactId: candidate.contactId,
        position: candidate.position,
        nextAttemptNumber: candidate.nextAttemptNumber,
        score: candidate.score,
        answerProbability: candidate.answerProbability,
        answerProbabilityUpperBound: candidate.answerProbabilityUpperBound,
        hazardSource: candidate.hazardSource,
      })),
      suppressed: selection.suppressed.map((candidate) => ({
        contactId: candidate.contactId,
        position: candidate.position,
        nextAttemptNumber: candidate.nextAttemptNumber,
        reason: candidate.reason,
        answerProbability: candidate.answerProbability,
        answerProbabilityUpperBound: candidate.answerProbabilityUpperBound,
      })),
      selectionProbabilities: null,
    };

    let decisionLogPersisted = false;
    let decisionLogError: string | null = null;
    try {
      await recordPredictiveDecision(database, decision);
      decisionLogPersisted = true;
    } catch (cause: unknown) {
      decisionLogError = formatErrorChain(cause);
    }

    const rankedTargets: CallableTarget[] = [];
    for (const candidate of selection.ranked) {
      const target = targets[candidate.position];
      const decisionContext = contextByPosition.get(candidate.position);
      if (!target) continue;
      rankedTargets.push(
        decisionContext
          ? {
              ...target,
              predictiveDecisionId: decisionId,
              decisionContext,
            }
          : target,
      );
    }

    return {
      rankedTargets,
      decision,
      decisionLogPersisted,
      decisionLogError,
    };
  } catch (cause: unknown) {
    onFallback?.({
      workspaceId,
      error: formatErrorChain(cause),
    });
    const decision: PredictiveDecisionRecord = {
      decisionId: randomUUID(),
      workspaceId,
      segmentId,
      evaluatedAt: now.toISOString(),
      policyVersion: D3_POLICY_VERSION,
      modelVersion: D3_MODEL_VERSION,
      featureSchemaVersion: D4_FEATURE_SCHEMA_VERSION,
      policyMode: 'deterministic',
      eligible: targets.map((target, position) => ({
        contactId: target.contactId,
        position,
      })),
      ranked: [],
      suppressed: [],
      selectionProbabilities: null,
    };
    return {
      rankedTargets: targets,
      decision,
      decisionLogPersisted: false,
      decisionLogError: formatErrorChain(cause),
    };
  }
};

export const rankPredictiveTargets = (
  options: RankingOptions,
): Promise<CallableTarget[]> =>
  rankPredictiveTargetsWithDecision(options).then((result) => {
    const originalByContactId = new Map(
      options.targets.map((target) => [target.contactId, target]),
    );
    return result.rankedTargets.map(
      (target) => originalByContactId.get(target.contactId) ?? target,
    );
  });
