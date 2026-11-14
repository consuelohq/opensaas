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
import { RULES_VERSION, type CompiledPlaybook } from './playbooks';
import {
  ruleContextEligible,
  selectScriptRule,
  scriptContextTurns,
} from './script-matching';
import { normalizePhrase } from './playbooks';
import {
  contextCatalog,
  checkpointDeltas,
  repeatedFinal,
  freezeCheckpoint,
  CONTEXT_LIMITS,
  type ClosedSetSelector,
  type SelectorCheckpoint,
} from './context-selector';
import {
  sharedContextScheduler,
  type ContextScheduler,
} from './context-scheduler';
export { createClosedSetSelector } from './context-selector';
export type {
  ClosedSetSelector,
  ClosedSetSelectorInput,
  ClosedSetSelection,
  SelectorCheckpoint,
} from './context-selector';
export { ruleContextEligible, selectScriptRule } from './script-matching';
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
  scheduler?: ContextScheduler;
  onSelectorCheckpoint?: (checkpoint: SelectorCheckpoint) => void;
  onChange?: (view: MercuryCueView) => void;
  onDecision?: (patch: CardPatch) => void;
};
export function createScriptSession(options: ScriptSessionOptions) {
  const configuredRequestLimit = options.maxSelectorRequests ?? 20;
  if (
    !Number.isSafeInteger(configuredRequestLimit) ||
    configuredRequestLimit < 0
  )
    throw new Error('Invalid selector request limit');
  const requestLimit = Math.min(20, configuredRequestLimit);
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
  const scheduler = options.scheduler ?? sharedContextScheduler;
  const schedulerOwner = {};
  const catalog = contextCatalog(compiled);
  let queued = false;
  let dirty = false;
  let intervalTimer: ReturnType<typeof setTimeout> | undefined;
  let lastMeaningfulFinal: TranscriptSegmentEvent | undefined;
  let lastSelectorCheckpoint: SelectorCheckpoint | null = null;
  let selectorCheckpoints = 0;
  let selectorFailures = 0;
  let selectorQueueRejected = 0;
  let transportUnsettled = false;
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
    dirty = false;
    clearTimeout(intervalTimer);
    intervalTimer = undefined;
    scheduler.cancel(schedulerOwner);
  };
  const commit = (
    cardId: string,
    source: CardPatch['source'],
    evidence: CardPatch['evidence'],
    base = card.revision,
    cursor = timeline.cursor,
    slots?: readonly string[],
    pin?: boolean,
    capturedTimeline: TimelineState = timeline,
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
      patchId: source + ':' + cursor.sequence + ':' + card.revision,
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
      timeline: capturedTimeline,
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
    if (result.status === 'unchanged' && source !== 'manual') {
      automatic = true;
      status = 'live';
      emit();
    }
    return result.status === 'unchanged';
  };
  const finalTurns = () => {
    const finals = Object.values(timeline.segments)
      .filter((s) => s.finality === 'final')
      .sort((a, b) => a.cursor.sequence - b.cursor.sequence);
    const latest = finals[finals.length - 1];
    return latest
      ? scriptContextTurns(latest, finals).slice(-CONTEXT_LIMITS.turns)
      : [];
  };
  const canSelect = () =>
    !!options.selector &&
    !!catalog &&
    mode === 'script' &&
    !card.pinned &&
    !capacityRejected &&
    timeline.status === 'active' &&
    admitCapability(policy, scope, 'live-coaching', nowMs()).allowed &&
    requests < requestLimit;
  const scheduleSelector = () => {
    if (!dirty || !canSelect() || queued || controller) return;
    const remaining =
      Math.max(0, Math.min(30000, options.contextIntervalMs ?? 15000)) -
      (nowMs() - lastContextAt);
    if (remaining > 0) {
      if (!intervalTimer) {
        intervalTimer = setTimeout(() => {
          intervalTimer = undefined;
          scheduleSelector();
        }, remaining);
        intervalTimer.unref?.();
      }
      return;
    }
    let finish!: () => void;
    pending = new Promise<void>((r) => {
      finish = r;
    });
    queued = true;
    const admissionFence = fence;
    const admission = scheduler.enqueue(schedulerOwner, async () => {
      queued = false;
      if (!dirty || !canSelect()) {
        finish();
        return;
      }
      const selector = options.selector!;
      const turns = finalTurns();
      const latest = turns[turns.length - 1];
      if (
        !latest ||
        latest.cursor.epoch !== timeline.cursor.epoch ||
        latest.cursor.sequence !== timeline.cursor.sequence ||
        !normalizePhrase(latest.text) ||
        turns.reduce((n, s) => n + s.text.length, 0) >
          CONTEXT_LIMITS.transcriptCharacters
      ) {
        dirty = false;
        finish();
        return;
      }
      const eligibleIds = new Set(
        compiled.rules
          .filter((r) => ruleContextEligible(r, latest, turns))
          .map((r) => r.cardId),
      );
      const cards = catalog!.cards.filter((c) => eligibleIds.has(c.cardId));
      if (!cards.length) {
        dirty = false;
        finish();
        return;
      }
      controller = new AbortController();
      const jobController = controller,
        jobFence = fence,
        base = card.revision,
        capturedTimeline = timeline,
        capturedPolicyRevision = policy.revision,
        capturedWorker = card.workerGeneration,
        capturedVersion = compiled.playbook.publishedVersion,
        capturedSourceRevision = compiled.sourceRevision;
      dirty = false;
      requests++;
      lastContextAt = nowMs();
      transportUnsettled = true;
      let settled = false,
        timer: ReturnType<typeof setTimeout> | undefined;
      const provider = (async () =>
        selector.select({
          catalog: catalog!.catalog,
          cards,
          turns: turns.map((s) => ({
            id: s.segmentId,
            revision: s.segmentRevision,
            role: s.speaker.role as 'customer' | 'rep',
            text: s.text,
          })),
          signal: jobController.signal,
        }))();
      const physical = provider.then(
        () => {
          settled = true;
        },
        () => {
          settled = true;
        },
      );
      let abortListener!: () => void;
      const cancelled = new Promise<never>((_, reject) => {
        abortListener = () => reject(new Error('selector cancelled'));
        jobController.signal.addEventListener('abort', abortListener, {
          once: true,
        });
        timer = setTimeout(
          () => jobController.abort(),
          Math.max(1, Math.min(5000, options.selectorDeadlineMs ?? 5000)),
        );
      });
      try {
        const raw = await Promise.race([provider, cancelled]);
        if (!raw || typeof raw !== 'object') return;
        const output = raw as Record<string, unknown>;
        if (output.cardId === null) return;
        const freshness = checkpointDeltas(capturedTimeline, timeline);
        if (
          fence !== jobFence ||
          jobController.signal.aborted ||
          !canSelectForCommit() ||
          card.revision !== base ||
          card.workerGeneration !== capturedWorker ||
          policy.revision !== capturedPolicyRevision ||
          compiled.playbook.publishedVersion !== capturedVersion ||
          compiled.sourceRevision !== capturedSourceRevision ||
          selector.sourceVersion !== sourceVersions.selector ||
          !freshness
        ) {
          selectorDiscards++;
          return;
        }
        if (
          typeof output.cardId !== 'string' ||
          !eligibleIds.has(output.cardId) ||
          !Array.isArray(output.slotIds) ||
          !output.slotIds.length ||
          output.slotIds.length > 4 ||
          output.slotIds.some((s) => typeof s !== 'string') ||
          !Array.isArray(output.evidence) ||
          !output.evidence.length ||
          output.evidence.length > 32
        ) {
          selectorDiscards++;
          return;
        }
        const rule = compiled.rules.find((r) => r.cardId === output.cardId);
        const currentTurns = finalTurns(),
          currentLast = [...currentTurns]
            .reverse()
            .find(
              (s) =>
                rule &&
                (rule.speaker === 'either' ||
                  s.speaker.role === rule.speaker) &&
                normalizePhrase(s.text),
            );
        if (
          !rule ||
          !currentLast ||
          !ruleContextEligible(rule, currentLast, currentTurns)
        ) {
          selectorDiscards++;
          return;
        }
        const capturedEvidence = new Map(turns.map((s) => [s.segmentId, s]));
        if (
          !output.evidence.every((e) => {
            if (!e || typeof e !== 'object') return false;
            const ref = e as { segmentId: unknown; segmentRevision: unknown };
            if (
              typeof ref.segmentId !== 'string' ||
              !Number.isSafeInteger(ref.segmentRevision)
            )
              return false;
            const before = capturedEvidence.get(ref.segmentId),
              current = timeline.segments[ref.segmentId];
            return (
              !!before &&
              !!current &&
              before.segmentRevision === ref.segmentRevision &&
              current.segmentRevision === ref.segmentRevision &&
              current.finality === 'final' &&
              before.speaker.role === current.speaker.role &&
              (rule.speaker === 'either' ||
                rule.speaker === before.speaker.role)
            );
          })
        ) {
          selectorDiscards++;
          return;
        }
        if (
          output.cardId !== card.cardId &&
          nowMs() - lastChangeAt < (options.minimumDwellMs ?? 1500)
        ) {
          selectorDiscards++;
          return;
        }
        const beforeRevision = card.revision;
        const committed = commit(
          output.cardId,
          'selector',
          output.evidence as CardPatch['evidence'],
          base,
          capturedTimeline.cursor,
          output.slotIds as string[],
          undefined,
          capturedTimeline,
        );
        if (!committed) {
          selectorDiscards++;
          return;
        }
        lastSelectorCheckpoint = freezeCheckpoint({
          patchId: 'selector:' + capturedTimeline.cursor.sequence + ':' + base,
          capturedCursor: { ...capturedTimeline.cursor },
          commitCursor: { ...timeline.cursor },
          deltaCursors: freshness.deltaCursors,
          admissionReason: freshness.admissionReason,
          outcome: card.revision !== beforeRevision ? 'applied' : 'unchanged',
        });
        selectorCheckpoints++;
        options.onSelectorCheckpoint?.(lastSelectorCheckpoint);
      } catch (_error: unknown) {
        selectorFailures++;
        if (fence === jobFence && mode === 'script') {
          status = 'unavailable';
          emit();
        }
      } finally {
        clearTimeout(timer);
        jobController.signal.removeEventListener('abort', abortListener);
        finish();
        // A deadline settles the UI wait, never the physical provider admission.
        // Non-cooperative adapters hold this bounded slot until their promise settles.
        if (!settled && fence === jobFence && mode === 'script') {
          status = 'unavailable';
          emit();
        }
        await physical;
        transportUnsettled = false;
        if (controller === jobController) controller = null;
      }
    });
    if (!admission) {
      queued = false;
      selectorQueueRejected++;
      status = 'unavailable';
      emit();
      finish();
      return;
    }
    void admission.then((outcome) => {
      queued = false;
      finish();
      if (outcome === 'finished' || admissionFence !== fence) {
        scheduleSelector();
      } else {
        dirty = false;
        selectorQueueRejected++;
        if (mode === 'script') {
          status = 'unavailable';
          emit();
        }
      }
    });
  };
  const canSelectForCommit = () =>
    mode === 'script' &&
    !card.pinned &&
    !capacityRejected &&
    timeline.status === 'active' &&
    admitCapability(policy, scope, 'live-coaching', nowMs()).allowed;
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
        cancel();
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
          card.cardId,
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
        if (
          card.revision !== beforeRevision ||
          (controller &&
            rule &&
            mode === 'script' &&
            !card.pinned &&
            rule.priority >= lastPriority)
        )
          cancel();
        if (
          (status === 'delayed' || status === 'reconnecting') &&
          e.speaker.role !== 'unknown' &&
          e.speaker.provenance !== 'unknown' &&
          normalizePhrase(e.text)
        ) {
          status = automatic ? 'live' : 'manual';
          emit();
        }
        if (normalizePhrase(e.text)) {
          if (!lastMeaningfulFinal || !repeatedFinal(lastMeaningfulFinal, e))
            dirty = true;
          lastMeaningfulFinal = e;
        }
        scheduleSelector();
      }
      return result;
    },
    control(action: 'pin' | 'auto' | 'next' | 'previous' | 'off') {
      cancel();
      if (action === 'off') {
        mode = 'off';
        automatic = false;
        status = admitCapability(policy, scope, 'manual-reference', nowMs())
          .allowed
          ? 'manual'
          : 'unavailable';
        emit();
        return;
      }
      if (
        !admitCapability(policy, scope, 'manual-reference', nowMs()).allowed
      ) {
        status = 'unavailable';
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
      if (next.revision !== policy.revision) cancel();
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
      selectorFailures,
      selectorCheckpoints,
      selectorQueueRejected,
      selectorQueued: queued,
      transportUnsettled,
      scheduler: scheduler.diagnostics(),
      lastSelectorCheckpoint,
      workerGeneration: card.workerGeneration,
      mode,
    }),
  };
}
export type ScriptSession = ReturnType<typeof createScriptSession>;
