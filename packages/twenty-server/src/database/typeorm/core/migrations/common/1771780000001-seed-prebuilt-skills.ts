import { type MigrationInterface, type QueryRunner } from 'typeorm';

import { PIPELINE_ANALYZER_SEED } from 'src/engine/core-modules/agent/seeds/pipeline-analyzer.seed';
import { POST_CALL_LOGGER_SEED } from 'src/engine/core-modules/agent/seeds/post-call-logger.seed';
import { PRE_CALL_BRIEF_SEED } from 'src/engine/core-modules/agent/seeds/pre-call-brief.seed';

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
  {
    ...PRE_CALL_BRIEF_SEED,
    useWhen: `{${PRE_CALL_BRIEF_SEED.useWhen}}`,
    dontUseWhen: `{${PRE_CALL_BRIEF_SEED.dontUseWhen}}`,
  },
  {
    ...POST_CALL_LOGGER_SEED,
    useWhen: `{${POST_CALL_LOGGER_SEED.useWhen}}`,
    dontUseWhen: `{${POST_CALL_LOGGER_SEED.dontUseWhen}}`,
  },
  {
    ...PIPELINE_ANALYZER_SEED,
    useWhen: `{${PIPELINE_ANALYZER_SEED.useWhen}}`,
    dontUseWhen: `{${PIPELINE_ANALYZER_SEED.dontUseWhen}}`,
  },
  {
    name: 'Queue Builder',
    description: 'Builds optimized call queues based on contact priority, time zones, and deal urgency.',
    icon: 'IconListNumbers',
    category: 'automation',
    tools: '{search_contacts,get_call_history,list_deals,add_to_queue,run_analysis}',
    triggers: '{manual,scheduled}',
    outputFormat: 'action',
    systemPrompt: 'You are a call queue optimization assistant. Build a prioritized call queue considering contact time zones, deal urgency, last contact date, and likelihood to convert.',
    integrations: '[]',
    useWhen: '{start_of_day,queue_empty}',
    dontUseWhen: '{no_contacts_available}',
  },
  {
    name: 'Custom Report Generator',
    description: 'Generates custom reports from call analytics, contact data, and deal metrics.',
    icon: 'IconReportAnalytics',
    category: 'analysis',
    tools: '{get_analytics,search_contacts,list_deals,get_call_history,run_analysis}',
    triggers: '{manual}',
    outputFormat: 'mixed',
    systemPrompt: 'You are a sales reporting assistant. Generate detailed reports combining call analytics, contact engagement metrics, and deal pipeline data based on the user request.',
    integrations: '[]',
    useWhen: '{reporting_period,manager_request}',
    dontUseWhen: '{insufficient_data}',
  },
];

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
          $1, $2, $3, $4, 'pre-built', $5::text[],
          $6, $7::text[], $8, $9::jsonb,
          $10::text[], $11::text[], $12::jsonb,
          'system', w."id", true
        FROM "core"."workspace" w
        WHERE NOT EXISTS (
          SELECT 1 FROM "core"."agentSkill" s
          WHERE s."workspaceId" = w."id"
            AND s."name" = $1
            AND s."deletedAt" IS NULL
        )`,
        [
          skill.name,
          skill.description,
          skill.icon,
          skill.category,
          skill.tools,
          skill.systemPrompt,
          skill.triggers,
          skill.outputFormat,
          skill.integrations,
          skill.useWhen,
          skill.dontUseWhen,
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
