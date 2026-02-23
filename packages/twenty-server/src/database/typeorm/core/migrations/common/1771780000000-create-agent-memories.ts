import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class CreateAgentMemories1771780000000 implements MigrationInterface {
  name = 'CreateAgentMemories1771780000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "core"."agentMemory" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "workspaceId" uuid NOT NULL,
        "type" varchar(20) NOT NULL,
        "key" varchar(255) NOT NULL,
        "value" text NOT NULL,
        "confidence" real NOT NULL DEFAULT 0.5,
        "source" varchar(20) NOT NULL DEFAULT 'inferred',
        "lastUsedAt" timestamptz,
        "useCount" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_AGENT_MEMORY" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_AGENT_MEMORY_USER_KEY" UNIQUE ("userId", "key"),
        CONSTRAINT "FK_AGENT_MEMORY_WORKSPACE" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_MEMORY_USER_CONFIDENCE" ON "core"."agentMemory" ("userId", "confidence" DESC)`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_MEMORY_WORKSPACE" ON "core"."agentMemory" ("workspaceId")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_MEMORY_USER_TYPE" ON "core"."agentMemory" ("userId", "type")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_AGENT_MEMORY_USER_TYPE"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_AGENT_MEMORY_WORKSPACE"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_AGENT_MEMORY_USER_CONFIDENCE"`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "core"."agentMemory"`);
  }
}
