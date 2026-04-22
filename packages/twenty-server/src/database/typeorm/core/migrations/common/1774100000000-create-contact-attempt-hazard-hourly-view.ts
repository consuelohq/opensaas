import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateContactAttemptHazardHourlyView1774100000000
  implements MigrationInterface
{
  name = 'CreateContactAttemptHazardHourlyView1774100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS core.contact_attempt_hazard_hourly_mv AS
      WITH attempt_events AS (
        SELECT
          cq.workspace_id,
          COALESCE(cq.category, 'unclassified') AS segment_id,
          EXTRACT(HOUR FROM qi.last_attempt_at)::int AS hour_of_day,
          EXTRACT(DOW FROM qi.last_attempt_at)::int AS day_of_week,
          GREATEST(COALESCE(qi.attempts, 1), 1)::int AS attempt_number,
          qi.call_outcome
        FROM queue_items qi
        INNER JOIN call_queues cq
          ON cq.id = qi.queue_id
        INNER JOIN contact_attempt_ledger ledger
          ON ledger.workspace_id = cq.workspace_id
         AND ledger.contact_id = qi.contact_id
        WHERE qi.last_attempt_at IS NOT NULL
          AND qi.call_outcome IS NOT NULL
          AND qi.status IN ('completed', 'skipped')
      )
      SELECT
        workspace_id,
        segment_id,
        hour_of_day,
        day_of_week,
        attempt_number,
        AVG(CASE WHEN call_outcome = 'answered' THEN 1.0 ELSE 0.0 END)::float AS answer_rate,
        COUNT(*)::int AS sample_size
      FROM attempt_events
      GROUP BY workspace_id, segment_id, hour_of_day, day_of_week, attempt_number
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_attempt_hazard_hourly_mv_unique
      ON core.contact_attempt_hazard_hourly_mv (
        workspace_id,
        segment_id,
        hour_of_day,
        day_of_week,
        attempt_number
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_contact_attempt_hazard_hourly_mv_lookup
      ON core.contact_attempt_hazard_hourly_mv (workspace_id, segment_id, attempt_number, answer_rate DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS core.idx_contact_attempt_hazard_hourly_mv_lookup',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS core.idx_contact_attempt_hazard_hourly_mv_unique',
    );
    await queryRunner.query(
      'DROP MATERIALIZED VIEW IF EXISTS core.contact_attempt_hazard_hourly_mv',
    );
  }
}
