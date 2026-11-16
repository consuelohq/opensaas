export type CurrentScriptEvidence = {
  eligible: boolean;
  reason:
    | 'current-or-unclassified'
    | 'empty-or-quoted'
    | 'historical'
    | 'reported'
    | 'withdrawn'
    | 'mixed-unsupported';
};

const wordCharacter = (character: string) => /[\p{L}\p{N}]/u.test(character);
// Retain clause boundaries when removing quotations; never join their neighbors.
export function unquotedScriptText(text: string): string {
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

const normalize = (text: string) =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(
      /\b(?:dont|doesnt|didnt|isnt|arent|wasnt|werent|havent|hasnt|hadnt)\b/g,
      (word) => {
        const auxiliary: Readonly<Record<string, string>> = {
          dont: 'do',
          doesnt: 'does',
          didnt: 'did',
          isnt: 'is',
          arent: 'are',
          wasnt: 'was',
          werent: 'were',
          havent: 'have',
          hasnt: 'has',
          hadnt: 'had',
        };
        return auxiliary[word] + ' not';
      },
    )
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

// Grammar, not playbook intent vocabulary. Ambiguous present/past forms (read,
// cut, put, etc.) deliberately remain unclassified rather than suppressing them.
const pastVerbs = new Set([
  'was',
  'were',
  'had',
  'did',
  'arose',
  'awoke',
  'became',
  'began',
  'bent',
  'bit',
  'bled',
  'blew',
  'broke',
  'brought',
  'built',
  'bought',
  'caught',
  'chose',
  'came',
  'dealt',
  'drew',
  'drank',
  'drove',
  'ate',
  'fell',
  'fed',
  'felt',
  'fought',
  'found',
  'flew',
  'forgot',
  'forgave',
  'froze',
  'got',
  'gave',
  'grew',
  'hung',
  'heard',
  'hid',
  'held',
  'kept',
  'knew',
  'laid',
  'led',
  'left',
  'lent',
  'lost',
  'made',
  'meant',
  'met',
  'paid',
  'ran',
  'rode',
  'rang',
  'rose',
  'said',
  'saw',
  'sold',
  'sent',
  'shook',
  'shot',
  'sang',
  'sat',
  'slept',
  'spoke',
  'spent',
  'stood',
  'stole',
  'stuck',
  'struck',
  'swam',
  'took',
  'taught',
  'tore',
  'told',
  'thought',
  'threw',
  'understood',
  'used',
  'woke',
  'wore',
  'won',
  'wrote',
]);
const pastPredicate = (word: string) =>
  pastVerbs.has(word) || /^[a-z]{3,}ed$/.test(word);
const finiteAuxiliary =
  /^(?:am|is|are|have|has|do|does|will|would|can|could|may|might|must|should|was|were|had|did)$/;
const clauseBoundary =
  /[.!?;:\n\r]|[—–]|\b(?:but|however|yet|nevertheless)\b|,(?=\s*(?:i|we|you|he|she|they|it|my|our|your|his|her|their|the|this|that|these|those)\b)|\b(?:and|because|although|while|when)\b(?=\s+(?:(?:now|currently|still)\s+)?(?:i|we|you|he|she|they|it|my|our|your|his|her|their|the|this|that|these|those)\b)|\band(?=\s+(?:now|currently|still)\b)/u;
const clauses = (text: string) =>
  unquotedScriptText(text.normalize('NFKC'))
    .toLowerCase()
    .split(clauseBoundary)
    .map(normalize)
    .filter(Boolean);
function predicateWords(clause: string): readonly string[] {
  return clause
    .replace(
      /^(?:(?:although|when|because|after|before|while|if|since|once|previously|formerly|yesterday|now|currently|still) )+/,
      '',
    )
    .split(' ');
}
const personalSubject = (word: string) =>
  /^(?:i|we|you|he|she|they|it|there)$/.test(word);
const personalPredicate = (words: readonly string[]) =>
  personalSubject(words[0] ?? '')
    ? words
        .slice(1)
        .find(
          (word) =>
            !/^(?:previously|formerly|once|already|never|not|just|still|currently|now|also|really)$/.test(
              word,
            ),
        )
    : undefined;
function historicalClause(clause: string): boolean {
  const words = predicateWords(clause);
  // A personal subject makes the main predicate identifiable. Later relative
  // material must not turn "I have the record I requested" into history.
  if (personalSubject(words[0] ?? '')) {
    const predicate = personalPredicate(words);
    if (!predicate) return false;
    if (predicate === 'had' && /\bhad better\b/.test(clause)) return false;
    return pastPredicate(predicate);
  }
  // A finite auxiliary distinguishes the tense of noun subjects, including
  // participial adjectives: "the required form is confusing" is current.
  const auxiliaries = words.filter((word) => finiteAuxiliary.test(word));
  const relativeSubject = words.findIndex(
    (word, index) => index > 0 && personalSubject(word),
  );
  const auxiliary =
    relativeSubject > 0 && auxiliaries.length > 1
      ? auxiliaries[auxiliaries.length - 1]
      : auxiliaries[0];
  if (auxiliary) return pastVerbs.has(auxiliary);
  // Past aspect can introduce a gerund without an auxiliary or personal subject.
  if (
    words.some(
      (word, index) =>
        index > 1 &&
        /^(?:stopped|ceased|finished|started|began)$/.test(word) &&
        /^[a-z]{3,}ing$/.test(words[index + 1] ?? ''),
    )
  )
    return true;
  // A participle inside a noun phrase is not necessarily a finite verb ("a
  // previous trusted concern"). Require a following object/temporal marker or
  // an explicit former-subject construction with an object phrase.
  return words.some(
    (word, index) =>
      index > 1 &&
      pastPredicate(word) &&
      (/^(?:me|us|you|them|him|her|it|this|that|these|those|a|an|the|my|our|your|their|another|to|for|about|with|by|yesterday|last|earlier|previously)$/.test(
        words[index + 1] ?? '',
      ) ||
        (words
          .slice(0, index)
          .some((part) => /^(?:former|previous|old)$/.test(part)) &&
          words.length - index > 2)),
  );
}

type UnsupportedReason = 'historical' | 'reported' | 'withdrawn';
function unsupportedClause(clause: string): UnsupportedReason | null {
  const words = predicateWords(clause);
  const predicate = personalPredicate(words);
  const reported = /^(?:said|says|told|heard|quoted|reported|reports)$/;
  const reportIndex = words.findIndex((word) => reported.test(word));
  const auxiliaryIndex = words.findIndex((word) => finiteAuxiliary.test(word));
  const relativeSubject = words.findIndex(
    (word, index) => index > 0 && personalSubject(word),
  );
  if (
    /^according to\b/.test(clause) ||
    (predicate !== undefined && reported.test(predicate)) ||
    (predicate === undefined &&
      reportIndex >= 0 &&
      (auxiliaryIndex < 0 || reportIndex < auxiliaryIndex) &&
      (relativeSubject < 0 || reportIndex < relativeSubject)) ||
    /^(?:i|we|you|he|she|they|it) (?:am|is|are|was|were) (?:being )?(?:told|quoted|reported)\b/.test(
      clause,
    ) ||
    /\b(?:note|message|example|record|transcript) (?:reads|says)\b/.test(clause)
  )
    return 'reported';
  if (
    /\b(?:never mind|forget (?:it|that)|disregard (?:it|that|my)|withdraw (?:that|my))\b/.test(
      clause,
    ) ||
    /\b(?:no longer|not|never) (?:an? )?(?:worried|concerned|bothered|issue|concern|problem|need|worry|care)\b/.test(
      clause,
    ) ||
    /\b(?:concern|issue|problem) (?:has been |is |was )?(?:already )?(?:resolved|settled|handled|fine|okay|ok)\b/.test(
      clause,
    )
  )
    return 'withdrawn';
  return historicalClause(clause) ? 'historical' : null;
}

// This is an exclusion guard, not a semantic classifier. Unfamiliar current
// statements and current deficits remain eligible for contextual interpretation.
// Authored aliases and speaker/context constraints are evaluated by the caller.
export function currentScriptEvidence(text: string): CurrentScriptEvidence {
  const parts = clauses(text);
  if (!parts.length) return { eligible: false, reason: 'empty-or-quoted' };
  const reasons = parts.map(unsupportedClause);
  if (reasons.includes(null))
    return { eligible: true, reason: 'current-or-unclassified' };
  const reason = reasons[0]!;
  return {
    eligible: false,
    reason: reasons.every((other) => other === reason)
      ? reason
      : 'mixed-unsupported',
  };
}

export const hasCurrentScriptEvidence = (text: string): boolean =>
  currentScriptEvidence(text).eligible;
