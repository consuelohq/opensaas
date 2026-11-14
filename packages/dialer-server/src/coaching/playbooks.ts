import {
  validatePlaybook,
  type ApprovedCard,
  type PublishedPlaybook,
} from '@consuelo/conversation';
export const RULES_VERSION = 'script-rules-v1';
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
    throw new Error('Use at most32 approved trigger phrases.');
  const result = v.map((p) => {
    if (
      typeof p !== 'string' ||
      p.length > 80 ||
      !normalizePhrase(p) ||
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
      next.some((id) => !cards.some((c) => c.id === id))
    )
      throw new Error('Invalid card transition');
    return {
      cardId: r.cardId,
      aliases: phrases(r.aliases),
      required: phrases(r.required),
      forbidden: phrases(r.forbidden),
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
  rules: [
    {
      cardId: 'existing-coverage',
      aliases: ['existing coverage', 'already covered'],
      priority: 50,
    },
    {
      cardId: 'affordability',
      aliases: ['too expensive', 'cant afford', 'my budget'],
      priority: 80,
    },
    {
      cardId: 'spouse-and-family',
      aliases: ['my spouse', 'my husband', 'my wife'],
      priority: 60,
    },
    {
      cardId: 'beneficiaries',
      aliases: ['beneficiary', 'beneficiaries'],
      priority: 60,
    },
    {
      cardId: 'employer-coverage',
      aliases: ['employer coverage', 'through work'],
      priority: 65,
    },
    {
      cardId: 'application-and-underwriting',
      aliases: ['underwriting', 'application questions'],
      priority: 55,
    },
  ],
};
