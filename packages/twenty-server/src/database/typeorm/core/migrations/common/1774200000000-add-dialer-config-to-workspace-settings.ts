import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddDialerConfigToWorkspaceSettings1774200000000
  implements MigrationInterface
{
  name = 'AddDialerConfigToWorkspaceSettings1774200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "core"."workspace_settings"
        ADD COLUMN IF NOT EXISTS "dialer_config" jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "core"."workspace_settings"
        DROP COLUMN IF EXISTS "dialer_config"`,
    );
  }
}
