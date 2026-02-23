import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddAgentAutomation1759617160275 implements MigrationInterface {
  name = 'AddAgentAutomation1759617160275';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "core"."agentAutomation" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "description" text, "enabled" boolean NOT NULL DEFAULT true, "skillId" uuid NOT NULL, "triggerConfig" jsonb NOT NULL, "inputOverrides" jsonb NOT NULL DEFAULT '{}', "notifyOn" character varying(20) NOT NULL DEFAULT 'failure', "maxRunsPerDay" integer, "lastRunAt" TIMESTAMP WITH TIME ZONE, "lastRunStatus" character varying(20), "userId" uuid NOT NULL, "workspaceId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_agentAutomation" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_AUTOMATION_USER" ON "core"."agentAutomation" ("userId", "workspaceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_AUTOMATION_SKILL" ON "core"."agentAutomation" ("skillId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_AUTOMATION_ENABLED" ON "core"."agentAutomation" ("enabled") WHERE "enabled" = true`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."agentAutomation" ADD CONSTRAINT "FK_agentAutomation_skillId" FOREIGN KEY ("skillId") REFERENCES "core"."agentSkill"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."agentAutomation" ADD CONSTRAINT "FK_agentAutomation_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."agentAutomation" DROP CONSTRAINT "FK_agentAutomation_workspaceId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."agentAutomation" DROP CONSTRAINT "FK_agentAutomation_skillId"`,
    );
    await queryRunner.query(`DROP INDEX "core"."IDX_AGENT_AUTOMATION_ENABLED"`);
    await queryRunner.query(`DROP INDEX "core"."IDX_AGENT_AUTOMATION_SKILL"`);
    await queryRunner.query(`DROP INDEX "core"."IDX_AGENT_AUTOMATION_USER"`);
    await queryRunner.query(`DROP TABLE "core"."agentAutomation"`);
  }
}
