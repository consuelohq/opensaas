import { type MigrationInterface, type QueryRunner } from 'typeorm';

// fixed UUIDs for built-in methodologies — enables idempotent seeding
const MEDDIC_ID = 'a0000000-0000-4000-8000-000000000001';
const BANT_ID = 'a0000000-0000-4000-8000-000000000002';
const CHALLENGER_ID = 'a0000000-0000-4000-8000-000000000003';
const SPIN_ID = 'a0000000-0000-4000-8000-000000000004';
const SANDLER_ID = 'a0000000-0000-4000-8000-000000000005';

type MethodologySeed = {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  qualificationCriteria: { key: string; label: string; description: string; scoringGuide: string }[];
  scoringWeights: Record<string, number> | null;
};

const methodologies: MethodologySeed[] = [
  {
    id: MEDDIC_ID,
    name: 'MEDDIC',
    description: 'Enterprise qualification framework focusing on Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, and Champion.',
    systemPrompt: [
      'You are a sales coach using the MEDDIC qualification methodology.',
      'Guide the rep through these six criteria during every deal review:',
      '1. Metrics — quantifiable business outcomes the prospect expects.',
      '2. Economic Buyer — the person with final budget authority.',
      '3. Decision Criteria — technical, business, and cultural factors driving the decision.',
      '4. Decision Process — steps, timeline, and stakeholders involved in approval.',
      '5. Identify Pain — the core business pain that justifies action.',
      '6. Champion — an internal advocate who sells on your behalf.',
      '',
      'For each criterion, assess whether the rep has gathered sufficient evidence.',
      'Flag gaps and suggest specific discovery questions to fill them.',
      'Score each criterion 0-10 based on evidence strength.',
    ].join('\n'),
    qualificationCriteria: [
      { key: 'metrics', label: 'Metrics', description: 'Quantifiable business outcomes the prospect expects', scoringGuide: '0: unknown, 5: vague goals, 10: specific KPIs with baselines' },
      { key: 'economic_buyer', label: 'Economic Buyer', description: 'Person with final budget authority identified and engaged', scoringGuide: '0: unknown, 5: identified but no access, 10: direct relationship' },
      { key: 'decision_criteria', label: 'Decision Criteria', description: 'Technical, business, and cultural factors driving the decision', scoringGuide: '0: unknown, 5: partial list, 10: full criteria with weights' },
      { key: 'decision_process', label: 'Decision Process', description: 'Steps, timeline, and stakeholders in the approval process', scoringGuide: '0: unknown, 5: rough timeline, 10: mapped with dates and owners' },
      { key: 'identify_pain', label: 'Identify Pain', description: 'Core business pain that justifies action and budget', scoringGuide: '0: no pain identified, 5: surface-level pain, 10: quantified cost of inaction' },
      { key: 'champion', label: 'Champion', description: 'Internal advocate who actively sells on your behalf', scoringGuide: '0: no champion, 5: friendly contact, 10: proven advocate with influence' },
    ],
    scoringWeights: { metrics: 0.17, economic_buyer: 0.17, decision_criteria: 0.17, decision_process: 0.17, identify_pain: 0.17, champion: 0.15 },
  },
  {
    id: BANT_ID,
    name: 'BANT',
    description: 'Classic qualification framework: Budget, Authority, Need, Timeline.',
    systemPrompt: [
      'You are a sales coach using the BANT qualification methodology.',
      'Evaluate every opportunity against four criteria:',
      '1. Budget — does the prospect have allocated budget or a path to funding?',
      '2. Authority — are you talking to the decision-maker or an influencer?',
      '3. Need — is there a genuine business need your solution addresses?',
      '4. Timeline — is there urgency or a defined purchase window?',
      '',
      'Ask the rep what they know about each criterion.',
      'Suggest discovery questions for any gaps.',
      'A deal is qualified when all four criteria have strong evidence.',
    ].join('\n'),
    qualificationCriteria: [
      { key: 'budget', label: 'Budget', description: 'Prospect has allocated budget or a clear path to funding', scoringGuide: '0: no budget discussion, 5: ballpark range, 10: approved budget confirmed' },
      { key: 'authority', label: 'Authority', description: 'Decision-maker identified and engaged in the process', scoringGuide: '0: unknown buyer, 5: influencer only, 10: decision-maker engaged' },
      { key: 'need', label: 'Need', description: 'Genuine business need that your solution addresses', scoringGuide: '0: no clear need, 5: nice-to-have, 10: critical business requirement' },
      { key: 'timeline', label: 'Timeline', description: 'Defined purchase window or urgency to act', scoringGuide: '0: no timeline, 5: sometime this year, 10: specific date with consequences' },
    ],
    scoringWeights: { budget: 0.25, authority: 0.25, need: 0.25, timeline: 0.25 },
  },
  {
    id: CHALLENGER_ID,
    name: 'Challenger',
    description: 'Methodology based on teaching, tailoring, and taking control of the sales conversation.',
    systemPrompt: [
      'You are a sales coach using the Challenger Sale methodology.',
      'Coach the rep on three core behaviors:',
      '1. Teach — deliver unique insights that reframe how the prospect thinks about their problem.',
      '2. Tailor — adapt the message to the specific stakeholder and their priorities.',
      '3. Take Control — guide the conversation assertively, especially around pricing and next steps.',
      '',
      'Review the rep\'s approach and suggest ways to strengthen each behavior.',
      'Push back when the rep is being too accommodating or failing to challenge assumptions.',
      'The goal is constructive tension that drives the prospect toward a decision.',
    ].join('\n'),
    qualificationCriteria: [
      { key: 'teach', label: 'Teach', description: 'Delivering unique insights that reframe the prospect\'s thinking', scoringGuide: '0: no insight shared, 5: generic value prop, 10: prospect had an aha moment' },
      { key: 'tailor', label: 'Tailor', description: 'Message adapted to the specific stakeholder and their priorities', scoringGuide: '0: generic pitch, 5: some personalization, 10: deeply relevant to their role' },
      { key: 'take_control', label: 'Take Control', description: 'Assertively guiding the conversation and next steps', scoringGuide: '0: passive, 5: suggests next steps, 10: drives timeline and commitments' },
    ],
    scoringWeights: null,
  },
  {
    id: SPIN_ID,
    name: 'SPIN',
    description: 'Discovery framework using Situation, Problem, Implication, and Need-Payoff questions.',
    systemPrompt: [
      'You are a sales coach using the SPIN Selling methodology.',
      'Guide the rep through four question types in order:',
      '1. Situation — gather facts about the prospect\'s current state and context.',
      '2. Problem — uncover difficulties, dissatisfactions, and challenges.',
      '3. Implication — explore the consequences and ripple effects of those problems.',
      '4. Need-Payoff — help the prospect articulate the value of solving the problem.',
      '',
      'Review the rep\'s discovery questions and suggest improvements.',
      'Ensure they progress through all four stages rather than jumping to solutions.',
      'The best reps spend the most time on Implication and Need-Payoff questions.',
    ].join('\n'),
    qualificationCriteria: [
      { key: 'situation', label: 'Situation', description: 'Facts about the prospect\'s current state gathered', scoringGuide: '0: no context, 5: basic facts, 10: deep understanding of their environment' },
      { key: 'problem', label: 'Problem', description: 'Difficulties and challenges uncovered through questioning', scoringGuide: '0: no problems surfaced, 5: surface issues, 10: root causes identified' },
      { key: 'implication', label: 'Implication', description: 'Consequences and ripple effects of problems explored', scoringGuide: '0: not explored, 5: some impact discussed, 10: full cost of inaction quantified' },
      { key: 'need_payoff', label: 'Need-Payoff', description: 'Prospect articulates the value of solving the problem', scoringGuide: '0: rep stated value, 5: prospect agrees, 10: prospect champions the solution' },
    ],
    scoringWeights: null,
  },
  {
    id: SANDLER_ID,
    name: 'Sandler',
    description: 'Qualification through Pain, Budget, and Decision discovery in a consultative framework.',
    systemPrompt: [
      'You are a sales coach using the Sandler Selling System.',
      'Focus on three qualification pillars:',
      '1. Pain — uncover the prospect\'s real pain at three levels: surface, business impact, and personal impact.',
      '2. Budget — establish whether the prospect can and will invest to solve the pain.',
      '3. Decision — map the full decision process including all stakeholders and steps.',
      '',
      'Coach the rep to qualify ruthlessly — disqualify early if pain, budget, or decision access is missing.',
      'The Sandler approach values mutual respect: never chase, never pressure.',
      'Help the rep maintain an equal business stature throughout the conversation.',
    ].join('\n'),
    qualificationCriteria: [
      { key: 'pain', label: 'Pain', description: 'Real pain uncovered at surface, business, and personal levels', scoringGuide: '0: no pain, 5: surface pain only, 10: personal impact articulated by prospect' },
      { key: 'budget', label: 'Budget', description: 'Prospect can and will invest to solve the identified pain', scoringGuide: '0: no budget discussion, 5: willing but unconfirmed, 10: budget allocated' },
      { key: 'decision', label: 'Decision', description: 'Full decision process mapped with stakeholders and steps', scoringGuide: '0: unknown process, 5: partial map, 10: all steps and stakeholders confirmed' },
    ],
    scoringWeights: null,
  },
];

const escapeStr = (s: string): string => s.replace(/'/g, "''");

export class SeedBuiltInMethodologies1771780100001
  implements MigrationInterface
{
  name = 'SeedBuiltInMethodologies1771780100001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const m of methodologies) {
      await queryRunner.query(
        `INSERT INTO "core"."agentMethodology" ("id", "name", "type", "description", "systemPrompt", "qualificationCriteria", "scoringWeights", "workspaceId", "createdBy")
         VALUES ('${m.id}', '${escapeStr(m.name)}', 'built-in', '${escapeStr(m.description)}', '${escapeStr(m.systemPrompt)}', '${escapeStr(JSON.stringify(m.qualificationCriteria))}', ${m.scoringWeights ? `'${JSON.stringify(m.scoringWeights)}'` : 'NULL'}, NULL, NULL)
         ON CONFLICT ("id") DO NOTHING`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const ids = methodologies.map((m) => `'${m.id}'`).join(', ');

    await queryRunner.query(
      `DELETE FROM "core"."agentMethodology" WHERE "id" IN (${ids}) AND "type" = 'built-in'`,
    );
  }
}
