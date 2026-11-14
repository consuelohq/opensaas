import {
  validatePlaybook,
  type ApprovedCard,
  type PublishedPlaybook,
} from '@consuelo/conversation';
export const RULES_VERSION = 'script-rules-v2';
export const MAX_RULES_JSON_BYTES = 512 * 1024;
export type CardRule = {
  cardId: string;
  aliases: readonly string[];
  required: readonly string[];
  forbidden: readonly string[];
  priority: number;
  speaker: 'customer' | 'rep' | 'either';
  nextCardIds: readonly string[];
};
export type CompiledPlaybook = {
  schemaVersion: 1;
  scriptId: string;
  sourceRevision: number;
  version: number;
  playbook: PublishedPlaybook;
  rules: readonly CardRule[];
  spans: Readonly<Record<string, { start: number; end: number }>>;
};
type CompileInput = {
  workspaceId: string;
  scriptId: string;
  sourceRevision: number;
  version: number;
  title: string;
  content: string;
  industryPackVersion: string;
  companyPolicyVersion: string;
  rules?: unknown;
};
export const normalizePhrase = (s: string) =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const identifier = (v: unknown): v is string =>
  typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(v);
const frozen = <T>(v: T): T => {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.values(v).forEach(frozen);
    Object.freeze(v);
  }
  return v;
};
const phrases = (v: unknown): string[] => {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > 32)
    throw new Error('Use at most 32 approved trigger phrases per field.');
  const result = v.map((p) => {
    if (
      typeof p !== 'string' ||
      p.length > 80 ||
      !normalizePhrase(p) ||
      normalizePhrase(p).length > 80 ||
      /[\u0000-\u001f]/.test(p)
    )
      throw new Error('Invalid trigger phrase');
    return normalizePhrase(p);
  });
  if (new Set(result).size !== result.length)
    throw new Error('Duplicate trigger phrase');
  return result;
};
export function compilePlaybook(input: CompileInput): CompiledPlaybook {
  if (
    !input.content.trim() ||
    new TextEncoder().encode(input.content).length > 100000 ||
    input.content.includes('\0') ||
    !Number.isSafeInteger(input.sourceRevision) ||
    input.sourceRevision < 1 ||
    !Number.isSafeInteger(input.version) ||
    input.version < 1
  )
    throw new Error('Use saved text or Markdown up to100KB.');
  const content = input.content;
  const headings = [...content.matchAll(/^#{1,6}\s+(.+)$/gm)];
  const blocks = headings.length
    ? headings.map((m, i) => ({
        title: m[1]!.trim(),
        start: m.index!,
        end: headings[i + 1]?.index ?? content.length,
        bodyStart: m.index! + m[0].length,
      }))
    : [{ title: input.title, start: 0, end: content.length, bodyStart: 0 }];
  const spans: Record<string, { start: number; end: number }> = {};
  const cards: ApprovedCard[] = [];
  for (const block of blocks) {
    const body = content.slice(block.bodyStart, block.end);
    const points = [...body.matchAll(/^(?:[-*+]|\d+[.)])\s+(.+)$/gm)];
    if (!body.trim() && !points.length) continue;
    if (points.length < 3 || points.length > 4)
      throw new Error(
        'Each published heading needs3–4 approved bullet points.',
      );
    const id = normalizePhrase(block.title).replace(/ /g, '-');
    if (!identifier(id) || spans[id])
      throw new Error('Use unique short heading names.');
    spans[id] = { start: block.start, end: block.end };
    const excerpt = content.slice(block.start, block.end).trim();
    cards.push({
      id,
      title: block.title,
      stageId: id,
      slots: points.map((m, i) => ({
        id: id + '-' + (i + 1),
        text: m[1]!.trim(),
        source: {
          documentId: input.scriptId,
          revision: String(input.sourceRevision),
          excerpt,
        },
      })),
    });
  }
  const validated = validatePlaybook({
    schemaVersion: 1,
    workspaceId: input.workspaceId,
    playbookId: input.scriptId,
    publishedVersion: input.scriptId + ':' + input.version,
    industryPackVersion: input.industryPackVersion,
    companyPolicyVersion: input.companyPolicyVersion,
    cards,
  });
  if (!validated.ok) throw new Error(validated.reason);
  if (input.rules !== undefined && !Array.isArray(input.rules))
    throw new Error('Rules must be an approved array.');
  if (
    input.rules !== undefined &&
    new TextEncoder().encode(JSON.stringify(input.rules)).length >
      MAX_RULES_JSON_BYTES
  )
    throw new Error('Use at most 512 KB of reviewed trigger rules.');
  const rawRules = (input.rules ??
    cards.map((card) => ({
      cardId: card.id,
      aliases:
        normalizePhrase(card.title).length <= 80
          ? [normalizePhrase(card.title)]
          : [],
      priority: 0,
      speaker: 'customer',
    }))) as Record<string, unknown>[];
  if (rawRules.length > cards.length) throw new Error('Too many rules');
  const ruleIds = new Set<string>();
  const rules = rawRules.map((r) => {
    if (
      !r ||
      typeof r !== 'object' ||
      Array.isArray(r) ||
      Object.keys(r).some(
        (key) =>
          ![
            'cardId',
            'aliases',
            'required',
            'forbidden',
            'priority',
            'speaker',
            'nextCardIds',
          ].includes(key),
      ) ||
      !identifier(r.cardId) ||
      !cards.some((c) => c.id === r.cardId) ||
      ruleIds.has(r.cardId) ||
      !Number.isInteger(r.priority) ||
      Number(r.priority) < 0 ||
      Number(r.priority) > 100 ||
      (r.speaker !== undefined &&
        !['customer', 'rep', 'either'].includes(String(r.speaker)))
    )
      throw new Error('Invalid approved rule/card');
    ruleIds.add(r.cardId);
    const next = r.nextCardIds ?? [];
    if (
      !Array.isArray(next) ||
      next.length > 16 ||
      new Set(next).size !== next.length ||
      next.some((id) => !cards.some((c) => c.id === id))
    )
      throw new Error('Invalid card transition');
    const aliases = phrases(r.aliases);
    const required = phrases(r.required);
    const forbidden = phrases(r.forbidden);
    if (required.some((phrase) => forbidden.includes(phrase)))
      throw new Error('A phrase cannot be both required and forbidden.');
    return {
      cardId: r.cardId,
      aliases,
      required,
      forbidden,
      priority: Number(r.priority),
      speaker: (r.speaker ?? 'customer') as CardRule['speaker'],
      nextCardIds: next as string[],
    };
  });
  return frozen({
    schemaVersion: 1,
    scriptId: input.scriptId,
    sourceRevision: input.sourceRevision,
    version: input.version,
    playbook: validated.value,
    rules,
    spans,
  });
}
export const SYNTHETIC_LIFE_INSURANCE = {
  label: 'Synthetic examples — require team review before publication',
  content: `# Existing coverage
- Ask about existing coverage
- Confirm who it protects
- Ask what they would change

# Affordability
- Ask about their budget
- Clarify their main concern
- Review approved options together

# Spouse and family
- Ask who should participate
- Invite their questions
- Agree on a follow-up

# Beneficiaries
- Ask who they would name
- Confirm their main priority
- Review the approved process

# Employer coverage
- Ask about employer coverage
- Ask what they understand
- Review their supplied documents

# Application and underwriting
- Ask about application questions
- Explain the approved next step
- Refer specifics to approved materials
`,
  // Explicit synthetic authoring vocabulary, not an industry inference registry.
  // Every tenant must review both these triggers and the source-linked points.
  rules: [
    {
      cardId: 'existing-coverage',
      aliases: [
        'existing coverage',
        'already covered',
        'already insured',
        'have coverage',
        'have insurance',
        'have life insurance',
        'have a policy',
        'have a life policy',
        'have a term policy',
        'have term insurance',
        'have whole life',
        'have a whole life policy',
        'have permanent coverage',
        'have personal coverage',
        'have individual coverage',
        'carry life insurance',
        'carry a policy',
        'got life insurance',
        'got a policy',
        'covered already',
        'insured already',
        'policy in place',
        'coverage in place',
        'policy of my own',
        'my own life insurance',
        'insurance elsewhere',
        'coverage elsewhere',
        'insured elsewhere',
        'covered elsewhere',
        'policy with another company',
        'policy through another provider',
        'paying for life insurance',
      ],
      priority: 50,
    },
    {
      cardId: 'affordability',
      aliases: [
        'too expensive',
        'cant afford',
        'my budget',
        'does not fit my budget',
        'not in my budget',
        'do not have the money',
        'do not have extra money',
        'not enough money',
        'too much money',
        'money is tight',
        'fixed income',
        'paycheck to paycheck',
        'cost too much',
        'premium is too high',
        'premiums are too high',
        'monthly premium is high',
        'price is too high',
        'payment is too high',
        'cheaper option',
        'lower premium',
        'payment options',
        'pay monthly',
        'pay annually',
        'how much is it',
        'how much would it be',
        'what would i pay',
        'what does it cost',
        'how much does it cost',
        'how much per month',
        'how much a month',
        'what is the monthly premium',
        'what will it run',
      ],
      priority: 80,
    },
    {
      cardId: 'spouse-and-family',
      aliases: [
        'my spouse',
        'my husband',
        'my wife',
        'talk to my partner',
        'talk with my partner',
        'check with my partner',
        'ask my partner',
        'discuss with my partner',
        'discuss it with my partner',
        'run it by my partner',
        'run this by my partner',
        'talk to my family',
        'talk with my family',
        'check with my family',
        'ask my family',
        'discuss with my family',
        'consult my partner',
        'consult my family',
        'family decision',
        'decide together',
        'make decisions together',
        'decide as a couple',
        'need family approval',
        'need my partners approval',
        'cannot decide alone',
        'not my decision alone',
        'get their input',
        'get their approval',
        'talk it over at home',
        'discuss it at home',
        'include my partner',
        'bring my partner',
      ],
      priority: 60,
    },
    {
      cardId: 'beneficiaries',
      aliases: [
        'beneficiary',
        'who gets the money',
        'who receives the money',
        'who would get the money',
        'who would receive the money',
        'who gets paid',
        'who is paid',
        'who gets the payout',
        'who receives the payout',
        'who would receive the payout',
        'who gets the benefit',
        'who receives the benefit',
        'who does it go to',
        'who it goes to',
        'money go to',
        'money goes to',
        'leave the money to',
        'name my children',
        'name my child',
        'name my partner',
        'name a trust',
        'name more than one',
        'list my children',
        'put my kids down',
        'split the payout',
        'split the money',
        'split the death benefit',
        'divide the death benefit',
        'change who receives',
        'choose who receives',
        'go to my children',
        'go to my kids',
      ],
      priority: 60,
    },
    {
      cardId: 'employer-coverage',
      aliases: [
        'employer coverage',
        'through work',
        'through my employer',
        'through my job',
        'through my company',
        'coverage from my job',
        'insurance from work',
        'insurance at work',
        'coverage at work',
        'insurance from my employer',
        'coverage from my employer',
        'employer provides',
        'employer pays',
        'company provides',
        'company pays',
        'covered by my employer',
        'employer provided',
        'employer paid',
        'workplace coverage',
        'workplace life insurance',
        'group life',
        'group policy',
        'group plan',
        'employer plan',
        'employee benefits',
        'work benefits',
        'company benefits',
        'company plan',
        'job benefits',
        'change jobs',
        'leave my job',
        'when i retire',
      ],
      priority: 70,
    },
    {
      cardId: 'application-and-underwriting',
      aliases: [
        'underwriting',
        'application questions',
        'medical exam',
        'need an exam',
        'physical exam',
        'need a physical',
        'health questions',
        'medical questions',
        'medical history',
        'medical records',
        'health condition',
        'pre existing',
        'preexisting',
        'blood test',
        'blood work',
        'bloodwork',
        'health check',
        'taking medication',
        'take medication',
        'prescription medication',
        'will i qualify',
        'would i qualify',
        'can i qualify',
        'do i qualify',
        'am i eligible',
        'application process',
        'application form',
        'apply for coverage',
        'apply for insurance',
        'how do i apply',
        'approval take',
        'get approved',
      ],
      priority: 55,
    },
  ],
};
