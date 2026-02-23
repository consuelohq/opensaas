import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddAgentSkillVersions1771800000001 implements MigrationInterface {
  name = 'AddAgentSkillVersions1771800000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "core"."agentSkillVersion" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "skillId" uuid NOT NULL,
        "version" integer NOT NULL,
        "systemPrompt" text,
        "sandboxTemplate" text,
        "changeSummary" character varying(500),
        "createdBy" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agent_skill_version_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_agent_skill_version_skill" FOREIGN KEY ("skillId")
          REFERENCES "core"."agentSkill"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_AGENT_SKILL_VERSION_SKILL_VERSION"
        ON "core"."agentSkillVersion" ("skillId", "version")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "core"."IDX_AGENT_SKILL_VERSION_SKILL_VERSION"`,
    );
    await queryRunner.query(`DROP TABLE "core"."agentSkillVersion"`);
  }
}
