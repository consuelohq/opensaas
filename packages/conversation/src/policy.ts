import {
  type AssistancePolicy,
  type Capability,
  type ConversationScope,
} from './types.js';
import {
  object,
  scopeValid,
  sameScope,
  id,
  integer,
  time,
} from './validation.js';
const capabilities: readonly Capability[] = [
  'manual-reference',
  'live-transcription',
  'live-coaching',
  'retain-transcript',
  'review-upload',
  'ai-generation',
];
export function admitCapability(
  input: unknown,
  scope: ConversationScope,
  capability: Capability,
  nowMs: number,
): { allowed: boolean; reason?: string } {
  const deny = (reason: string) => ({ allowed: false, reason });
  if (
    !scopeValid(scope) ||
    !time(nowMs) ||
    !capabilities.includes(capability) ||
    !object(input) ||
    !scopeValid(input.scope) ||
    !sameScope(scope, input.scope) ||
    !id(input.memberId) ||
    !integer(input.revision, 1) ||
    !time(input.validUntilMs) ||
    input.validUntilMs <= nowMs ||
    input.revoked !== false ||
    !Array.isArray(input.capabilities) ||
    input.capabilities.some((c) => !capabilities.includes(c)) ||
    !object(input.consent) ||
    ['ephemeralTranscription', 'retainedTranscript', 'aiGeneration'].some(
      (c) => typeof (input.consent as Record<string, unknown>)[c] !== 'boolean',
    )
  )
    return deny('invalid/expired/revoked authenticated policy');
  const policy = input as unknown as AssistancePolicy;
  if (!policy.capabilities.includes(capability))
    return deny('capability absent');
  if (
    (capability === 'live-transcription' ||
      capability === 'live-coaching' ||
      capability === 'ai-generation') &&
    (!policy.capabilities.includes('live-transcription') ||
      !policy.consent.ephemeralTranscription)
  )
    return deny('ephemeral transcription not authorized');
  if (
    capability === 'ai-generation' &&
    (!policy.capabilities.includes('live-coaching') ||
      !policy.consent.aiGeneration)
  )
    return deny('AI generation not authorized');
  if (capability === 'retain-transcript' && !policy.consent.retainedTranscript)
    return deny('retention not authorized');
  return { allowed: true };
}
