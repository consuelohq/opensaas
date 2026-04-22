import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProfilePosteriors1774000000000 implements MigrationInterface {
  name = 'CreateProfilePosteriors1774000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS core.profile_posteriors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scope VARCHAR(20) NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'workspace')),
        workspace_id UUID NULL,
        profile_id VARCHAR(20) NOT NULL CHECK (profile_id IN ('balanced', 'aggressive', 'conservative')),
        alpha INTEGER NOT NULL DEFAULT 1,
        beta INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_profile_posteriors_scope_workspace_profile
        ON core.profile_posteriors (
          scope,
          COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid),
          profile_id
        )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_profile_posteriors_lookup
        ON core.profile_posteriors (scope, workspace_id, profile_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS core.idx_profile_posteriors_lookup');
    await queryRunner.query('DROP INDEX IF EXISTS core.uq_profile_posteriors_scope_workspace_profile');
    await queryRunner.query('DROP TABLE IF EXISTS core.profile_posteriors');
  }
}
