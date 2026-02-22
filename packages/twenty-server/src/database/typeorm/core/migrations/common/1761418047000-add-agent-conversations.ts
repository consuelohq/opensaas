import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddAgentConversations1761418047000
  implements MigrationInterface
{
  name = 'AddAgentConversations1761418047000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "core"."agentConversation" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" varchar(255) NOT NULL DEFAULT 'New conversation',
        "userId" uuid NOT NULL,
        "workspaceId" uuid NOT NULL,
        "skillId" uuid,
        "messageCount" integer NOT NULL DEFAULT 0,
        "pinned" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agent_conversation" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_AGENT_CONVERSATION_USER_WORKSPACE"
      ON "core"."agentConversation" ("userId", "workspaceId")
    `);

    await queryRunner.query(`
      ALTER TABLE "core"."agentConversation"
      ADD CONSTRAINT "FK_agent_conversation_workspace"
      FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "core"."agentMessage" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversationId" uuid NOT NULL,
        "role" varchar(20) NOT NULL,
        "content" text,
        "toolName" varchar(100),
        "toolInput" jsonb,
        "toolResult" jsonb,
        "tokenUsage" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agent_message" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_AGENT_MESSAGE_CONVERSATION"
      ON "core"."agentMessage" ("conversationId")
    `);

    await queryRunner.query(`
      ALTER TABLE "core"."agentMessage"
      ADD CONSTRAINT "FK_agent_message_conversation"
      FOREIGN KEY ("conversationId") REFERENCES "core"."agentConversation"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."agentMessage"
      DROP CONSTRAINT IF EXISTS "FK_agent_message_conversation"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "core"."IDX_AGENT_MESSAGE_CONVERSATION"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "core"."agentMessage"`);

    await queryRunner.query(`
      ALTER TABLE "core"."agentConversation"
      DROP CONSTRAINT IF EXISTS "FK_agent_conversation_workspace"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "core"."IDX_AGENT_CONVERSATION_USER_WORKSPACE"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "core"."agentConversation"`);
  }
}
