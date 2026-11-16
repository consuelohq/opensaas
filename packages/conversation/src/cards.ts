import {
  type ConversationScope,
  type PublishedPlaybook,
  type CardState,
  type CardContext,
  type Reduction,
} from './types.js';
import {
  snapshot,
  freeze,
  integer,
  scopeValid,
  sameScope,
  sameCursor,
  validatePlaybook,
  validateCardPatch,
  time,
} from './validation.js';
import { admitCapability } from './policy.js';
export function createCardState(
  scope: ConversationScope,
  playbook: PublishedPlaybook,
  workerGeneration: number,
): CardState {
  const validated = validatePlaybook(playbook);
  if (
    !scopeValid(scope) ||
    !validated.ok ||
    validated.value.workspaceId !== scope.workspaceId ||
    !integer(workerGeneration, 1)
  )
    throw new Error('invalid scoped published playbook/worker generation');
  return snapshot({
    scope,
    playbook: validated.value,
    workerGeneration,
    revision: 0,
    cardId: null,
    slots: [],
    pinned: false,
    lastPatchId: null,
  });
}
export function advanceCardWorker(
  state: CardState,
  workerGeneration: number,
): CardState {
  if (
    !integer(workerGeneration, 1) ||
    workerGeneration !== state.workerGeneration + 1
  )
    throw new Error('worker generation must advance exactly once');
  return freeze({ ...state, workerGeneration, revision: state.revision + 1 });
}
export function reduceCard(
  state: CardState,
  input: unknown,
  context: CardContext,
): Reduction<CardState> {
  const reject = (reason: string): Reduction<CardState> => ({
    status: 'rejected',
    state,
    reason,
  });
  const validated = validateCardPatch(input);
  if (!validated.ok) return reject(validated.reason);
  const patch = validated.value;
  if (
    context.signal?.aborted ||
    !time(context.nowMs) ||
    !sameScope(state.scope, patch.scope) ||
    !sameScope(state.scope, context.timeline.scope) ||
    context.timeline.status !== 'active'
  )
    return reject('aborted/foreign/terminal call');
  if (
    !admitCapability(
      context.policy,
      state.scope,
      patch.source === 'manual' ? 'manual-reference' : 'live-coaching',
      context.nowMs,
    ).allowed ||
    patch.policyRevision !== context.policy.revision
  )
    return reject('policy revision/admission denied');
  if (
    patch.baseCardRevision !== state.revision ||
    patch.workerGeneration !== state.workerGeneration ||
    patch.sourceVersion !== context.sourceVersions?.[patch.source] ||
    patch.publishedScriptVersion !== state.playbook.publishedVersion ||
    !sameCursor(patch.transcriptCursor, context.timeline.cursor) ||
    patch.issuedAtMs > context.nowMs ||
    patch.expiresAtMs <= context.nowMs
  )
    return reject('stale card/worker/script/cursor or expired result');
  if (
    patch.source !== 'manual' &&
    (state.pinned || patch.pin !== undefined || !patch.evidence.length)
  )
    return reject('manual pin or missing automatic evidence');
  for (const evidence of patch.evidence) {
    const segment = context.timeline.segments[evidence.segmentId];
    if (
      !segment ||
      segment.finality !== 'final' ||
      segment.segmentRevision !== evidence.segmentRevision
    )
      return reject('foreign/stale/nonfinal evidence');
  }
  const card = state.playbook.cards.find((c) => c.id === patch.cardId);
  if (!card) return reject('unapproved card');
  const slots: (string | null)[] =
    state.cardId === card.id ? [...state.slots] : [];
  for (const change of patch.changedSlots)
    slots[change.position] = change.approvedSlotId;
  // Null explicitly clears a removed fourth position. Never silently carry a previous card.
  while (slots.length && slots[slots.length - 1] === null) slots.pop();
  if (
    slots.length !== card.slots.length ||
    Array.from({ length: slots.length }, (_, i) => slots[i]).some(
      (s) =>
        typeof s !== 'string' ||
        !card.slots.some((approved) => approved.id === s),
    ) ||
    new Set(slots).size !== slots.length
  )
    return reject('incomplete/duplicate/unapproved slot layout');
  const pinned =
    patch.source === 'manual' ? (patch.pin ?? state.pinned) : state.pinned;
  if (
    state.cardId === card.id &&
    state.pinned === pinned &&
    state.slots.every((slot, i) => slot === slots[i])
  )
    return { status: 'unchanged', state };
  return {
    status: 'applied',
    state: freeze({
      ...state,
      revision: state.revision + 1,
      cardId: card.id,
      slots: slots as string[],
      pinned,
      lastPatchId: patch.patchId,
    }),
  };
}
