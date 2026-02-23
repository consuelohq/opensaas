import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class CreateAgentSkills1771780000000 implements MigrationInterface {
  name = 'CreateAgentSkills1771780000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "core"."agentSkillFolder" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "icon" varchar(50),
        "workspaceId" uuid NOT NULL,
        "createdBy" uuid NOT NULL,
        "parentFolderId" uuid,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agentSkillFolder" PRIMARY KEY ("id"),
        CONSTRAINT "FK_agentSkillFolder_parent" FOREIGN KEY ("parentFolderId")
          REFERENCES "core"."agentSkillFolder"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_agentSkillFolder_workspace" FOREIGN KEY ("workspaceId")
          REFERENCES "core"."workspace"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_SKILL_FOLDER_WORKSPACE"
        ON "core"."agentSkillFolder" ("workspaceId")`,
    );

    await queryRunner.query(
      `CREATE TABLE "core"."agentSkill" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "description" text,
        "icon" varchar(50),
        "category" varchar(50) NOT NULL,
        "type" varchar(20) NOT NULL DEFAULT 'custom',
        "tools" text[] NOT NULL DEFAULT '{}',
        "systemPrompt" text NOT NULL,
        "sandboxTemplate" text,
        "triggers" text[] NOT NULL DEFAULT '{manual}',
        "inputSchema" jsonb,
        "outputFormat" varchar(20) NOT NULL DEFAULT 'text',
        "integrations" jsonb NOT NULL DEFAULT '[]',
        "useWhen" text[] NOT NULL DEFAULT '{}',
        "dontUseWhen" text[] NOT NULL DEFAULT '{}',
        "version" integer NOT NULL DEFAULT 1,
        "createdBy" varchar(50) NOT NULL,
        "workspaceId" uuid NOT NULL,
        "folderId" uuid,
        "isPublic" boolean NOT NULL DEFAULT false,
        "sandboxTimeoutMs" integer NOT NULL DEFAULT 30000,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz,
        CONSTRAINT "PK_agentSkill" PRIMARY KEY ("id"),
        CONSTRAINT "FK_agentSkill_folder" FOREIGN KEY ("folderId")
          REFERENCES "core"."agentSkillFolder"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_agentSkill_workspace" FOREIGN KEY ("workspaceId")
          REFERENCES "core"."workspace"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_AGENT_SKILL_WORKSPACE_NAME"
        ON "core"."agentSkill" ("workspaceId", "name")
        WHERE "deletedAt" IS NULL`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_SKILL_WORKSPACE"
        ON "core"."agentSkill" ("workspaceId")
        WHERE "deletedAt" IS NULL`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_SKILL_CATEGORY"
        ON "core"."agentSkill" ("workspaceId", "category")
        WHERE "deletedAt" IS NULL`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_SKILL_TYPE"
        ON "core"."agentSkill" ("workspaceId", "type")
        WHERE "deletedAt" IS NULL`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_SKILL_CREATED_BY"
        ON "core"."agentSkill" ("workspaceId", "createdBy")
        WHERE "deletedAt" IS NULL`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_SKILL_FOLDER"
        ON "core"."agentSkill" ("folderId")
        WHERE "deletedAt" IS NULL`,
    );

    await queryRunner.query(
      `CREATE TABLE "core"."agentSkillUsageLog" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "skillId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "workspaceId" uuid NOT NULL,
        "triggeredBy" varchar(20) NOT NULL,
        "success" boolean NOT NULL DEFAULT true,
        "errorCode" varchar(50),
        "durationMs" integer NOT NULL,
        "tokensInput" integer NOT NULL DEFAULT 0,
        "tokensCached" integer NOT NULL DEFAULT 0,
        "tokensOutput" integer NOT NULL DEFAULT 0,
        "provider" varchar(50),
        "sandboxUsed" boolean NOT NULL DEFAULT false,
        "executedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agentSkillUsageLog" PRIMARY KEY ("id"),
        CONSTRAINT "FK_agentSkillUsageLog_skill" FOREIGN KEY ("skillId")
          REFERENCES "core"."agentSkill"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_agentSkillUsageLog_workspace" FOREIGN KEY ("workspaceId")
          REFERENCES "core"."workspace"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_SKILL_USAGE_LOG_SKILL"
        ON "core"."agentSkillUsageLog" ("skillId")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_SKILL_USAGE_LOG_USER"
        ON "core"."agentSkillUsageLog" ("userId")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_SKILL_USAGE_LOG_WORKSPACE"
        ON "core"."agentSkillUsageLog" ("workspaceId")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_SKILL_USAGE_LOG_EXECUTED"
        ON "core"."agentSkillUsageLog" ("executedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "core"."agentSkillUsageLog"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "core"."agentSkill"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "core"."agentSkillFolder"`);
  }
}
