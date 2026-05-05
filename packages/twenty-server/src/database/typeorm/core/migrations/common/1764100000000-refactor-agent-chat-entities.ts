import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class RefactorAgentChatEntities1764100000000 implements MigrationInterface {
  name = 'RefactorAgentChatEntities1764100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Keep the existing core agent conversation table shape and add the newer
    // turn/message-part tables expected by the AI agent execution modules.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "core"."agentTurn" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "threadId" uuid NOT NULL,
        "agentId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_0e3f599ba7cf6a02fc940d9f18d" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_3be906dca9d5b50fbfe40e33f0"
      ON "core"."agentTurn" ("threadId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_e6d7c07f32e6f0f08cf639d4f5"
      ON "core"."agentTurn" ("agentId")
    `);

    await queryRunner.query(`
      ALTER TABLE "core"."agentMessage"
      ALTER COLUMN "conversationId" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "core"."agentMessage"
      ADD COLUMN IF NOT EXISTS "threadId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "core"."agentMessage"
      ADD COLUMN IF NOT EXISTS "turnId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "core"."agentMessage"
      ADD COLUMN IF NOT EXISTS "agentId" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_4c31daa882e3130534995bf90c"
      ON "core"."agentMessage" ("threadId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_87dbab10ac94d9a091f8efaa67"
      ON "core"."agentMessage" ("turnId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_48c75cb32ff0d2887ef0dc547f"
      ON "core"."agentMessage" ("agentId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "core"."agentMessagePart" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "messageId" uuid NOT NULL,
        "orderIndex" integer NOT NULL,
        "type" character varying NOT NULL,
        "textContent" text,
        "reasoningContent" text,
        "toolName" character varying,
        "toolCallId" character varying,
        "toolInput" jsonb,
        "toolOutput" jsonb,
        "state" character varying,
        "errorMessage" text,
        "errorDetails" jsonb,
        "sourceUrlSourceId" character varying,
        "sourceUrlUrl" character varying,
        "sourceUrlTitle" character varying,
        "sourceDocumentSourceId" character varying,
        "sourceDocumentMediaType" character varying,
        "sourceDocumentTitle" character varying,
        "sourceDocumentFilename" character varying,
        "fileMediaType" character varying,
        "fileFilename" character varying,
        "fileUrl" character varying,
        "providerMetadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_7e8c9f0b1a2b3c4d5e6f7a8b9c0" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_2aff9daad5cc3b5e15ca717334"
      ON "core"."agentMessagePart" ("messageId")
    `);

    await queryRunner.query(`
      ALTER TABLE "core"."agentTurn"
      DROP CONSTRAINT IF EXISTS "FK_3be906dca9d5b50fbfe40e33f07"
    `);
    await queryRunner.query(`
      ALTER TABLE "core"."agentTurn"
      ADD CONSTRAINT "FK_3be906dca9d5b50fbfe40e33f07"
      FOREIGN KEY ("threadId")
      REFERENCES "core"."agentChatThread"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "core"."agentMessage"
      DROP CONSTRAINT IF EXISTS "FK_4c31daa882e3130534995bf90ca"
    `);
    await queryRunner.query(`
      ALTER TABLE "core"."agentMessage"
      ADD CONSTRAINT "FK_4c31daa882e3130534995bf90ca"
      FOREIGN KEY ("threadId")
      REFERENCES "core"."agentChatThread"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "core"."agentMessage"
      DROP CONSTRAINT IF EXISTS "FK_87dbab10ac94d9a091f8efaa67b"
    `);
    await queryRunner.query(`
      ALTER TABLE "core"."agentMessage"
      ADD CONSTRAINT "FK_87dbab10ac94d9a091f8efaa67b"
      FOREIGN KEY ("turnId")
      REFERENCES "core"."agentTurn"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "core"."agentMessagePart"
      DROP CONSTRAINT IF EXISTS "FK_2aff9daad5cc3b5e15ca7173342"
    `);
    await queryRunner.query(`
      ALTER TABLE "core"."agentMessagePart"
      ADD CONSTRAINT "FK_2aff9daad5cc3b5e15ca7173342"
      FOREIGN KEY ("messageId")
      REFERENCES "core"."agentMessage"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(): Promise<void> {
    // Compatibility/adoption migration: keep agent execution tables and columns
    // intact on rollback because newer agent messages may not have a
    // conversationId and the active dev seeder writes thread/turn-based rows.
  }
}
