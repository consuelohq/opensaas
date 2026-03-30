type DatabaseClient = {
  query<TRecord extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: TRecord[] }>;
};

const SQL_SELECT_NEXT_ELIGIBLE_QUEUE_ITEM = `
WITH queue_config AS (
  SELECT
    cq.id AS queue_id,
    cq.settings,
    CASE
      WHEN (cq.settings->>'maxAttempts') ~ '^[0-9]+$' THEN (cq.settings->>'maxAttempts')::INT
      ELSE 3
    END AS max_attempts,
    CASE
      WHEN (cq.settings->>'cooldownMinutes') ~ '^[0-9]+$' THEN (cq.settings->>'cooldownMinutes')::INT
      ELSE 30
    END AS cooldown_minutes,
    CASE
      WHEN (cq.settings->>'callingStartHour') ~ '^[0-9]+$' THEN (cq.settings->>'callingStartHour')::INT
      ELSE 9
    END AS calling_start_hour,
    CASE
      WHEN (cq.settings->>'callingEndHour') ~ '^[0-9]+$' THEN (cq.settings->>'callingEndHour')::INT
      ELSE 20
    END AS calling_end_hour,
    CASE
      WHEN (cq.settings->>'doNotCallStartHour') ~ '^[0-9]+$' THEN (cq.settings->>'doNotCallStartHour')::INT
      ELSE 21
    END AS dnc_start_hour,
    CASE
      WHEN (cq.settings->>'doNotCallEndHour') ~ '^[0-9]+$' THEN (cq.settings->>'doNotCallEndHour')::INT
      ELSE 8
    END AS dnc_end_hour,
    CASE
      WHEN (cq.settings->>'preferredCallHour') ~ '^[0-9]+$' THEN (cq.settings->>'preferredCallHour')::INT
      ELSE 16
    END AS preferred_call_hour,
    COALESCE(NULLIF(cq.settings->>'defaultTimezone', ''), 'UTC') AS default_timezone,
    CASE
      WHEN (cq.settings->>'campaignPriority') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (cq.settings->>'campaignPriority')::NUMERIC
      ELSE 0
    END AS campaign_priority
  FROM call_queues cq
  WHERE cq.id = $1
),
eligible_items AS (
  SELECT
    qi.id,
    qi.queue_id,
    qi.contact_id,
    qi.position,
    qi.status,
    qi.attempts,
    qi.last_attempt_at,
    qi.call_outcome,
    qi.call_duration_seconds,
    qi.skip_reason,
    qi.notes,
    qi.created_at,
    qc.max_attempts,
    qc.cooldown_minutes,
    qc.calling_start_hour,
    qc.calling_end_hour,
    qc.preferred_call_hour,
    qc.campaign_priority,
    COALESCE(c.dnc_status, 'allowed') AS dnc_status,
    EXTRACT(
      HOUR FROM NOW() AT TIME ZONE qc.default_timezone
    )::INT AS local_hour,
    COALESCE(
      CASE
        WHEN (qc.settings->'leadScores'->>qi.contact_id) ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (qc.settings->'leadScores'->>qi.contact_id)::NUMERIC
        ELSE NULL
      END,
      0
    ) AS lead_score
  FROM queue_items qi
  INNER JOIN queue_config qc ON qc.queue_id = qi.queue_id
  LEFT JOIN contacts c ON c.id::TEXT = qi.contact_id
  WHERE qi.queue_id = $1
    AND qi.status = 'pending'
    AND COALESCE(c.dnc_status, 'allowed') NOT IN ('blocked', 'do_not_call', 'dnc')
    AND qi.attempts < qc.max_attempts
    AND (
      qi.last_attempt_at IS NULL OR
      qi.last_attempt_at <= NOW() - make_interval(mins => qc.cooldown_minutes)
    )
    AND EXTRACT(HOUR FROM NOW() AT TIME ZONE qc.default_timezone)::INT >= qc.calling_start_hour
    AND EXTRACT(HOUR FROM NOW() AT TIME ZONE qc.default_timezone)::INT < qc.calling_end_hour
    AND (
      qc.dnc_start_hour = qc.dnc_end_hour OR
      EXTRACT(HOUR FROM NOW() AT TIME ZONE qc.default_timezone)::INT NOT IN (
        SELECT hour_value
        FROM generate_series(qc.dnc_start_hour, qc.dnc_end_hour) AS hour_value
      )
    )
  FOR UPDATE OF qi SKIP LOCKED
),
ranked_items AS (
  SELECT
    eligible_items.*,
    (
      (GREATEST(0, 100 - (eligible_items.attempts * 25))) +
      (LEAST(120, COALESCE(EXTRACT(EPOCH FROM (NOW() - eligible_items.last_attempt_at)) / 60, 120))) +
      (eligible_items.lead_score * 10) +
      (24 - ABS(eligible_items.local_hour - eligible_items.preferred_call_hour)) +
      (eligible_items.campaign_priority * 15)
    ) AS ranking_score
  FROM eligible_items
)
SELECT
  id,
  queue_id,
  contact_id,
  position,
  status,
  attempts,
  last_attempt_at,
  call_outcome,
  call_duration_seconds,
  skip_reason,
  notes,
  created_at,
  ranking_score
FROM ranked_items
ORDER BY ranking_score DESC, position ASC
LIMIT 1
`;

export const selectNextQueueItem = async (
  databaseClient: DatabaseClient,
  queueId: string,
): Promise<Record<string, unknown> | null> => {
  const { rows } = await databaseClient.query(SQL_SELECT_NEXT_ELIGIBLE_QUEUE_ITEM, [
    queueId,
  ]);

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
};
