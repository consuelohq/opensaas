import type {
  TranscriptCursor,
  TranscriptSegmentEvent,
  TimelineState,
} from '@consuelo/conversation';
import type { CompiledPlaybook } from './playbooks';

export const CONTEXT_LIMITS = Object.freeze({
  cards: 32,
  catalogBytes: 48 * 1024,
  turns: 6,
  transcriptCharacters: 8000,
  deltaEvents: 32,
});
export type ClosedSetCatalogCard = {
  readonly cardId: string;
  readonly title: string;
  readonly slotIds: readonly string[];
  readonly slots: readonly {
    readonly slotId: string;
    readonly text: string;
    readonly source: { readonly documentId: string; readonly revision: string };
  }[];
  readonly matching: {
    readonly aliases: readonly string[];
    readonly required: readonly string[];
    readonly forbidden: readonly string[];
    readonly speaker: 'customer' | 'rep' | 'either';
    readonly priority: number;
  };
};
export type ClosedSetSelectorInput = {
  readonly catalog: {
    readonly workspaceId: string;
    readonly playbookId: string;
    readonly publishedVersion: string;
    readonly sourceRevision: number;
    readonly industryPackVersion: string;
    readonly companyPolicyVersion: string;
  };
  readonly cards: readonly ClosedSetCatalogCard[];
  readonly turns: readonly {
    readonly id: string;
    readonly revision: number;
    readonly role: 'rep' | 'customer';
    readonly text: string;
  }[];
  readonly signal: AbortSignal;
};
export type ClosedSetSelection = {
  readonly cardId: string | null;
  readonly slotIds: readonly string[];
  readonly evidence: readonly {
    readonly segmentId: string;
    readonly segmentRevision: number;
  }[];
};
export type ClosedSetSelector = {
  readonly sourceVersion: string;
  select(input: ClosedSetSelectorInput): Promise<unknown>;
};
export const createClosedSetSelector = (options: {
  providerRevision: string;
  modelRevision: string;
  structuredOutput: boolean;
  run: ClosedSetSelector['select'];
}): ClosedSetSelector => {
  if (
    !options.structuredOutput ||
    !options.providerRevision ||
    !options.modelRevision
  )
    throw new Error(
      'Selector requires evaluated structured output configuration',
    );
  return Object.freeze({
    sourceVersion: options.providerRevision + ':' + options.modelRevision,
    select: options.run,
  });
};
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
type Catalog = Pick<ClosedSetSelectorInput, 'catalog' | 'cards'>;
// Object identity is tenant-owned. Identifier strings never address this cache.
const catalogs = new WeakMap<CompiledPlaybook, Catalog | null>();
export function contextCatalog(compiled: CompiledPlaybook): Catalog | null {
  const cached = catalogs.get(compiled);
  if (cached !== undefined) return cached;
  const rules = new Map(
    compiled.rules
      .filter((r) => r.aliases.length > 0)
      .map((r) => [r.cardId, r]),
  );
  const value: Catalog = freeze({
    catalog: {
      workspaceId: compiled.playbook.workspaceId,
      playbookId: compiled.playbook.playbookId,
      publishedVersion: compiled.playbook.publishedVersion,
      sourceRevision: compiled.sourceRevision,
      industryPackVersion: compiled.playbook.industryPackVersion,
      companyPolicyVersion: compiled.playbook.companyPolicyVersion,
    },
    cards: compiled.playbook.cards
      .filter((c) => rules.has(c.id))
      .map((c) => {
        const rule = rules.get(c.id)!;
        return {
          cardId: c.id,
          title: c.title,
          slotIds: c.slots.map((s) => s.id),
          slots: c.slots.map((s) => ({
            slotId: s.id,
            text: s.text,
            source: {
              documentId: s.source.documentId,
              revision: s.source.revision,
            },
          })),
          matching: {
            aliases: [...rule.aliases],
            required: [...rule.required],
            forbidden: [...rule.forbidden],
            speaker: rule.speaker,
            priority: rule.priority,
          },
        };
      }),
  });
  const bounded =
    value.cards.length > 0 &&
    value.cards.length <= CONTEXT_LIMITS.cards &&
    new TextEncoder().encode(JSON.stringify(value)).length <=
      CONTEXT_LIMITS.catalogBytes
      ? value
      : null;
  if (deeplyFrozen(compiled)) catalogs.set(compiled, bounded);
  return bounded;
}
const deeplyFrozen = (value: unknown): boolean =>
  !value ||
  typeof value !== 'object' ||
  (Object.isFrozen(value) && Object.values(value).every(deeplyFrozen));
const sameParty = (a: TranscriptSegmentEvent, b: TranscriptSegmentEvent) =>
  a.participantId === b.participantId &&
  a.legId === b.legId &&
  a.speaker.role === b.speaker.role &&
  a.speaker.provenance === b.speaker.provenance &&
  a.speaker.bindingRevision === b.speaker.bindingRevision;
// Freshness equivalence must retain quotation, polarity and numeric punctuation.
const checkpointText = (text: string) =>
  text.normalize('NFC').toLowerCase().replace(/\s+/gu, ' ').trim();
const acknowledgements = new Set(
  [
    'okay',
    'ok',
    'yes',
    'right',
    'understood',
    'i understand',
    'thank you',
    'thanks',
    'got it',
  ].flatMap((text) => [text, text + '.']),
);
export const repeatedFinal = (
  a: TranscriptSegmentEvent,
  b: TranscriptSegmentEvent,
) => sameParty(a, b) && checkpointText(a.text) === checkpointText(b.text);
export type SelectorCheckpoint = {
  readonly patchId: string;
  readonly capturedCursor: TranscriptCursor;
  readonly commitCursor: TranscriptCursor;
  readonly deltaCursors: readonly TranscriptCursor[];
  readonly admissionReason: 'exact-cursor' | 'benign-final-deltas';
  readonly outcome: 'applied' | 'unchanged';
};
export function checkpointDeltas(
  captured: TimelineState,
  current: TimelineState,
): {
  readonly deltaCursors: readonly TranscriptCursor[];
  readonly admissionReason: SelectorCheckpoint['admissionReason'];
} | null {
  if (
    current.status !== 'active' ||
    captured.cursor.epoch !== current.cursor.epoch ||
    current.cursor.sequence < captured.cursor.sequence ||
    current.scope.workspaceId !== captured.scope.workspaceId ||
    current.scope.callSessionId !== captured.scope.callSessionId ||
    current.scope.callGeneration !== captured.scope.callGeneration
  )
    return null;
  const deltas = current.events.filter(
    (e) => e.cursor.sequence > captured.cursor.sequence,
  );
  if (!deltas.length)
    return current.cursor.sequence === captured.cursor.sequence
      ? { deltaCursors: [], admissionReason: 'exact-cursor' }
      : null;
  if (deltas.length > CONTEXT_LIMITS.deltaEvents) return null;
  let last = [...captured.events]
    .reverse()
    .find(
      (e): e is TranscriptSegmentEvent =>
        e.kind === 'segment' &&
        e.finality === 'final' &&
        checkpointText(e.text).length > 0,
    );
  for (const delta of deltas) {
    if (
      delta.kind !== 'segment' ||
      delta.finality !== 'final' ||
      delta.speaker.role === 'unknown' ||
      delta.speaker.provenance === 'unknown'
    )
      return null;
    const text = checkpointText(delta.text);
    if (!text) continue;
    if (delta.speaker.role === 'rep' && /[?？]/u.test(delta.text)) return null;
    if (last && repeatedFinal(last, delta)) {
      last = delta;
      continue;
    }
    // Questions and all novel customer speech require a new inference checkpoint.
    if (
      delta.speaker.role !== 'rep' ||
      /[?？]/u.test(delta.text) ||
      !acknowledgements.has(text)
    )
      return null;
    last = delta;
  }
  return {
    deltaCursors: deltas.map((e) => ({ ...e.cursor })),
    admissionReason: 'benign-final-deltas',
  };
}
export const freezeCheckpoint = (
  value: SelectorCheckpoint,
): SelectorCheckpoint => freeze(value);
