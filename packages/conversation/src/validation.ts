import {
  LIMITS,
  type ConversationScope,
  type TranscriptCursor,
  type TranscriptEvent,
  type PublishedPlaybook,
  type CardPatch,
  type Validation,
  type ParticipantBinding,
} from './types.js';

export const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
export const integer = (v: unknown, minimum = 0): v is number =>
  Number.isSafeInteger(v) && (v as number) >= minimum;
export const time = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0;
export const text = (v: unknown, max: number = LIMITS.idLength): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;
// Reject prototype keys because persisted maps must remain ordinary JSON objects.
export const id = (v: unknown): v is string =>
  text(v) && !['__proto__', 'constructor', 'prototype'].includes(v);
export const scopeValid = (v: unknown): v is ConversationScope =>
  object(v) &&
  id(v.workspaceId) &&
  id(v.callSessionId) &&
  integer(v.callGeneration, 1);
export const cursorValid = (v: unknown): v is TranscriptCursor =>
  object(v) && integer(v.sequence) && integer(v.epoch);
export const sameScope = (
  a: ConversationScope,
  b: ConversationScope,
): boolean =>
  a.workspaceId === b.workspaceId &&
  a.callSessionId === b.callSessionId &&
  a.callGeneration === b.callGeneration;
export const sameCursor = (a: TranscriptCursor, b: TranscriptCursor): boolean =>
  a.sequence === b.sequence && a.epoch === b.epoch;
const optional = (v: unknown, predicate: (v: unknown) => boolean) =>
  v === undefined || predicate(v);
const probability = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
export const speakerValid = (v: unknown): boolean =>
  object(v) &&
  ['rep', 'customer', 'unknown'].includes(v.role as string) &&
  ['authenticated-leg', 'verified-diarization', 'unknown'].includes(
    v.provenance as string,
  ) &&
  integer(v.bindingRevision, 1) &&
  (v.role === 'unknown'
    ? v.provenance === 'unknown'
    : v.provenance !== 'unknown');
export const bindingValid = (v: unknown): v is ParticipantBinding =>
  object(v) && id(v.participantId) && id(v.legId) && speakerValid(v);
export function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
export function snapshot<T>(value: T): T {
  return freeze(JSON.parse(JSON.stringify(value)) as T);
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (object(value))
    return (
      '{' +
      Object.keys(value)
        .filter((k) => value[k] !== undefined)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + canonical(value[k]))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
const fail = <T>(reason: string): Validation<T> => ({ ok: false, reason });
const exact = (v: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(v).every((k) => keys.includes(k));
const scopeKeys = ['workspaceId', 'callSessionId', 'callGeneration'];
const cursorKeys = ['sequence', 'epoch'];
const speakerKeys = ['role', 'provenance', 'bindingRevision'];
export function validateTranscriptEvent(
  input: unknown,
): Validation<TranscriptEvent> {
  if (
    !object(input) ||
    input.schemaVersion !== 1 ||
    !id(input.eventId) ||
    !scopeValid(input.scope) ||
    !cursorValid(input.cursor) ||
    input.cursor.sequence < 1 ||
    !time(input.observedAtMs) ||
    !object(input.source) ||
    !id(input.source.adapter) ||
    !optional(input.source.modelVersion, id)
  )
    return fail('invalid event envelope or schema version');
  if (
    !exact(input.scope as unknown as Record<string, unknown>, scopeKeys) ||
    !exact(input.cursor as unknown as Record<string, unknown>, cursorKeys) ||
    !exact(input.source, ['adapter', 'modelVersion'])
  )
    return fail('unknown event envelope fields');
  const keys = [
    'schemaVersion',
    'kind',
    'eventId',
    'scope',
    'cursor',
    'observedAtMs',
    'source',
  ];
  if (input.kind === 'segment') {
    if (
      !id(input.segmentId) ||
      !integer(input.segmentRevision, 1) ||
      !id(input.participantId) ||
      !id(input.legId) ||
      !speakerValid(input.speaker) ||
      !object(input.speaker) ||
      !exact(input.speaker, speakerKeys) ||
      !time(input.audioStartMs) ||
      !time(input.audioEndMs) ||
      input.audioEndMs < input.audioStartMs ||
      !text(input.text, LIMITS.textLength) ||
      !['interim', 'final'].includes(input.finality as string) ||
      !optional(input.language, (v) => text(v, 64)) ||
      !optional(input.quality, probability) ||
      !optional(input.roleConfidence, probability)
    )
      return fail('invalid segment');
    keys.push(
      'segmentId',
      'segmentRevision',
      'participantId',
      'legId',
      'speaker',
      'audioStartMs',
      'audioEndMs',
      'text',
      'language',
      'quality',
      'roleConfidence',
      'finality',
    );
  } else if (input.kind === 'gap') {
    if (
      !time(input.audioStartMs) ||
      !time(input.audioEndMs) ||
      input.audioEndMs <= input.audioStartMs ||
      ![
        'missing-audio',
        'reconnect',
        'provider-unavailable',
        'backpressure',
      ].includes(input.reason as string) ||
      !optional(input.participantId, id)
    )
      return fail('invalid gap');
    keys.push('audioStartMs', 'audioEndMs', 'reason', 'participantId');
  } else if (
    !['reconnected', 'ended', 'revoked', 'deleted'].includes(
      input.kind as string,
    )
  )
    return fail('invalid event kind');
  if (!exact(input, keys)) return fail('unknown event fields');
  return { ok: true, value: snapshot(input as unknown as TranscriptEvent) };
}
export function validatePlaybook(
  input: unknown,
): Validation<PublishedPlaybook> {
  if (
    !object(input) ||
    input.schemaVersion !== 1 ||
    !id(input.workspaceId) ||
    !id(input.playbookId) ||
    !id(input.publishedVersion) ||
    !id(input.industryPackVersion) ||
    !id(input.companyPolicyVersion) ||
    !Array.isArray(input.cards) ||
    !input.cards.length ||
    input.cards.length > LIMITS.cards ||
    !exact(input, [
      'schemaVersion',
      'workspaceId',
      'playbookId',
      'publishedVersion',
      'industryPackVersion',
      'companyPolicyVersion',
      'cards',
    ])
  )
    return fail('invalid published playbook');
  const cardIds = new Set<string>();
  for (const card of input.cards) {
    if (
      !object(card) ||
      !id(card.id) ||
      cardIds.has(card.id) ||
      !text(card.title, 160) ||
      !optional(card.stageId, id) ||
      !Array.isArray(card.slots) ||
      card.slots.length < 3 ||
      card.slots.length > 4 ||
      !exact(card, ['id', 'title', 'stageId', 'slots'])
    )
      return fail('invalid approved card');
    cardIds.add(card.id);
    const slots = new Set<string>();
    for (const slot of card.slots) {
      if (
        !object(slot) ||
        !id(slot.id) ||
        slots.has(slot.id) ||
        !text(slot.text, 256) ||
        !object(slot.source) ||
        !id(slot.source.documentId) ||
        !id(slot.source.revision) ||
        !text(slot.source.excerpt, LIMITS.textLength) ||
        !exact(slot, ['id', 'text', 'source']) ||
        !exact(slot.source, ['documentId', 'revision', 'excerpt'])
      )
        return fail('invalid approved slot/source');
      slots.add(slot.id);
    }
  }
  return { ok: true, value: snapshot(input as unknown as PublishedPlaybook) };
}
export function validateCardPatch(input: unknown): Validation<CardPatch> {
  if (!object(input) || !id(input.sourceVersion))
    return fail('missing approved selector/rules/manual source version');
  if (
    !object(input) ||
    input.schemaVersion !== 1 ||
    !id(input.patchId) ||
    !scopeValid(input.scope) ||
    !integer(input.baseCardRevision) ||
    !cursorValid(input.transcriptCursor) ||
    !integer(input.workerGeneration, 1) ||
    !integer(input.policyRevision, 1) ||
    !id(input.publishedScriptVersion) ||
    !id(input.cardId) ||
    !['manual', 'rules', 'selector'].includes(input.source as string) ||
    !Array.isArray(input.changedSlots) ||
    input.changedSlots.length > 4 ||
    !Array.isArray(input.evidence) ||
    input.evidence.length > 32 ||
    !time(input.issuedAtMs) ||
    !time(input.expiresAtMs) ||
    input.expiresAtMs <= input.issuedAtMs ||
    input.expiresAtMs - input.issuedAtMs > LIMITS.patchLifetimeMs ||
    !optional(input.pin, (v) => typeof v === 'boolean') ||
    !exact(input, [
      'schemaVersion',
      'patchId',
      'scope',
      'baseCardRevision',
      'transcriptCursor',
      'workerGeneration',
      'policyRevision',
      'publishedScriptVersion',
      'cardId',
      'source',
      'sourceVersion',
      'changedSlots',
      'evidence',
      'issuedAtMs',
      'expiresAtMs',
      'pin',
    ])
  )
    return fail('invalid card patch');
  const positions = new Set<number>();
  for (const slot of input.changedSlots) {
    if (
      !object(slot) ||
      !integer(slot.position) ||
      slot.position > 3 ||
      positions.has(slot.position) ||
      !(slot.approvedSlotId === null || id(slot.approvedSlotId)) ||
      !exact(slot, ['position', 'approvedSlotId'])
    )
      return fail('invalid changed slot');
    positions.add(slot.position);
  }
  const evidenceIds = new Set<string>();
  for (const e of input.evidence) {
    if (
      !object(e) ||
      !id(e.segmentId) ||
      !integer(e.segmentRevision, 1) ||
      evidenceIds.has(e.segmentId) ||
      !exact(e, ['segmentId', 'segmentRevision'])
    )
      return fail('invalid evidence');
    evidenceIds.add(e.segmentId);
  }
  return { ok: true, value: snapshot(input as unknown as CardPatch) };
}
