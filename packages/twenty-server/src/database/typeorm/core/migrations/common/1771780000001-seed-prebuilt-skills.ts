import { type MigrationInterface, type QueryRunner } from 'typeorm';

import { CUSTOM_REPORT_GENERATOR_SEED } from 'src/engine/core-modules/agent/seeds/custom-report-generator.seed';
import { PIPELINE_ANALYZER_SEED } from 'src/engine/core-modules/agent/seeds/pipeline-analyzer.seed';
import { POST_CALL_LOGGER_SEED } from 'src/engine/core-modules/agent/seeds/post-call-logger.seed';
import { PRE_CALL_BRIEF_SEED } from 'src/engine/core-modules/agent/seeds/pre-call-brief.seed';
import { QUEUE_BUILDER_SEED } from 'src/engine/core-modules/agent/seeds/queue-builder.seed';

type SkillSeed = {
  name: string;
  description: string;
  icon: string;
  category: string;
  tools: string;
  triggers: string;
  outputFormat: string;
  systemPrompt: string;
  integrations: string;
  useWhen: string;
  dontUseWhen: string;
  inputSchema?: string;
};

const PREBUILT_SKILLS: SkillSeed[] = [
  PRE_CALL_BRIEF_SEED,
  POST_CALL_LOGGER_SEED,
  PIPELINE_ANALYZER_SEED,
  QUEUE_BUILDER_SEED,
  CUSTOM_REPORT_GENERATOR_SEED,
];

const toTextArray = (value: string): string[] =>
  value
    .replace(/^\{/, '')
    .replace(/\}$/, '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

export class SeedPrebuiltSkills1771780000001 implements MigrationInterface {
  name = 'SeedPrebuiltSkills1771780000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const skill of PREBUILT_SKILLS) {
      await queryRunner.query(
        `INSERT INTO "core"."agentSkill" (
          "name", "description", "icon", "category", "type", "tools",
          "systemPrompt", "triggers", "outputFormat", "integrations",
          "useWhen", "dontUseWhen", "inputSchema",
          "createdBy", "workspaceId", "isPublic"
        ) SELECT
          $1::varchar, $2::text, $3::varchar, $4::varchar, 'pre-built', $5::text[],
          $6::text, $7::text[], $8::varchar, $9::jsonb,
          $10::text[], $11::text[], $12::jsonb,
          'system', w."id", true
        FROM "core"."workspace" w
        WHERE NOT EXISTS (
          SELECT 1 FROM "core"."agentSkill" s
          WHERE s."workspaceId" = w."id"
            AND s."name" = $1::varchar
            AND s."deletedAt" IS NULL
        )`,
        [
          skill.name,
          skill.description,
          skill.icon,
          skill.category,
          toTextArray(skill.tools),
          skill.systemPrompt,
          toTextArray(skill.triggers),
          skill.outputFormat,
          skill.integrations,
          toTextArray(skill.useWhen),
          toTextArray(skill.dontUseWhen),
          skill.inputSchema ?? null,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "core"."agentSkill"
        WHERE "type" = 'pre-built' AND "createdBy" = 'system'`,
    );
  }
}
