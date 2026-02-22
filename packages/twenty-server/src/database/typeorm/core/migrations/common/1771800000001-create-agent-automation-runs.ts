import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class CreateAgentAutomationRuns1771800000001
  implements MigrationInterface
{
  name = 'CreateAgentAutomationRuns1771800000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "core"."agentAutomationRun" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "automationId" uuid NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "startedAt" timestamptz,
        "completedAt" timestamptz,
        "durationMs" integer,
        "triggerPayload" jsonb,
        "result" jsonb,
        "error" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agentAutomationRun" PRIMARY KEY ("id"),
        CONSTRAINT "FK_agentAutomationRun_automation" FOREIGN KEY ("automationId")
          REFERENCES "core"."agentAutomation"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_AUTOMATION_RUN_AUTOMATION"
        ON "core"."agentAutomationRun" ("automationId")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_AUTOMATION_RUN_AUTOMATION_STATUS"
        ON "core"."agentAutomationRun" ("automationId", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "core"."agentAutomationRun"`,
    );
  }
}
