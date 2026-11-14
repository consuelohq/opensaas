import { DialerNotFoundError } from '@consuelo/dialer';
import { Effect } from 'effect';
import {
  createTranscriptionOperations,
  type TranscriptionConfig,
} from './transcription';
import type { CallLegTransition, CallSessionUpsert } from './contracts';
import type {
  CallOperationsRepositoryService,
  SpeechToTextProviderService,
  TranscriptionContext,
} from './ports';
export { buildMulawWav } from './audio';
export type {
  CallDetail,
  CallLegSummary,
  CallSessionSummary,
  TranscriptSegment,
  TranscriptStatus,
  TranscriptTrack,
  TwilioMediaFrame,
} from './contracts';
export type {
  CallOperationsRepositoryService,
  SpeechToTextProviderService,
} from './ports';

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const createCallOperationsApplication = (input: {
  repository: CallOperationsRepositoryService;
  speechToTextProvider: SpeechToTextProviderService;
  config: TranscriptionConfig;
}) => {
  return {
    ...createTranscriptionOperations(input),
    createOrUpdateCallSession: (request: CallSessionUpsert) =>
      input.repository.createOrUpdateCallSession(request),
    recordCallLegTransition: (request: CallLegTransition) =>
      input.repository.recordCallLegTransition(request),
    listActiveCalls: (request: { workspaceId: string }) =>
      input.repository.listActiveCalls(request),
    listCallHistory: (request: {
      workspaceId: string;
      status?: string;
      cursor?: string;
      limit: number;
    }) => input.repository.listCallHistory(request),
    getCallDetail: (request: { workspaceId: string; callId: string }) =>
      input.repository.getCallDetail(request).pipe(
        Effect.flatMap((detail) =>
          detail
            ? Effect.succeed(detail)
            : Effect.fail(
                new DialerNotFoundError({
                  code: 'NOT_FOUND',
                  message: 'Call not found',
                  retryable: false,
                }),
              ),
        ),
      ),
    getCallTranscript: (request: { workspaceId: string; callId: string }) =>
      input.repository.getCallTranscript(request),
    recordDisposition: (request: {
      workspaceId: string;
      sessionId: string;
      disposition: string;
      note?: string;
      tags?: string[];
    }) => input.repository.recordDisposition(request),
    setCrmSyncStatus: (request: {
      workspaceId: string;
      sessionId: string;
      status: 'synced' | 'failed';
      errorCode?: string;
    }) => input.repository.setCrmSyncStatus(request),
    claimCallRecording: (request: { providerCallId: string }) =>
      input.repository.claimCallRecording(request),
    setCallRecordingStarted: (request: {
      workspaceId: string;
      sessionId: string;
      recordingSid: string;
      status: string;
    }) => input.repository.setCallRecordingStarted(request),
    setCallRecordingFailed: (request: {
      workspaceId: string;
      sessionId: string;
      failureCode: string;
    }) => input.repository.setCallRecordingFailed(request),
    resolveRecordingCallOwnership: (request: { providerCallId: string }) =>
      input.repository.resolveRecordingCallOwnership(request),
    resolveStatusCallOwnership: (request: { providerCallId: string }) =>
      input.repository.resolveStatusCallOwnership(request),
    recordCallRecordingStatus: (request: {
      workspaceId: string;
      providerCallId: string;
      recordingSid: string;
      recordingStatus: string;
      recordingDurationSeconds?: number;
    }) => input.repository.recordCallRecordingStatus(request),
    attachTranscriptionStream: (request: {
      providerCallId: string;
      twiml: string;
      workspaceId?: string;
      sessionId?: string;
    }) =>
      Effect.gen(function* () {
        if (!input.config.streamUrl) return request.twiml;
        let context: TranscriptionContext | null;
        if (request.workspaceId && request.sessionId) {
          // Workspace defaults cannot override a persisted per-call consent decision.
          const persisted =
            yield* input.repository.resolveTranscriptionContextForSession(
              request.sessionId,
            );
          context =
            persisted?.workspaceId === request.workspaceId ? persisted : null;
        } else {
          context = yield* input.repository.resolveTranscriptionContext(
            request.providerCallId,
          );
        }
        if (!context?.enabled || !request.twiml.includes('<Response>')) {
          return request.twiml;
        }
        const stream = [
          '<Start>',
          // Twilio Media Streams do not accept query parameters; the URL path
          // is a lookup hint, checked against persisted call ownership on upgrade.
          `<Stream url="${escapeXml(input.config.streamUrl.replace(/\/$/, '') + '/' + encodeURIComponent(request.providerCallId))}" track="both_tracks">`,
          `<Parameter name="callId" value="${escapeXml(request.providerCallId)}" />`,
          `<Parameter name="sessionId" value="${escapeXml(context.sessionId)}" />`,
          '</Stream>',
          '</Start>',
        ].join('');
        return request.twiml.replace('<Response>', `<Response>${stream}`);
      }),
  };
};
