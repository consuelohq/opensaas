import {
  WhittleIndexService,
  type CallableTarget,
} from '@consuelo/dialer';
import type { LeadConnectorDatabase } from '@consuelo/lead-connector';

type AttemptRow = {
  contact_id: string;
  attempts_total: number | string;
  last_attempt_at: string | Date | null;
};

type HazardRow = {
  attempt_number: number | string;
  answer_rate: number | string;
  sample_size: number | string;
};

type EconomicsRow = {
  value_per_connection: number | string | null;
  cost_per_attempt: number | string | null;
};

type RankingFallbackLogger = (details: {
  workspaceId: string;
  error: string;
}) => void;

type RankingOptions = {
  database: LeadConnectorDatabase;
  workspaceId: string;
  targets: CallableTarget[];
  timezone: string;
  callableWindowEndHour: number;
  now?: Date;
  onFallback?: RankingFallbackLogger;
};

const DEFAULT_VALUE_PER_CONNECTION = 100;
const DEFAULT_COST_PER_ATTEMPT = 0.03;

const localTimeParts = (now: Date, timezone: string) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    hour: '2-digit',
    weekday: 'short',
  });
  const parts = formatter.formatToParts(now);
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? 'Sun';
  const dayOfWeek =
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  return {
    hour: Number(parts.find((part) => part.type === 'hour')?.value ?? '0'),
    dayOfWeek: Math.max(dayOfWeek, 0),
  };
};

const finiteNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const staleDecayFactor = (lastAttemptAt: string | Date | null, now: Date) => {
  if (!lastAttemptAt) return 1;
  const attemptedAt =
    lastAttemptAt instanceof Date ? lastAttemptAt : new Date(lastAttemptAt);
  if (Number.isNaN(attemptedAt.getTime())) return 1;
  const hoursSinceAttempt =
    (now.getTime() - attemptedAt.getTime()) / (60 * 60 * 1000);
  return hoursSinceAttempt > 48 ? 0.8 : 1;
};

export const rankPredictiveLeadConnectorTargets = async ({
  database,
  workspaceId,
  targets,
  timezone,
  callableWindowEndHour,
  now = new Date(),
  onFallback,
}: RankingOptions): Promise<CallableTarget[]> => {
  if (targets.length < 2) return targets;

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
    const nextAttempts = [
      ...new Set(
        targets.map((target) =>
          finiteNumber(attemptsByContact.get(target.contactId)?.attempts_total, 0) +
          1,
        ),
      ),
    ];
    const local = localTimeParts(now, timezone);
    const sharedHazardResult = await database
      .query<HazardRow>(
        `WITH candidate_hazards AS (
           SELECT
             attempt_number,
             answer_rate,
             sample_size,
             CASE
               WHEN hour_of_day = $3 AND day_of_week = $4 THEN 0
               ELSE 1
             END AS fallback_priority
           FROM core.contact_attempt_hazard_hourly_mv
           WHERE workspace_id::text = $1
             AND attempt_number = ANY($2::int[])
         ),
         selected_priority AS (
           SELECT attempt_number, MIN(fallback_priority) AS fallback_priority
           FROM candidate_hazards
           GROUP BY attempt_number
         )
         SELECT
           hazards.attempt_number,
           SUM(hazards.answer_rate * hazards.sample_size)
             / NULLIF(SUM(hazards.sample_size), 0) AS answer_rate,
           SUM(hazards.sample_size)::int AS sample_size
         FROM candidate_hazards hazards
         INNER JOIN selected_priority selected
           ON selected.attempt_number = hazards.attempt_number
          AND selected.fallback_priority = hazards.fallback_priority
         GROUP BY hazards.attempt_number`,
        [workspaceId, nextAttempts, local.hour, local.dayOfWeek],
      )
      .catch(() => ({ rows: [] as HazardRow[] }));
    const leadConnectorHazardResult = await database
      .query<HazardRow>(
        `WITH candidate_outcomes AS (
           SELECT
             attempt_number,
             outcome,
             CASE
               WHEN EXTRACT(
                 HOUR FROM attempted_at AT TIME ZONE $5
               )::int = $3
                AND EXTRACT(
                  DOW FROM attempted_at AT TIME ZONE $5
                )::int = $4
                 THEN 0
               ELSE 1
             END AS fallback_priority
           FROM consuelo_lead_connector_call_outcomes
           WHERE workspace_id = $1
             AND attempt_number = ANY($2::int[])
         ),
         selected_priority AS (
           SELECT attempt_number, MIN(fallback_priority) AS fallback_priority
           FROM candidate_outcomes
           GROUP BY attempt_number
         )
         SELECT
           outcomes.attempt_number,
           AVG(
             CASE WHEN outcomes.outcome = 'answered' THEN 1.0 ELSE 0.0 END
           )::float AS answer_rate,
           COUNT(*)::int AS sample_size
         FROM candidate_outcomes outcomes
         INNER JOIN selected_priority selected
           ON selected.attempt_number = outcomes.attempt_number
          AND selected.fallback_priority = outcomes.fallback_priority
         GROUP BY outcomes.attempt_number`,
        [workspaceId, nextAttempts, local.hour, local.dayOfWeek, timezone],
      )
      .catch(() => ({ rows: [] as HazardRow[] }));
    const aggregateByAttempt = new Map<
      number,
      { weightedAnswerRate: number; sampleSize: number }
    >();
    for (const row of [
      ...sharedHazardResult.rows,
      ...leadConnectorHazardResult.rows,
    ]) {
      const attemptNumber = Number(row.attempt_number);
      const sampleSize = Math.max(finiteNumber(row.sample_size, 0), 0);
      const current = aggregateByAttempt.get(attemptNumber) ?? {
        weightedAnswerRate: 0,
        sampleSize: 0,
      };
      current.weightedAnswerRate +=
        Math.max(finiteNumber(row.answer_rate, 0), 0) * sampleSize;
      current.sampleSize += sampleSize;
      aggregateByAttempt.set(attemptNumber, current);
    }
    const hazardsByAttempt = new Map<number, HazardRow>(
      [...aggregateByAttempt.entries()]
        .filter(([, aggregate]) => aggregate.sampleSize > 0)
        .map(([attemptNumber, aggregate]) => [
          attemptNumber,
          {
            attempt_number: attemptNumber,
            answer_rate:
              aggregate.weightedAnswerRate / aggregate.sampleSize,
            sample_size: aggregate.sampleSize,
          },
        ]),
    );

    // Missing learned data must retain the deterministic input order rather than
    // manufacturing an exploration score from an empty model.
    if (nextAttempts.some((attempt) => !hazardsByAttempt.has(attempt))) {
      return targets;
    }

    const economicsResult = await database.query<EconomicsRow>(
      `SELECT
         COALESCE(
           CASE
             WHEN (dialer_config->>'avgDealValue') ~ '^[0-9]+(\\.[0-9]+)?$'
              AND (dialer_config->>'avgCloseRate') ~ '^[0-9]+(\\.[0-9]+)?$'
             THEN (dialer_config->>'avgDealValue')::numeric
                * (dialer_config->>'avgCloseRate')::numeric
             ELSE NULL
           END,
           $2::numeric
         ) AS value_per_connection,
         COALESCE(
           CASE
             WHEN (dialer_config->>'costPerAttempt') ~ '^[0-9]+(\\.[0-9]+)?$'
             THEN (dialer_config->>'costPerAttempt')::numeric
             ELSE NULL
           END,
           $3::numeric
         ) AS cost_per_attempt
       FROM core.workspace_settings
       WHERE workspace_id::text = $1
       LIMIT 1`,
      [
        workspaceId,
        DEFAULT_VALUE_PER_CONNECTION,
        DEFAULT_COST_PER_ATTEMPT,
      ],
    ).catch(() => ({ rows: [] as EconomicsRow[] }));
    const economics = economicsResult.rows[0];
    const valuePerConnection = finiteNumber(
      economics?.value_per_connection,
      DEFAULT_VALUE_PER_CONNECTION,
    );
    const costPerAttempt = Math.max(
      finiteNumber(economics?.cost_per_attempt, DEFAULT_COST_PER_ATTEMPT),
      0,
    );
    const hoursRemainingInWindow = Math.max(
      callableWindowEndHour - local.hour,
      0,
    );
    const ranked = new WhittleIndexService().rankCandidates(
      targets.map((target, position) => {
        const attempt = attemptsByContact.get(target.contactId);
        const nextAttempt = finiteNumber(attempt?.attempts_total, 0) + 1;
        const hazard = hazardsByAttempt.get(nextAttempt)!;
        return {
          contactId: target.contactId,
          position,
          input: {
            answerRate:
              Math.max(finiteNumber(hazard.answer_rate, 0), 0) *
              staleDecayFactor(attempt?.last_attempt_at ?? null, now),
            valuePerConnection,
            costPerAttempt,
            hoursRemainingInWindow,
            segmentSampleSize: Math.max(
              finiteNumber(hazard.sample_size, 1),
              1,
            ),
          },
        };
      }),
    );
    const targetByContact = new Map(
      targets.map((target) => [target.contactId, target]),
    );
    return ranked
      .map((candidate) => targetByContact.get(candidate.contactId))
      .filter((target): target is CallableTarget => Boolean(target));
  } catch (cause: unknown) {
    onFallback?.({
      workspaceId,
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return targets;
  }
};
