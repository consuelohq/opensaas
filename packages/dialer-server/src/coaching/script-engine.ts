import {
  createTimeline,
  reduceTimeline,
  createCardState,
  reduceCard,
  admitCapability,
  validateCardPatch,
  type ConversationScope,
  type ParticipantBinding,
  type AssistancePolicy,
  type TranscriptEvent,
  type TranscriptSegmentEvent,
  type CardPatch,
  type CardState,
  type TimelineState,
} from '@consuelo/conversation';
import {
  normalizePhrase,
  RULES_VERSION,
  type CompiledPlaybook,
  type CardRule,
} from './playbooks';
export type MercuryCueView = {
  scopeKey: string;
  revision: number;
  heading: string;
  kind: 'approved' | 'manual';
  status: 'live' | 'manual' | 'delayed' | 'reconnecting' | 'unavailable';
  points: readonly {
    slotId: string;
    text: string;
    exact: string;
    source: string;
  }[];
};
export type ClosedSetSelector = {
  sourceVersion: string;
  select(input: {
    cards: readonly { cardId: string; slotIds: readonly string[] }[];
    turns: readonly {
      id: string;
      revision: number;
      role: string;
      text: string;
    }[];
    signal: AbortSignal;
  }): Promise<unknown>;
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
export type ScriptSessionOptions = {
  scope: ConversationScope;
  participants: readonly ParticipantBinding[];
  compiled: CompiledPlaybook;
  policy: AssistancePolicy;
  nowMs: () => number;
  selector?: ClosedSetSelector;
  workerGeneration?: number;
  contextIntervalMs?: number;
  selectorDeadlineMs?: number;
  maxSelectorRequests?: number;
  minimumDwellMs?: number;
  onChange?: (view: MercuryCueView) => void;
  onDecision?: (patch: CardPatch) => void;
};
let globalSelectors = 0;
function phrasePresent(text: string, phrase: string) {
  return (' ' + text + ' ').includes(' ' + phrase + ' ');
}
function eligibleAlias(text: string, alias: string) {
  const normalized = normalizePhrase(text);
  if (!phrasePresent(normalized, alias)) return false;
  const withoutQuotes = text
    .replace(/["“][^"”]*["”]/g, ' ')
    .replace(/(?:^|\s)'[^']+'(?=\s|$)/g, ' ');
  const clean = normalizePhrase(withoutQuotes);
  const index = (' ' + clean + ' ').indexOf(' ' + alias + ' ');
  if (index < 0) return false;
  const prefix = clean.slice(0, index).split(' ').slice(-5).join(' ');
  return !/(?:\b(?:no|not|never|dont|doesnt|isnt|without)\b|used to|previously|last year|in the past|had)/.test(
    prefix,
  );
}
export function ruleContextEligible(
  rule: CardRule,
  event: TranscriptSegmentEvent,
  recent: readonly TranscriptSegmentEvent[],
): boolean {
  if (
    event.finality !== 'final' ||
    event.speaker.role === 'unknown' ||
    (rule.speaker !== 'either' && rule.speaker !== event.speaker.role)
  )
    return false;
  const context = normalizePhrase(
    recent
      .slice(-6)
      .filter((s) => s.finality === 'final' && s.speaker.role !== 'unknown')
      .map((s) => s.text)
      .join(' '),
  );
  if (
    !rule.required.every((p) => phrasePresent(context, p)) ||
    rule.forbidden.some((p) => phrasePresent(context, p))
  )
    return false;
  return !rule.aliases.some(
    (a) =>
      phrasePresent(normalizePhrase(event.text), a) &&
      !eligibleAlias(event.text, a),
  );
}
export function selectScriptRule(
  compiled: CompiledPlaybook,
  event: TranscriptSegmentEvent,
  recent: readonly TranscriptSegmentEvent[],
): CardRule | null {
  if (event.finality !== 'final' || event.speaker.role === 'unknown')
    return null;
  const context = normalizePhrase(
    recent
      .slice(-6)
      .filter((s) => s.finality === 'final' && s.speaker.role !== 'unknown')
      .map((s) => s.text)
      .join(' '),
  );
  return (
    [...compiled.rules]
      .filter(
        (r) =>
          (r.speaker === 'either' || r.speaker === event.speaker.role) &&
          r.aliases.some((a) => eligibleAlias(event.text, a)) &&
          r.required.every((p) => phrasePresent(context, p)) &&
          !r.forbidden.some((p) => phrasePresent(context, p)),
      )
      .sort(
        (a, b) => b.priority - a.priority || a.cardId.localeCompare(b.cardId),
      )[0] ?? null
  );
}
export function createScriptSession(options: ScriptSessionOptions) {
  const { scope, compiled, nowMs } = options;
  let policy = options.policy;
  let timeline = createTimeline(scope, options.participants);
  let card = createCardState(
    scope,
    compiled.playbook,
    options.workerGeneration ?? 1,
  );
  let mode: 'script' | 'manual' | 'off' = 'script';
  let automatic = false;
  let status: MercuryCueView['status'] = 'manual';
  let capacityRejected = false;
  let controller: AbortController | null = null;
  let pending: Promise<void> = Promise.resolve();
  let fence = 0;
  let requests = 0;
  let selectorDiscards = 0;
  let lastContextAt = -Infinity;
  let lastChangeAt = -Infinity;
  let lastPriority = -1;
  let lastSelectedCursor = 0;
  let viewRevision = 0;
  let lastSignature = '';
  let currentScopeKey = '';
  let lastDecision: CardPatch | null = null;
  const sourceVersions = {
    manual: 'manual-v1',
    rules: RULES_VERSION,
    selector: options.selector?.sourceVersion ?? 'disabled',
  };
  const currentView = (scopeKey: string): MercuryCueView => {
    const selected =
      compiled.playbook.cards.find((c) => c.id === card.cardId) ??
      compiled.playbook.cards[0]!;
    const ids = card.slots.length
      ? card.slots
      : selected.slots.map((s) => s.id);
    return {
      scopeKey,
      revision: viewRevision,
      heading: selected.title,
      kind: automatic ? 'approved' : 'manual',
      status,
      points: ids.map((id) => {
        const slot = selected.slots.find((s) => s.id === id)!;
        return {
          slotId: slot.id,
          text: slot.text,
          exact: slot.source.excerpt,
          source: slot.source.documentId + ' @' + slot.source.revision,
        };
      }),
    };
  };
  const emit = () => {
    const v = currentView(currentScopeKey),
      signature = JSON.stringify({ ...v, revision: 0, scopeKey: '' });
    if (signature !== lastSignature) {
      lastSignature = signature;
      viewRevision++;
      options.onChange?.(currentView(currentScopeKey));
    }
  };
  const cancel = () => {
    fence++;
    controller?.abort();
    controller = null;
  };
  const commit = (
    cardId: string,
    source: CardPatch['source'],
    evidence: CardPatch['evidence'],
    base = card.revision,
    cursor = timeline.cursor,
    slots?: readonly string[],
    pin?: boolean,
  ) => {
    const target = compiled.playbook.cards.find((c) => c.id === cardId);
    if (!target) return false;
    const ids = slots ?? target.slots.map((s) => s.id);
    const changes = Array.from(
      { length: Math.max(ids.length, card.slots.length) },
      (_, position) => ({ position, approvedSlotId: ids[position] ?? null }),
    ).filter(
      (c) =>
        card.cardId !== cardId || card.slots[c.position] !== c.approvedSlotId,
    );
    const candidate = {
      schemaVersion: 1,
      patchId: source + ':' + timeline.cursor.sequence + ':' + card.revision,
      scope,
      baseCardRevision: base,
      transcriptCursor: cursor,
      workerGeneration: card.workerGeneration,
      policyRevision: policy.revision,
      publishedScriptVersion: compiled.playbook.publishedVersion,
      cardId,
      source,
      sourceVersion: sourceVersions[source],
      changedSlots: changes,
      evidence,
      issuedAtMs: nowMs(),
      expiresAtMs: nowMs() + 5000,
      ...(pin !== undefined ? { pin } : {}),
    };
    const checked = validateCardPatch(candidate);
    if (!checked.ok) return false;
    const result = reduceCard(card, checked.value, {
      timeline,
      policy,
      sourceVersions,
      nowMs: nowMs(),
    });
    if (result.status === 'applied') {
      card = result.state;
      lastDecision = checked.value;
      options.onDecision?.(checked.value);
      lastChangeAt = nowMs();
      automatic = source !== 'manual';
      status = automatic ? 'live' : 'manual';
      emit();
      return true;
    }
    return result.status === 'unchanged';
  };
  const launchSelector = () => {
    const selector = options.selector;
    if (
      !selector ||
      mode !== 'script' ||
      card.pinned ||
      !admitCapability(policy, scope, 'live-coaching', nowMs()).allowed ||
      timeline.status !== 'active' ||
      controller ||
      globalSelectors >= 4 ||
      requests >= (options.maxSelectorRequests ?? 20) ||
      timeline.cursor.sequence === lastSelectedCursor ||
      nowMs() - lastContextAt < (options.contextIntervalMs ?? 15000)
    )
      return;
    const turns = Object.values(timeline.segments)
      .filter((s) => s.finality === 'final')
      .slice(-8);
    if (!turns.length) return;
    const bytes = turns.reduce((n, s) => n + s.text.length, 0);
    if (bytes > 8000) return;
    const latest = turns[turns.length - 1]!;
    const eligibleIds = new Set(
      compiled.rules
        .filter((r) => ruleContextEligible(r, latest, turns))
        .map((r) => r.cardId),
    );
    if (!eligibleIds.size) return;
    controller = new AbortController();
    const jobController = controller,
      jobFence = fence,
      base = card.revision,
      cursor = timeline.cursor;
    requests++;
    globalSelectors++;
    lastContextAt = nowMs();
    lastSelectedCursor = cursor.sequence;
    let timer: ReturnType<typeof setTimeout>;
    const cancelled = new Promise<never>((_, reject) => {
      jobController.signal.addEventListener(
        'abort',
        () => reject(new Error('cancelled')),
        { once: true },
      );
      timer = setTimeout(
        () => {
          jobController.abort();
        },
        Math.min(5000, options.selectorDeadlineMs ?? 5000),
      );
    });
    pending = Promise.race([
      Promise.resolve().then(() =>
        selector.select({
          cards: compiled.playbook.cards
            .filter((c) => eligibleIds.has(c.id))
            .map((c) => ({
              cardId: c.id,
              slotIds: c.slots.map((s) => s.id),
            })),
          turns: turns.map((s) => ({
            id: s.segmentId,
            revision: s.segmentRevision,
            role: s.speaker.role,
            text: s.text,
          })),
          signal: jobController.signal,
        }),
      ),
      cancelled,
    ])
      .then((raw) => {
        if (
          !raw ||
          typeof raw !== 'object' ||
          fence !== jobFence ||
          jobController.signal.aborted ||
          mode !== 'script' ||
          card.pinned ||
          !admitCapability(policy, scope, 'live-coaching', nowMs()).allowed
        )
          return;
        const output = raw as Record<string, unknown>;
        if (
          typeof output.cardId !== 'string' ||
          !eligibleIds.has(output.cardId) ||
          !Array.isArray(output.slotIds) ||
          output.slotIds.length > 4 ||
          output.slotIds.some((s) => typeof s !== 'string') ||
          !Array.isArray(output.evidence) ||
          output.evidence.length > 32 ||
          !output.evidence.length
        )
          return;
        const rule = compiled.rules.find((r) => r.cardId === output.cardId);
        const currentTurns = Object.values(timeline.segments).filter(
          (s) => s.finality === 'final',
        );
        const currentLast = currentTurns[currentTurns.length - 1];
        if (
          !rule ||
          !currentLast ||
          !ruleContextEligible(rule, currentLast, currentTurns)
        )
          return;
        if (
          !output.evidence.every((e) => {
            if (!e || typeof e !== 'object') return false;
            const segment =
              timeline.segments[(e as { segmentId: string }).segmentId];
            return (
              !!segment &&
              (rule.speaker === 'either' ||
                rule.speaker === segment.speaker.role)
            );
          })
        )
          return;
        // Model-supplied source, scope, generation, pin and free text never enter the trusted patch.
        if (
          output.cardId !== card.cardId &&
          nowMs() - lastChangeAt < (options.minimumDwellMs ?? 1500)
        )
          return;
        const committed = commit(
          output.cardId,
          'selector',
          output.evidence as CardPatch['evidence'],
          base,
          cursor,
          output.slotIds as string[],
        );
        if (!committed) selectorDiscards++;
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(timer!);
        globalSelectors--;
        if (controller === jobController) controller = null;
      });
  };
  return {
    async ingest(event: unknown) {
      if (
        mode === 'off' ||
        !admitCapability(policy, scope, 'live-coaching', nowMs()).allowed
      )
        return { status: 'rejected', reason: 'capture/coaching not admitted' };
      const result = reduceTimeline(timeline, event);
      if (result.status === 'rejected') {
        if (result.reason?.includes('capacity')) {
          capacityRejected = true;
          status = 'unavailable';
          cancel();
          emit();
        }
        return result;
      }
      if (result.status !== 'applied') return result;
      timeline = result.state;
      const e = event as TranscriptEvent;
      if (timeline.status !== 'active') {
        cancel();
        status = 'unavailable';
        emit();
        return result;
      }
      if (e.kind === 'reconnected') {
        cancel();
        status = 'reconnecting';
        emit();
        return result;
      }
      if (e.kind === 'gap') {
        status = 'delayed';
        emit();
        return result;
      }
      if (e.kind === 'segment' && e.finality === 'final') {
        const beforeRevision = card.revision;
        const rule = selectScriptRule(
          compiled,
          e,
          Object.values(timeline.segments),
        );
        if (
          rule &&
          !card.pinned &&
          mode === 'script' &&
          (rule.priority > lastPriority ||
            nowMs() - lastChangeAt >= (options.minimumDwellMs ?? 1500))
        ) {
          if (
            commit(rule.cardId, 'rules', [
              { segmentId: e.segmentId, segmentRevision: e.segmentRevision },
            ])
          )
            lastPriority = rule.priority;
        }
        if (card.revision !== beforeRevision) cancel();
        launchSelector();
      }
      return result;
    },
    control(action: 'pin' | 'auto' | 'next' | 'previous' | 'off') {
      cancel();
      if (
        !admitCapability(policy, scope, 'manual-reference', nowMs()).allowed
      ) {
        status = 'unavailable';
        emit();
        return;
      }
      if (action === 'off') {
        mode = 'off';
        automatic = false;
        status = 'manual';
        emit();
        return;
      }
      const cards = compiled.playbook.cards;
      let index = Math.max(
        0,
        cards.findIndex((c) => c.id === card.cardId),
      );
      if (action === 'next') index = (index + 1) % cards.length;
      if (action === 'previous')
        index = (index + cards.length - 1) % cards.length;
      mode = action === 'auto' ? 'script' : 'manual';
      commit(
        cards[index]!.id,
        'manual',
        [],
        card.revision,
        timeline.cursor,
        undefined,
        action !== 'auto',
      );
    },
    renew(next: AssistancePolicy) {
      policy = next;
      if (!admitCapability(policy, scope, 'live-coaching', nowMs()).allowed) {
        cancel();
        automatic = false;
        status = admitCapability(policy, scope, 'manual-reference', nowMs())
          .allowed
          ? 'manual'
          : 'unavailable';
        emit();
      }
    },
    view(scopeKey: string) {
      currentScopeKey = scopeKey;
      emit();
      return currentView(scopeKey);
    },
    unavailable(reason: 'delayed' | 'unavailable' = 'unavailable') {
      cancel();
      status = reason;
      emit();
    },
    flush: () => pending,
    dispose() {
      cancel();
      mode = 'off';
      status = 'unavailable';
    },
    decision: () => lastDecision,
    diagnostics: () => ({
      cursor: timeline.cursor,
      capacityRejected,
      requests,
      selectorDiscards,
      workerGeneration: card.workerGeneration,
      mode,
    }),
  };
}
export type ScriptSession = ReturnType<typeof createScriptSession>;
