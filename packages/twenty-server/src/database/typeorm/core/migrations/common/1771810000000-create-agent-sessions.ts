import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class CreateAgentSessions1771810000000 implements MigrationInterface {
  name = 'CreateAgentSessions1771810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "core"."agentSession" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "data" jsonb NOT NULL DEFAULT '{}',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_AGENT_SESSION" PRIMARY KEY ("id"),
        CONSTRAINT "FK_AGENT_SESSION_WORKSPACE" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_SESSION_WORKSPACE" ON "core"."agentSession" ("workspaceId")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_SESSION_USER" ON "core"."agentSession" ("userId")`,
    );

    // composite index for list queries filtering by userId AND workspaceId
    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_SESSION_USER_WORKSPACE" ON "core"."agentSession" ("userId", "workspaceId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_AGENT_SESSION_USER_WORKSPACE"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_AGENT_SESSION_USER"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_AGENT_SESSION_WORKSPACE"`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "core"."agentSession"`);
  }
}
