import type { LeadConnectorDatabase } from '@consuelo/lead-connector';
import type {
  ConversationScope,
  TranscriptEvent,
  TranscriptCursor,
} from '@consuelo/conversation';
import type { DialerIdentity } from '../contracts';
import {
  readTranscriptOutbox,
  acknowledgeTranscriptOutbox,
} from '../call-operations/outbox';
import {
  normalizeTranscriptSegment,
  normalizeTranscriptGap,
} from '../call-operations/normalization';
import { createCoachingScripts } from '../coaching/scripts';
import {
  createPlaybookStore,
  PlaybookAccessError,
} from '../coaching/playbook-store';
import {
  createCueService,
  type CallAdmission,
  type TranscriptSource,
} from '../coaching/cue-service';
export type CoachingLiveAuthority = (
  identity: DialerIdentity,
  input: {
    scopeKey: string;
    scope: ConversationScope;
    transcriptionEnabled: boolean;
  },
) => Promise<CallAdmission | null>;
// This adapter reads existing durable SOURCE refs; it never treats the source cursor as a core event cursor.
export function createDurableTranscriptSource(
  database: LeadConnectorDatabase,
): TranscriptSource {
  const projections = new Map<string, Map<string, string>>();
  return {
    release(projectionId) {
      projections.delete(projectionId);
    },
    async read(input) {
      try {
        let streams = projections.get(input.projectionId);
        if (!streams) {
          if (projections.size >= 200)
            throw new Error('Transcript projection capacity unavailable');
          streams = new Map();
          projections.set(input.projectionId, streams);
        }
        const projectionStreams = streams;
        const refs = await readTranscriptOutbox(database, {
          workspaceId: input.admission.scope.workspaceId,
          sessionId: input.admission.scope.callSessionId,
          afterCursor: input.afterCursor,
          limit: 50,
          signal: input.signal,
        });
        let cursor: TranscriptCursor = { ...input.cursor };
        const working = new Map(streams);
        const result = [];
        for (const ref of refs) {
          const segment = ref.segment,
            binding = input.admission.participants.find(
              (p) => p.legId === segment.providerCallId,
            );
          if (!binding)
            throw new Error(
              'Authenticated transcript participant is unavailable',
            );
          const streamSid = segment.metadata?.streamSid;
          if (!streamSid)
            throw new Error('Transcript stream identity is unavailable');
          const streamKey = JSON.stringify([
            input.admission.scope.workspaceId,
            input.admission.scope.callSessionId,
            segment.providerCallId,
          ]);
          const previous = working.get(streamKey);
          const perStream = input.admission.audioOffsetsByStream?.[streamSid];
          const audioOffsetMs =
            perStream ??
            (previous && previous !== streamSid
              ? null
              : (input.admission.audioOffsetsByLeg?.[segment.providerCallId] ??
                (input.admission.participants.length === 1
                  ? input.admission.audioOffsetMs
                  : null)));
          if (audioOffsetMs === null || audioOffsetMs === undefined)
            throw new Error(
              'Trusted call-relative audio alignment is unavailable',
            );
          const events: TranscriptEvent[] = [];
          if (previous && previous !== streamSid) {
            cursor = { sequence: cursor.sequence + 1, epoch: cursor.epoch + 1 };
            events.push({
              schemaVersion: 1,
              kind: 'reconnected',
              eventId: segment.id + ':reconnected',
              scope: input.admission.scope,
              cursor,
              observedAtMs: Date.parse(segment.createdAt),
              source: { adapter: 'durable-transcript' },
            });
          }
          if (segment.metadata?.gapBefore) {
            cursor = { sequence: cursor.sequence + 1, epoch: cursor.epoch };
            const gap = normalizeTranscriptGap({
              segment,
              scope: input.admission.scope,
              cursor,
              audioOffsetMs,
              participantId: binding.participantId,
            });
            if (!gap.ok)
              throw new Error('Source audio gap could not be normalized');
            events.push(gap.value);
          }
          cursor = { sequence: cursor.sequence + 1, epoch: cursor.epoch };
          const normalized = normalizeTranscriptSegment({
            segment,
            scope: input.admission.scope,
            cursor,
            binding,
            audioOffsetMs,
          });
          if (!normalized.ok)
            throw new Error('Source speech evidence could not be normalized');
          events.push(normalized.value);
          working.set(streamKey, streamSid);
          result.push({
            sourceCursor: ref.cursor,
            events,
            async acknowledge() {
              try {
                input.signal.throwIfAborted();
                await acknowledgeTranscriptOutbox(database, {
                  workspaceId: input.admission.scope.workspaceId,
                  sessionId: input.admission.scope.callSessionId,
                  outboxId: ref.outboxId,
                  signal: input.signal,
                });
                projectionStreams.set(streamKey, streamSid);
              } catch (cause: unknown) {
                throw cause instanceof Error
                  ? cause
                  : new Error('Coaching operation failed', { cause });
              }
            },
          });
        }
        return result;
      } catch (cause: unknown) {
        throw cause instanceof Error
          ? cause
          : new Error('Coaching operation failed', { cause });
      }
    },
  };
}
export function createCoachingRuntime(
  database: LeadConnectorDatabase,
  options: {
    liveAuthority?: CoachingLiveAuthority;
    nowMs?: () => number;
    resolveSessionId?: (
      identity: DialerIdentity,
      groupId: string,
    ) => Promise<string | null>;
  } = {},
) {
  const nowMs = options.nowMs ?? Date.now,
    playbooks = createPlaybookStore(database);
  const cues = createCueService({
    store: playbooks,
    nowMs,
    source: createDurableTranscriptSource(database),
    resolve: async (identity, scopeKey) => {
      try {
        if (!scopeKey.startsWith('outbound:') || scopeKey.length > 256)
          throw new PlaybookAccessError(
            'This call requires an authoritative inbound coaching binding',
          );
        let sessionId = scopeKey.slice(9);
        let row = (
          await database.query<{
            id: string;
            user_id: string;
            status: string;
            ended_at: unknown;
            transcription_enabled: boolean;
          }>(
            'SELECT id,user_id,status,ended_at,transcription_enabled FROM dialer_call_sessions WHERE workspace_id=$1 AND id=$2',
            [identity.workspaceId, sessionId],
          )
        ).rows[0];
        if (!row && options.resolveSessionId) {
          const resolved = await options.resolveSessionId(identity, sessionId);
          if (resolved) {
            sessionId = resolved;
            row = (
              await database.query<{
                id: string;
                user_id: string;
                status: string;
                ended_at: unknown;
                transcription_enabled: boolean;
              }>(
                'SELECT id,user_id,status,ended_at,transcription_enabled FROM dialer_call_sessions WHERE workspace_id=$1 AND id=$2',
                [identity.workspaceId, sessionId],
              )
            ).rows[0];
          }
        }
        if (!row || row.user_id !== identity.userId)
          throw new PlaybookAccessError('Call unavailable for this member');
        const scope = {
          workspaceId: identity.workspaceId,
          callSessionId: row.id,
          callGeneration: 1,
        };
        const active =
          !row.ended_at &&
          !['completed', 'failed', 'cancelled'].includes(row.status);
        const admitted = options.liveAuthority
          ? await options.liveAuthority(identity, {
              scopeKey,
              scope,
              transcriptionEnabled: row.transcription_enabled === true,
            })
          : null;
        if (admitted) {
          if (
            admitted.scope.workspaceId !== scope.workspaceId ||
            admitted.scope.callSessionId !== scope.callSessionId ||
            admitted.scope.callGeneration !== scope.callGeneration ||
            admitted.policy.memberId !== identity.userId ||
            !row.transcription_enabled
          )
            throw new PlaybookAccessError('Live coaching authority mismatch');
          return { ...admitted, active: active && admitted.active };
        }
        // Manual reference is an authenticated library capability. It grants no capture, retention, AI, or paid-plan override.
        return {
          scope,
          participants: [
            {
              participantId: 'unmapped',
              legId: 'unmapped',
              role: 'unknown',
              provenance: 'unknown',
              bindingRevision: 1,
            },
          ],
          active,
          audioOffsetMs: null,
          policy: {
            scope,
            memberId: identity.userId,
            revision: 1,
            validUntilMs: nowMs() + 10000,
            revoked: false,
            capabilities: ['manual-reference'],
            consent: {
              ephemeralTranscription: false,
              retainedTranscript: false,
              aiGeneration: false,
            },
          },
        };
      } catch (cause: unknown) {
        throw cause instanceof Error
          ? cause
          : new Error('Coaching operation failed', { cause });
      }
    },
  });
  return { ...createCoachingScripts(database), mercury: { playbooks, cues } };
}
