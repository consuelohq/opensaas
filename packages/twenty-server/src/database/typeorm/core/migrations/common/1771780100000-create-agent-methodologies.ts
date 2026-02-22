import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class CreateAgentMethodologies1771780100000
  implements MigrationInterface
{
  name = 'CreateAgentMethodologies1771780100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "core"."agentMethodology" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(100) NOT NULL,
        "type" varchar(20) NOT NULL,
        "description" text NOT NULL,
        "systemPrompt" text NOT NULL,
        "qualificationCriteria" jsonb NOT NULL DEFAULT '[]',
        "scoringWeights" jsonb,
        "workspaceId" uuid,
        "createdBy" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_AGENT_METHODOLOGY" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_METHODOLOGY_WORKSPACE" ON "core"."agentMethodology" ("workspaceId")`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_AGENT_METHODOLOGY_WORKSPACE_NAME" ON "core"."agentMethodology" ("workspaceId", "name") WHERE "workspaceId" IS NOT NULL`,
    );

    await queryRunner.query(
      `CREATE TABLE "core"."agentWorkspaceConfig" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "activeMethodologyId" uuid,
        "config" jsonb,
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_AGENT_WORKSPACE_CONFIG" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_AGENT_WORKSPACE_CONFIG_WORKSPACE" UNIQUE ("workspaceId"),
        CONSTRAINT "FK_AGENT_WORKSPACE_CONFIG_METHODOLOGY" FOREIGN KEY ("activeMethodologyId") REFERENCES "core"."agentMethodology"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_AGENT_WORKSPACE_CONFIG_WORKSPACE" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "core"."agentWorkspaceConfig"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."UQ_AGENT_METHODOLOGY_WORKSPACE_NAME"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_AGENT_METHODOLOGY_WORKSPACE"`,
    );

    await queryRunner.query(
      `DROP TABLE IF EXISTS "core"."agentMethodology"`,
    );
  }
}
