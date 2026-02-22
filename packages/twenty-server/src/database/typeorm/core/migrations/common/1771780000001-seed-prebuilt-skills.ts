import { type MigrationInterface, type QueryRunner } from 'typeorm';

const PREBUILT_SKILLS = [
  {
    name: 'Pre-call Brief',
    description: 'Generates a research brief before a call with contact history, deal context, and talking points.',
    icon: 'IconFileDescription',
    category: 'preparation',
    tools: '{search_contacts,get_contact,get_call_history,search_kb}',
    triggers: '{manual,on_call_start}',
    outputFormat: 'report',
    systemPrompt: 'You are a sales preparation assistant. Research the contact and generate a concise pre-call brief with key talking points, recent interactions, and deal context.',
    integrations: '[]',
    useWhen: '{before_outbound_call,when_contact_has_history}',
    dontUseWhen: '{cold_call_no_data}',
  },
  {
    name: 'Post-call Logger',
    description: 'Automatically logs call outcomes, creates follow-up tasks, and updates deal stages after a call.',
    icon: 'IconClipboardCheck',
    category: 'logging',
    tools: '{log_call,update_deal,create_note,create_task}',
    triggers: '{manual,on_call_end}',
    outputFormat: 'action',
    systemPrompt: 'You are a post-call logging assistant. Summarize the call outcome, create follow-up tasks, and update the deal stage based on the conversation.',
    integrations: '[]',
    useWhen: '{after_any_call,when_deal_exists}',
    dontUseWhen: '{voicemail_only}',
  },
  {
    name: 'Pipeline Analyzer',
    description: 'Analyzes deal pipeline health, identifies at-risk deals, and suggests next actions.',
    icon: 'IconChartBar',
    category: 'analysis',
    tools: '{list_deals,get_analytics,run_analysis}',
    triggers: '{manual,scheduled}',
    outputFormat: 'mixed',
    systemPrompt: 'You are a pipeline analysis assistant. Analyze the current deal pipeline, identify deals at risk of stalling, and recommend specific next actions for each.',
    integrations: '[]',
    useWhen: '{weekly_review,pipeline_has_deals}',
    dontUseWhen: '{empty_pipeline}',
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
          "useWhen", "dontUseWhen", "createdBy", "workspaceId", "isPublic"
        ) SELECT
          $1, $2, $3, $4, 'pre-built', $5::text[],
          $6, $7::text[], $8, $9::jsonb,
          $10::text[], $11::text[], 'system', w."id", true
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
