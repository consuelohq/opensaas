import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class CreateAgentAutomations1771790000001
  implements MigrationInterface
{
  name = 'CreateAgentAutomations1771790000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "core"."agentAutomation" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "description" text,
        "enabled" boolean NOT NULL DEFAULT true,
        "skillId" uuid NOT NULL,
        "triggerConfig" jsonb NOT NULL,
        "inputOverrides" jsonb NOT NULL DEFAULT '{}',
        "notifyOn" varchar(20) NOT NULL DEFAULT 'failure',
        "maxRunsPerDay" integer,
        "lastRunAt" timestamptz,
        "lastRunStatus" varchar(20),
        "userId" uuid NOT NULL,
        "workspaceId" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agentAutomation" PRIMARY KEY ("id"),
        CONSTRAINT "FK_agentAutomation_skill" FOREIGN KEY ("skillId")
          REFERENCES "core"."agentSkill"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_agentAutomation_workspace" FOREIGN KEY ("workspaceId")
          REFERENCES "core"."workspace"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_AUTOMATION_USER"
        ON "core"."agentAutomation" ("userId", "workspaceId")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_AUTOMATION_SKILL"
        ON "core"."agentAutomation" ("skillId")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_AUTOMATION_ENABLED"
        ON "core"."agentAutomation" ("enabled")
        WHERE "enabled" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "core"."agentAutomation"`,
    );
  }
}
