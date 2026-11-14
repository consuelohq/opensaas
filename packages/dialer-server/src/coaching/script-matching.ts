import type { TranscriptSegmentEvent } from '@consuelo/conversation';
import type { CardRule, CompiledPlaybook } from './playbooks';

// Grammar only: intent vocabulary comes exclusively from published CardRule phrases.
const contractions: Readonly<Record<string, string>> = Object.freeze({
  cannot: 'can not',
  cant: 'can not',
  dont: 'do not',
  doesnt: 'does not',
  didnt: 'did not',
  isnt: 'is not',
  arent: 'are not',
  wasnt: 'was not',
  werent: 'were not',
  wont: 'will not',
  wouldnt: 'would not',
  couldnt: 'could not',
  shouldnt: 'should not',
  havent: 'have not',
  hasnt: 'has not',
  hadnt: 'had not',
  mustnt: 'must not',
  neednt: 'need not',
  im: 'i am',
  ive: 'i have',
  youre: 'you are',
  youve: 'you have',
  theyre: 'they are',
  theyve: 'they have',
  weve: 'we have',
});
const plural = (word: string) => {
  if (word.length > 4 && word.endsWith('ies') && word !== 'series')
    return word.slice(0, -3) + 'y';
  if (word.length > 4 && /[^sui]s$/.test(word)) return word.slice(0, -1);
  return word;
};
const tokens = (text: string): readonly string[] =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) =>
      (Object.hasOwn(contractions, word) ? contractions[word]! : word).split(
        ' ',
      ),
    )
    .map(plural);
type RulePhrases = {
  aliases: readonly (readonly string[])[];
  required: readonly (readonly string[])[];
  forbidden: readonly (readonly string[])[];
};
const phraseCache = new WeakMap<CardRule, RulePhrases>();
function rulePhrases(rule: CardRule): RulePhrases {
  const cached = phraseCache.get(rule);
  if (cached) return cached;
  const prepared = {
    aliases: rule.aliases.map(tokens),
    required: rule.required.map(tokens),
    forbidden: rule.forbidden.map(tokens),
  };
  // Published rules are deeply frozen; mutable callers must never retain stale phrases.
  if (
    Object.isFrozen(rule) &&
    Object.isFrozen(rule.aliases) &&
    Object.isFrozen(rule.required) &&
    Object.isFrozen(rule.forbidden)
  )
    phraseCache.set(rule, prepared);
  return prepared;
}
const occurrences = (
  haystack: readonly string[],
  needle: readonly string[],
) => {
  const found: number[] = [];
  if (!needle.length) return found;
  for (let i = 0; i <= haystack.length - needle.length; i++)
    if (needle.every((word, j) => haystack[i + j] === word)) found.push(i);
  return found;
};
const contains = (haystack: readonly string[], needle: readonly string[]) =>
  occurrences(haystack, needle).length > 0;
const wordCharacter = (character: string) => /[\p{L}\p{N}]/u.test(character);
function unquoted(text: string): string {
  let close: string | null = null;
  let result = '';
  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;
    const withinWord =
      wordCharacter(text[index - 1] ?? '') &&
      wordCharacter(text[index + 1] ?? '');
    if (close !== null) {
      if (
        character === close &&
        !((close === "'" || close === '’') && withinWord)
      ) {
        close = null;
        result += ' . ';
      }
      continue;
    }
    if (
      character === '"' ||
      character === '“' ||
      ((character === "'" || character === '‘') &&
        !wordCharacter(text[index - 1] ?? ''))
    ) {
      close = character === '“' ? '”' : character === '‘' ? '’' : character;
      result += ' . ';
    } else result += character;
  }
  return result;
}
type TurnText = {
  raw: readonly string[];
  clauses: readonly { tokens: readonly string[]; words: ReadonlySet<string> }[];
  evidence: Map<string, PhraseEvidence | null>;
};
const analyze = (text: string): TurnText => ({
  raw: tokens(text),
  evidence: new Map(),
  clauses: unquoted(text.normalize('NFKC'))
    .toLowerCase()
    .split(
      /[.!?;:\n\r]|[—–]|\b(?:but|however|yet|nevertheless)\b|,(?=\s*(?:i|we|you|he|she|they|my|our)\b)/u,
    )
    .map(tokens)
    .filter((clause) => clause.length > 0)
    .map((clause) => ({ tokens: clause, words: new Set(clause) })),
});
const negation = new Set(['no', 'not', 'never', 'without', 'neither', 'nor']);
const historical =
  /\b(?:used to|previously|formerly|in the past|back then|last (?:year|month|week|time)|(?:year|month|week)s? ago|yesterday)\b/;
const reporting = /\b(?:said|says|told|heard|quoted|read|reads)\b/;
const resolved =
  /\b(?:(?:is|are|seems?) (?:fine|okay|ok|acceptable|manageable|sufficient)|works? for (?:me|us)|(?:already )?(?:resolved|settled)|already (?:decided|handled|agreed|approved)|taken care of|no longer (?:an? )?(?:issue|concern|problem)|not (?:an? )?(?:issue|concern|problem))\b/;
type PhraseState = 'affirmed' | 'retracted' | null;
type PhraseEvidence = {
  state: Exclude<PhraseState, null>;
  clause: number;
  end: number;
  length: number;
};
function uncachedPhraseEvidence(
  turn: TurnText,
  phrase: readonly string[],
): PhraseEvidence | null {
  for (
    let clauseIndex = turn.clauses.length - 1;
    clauseIndex >= 0;
    clauseIndex--
  ) {
    const { tokens: clause, words } = turn.clauses[clauseIndex]!;
    if (!phrase.every((word) => words.has(word))) continue;
    const found = occurrences(clause, phrase);
    for (let occurrence = found.length - 1; occurrence >= 0; occurrence--) {
      const index = found[occurrence]!;
      const previousEnd =
        occurrence > 0 ? found[occurrence - 1]! + phrase.length : 0;
      // An explicit repeated assertion can correct the earlier occurrence even
      // without punctuation: "no coverage and now I have coverage". Keep the
      // entire prefix otherwise, including reporting and shared negation.
      let prefixStart = 0;
      if (previousEnd > 0) {
        for (let word = previousEnd; word < index; word++) {
          if (clause[word] !== 'and') continue;
          const next = clause[word + 1];
          const subject =
            next === 'now' || next === 'currently' ? clause[word + 2] : next;
          if (subject && /^(?:i|we|you|he|she|they|my|our)$/.test(subject))
            prefixStart = word + 1;
        }
      }
      const prefix = clause.slice(prefixStart, index);
      const suffix = clause.slice(index + phrase.length);
      // Negation within an approved alias (e.g. "cannot afford") is part of its
      // authored meaning. Only external negation changes that alias's polarity.
      const prefixText = prefix.join(' ');
      const suffixText = suffix.join(' ');
      // Reported and dated mentions are not current assertions or retractions.
      if (
        prefix.some(
          (word) => word === 'had' || word === 'was' || word === 'were',
        )
      )
        continue;
      if (
        historical.test(prefixText) ||
        reporting.test(clause.slice(0, index).join(' '))
      )
        continue;
      // Explicit current possession can coexist with a dated relative clause.
      const currentHolding =
        /\b(?:still|currently|now) (?:have|hold|own|carry|keep)\b/.test(
          prefixText,
        );
      if (
        historical.test(suffixText) &&
        !(currentHolding && /^(?:that|which|i|we)\b/.test(suffixText))
      )
        continue;
      const retracted =
        prefix.some((word) => negation.has(word)) ||
        /^(?:(?:is|are|was|were|do|does|did|has|have|will|would|can|could|should) )?not\b/.test(
          suffixText,
        ) ||
        resolved.test(clause.slice(prefixStart).join(' '));
      return {
        state: retracted ? 'retracted' : 'affirmed',
        clause: clauseIndex,
        end: index + phrase.length,
        length: phrase.length,
      };
    }
  }
  return null;
}
function phraseEvidence(
  turn: TurnText,
  phrase: readonly string[],
): PhraseEvidence | null {
  // Shared aliases are evaluated once per analyzed turn, never across events.
  const key = phrase.join(' ');
  if (turn.evidence.has(key)) return turn.evidence.get(key)!;
  const evidence = uncachedPhraseEvidence(turn, phrase);
  turn.evidence.set(key, evidence);
  return evidence;
}
const phraseState = (turn: TurnText, phrase: readonly string[]): PhraseState =>
  phraseEvidence(turn, phrase)?.state ?? null;
function aliasState(
  turn: TurnText,
  aliases: RulePhrases['aliases'],
): PhraseState {
  let latest: PhraseEvidence | null = null;
  for (const alias of aliases) {
    const evidence = phraseEvidence(turn, alias);
    if (
      evidence &&
      (!latest ||
        evidence.clause > latest.clause ||
        (evidence.clause === latest.clause &&
          (evidence.end > latest.end ||
            (evidence.end === latest.end && evidence.length > latest.length))))
    )
      latest = evidence;
  }
  return latest?.state ?? null;
}
function latestContextAffirmed(
  context: readonly TurnText[],
  phrase: readonly string[],
): boolean {
  for (let index = context.length - 1; index >= 0; index--) {
    const state = phraseState(context[index]!, phrase);
    if (state !== null) return state === 'affirmed';
  }
  return false;
}
const sameScope = (a: TranscriptSegmentEvent, b: TranscriptSegmentEvent) =>
  a.scope.workspaceId === b.scope.workspaceId &&
  a.scope.callSessionId === b.scope.callSessionId &&
  a.scope.callGeneration === b.scope.callGeneration;
const confirmed = (event: TranscriptSegmentEvent) =>
  event.finality === 'final' &&
  event.speaker.role !== 'unknown' &&
  event.speaker.provenance !== 'unknown';

// Context never crosses turns, speakers (unless explicitly "either"), scope,
// reconnect epoch, cursor or a 30-second/six-turn evidence window.
export function scriptContextTurns(
  event: TranscriptSegmentEvent,
  recent: readonly TranscriptSegmentEvent[],
): readonly TranscriptSegmentEvent[] {
  const bySegment = new Map<string, TranscriptSegmentEvent>();
  for (const turn of [...recent, event]) {
    if (
      !sameScope(turn, event) ||
      turn.cursor.epoch !== event.cursor.epoch ||
      turn.cursor.sequence > event.cursor.sequence ||
      turn.observedAtMs > event.observedAtMs ||
      event.observedAtMs - turn.observedAtMs > 30000
    )
      continue;
    const previous = bySegment.get(turn.segmentId);
    if (
      !previous ||
      turn.segmentRevision > previous.segmentRevision ||
      (turn.segmentRevision === previous.segmentRevision &&
        turn.cursor.sequence > previous.cursor.sequence)
    )
      bySegment.set(turn.segmentId, turn);
  }
  const ordered = [...bySegment.values()].sort(
    (a, b) =>
      a.cursor.sequence - b.cursor.sequence ||
      (a.segmentId < b.segmentId ? -1 : a.segmentId > b.segmentId ? 1 : 0),
  );
  // Omitted unknown speech can change the topic; evidence cannot bridge it.
  let boundary = -1;
  for (const turn of ordered)
    if (
      turn.finality === 'final' &&
      (turn.speaker.role === 'unknown' || turn.speaker.provenance === 'unknown')
    )
      boundary = turn.cursor.sequence;
  return ordered
    .filter((turn) => confirmed(turn) && turn.cursor.sequence > boundary)
    .slice(-6);
}
function matchingContext(
  rule: CardRule,
  event: TranscriptSegmentEvent,
  recent: readonly TranscriptSegmentEvent[],
  texts: Map<TranscriptSegmentEvent, TurnText>,
) {
  if (
    // Blank authored triggers mean manual-only, including the selector lane.
    rule.aliases.length === 0 ||
    !confirmed(event) ||
    (rule.speaker !== 'either' && rule.speaker !== event.speaker.role)
  )
    return null;
  const get = (turn: TranscriptSegmentEvent) => {
    let value = texts.get(turn);
    if (!value) {
      value = analyze(turn.text);
      texts.set(turn, value);
    }
    return value;
  };
  const context = recent
    .filter(
      (turn) => rule.speaker === 'either' || turn.speaker.role === rule.speaker,
    )
    .map(get);
  const prepared = rulePhrases(rule);
  if (
    !prepared.required.every((phrase) =>
      latestContextAffirmed(context, phrase),
    ) ||
    prepared.forbidden.some((phrase) =>
      context.some((turn) => contains(turn.raw, phrase)),
    )
  )
    return null;
  return get(event);
}
export function ruleContextEligible(
  rule: CardRule,
  event: TranscriptSegmentEvent,
  recent: readonly TranscriptSegmentEvent[],
): boolean {
  const text = matchingContext(
    rule,
    event,
    scriptContextTurns(event, recent),
    new Map(),
  );
  if (!text) return false;
  // A selector may evaluate unrecognized language, but cannot bypass an explicit
  // authored phrase that was present only as negated, historical or quoted text.
  const aliases = rulePhrases(rule).aliases;
  return (
    !aliases.some((alias) => contains(text.raw, alias)) ||
    aliasState(text, aliases) === 'affirmed'
  );
}
export function selectScriptRule(
  compiled: CompiledPlaybook,
  event: TranscriptSegmentEvent,
  recent: readonly TranscriptSegmentEvent[],
  currentCardId?: string | null,
): CardRule | null {
  if (!confirmed(event)) return null;
  const context = scriptContextTurns(event, recent);
  const texts = new Map<TranscriptSegmentEvent, TurnText>();
  const preferred = new Set(
    compiled.rules.find((rule) => rule.cardId === currentCardId)?.nextCardIds ??
      [],
  );
  return (
    [...compiled.rules]
      .filter((rule) => {
        const text = matchingContext(rule, event, context, texts);
        return (
          text !== null &&
          aliasState(text, rulePhrases(rule).aliases) === 'affirmed'
        );
      })
      .sort(
        (a, b) =>
          b.priority - a.priority ||
          Number(preferred.has(b.cardId)) - Number(preferred.has(a.cardId)) ||
          (a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : 0),
      )[0] ?? null
  );
}
