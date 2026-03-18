import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddDiscordBotConfigEntity1773804668056 implements MigrationInterface {
  name = 'AddDiscordBotConfigEntity1773804668056';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "core"."discordBotConfig" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "workspaceId" uuid NOT NULL, "botToken" text NOT NULL, "publicKey" text NOT NULL, "applicationId" text NOT NULL, "clientSecret" text NOT NULL, "interactionsEndpointUrl" text, CONSTRAINT "PK_discordBotConfig_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_DISCORD_BOT_CONFIG_WORKSPACE_ID" ON "core"."discordBotConfig" ("workspaceId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."discordBotConfig" ADD CONSTRAINT "FK_discordBotConfig_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."discordBotConfig" DROP CONSTRAINT "FK_discordBotConfig_workspaceId"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_DISCORD_BOT_CONFIG_WORKSPACE_ID"`);
    await queryRunner.query(`DROP TABLE "core"."discordBotConfig"`);
  }
}
