import {
  RedisParallelStore,
  type CallableTarget,
  type ParallelTelemetryRecord,
  type RedisParallelClient,
} from '@consuelo/dialer';
import type { LeadConnectorDatabase } from '@consuelo/lead-connector';

import { createPostgresPredictiveModelStore } from '../learning/postgres-predictive-model-store';
import { recordLeadConnectorAttemptTelemetry } from '../runtime/lead-connector-learning';
import { rankPredictiveTargets } from '../runtime/predictive-target-ranking';

export type LabScaleName = 'smoke' | 'standard' | 'large';

export type LabScale = {
  contactCount: number;
  attemptsPerContact: number;
  ingestOperations: number;
  rankingCandidateCounts: number[];
  rankingIterations: number;
  redisOperations: number;
};

const LAB_SCALES: Record<LabScaleName, LabScale> = {
  smoke: {
    contactCount: 250,
    attemptsPerContact: 4,
    ingestOperations: 50,
    rankingCandidateCounts: [25, 100, 250],
    rankingIterations: 3,
    redisOperations: 50,
  },
  standard: {
    contactCount: 5_000,
    attemptsPerContact: 4,
    ingestOperations: 500,
    rankingCandidateCounts: [100, 1_000, 5_000],
    rankingIterations: 5,
    redisOperations: 500,
  },
  large: {
    contactCount: 25_000,
    attemptsPerContact: 4,
    ingestOperations: 2_000,
    rankingCandidateCounts: [1_000, 10_000, 25_000],
    rankingIterations: 5,
    redisOperations: 2_000,
  },
};

export const resolveLabScale = (name: LabScaleName): LabScale => ({
  ...LAB_SCALES[name],
  rankingCandidateCounts: [...LAB_SCALES[name].rankingCandidateCounts],
});

export type SyntheticDialerContact = {
  contactId: string;
  attemptsTotal: number;
  lastAttemptAt: string | null;
};

export type SyntheticDialerOutcome = {
  contactId: string;
  attemptedAt: string;
  attemptNumber: number;
  outcome: 'answered' | 'busy' | 'no-answer' | 'voicemail';
};

export type SyntheticDialerFixture = {
  seed: number;
  baseTime: string;
  contacts: SyntheticDialerContact[];
  outcomes: SyntheticDialerOutcome[];
  workspaceSettings: {
    avgDealValue: number;
    avgCloseRate: number;
    costPerAttempt: number;
  };
};

type SyntheticFixtureOptions = {
  seed: number;
  contactCount: number;
  attemptsPerContact: number;
  baseTime: Date;
};

const createRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
};

const answerProbability = (attemptNumber: number, hourOfDay: number) => {
  const attemptBase = [0, 0.42, 0.31, 0.22, 0.15][attemptNumber] ?? 0.1;
  const peakBonus =
    (hourOfDay >= 10 && hourOfDay <= 12) ||
    (hourOfDay >= 15 && hourOfDay <= 17)
      ? 0.1
      : 0;
  return Math.min(attemptBase + peakBonus, 0.9);
};

export const createSyntheticDialerFixture = ({
  seed,
  contactCount,
  attemptsPerContact,
  baseTime,
}: SyntheticFixtureOptions): SyntheticDialerFixture => {
  if (!Number.isInteger(contactCount) || contactCount < 1) {
    throw new Error('contactCount must be a positive integer');
  }
  if (!Number.isInteger(attemptsPerContact) || attemptsPerContact < 1) {
    throw new Error('attemptsPerContact must be a positive integer');
  }

  const random = createRandom(seed);
  const contacts: SyntheticDialerContact[] = [];
  const outcomes: SyntheticDialerOutcome[] = [];
  const baseDay = Date.UTC(
    baseTime.getUTCFullYear(),
    baseTime.getUTCMonth(),
    baseTime.getUTCDate(),
  );

  for (let index = 0; index < contactCount; index += 1) {
    const attemptsTotal = index % attemptsPerContact;
    const lastAttemptAt =
      attemptsTotal === 0
        ? null
        : new Date(
            baseTime.getTime() -
              (1 + Math.floor(random() * 96)) * 60 * 60 * 1_000,
          ).toISOString();
    contacts.push({
      contactId: `lab-contact-${String(index).padStart(8, '0')}`,
      attemptsTotal,
      lastAttemptAt,
    });

    const slot = index % (7 * 24);
    const daysAgo = Math.floor(slot / 24);
    const hourOfDay = slot % 24;
    for (let attemptNumber = 1; attemptNumber <= attemptsPerContact; attemptNumber += 1) {
      const attemptedAt = new Date(
        baseDay -
          daysAgo * 24 * 60 * 60 * 1_000 +
          hourOfDay * 60 * 60 * 1_000 +
          (attemptNumber - 1) * 60 * 1_000,
      ).toISOString();
      const roll = random();
      const probability = answerProbability(attemptNumber, hourOfDay);
      const nonAnswerOutcomes = ['no-answer', 'busy', 'voicemail'] as const;
      outcomes.push({
        contactId: `lab-history-${String(index).padStart(8, '0')}`,
        attemptedAt,
        attemptNumber,
        outcome:
          roll < probability
            ? 'answered'
            : nonAnswerOutcomes[Math.floor(random() * nonAnswerOutcomes.length)],
      });
    }
  }

  return {
    seed,
    baseTime: baseTime.toISOString(),
    contacts,
    outcomes,
    workspaceSettings: {
      avgDealValue: 2_500,
      avgCloseRate: 0.08,
      costPerAttempt: 0.03,
    },
  };
};

export type SampleSummary = {
  samples: number;
  minMs: number;
  medianMs: number;
  p95Ms: number;
  maxMs: number;
};

const roundedMilliseconds = (value: number) => Math.round(value * 1_000) / 1_000;

export const summarizeSamples = (samples: number[]): SampleSummary => {
  if (samples.length === 0) {
    return { samples: 0, minMs: 0, medianMs: 0, p95Ms: 0, maxMs: 0 };
  }
  const sorted = [...samples].sort((left, right) => left - right);
  const percentile = (fraction: number) =>
    sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
  return {
    samples: sorted.length,
    minMs: roundedMilliseconds(sorted[0]),
    medianMs: roundedMilliseconds(percentile(0.5)),
    p95Ms: roundedMilliseconds(percentile(0.95)),
    maxMs: roundedMilliseconds(sorted[sorted.length - 1]),
  };
};

const chunked = <T>(values: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let offset = 0; offset < values.length; offset += size) {
    chunks.push(values.slice(offset, offset + size));
  }
  return chunks;
};

const labFailure = (operation: string, cause: unknown) =>
  new Error(`Local dialer lab ${operation} failed`, { cause });

export const seedSyntheticDialerFixture = async (
  database: LeadConnectorDatabase,
  workspaceId: string,
  fixture: SyntheticDialerFixture,
): Promise<void> => {
  try {
    await database.query(
      'DELETE FROM dialer_learning_observations WHERE workspace_id = $1',
      [workspaceId],
    );
    await database.query(
      'DELETE FROM consuelo_lead_connector_call_outcomes WHERE workspace_id = $1',
      [workspaceId],
    );
    await database.query(
      'DELETE FROM contact_attempt_ledger WHERE workspace_id = $1',
      [workspaceId],
    );
    await database.query(
      'DELETE FROM dialer_workspace_settings WHERE workspace_id = $1',
      [workspaceId],
    );

    await database.query(
      `INSERT INTO dialer_workspace_settings (
         workspace_id, avg_deal_value, avg_close_rate, cost_per_attempt
       ) VALUES ($1, $2, $3, $4)`,
      [
        workspaceId,
        fixture.workspaceSettings.avgDealValue,
        fixture.workspaceSettings.avgCloseRate,
        fixture.workspaceSettings.costPerAttempt,
      ],
    );

    for (const contacts of chunked(fixture.contacts, 5_000)) {
      await database.query(
        `INSERT INTO contact_attempt_ledger (
           workspace_id, contact_id, last_attempt_at, attempts_total,
           attempts_today, attempts_this_week, outcomes, day_window_start,
           week_window_start, updated_at
         )
         SELECT
           $1, rows.contact_id, rows.last_attempt_at, rows.attempts_total,
           0, rows.attempts_total, '[]'::jsonb,
           date_trunc('day', $2::timestamptz),
           date_trunc('week', $2::timestamptz), NOW()
         FROM UNNEST($3::text[], $4::int[], $5::timestamptz[])
           AS rows(contact_id, attempts_total, last_attempt_at)`,
        [
          workspaceId,
          fixture.baseTime,
          contacts.map((contact) => contact.contactId),
          contacts.map((contact) => contact.attemptsTotal),
          contacts.map((contact) => contact.lastAttemptAt),
        ],
      );
    }

    for (const outcomes of chunked(fixture.outcomes, 5_000)) {
      await database.query(
        `INSERT INTO consuelo_lead_connector_call_outcomes (
           workspace_id, contact_id, attempted_at, attempt_number, outcome
         )
         SELECT $1, rows.contact_id, rows.attempted_at, rows.attempt_number, rows.outcome
         FROM UNNEST($2::text[], $3::timestamptz[], $4::int[], $5::text[])
           AS rows(contact_id, attempted_at, attempt_number, outcome)`,
        [
          workspaceId,
          outcomes.map((outcome) => outcome.contactId),
          outcomes.map((outcome) => outcome.attemptedAt),
          outcomes.map((outcome) => outcome.attemptNumber),
          outcomes.map((outcome) => outcome.outcome),
        ],
      );

      const responseAt = outcomes.map((outcome) =>
        outcome.outcome === 'answered'
          ? new Date(
              new Date(outcome.attemptedAt).getTime() + 30 * 1_000,
            ).toISOString()
          : null,
      );
      const observedUntilAt = outcomes.map((outcome, index) =>
        responseAt[index] ??
        new Date(
          new Date(outcome.attemptedAt).getTime() + 60 * 1_000,
        ).toISOString(),
      );
      await database.query(
        `INSERT INTO dialer_learning_observations (
           workspace_id, group_id, position, segment_id, contact_id,
           attempted_at, response_at, observed_until_at, local_hour,
           local_day_of_week, outcome_class, censor_reason
         )
         SELECT
           $1, rows.group_id, 1, 'lab-segment', rows.contact_id,
           rows.attempted_at, rows.response_at, rows.observed_until_at,
           rows.local_hour, rows.local_day_of_week, rows.outcome_class, NULL
         FROM UNNEST(
           $2::text[], $3::text[], $4::timestamptz[], $5::timestamptz[],
           $6::timestamptz[], $7::int[], $8::int[], $9::text[]
         ) AS rows(
           group_id, contact_id, attempted_at, response_at,
           observed_until_at, local_hour, local_day_of_week, outcome_class
         )`,
        [
          workspaceId,
          outcomes.map(
            (outcome) =>
              `lab-fixture-${outcome.contactId}-${String(outcome.attemptNumber).padStart(2, '0')}`,
          ),
          outcomes.map((outcome) => outcome.contactId),
          outcomes.map((outcome) => outcome.attemptedAt),
          responseAt,
          observedUntilAt,
          outcomes.map((outcome) => new Date(outcome.attemptedAt).getUTCHours()),
          outcomes.map((outcome) => new Date(outcome.attemptedAt).getUTCDay()),
          outcomes.map((outcome) =>
            outcome.outcome === 'answered' ? 'response' : 'non_response',
          ),
        ],
      );
    }
  } catch (cause: unknown) {
    throw labFailure('fixture seeding', cause);
  }
};

const elapsedMilliseconds = <T>(operation: () => Promise<T>) => {
  const startedAt = performance.now();
  return operation().then((value) => ({
    value,
    durationMs: performance.now() - startedAt,
  }));
};

const syntheticPhone = (index: number) =>
  `+1555${String(index).padStart(7, '0')}`;

const benchmarkRanking = async (
  database: LeadConnectorDatabase,
  workspaceId: string,
  fixture: SyntheticDialerFixture,
  scale: LabScale,
) => {
  try {
    const results: Record<string, SampleSummary> = {};
    for (const candidateCount of scale.rankingCandidateCounts) {
      const targets: CallableTarget[] = fixture.contacts
        .slice(0, candidateCount)
        .map((contact, index) => ({
          contactId: contact.contactId,
          phone: syntheticPhone(index),
        }));
      const samples: number[] = [];
      for (
        let iteration = 0;
        iteration < scale.rankingIterations;
        iteration += 1
      ) {
        const measurement = await elapsedMilliseconds(() =>
          rankPredictiveTargets({
            database,
            workspaceId,
            segmentId: 'lab-segment',
            targets,
            timezone: 'UTC',
            callableWindowEndHour: 20,
            now: new Date(fixture.baseTime),
          }),
        );
        if (measurement.value.length !== targets.length) {
          throw new Error(
            `Ranking returned ${measurement.value.length} targets for ${targets.length} candidates`,
          );
        }
        samples.push(measurement.durationMs);
      }
      results[String(candidateCount)] = summarizeSamples(samples);
    }
    return results;
  } catch (cause: unknown) {
    throw labFailure('predictive ranking benchmark', cause);
  }
};

const benchmarkAggregation = async (
  database: LeadConnectorDatabase,
  workspaceId: string,
  iterations: number,
) => {
  try {
    const store = createPostgresPredictiveModelStore(database);
    const samples: number[] = [];
    let groupCount = 0;
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const measurement = await elapsedMilliseconds(() =>
        store.getHazardEstimates({
          workspaceId,
          segmentId: 'lab-segment',
          attemptNumbers: [1, 2, 3, 4],
        }),
      );
      groupCount = measurement.value.length;
      samples.push(measurement.durationMs);
    }
    return { groups: groupCount, latency: summarizeSamples(samples) };
  } catch (cause: unknown) {
    throw labFailure('hazard aggregation benchmark', cause);
  }
};

const createIngestRecord = (
  workspaceId: string,
  index: number,
  attemptedAt: string,
): ParallelTelemetryRecord => {
  const callSid = `lab-call-${index}`;
  const answered = index % 4 === 0;
  return {
    group: {
      groupId: `lab-ingest-group-${index}`,
      conferenceName: `lab-conference-${index}`,
      status: 'completed',
      winnerSid: answered ? callSid : null,
      calls: [
        {
          callSid,
          customerNumber: syntheticPhone(index),
          fromNumber: '+15559999999',
          position: 1,
          status: answered ? 'completed' : 'no-answer',
          amdResult: answered ? 'human' : 'unknown',
          contactId: `lab-ingest-contact-${String(index).padStart(8, '0')}`,
          dialStartedAt: attemptedAt,
          answeredAt: answered
            ? new Date(new Date(attemptedAt).getTime() + 800).toISOString()
            : undefined,
        },
      ],
      workspaceId,
      queueId: 'lab-queue',
      userId: 'lab-user',
      createdAt: attemptedAt,
      profile: {
        id: 'balanced',
        fanout: 1,
        staggerMs: 0,
        amdPolicy: 'human-or-unknown',
        terminationPolicy: 'winner-take-all',
      },
      resolverReason: 'local-lab',
      cleanupFailures: [],
      completedAt: attemptedAt,
    },
    telemetry: {
      winnerRate: answered ? 1 : 0,
      wastedLegs: answered ? 0 : 1,
      connectLatencyMs: answered ? 800 : null,
    },
    success: answered,
  };
};

export type PredictiveScienceValidation = {
  observedAttemptNumbers: number[];
  observedProbabilities: number[];
  censoredAttemptExcludedFromDenominator: boolean;
  idempotency: {
    canonicalRows: number;
    ledgerAttempts: number;
    compatibilityOutcomeRows: number;
  };
};

export const validatePredictiveLearningScience = async (
  database: LeadConnectorDatabase,
  workspaceId: string,
  baseTime: string,
): Promise<PredictiveScienceValidation> => {
  try {
    await database.query(
      'DELETE FROM dialer_learning_observations WHERE workspace_id = $1',
      [workspaceId],
    );
    await database.query(
      'DELETE FROM consuelo_lead_connector_call_outcomes WHERE workspace_id = $1',
      [workspaceId],
    );
    await database.query(
      'DELETE FROM contact_attempt_ledger WHERE workspace_id = $1',
      [workspaceId],
    );
    await database.query(
      'DELETE FROM dialer_workspace_settings WHERE workspace_id = $1',
      [workspaceId],
    );
    await database.query(
      `INSERT INTO dialer_workspace_settings (
         workspace_id, avg_deal_value, avg_close_rate, cost_per_attempt
       ) VALUES ($1, 2500, 0.08, 0.03)`,
      [workspaceId],
    );

    const base = new Date(baseTime).getTime();
    const chronologicalRows = [
      {
        groupId: 'science-group-3',
        attemptedAt: new Date(base + 2 * 60 * 60 * 1_000),
        outcomeClass: 'non_response',
        censorReason: null,
      },
      {
        groupId: 'science-group-1',
        attemptedAt: new Date(base),
        outcomeClass: 'response',
        censorReason: null,
      },
      {
        groupId: 'science-group-2',
        attemptedAt: new Date(base + 60 * 60 * 1_000),
        outcomeClass: 'censored',
        censorReason: 'competing_winner',
      },
    ] as const;

    for (const row of chronologicalRows) {
      const responseAt =
        row.outcomeClass === 'response'
          ? new Date(row.attemptedAt.getTime() + 60 * 1_000)
          : null;
      await database.query(
        `INSERT INTO dialer_learning_observations (
           workspace_id, group_id, position, segment_id, contact_id,
           attempted_at, response_at, observed_until_at, local_hour,
           local_day_of_week, outcome_class, censor_reason
         ) VALUES ($1, $2, 1, 'science-segment', 'science-contact',
                   $3::timestamptz, $4::timestamptz, $5::timestamptz,
                   $6, $7, $8, $9)`,
        [
          workspaceId,
          row.groupId,
          row.attemptedAt.toISOString(),
          responseAt?.toISOString() ?? null,
          new Date(row.attemptedAt.getTime() + 90 * 1_000).toISOString(),
          row.attemptedAt.getUTCHours(),
          row.attemptedAt.getUTCDay(),
          row.outcomeClass,
          row.censorReason,
        ],
      );
    }

    const store = createPostgresPredictiveModelStore(database);
    const estimates = await store.getAnswerProbabilities({
      workspaceId,
      segmentId: 'science-segment',
    });

    const idempotentRecord = createIngestRecord(workspaceId, 1_000, baseTime);
    await recordLeadConnectorAttemptTelemetry(
      database,
      idempotentRecord,
      undefined,
      { timezone: 'UTC' },
    );
    await recordLeadConnectorAttemptTelemetry(
      database,
      idempotentRecord,
      undefined,
      { timezone: 'UTC' },
    );
    const idempotency = await database.query<{
      canonical_rows: number;
      ledger_attempts: number;
      compatibility_outcome_rows: number;
    }>(
      `SELECT
         (SELECT COUNT(*)::int
            FROM dialer_learning_observations
           WHERE workspace_id = $1 AND contact_id = $2) AS canonical_rows,
         COALESCE((SELECT attempts_total
            FROM contact_attempt_ledger
           WHERE workspace_id = $1 AND contact_id = $2), 0)::int AS ledger_attempts,
         (SELECT COUNT(*)::int
            FROM consuelo_lead_connector_call_outcomes
           WHERE workspace_id = $1 AND contact_id = $2) AS compatibility_outcome_rows`,
      [workspaceId, idempotentRecord.group.calls[0]?.contactId ?? ''],
    );
    const idempotencyRow = idempotency.rows[0];

    return {
      observedAttemptNumbers: estimates.map((estimate) => estimate.attemptNumber),
      observedProbabilities: estimates.map((estimate) => estimate.probability),
      censoredAttemptExcludedFromDenominator:
        estimates.every((estimate) => estimate.attemptNumber !== 2),
      idempotency: {
        canonicalRows: idempotencyRow?.canonical_rows ?? 0,
        ledgerAttempts: idempotencyRow?.ledger_attempts ?? 0,
        compatibilityOutcomeRows:
          idempotencyRow?.compatibility_outcome_rows ?? 0,
      },
    };
  } catch (cause: unknown) {
    throw labFailure('predictive science validation', cause);
  }
};

export type CanonicalRuntimeCutoverValidation = {
  canonicalTopContactId: string | null;
  canonicalPreferredAttempt: number;
  compatibilityPreferredAttempt: number;
  compatibilityConflictIgnored: boolean;
  legacyBaselineAttemptNumbers: number[];
};

export const validateCanonicalRuntimeCutover = async (
  database: LeadConnectorDatabase,
  workspaceId: string,
  baseTime: string,
): Promise<CanonicalRuntimeCutoverValidation> => {
  try {
    await database.query(
      'DELETE FROM dialer_learning_observations WHERE workspace_id = $1',
      [workspaceId],
    );
    await database.query(
      'DELETE FROM consuelo_lead_connector_call_outcomes WHERE workspace_id = $1',
      [workspaceId],
    );
    await database.query(
      'DELETE FROM contact_attempt_ledger WHERE workspace_id = $1',
      [workspaceId],
    );
    await database.query(
      'DELETE FROM dialer_workspace_settings WHERE workspace_id = $1',
      [workspaceId],
    );
    await database.query(
      `INSERT INTO dialer_workspace_settings (
         workspace_id, avg_deal_value, avg_close_rate, cost_per_attempt
       ) VALUES ($1, 100, 1, 0.03)`,
      [workspaceId],
    );
    await database.query(
      `INSERT INTO contact_attempt_ledger (
         workspace_id, contact_id, attempts_total, last_attempt_at
       ) VALUES
         ($1, 'cutover-canonical-first', 0, NULL),
         ($1, 'cutover-canonical-winner', 1, $2::timestamptz),
         ($1, 'cutover-legacy-offset', 4, $2::timestamptz)`,
      [workspaceId, baseTime],
    );

    await database.query(
      `INSERT INTO dialer_learning_observations (
         workspace_id, group_id, position, segment_id, contact_id,
         attempted_at, response_at, observed_until_at, local_hour,
         local_day_of_week, outcome_class, censor_reason
       ) VALUES
         ($1, 'cutover-offset-1', 1, 'legacy-offset-segment', 'cutover-legacy-offset',
          $2::timestamptz + interval '2 hours', NULL,
          $2::timestamptz + interval '2 hours 90 seconds', 14, 1,
          'non_response', NULL),
         ($1, 'cutover-offset-2', 1, 'legacy-offset-segment', 'cutover-legacy-offset',
          $2::timestamptz + interval '3 hours',
          $2::timestamptz + interval '3 hours 30 seconds',
          $2::timestamptz + interval '3 hours 90 seconds', 15, 1,
          'response', NULL)`,
      [workspaceId, baseTime],
    );

    await database.query(
      `INSERT INTO dialer_learning_observations (
         workspace_id, group_id, position, segment_id, contact_id,
         attempted_at, response_at, observed_until_at, local_hour,
         local_day_of_week, outcome_class, censor_reason
       )
       SELECT
         $1,
         'cutover-canonical-a1-' || series::text,
         1,
         'runtime-cutover-segment',
         'cutover-history-' || series::text,
         $2::timestamptz + series * interval '1 second',
         CASE WHEN series <= 2
           THEN $2::timestamptz + series * interval '1 second' + interval '30 seconds'
           ELSE NULL
         END,
         $2::timestamptz + series * interval '1 second' + interval '90 seconds',
         12,
         1,
         CASE WHEN series <= 2 THEN 'response' ELSE 'non_response' END,
         NULL
       FROM generate_series(1, 20) AS series`,
      [workspaceId, baseTime],
    );
    await database.query(
      `INSERT INTO dialer_learning_observations (
         workspace_id, group_id, position, segment_id, contact_id,
         attempted_at, response_at, observed_until_at, local_hour,
         local_day_of_week, outcome_class, censor_reason
       )
       SELECT
         $1,
         'cutover-canonical-a2-' || series::text,
         1,
         'runtime-cutover-segment',
         'cutover-history-' || series::text,
         $2::timestamptz + interval '1 hour' + series * interval '1 second',
         CASE WHEN series <= 16
           THEN $2::timestamptz + interval '1 hour' + series * interval '1 second' + interval '30 seconds'
           ELSE NULL
         END,
         $2::timestamptz + interval '1 hour' + series * interval '1 second' + interval '90 seconds',
         13,
         1,
         CASE WHEN series <= 16 THEN 'response' ELSE 'non_response' END,
         NULL
       FROM generate_series(1, 20) AS series`,
      [workspaceId, baseTime],
    );

    await database.query(
      `INSERT INTO consuelo_lead_connector_call_outcomes (
         workspace_id, contact_id, attempted_at, attempt_number, outcome
       )
       SELECT
         $1,
         'cutover-compat-a1-' || series::text,
         $2::timestamptz + series * interval '1 second',
         1,
         CASE WHEN series <= 18 THEN 'answered' ELSE 'no-answer' END
       FROM generate_series(1, 20) AS series`,
      [workspaceId, baseTime],
    );
    await database.query(
      `INSERT INTO consuelo_lead_connector_call_outcomes (
         workspace_id, contact_id, attempted_at, attempt_number, outcome
       )
       SELECT
         $1,
         'cutover-compat-a2-' || series::text,
         $2::timestamptz + interval '1 hour' + series * interval '1 second',
         2,
         CASE WHEN series <= 2 THEN 'answered' ELSE 'no-answer' END
       FROM generate_series(1, 20) AS series`,
      [workspaceId, baseTime],
    );

    const store = createPostgresPredictiveModelStore(database);
    const canonicalEstimates = await store.getAnswerProbabilities({
      workspaceId,
      segmentId: 'runtime-cutover-segment',
    });
    const legacyBaselineEstimates = await store.getAnswerProbabilities({
      workspaceId,
      segmentId: 'legacy-offset-segment',
    });
    const canonicalPreferredAttempt = [...canonicalEstimates].sort(
      (left, right) => right.probability - left.probability,
    )[0]?.attemptNumber ?? 0;
    const compatibility = await database.query<{
      attempt_number: number;
      answer_rate: number | string;
    }>(
      `SELECT
         attempt_number,
         AVG(CASE WHEN outcome = 'answered' THEN 1.0 ELSE 0.0 END)::float AS answer_rate
       FROM consuelo_lead_connector_call_outcomes
       WHERE workspace_id = $1
       GROUP BY attempt_number
       ORDER BY answer_rate DESC, attempt_number ASC
       LIMIT 1`,
      [workspaceId],
    );
    const compatibilityPreferredAttempt = Number(
      compatibility.rows[0]?.attempt_number ?? 0,
    );
    const ranked = await rankPredictiveTargets({
      database,
      workspaceId,
      segmentId: 'runtime-cutover-segment',
      targets: [
        { contactId: 'cutover-canonical-first', phone: '+15550110001' },
        { contactId: 'cutover-canonical-winner', phone: '+15550110002' },
      ],
      timezone: 'UTC',
      callableWindowEndHour: 20,
      now: new Date(baseTime),
    });
    const canonicalTopContactId = ranked[0]?.contactId ?? null;

    return {
      canonicalTopContactId,
      canonicalPreferredAttempt,
      compatibilityPreferredAttempt,
      compatibilityConflictIgnored:
        canonicalPreferredAttempt === 2 &&
        compatibilityPreferredAttempt === 1 &&
        canonicalTopContactId === 'cutover-canonical-winner',
      legacyBaselineAttemptNumbers: legacyBaselineEstimates.map(
        (estimate) => estimate.attemptNumber,
      ),
    };
  } catch (cause: unknown) {
    throw labFailure('canonical runtime cutover validation', cause);
  }
};

const persistIngestRecords = (
  database: LeadConnectorDatabase,
  records: ParallelTelemetryRecord[],
): Promise<void> =>
  chunked(records, 25).reduce<Promise<void>>(
    (operation, batch) =>
      operation.then(() =>
        Promise.all(
          batch.map((record) =>
            recordLeadConnectorAttemptTelemetry(database, record),
          ),
        ).then((stored) => {
          if (stored.some((value) => !value)) {
            throw new Error('Synthetic attempt telemetry failed to persist');
          }
        }),
      ),
    Promise.resolve(),
  );

const benchmarkIngestion = async (
  database: LeadConnectorDatabase,
  workspaceId: string,
  fixture: SyntheticDialerFixture,
  operations: number,
) => {
  try {
    const records = Array.from({ length: operations }, (_, index) =>
      createIngestRecord(workspaceId, index, fixture.baseTime),
    );
    const measurement = await elapsedMilliseconds(() =>
      persistIngestRecords(database, records),
    );
    return {
      operations,
      durationMs: roundedMilliseconds(measurement.durationMs),
      operationsPerSecond: roundedMilliseconds(
        operations / Math.max(measurement.durationMs / 1_000, Number.EPSILON),
      ),
    };
  } catch (cause: unknown) {
    throw labFailure('attempt ingestion benchmark', cause);
  }
};

const benchmarkRedis = async (
  redis: RedisParallelClient,
  workspaceId: string,
  operations: number,
) => {
  try {
    const store = new RedisParallelStore(redis, {
      keyPrefix: `consuelo:lab:${workspaceId}`,
      lockTtlMs: 5_000,
      lockRetryMs: 2,
      lockTimeoutMs: 1_000,
    });
    const samples: number[] = [];
    for (let index = 0; index < operations; index += 1) {
      const groupId = `coordination-${index}`;
      const measurement = await elapsedMilliseconds(() =>
        store.withGroupLock(groupId, () => Promise.resolve(index)),
      );
      samples.push(measurement.durationMs);
    }
    return summarizeSamples(samples);
  } catch (cause: unknown) {
    throw labFailure('Redis coordination benchmark', cause);
  }
};

export type LocalDialerBenchmarkResult = {
  dataset: {
    contacts: number;
    outcomes: number;
    seed: number;
  };
  ranking: Record<string, SampleSummary>;
  aggregation: Awaited<ReturnType<typeof benchmarkAggregation>>;
  ingestion: Awaited<ReturnType<typeof benchmarkIngestion>>;
  scientificValidation: PredictiveScienceValidation;
  runtimeCutover: CanonicalRuntimeCutoverValidation;
  redisCoordination: SampleSummary;
};

export const runLocalDialerBenchmarks = async (options: {
  database: LeadConnectorDatabase;
  redis: RedisParallelClient;
  workspaceId: string;
  fixture: SyntheticDialerFixture;
  scale: LabScale;
}): Promise<LocalDialerBenchmarkResult> => {
  try {
    await seedSyntheticDialerFixture(
      options.database,
      options.workspaceId,
      options.fixture,
    );
    return {
      dataset: {
        contacts: options.fixture.contacts.length,
        outcomes: options.fixture.outcomes.length,
        seed: options.fixture.seed,
      },
      ranking: await benchmarkRanking(
        options.database,
        options.workspaceId,
        options.fixture,
        options.scale,
      ),
      aggregation: await benchmarkAggregation(
        options.database,
        options.workspaceId,
        options.scale.rankingIterations,
      ),
      ingestion: await benchmarkIngestion(
        options.database,
        `${options.workspaceId}-ingest`,
        options.fixture,
        options.scale.ingestOperations,
      ),
      scientificValidation: await validatePredictiveLearningScience(
        options.database,
        `${options.workspaceId}-science`,
        options.fixture.baseTime,
      ),
      runtimeCutover: await validateCanonicalRuntimeCutover(
        options.database,
        `${options.workspaceId}-cutover`,
        options.fixture.baseTime,
      ),
      redisCoordination: await benchmarkRedis(
        options.redis,
        options.workspaceId,
        options.scale.redisOperations,
      ),
    };
  } catch (cause: unknown) {
    throw labFailure('benchmark suite', cause);
  }
};
