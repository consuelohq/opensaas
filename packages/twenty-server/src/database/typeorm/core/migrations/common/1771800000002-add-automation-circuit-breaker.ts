import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddAutomationCircuitBreaker1771800000002 implements MigrationInterface {
  name = 'AddAutomationCircuitBreaker1771800000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."agentAutomation"
        ADD COLUMN "consecutiveFailures" integer NOT NULL DEFAULT 0`,
    );

    await queryRunner.query(
      `ALTER TABLE "core"."agentAutomation"
        ADD COLUMN "maxConsecutiveFailures" integer NOT NULL DEFAULT 5`,
    );

    await queryRunner.query(
      `ALTER TABLE "core"."agentAutomation"
        ADD COLUMN "disabledReason" varchar(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."agentAutomation"
        DROP COLUMN "disabledReason"`,
    );

    await queryRunner.query(
      `ALTER TABLE "core"."agentAutomation"
        DROP COLUMN "maxConsecutiveFailures"`,
    );

    await queryRunner.query(
      `ALTER TABLE "core"."agentAutomation"
        DROP COLUMN "consecutiveFailures"`,
    );
  }
}
