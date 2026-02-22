import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class CreateAgentConversationSummaries1771790000002
  implements MigrationInterface
{
  name = 'CreateAgentConversationSummaries1771790000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "core"."agentConversationSummary" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "conversationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "workspaceId" uuid NOT NULL,
        "summary" text NOT NULL,
        "messageCount" integer NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agentConversationSummary" PRIMARY KEY ("id"),
        CONSTRAINT "FK_agentConversationSummary_workspace" FOREIGN KEY ("workspaceId")
          REFERENCES "core"."workspace"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_CONV_SUMMARY_CONVERSATION"
        ON "core"."agentConversationSummary" ("conversationId")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_CONV_SUMMARY_USER_WORKSPACE"
        ON "core"."agentConversationSummary" ("userId", "workspaceId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "core"."agentConversationSummary"`,
    );
  }
}
