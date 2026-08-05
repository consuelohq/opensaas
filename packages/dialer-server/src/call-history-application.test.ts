import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';

import { createCallHistoryDialerApplication } from './application';
import {
  createCallOperationsApplication,
  type CallOperationsRepositoryService,
  type CallSessionSummary,
} from './call-operations/application';
import type {
  DialerServerApplication,
  DialerServerStartCallCommand,
} from './contracts';

const createBaseApplication = (
  events: string[],
  options: { recordingFails?: boolean } = {},
): DialerServerApplication => ({
  startCallSession: (command) =>
    Effect.sync(() => {
      events.push(`carrier:${command.sessionId}`);
      return {
        sessionId: command.sessionId ?? 'missing-session',
        twilioGroupId: 'group-1',
        queueId: 'queue-1',
        selectionStrategy: 'single' as const,
        requestedFanout: 1,
        actualFanout: 1,
        status: 'dialing' as const,
        capacity: {
          requestedFanout: 1,
          callableTargetCount: 1,
          availableCallerIdCount: 1,
          reducedCapacityReasons: [],
          blockedReasons: [],
          actualFanout: 1,
        },
        calls: [
          {
            callSid: 'CA-1',
            contactId: 'contact-1',
    recordingEnabled: true,
    transcriptionEnabled: true,
            customerNumber: '+15550100001',
            callerId: '+15550100002',
            status: 'queued',
            position: 1,
          },
        ],
      };
    }),
  getCallSession: ({ sessionId }) =>
    Effect.succeed({
      groupId: sessionId,
      conferenceName: 'conference-1',
      status: 'dialing',
      winnerSid: null,
      winner: null,
      calls: [],
    }),
  terminateCallSession: ({ sessionId }) =>
    Effect.succeed({ groupId: sessionId, status: 'completed' as const }),
  processTwilioStatus: () =>
    Effect.succeed({ received: true as const, groupId: 'group-1' }),
  generateTwilioCustomerTwiml: () =>
    Effect.succeed('<Response><Dial /></Response>'),
  generateTwilioAgentTwiml: () => Effect.succeed('<Response />'),
  markAgentReady: ({ sessionId }) =>
    Effect.succeed({
      groupId: sessionId,
      status: 'connected',
      remainingCleanup: 0,
    }),
  resolveTwilioCallContext: () =>
    Effect.succeed({
      workspaceId: 'workspace-1',
      dialerSessionId: 'session-1',
    }),
  startCallRecording: ({ callSid }) =>
    options.recordingFails
      ? Effect.fail(new Error('recording provider unavailable'))
      : Effect.sync(() => {
          events.push(`recording:${callSid}`);
          return { recordingSid: 'RE-1', status: 'in-progress' };
        }),
});

const createCallOperations = (events: string[]) => {
  const sessions: CallSessionSummary[] = [];
  let providerContextReads = 0;
  let recordingClaimed = false;
  const repository: CallOperationsRepositoryService = {
    resolveTranscriptionSettings: () =>
      Effect.succeed({ enabled: true, language: 'en', retentionDays: 30 }),
    resolveTranscriptionContextForSession: () => Effect.succeed(null),
    resolveTranscriptionContext: () =>
      Effect.sync(() => {
        providerContextReads += 1;
        return null;
      }),
    setTranscriptStatus: () => Effect.void,
    appendTranscriptSegment: () => Effect.succeed({ inserted: true }),
    recoverInterruptedTranscriptions: () => Effect.succeed(0),
    createOrUpdateCallSession: (session) =>
      Effect.sync(() => {
        events.push(`persist:${session.status}`);
        sessions.push({
          id: session.id,
          workspaceId: session.workspaceId,
          status: session.status,
          calls: session.calls,
        });
      }),
    recordCallLegTransition: () => Effect.void,
    listActiveCalls: () => Effect.succeed([]),
    listCallHistory: () => Effect.succeed({ calls: [], nextCursor: null }),
    getCallDetail: () => Effect.succeed(null),
    getCallTranscript: () => Effect.succeed([]),
    recordDisposition: () => Effect.void,
    setCrmSyncStatus: () => Effect.void,
    claimCallRecording: ({ providerCallId }) =>
      Effect.sync(() => {
        events.push(`recording-claim:${providerCallId}`);
        if (providerCallId !== 'CA-1' || recordingClaimed) return null;
        recordingClaimed = true;
        return {
          workspaceId: 'workspace-1',
          sessionId: 'session-1',
          providerCallId,
        };
      }),
    setCallRecordingStarted: ({ recordingSid }) =>
      Effect.sync(() => {
        events.push(`recording-started:${recordingSid}`);
      }),
    setCallRecordingFailed: ({ failureCode }) =>
      Effect.sync(() => {
        events.push(`recording-failed:${failureCode}`);
      }),
    recordCallRecordingStatus: () => Effect.void,
  };
  return {
    application: createCallOperationsApplication({
      repository,
      speechToTextProvider: {
        transcribe: () => Effect.succeed({ text: '' }),
      },
      config: {
        model: 'whisper-large-v3-turbo',
        chunkBytes: 80_000,
        maxBufferBytesPerTrack: 240_000,
        providerTimeoutMs: 5_000,
        maxConcurrentTranscriptions: 2,
        streamUrl: 'wss://dialer.example.test/webhooks/twilio/media',
      },
    }),
    providerContextReads: () => providerContextReads,
    sessions,
  };
};

const command: DialerServerStartCallCommand = {
  workspaceId: 'workspace-1',
  userId: 'user-1',
  input: {
    source: 'direct',
    selectionStrategy: 'single',
    requestedFanout: 1,
    targetPhone: '+15550100001',
    contactId: 'contact-1',
  },
};

describe('call-history dialer application', () => {
  it('persists a durable session before carrier initiation and enriches it afterward', async () => {
    const events: string[] = [];
    const callOperations = createCallOperations(events);
    const application = createCallHistoryDialerApplication(
      createBaseApplication(events),
      callOperations.application,
    );

    const result = await Effect.runPromise(
      application.startCallSession(command),
    );

    expect(events[0]).toBe('persist:starting');
    expect(events[1]).toBe(`carrier:${result.sessionId}`);
    expect(events[2]).toBe('persist:dialing');
    expect(callOperations.sessions).toHaveLength(2);
    expect(callOperations.sessions[1]?.calls).toHaveLength(1);
  });

  it('persists plan-derived media entitlements and starts recording once only after a human connection', async () => {
    const events: string[] = [];
    const callOperations = createCallOperations(events);
    const application = createCallHistoryDialerApplication(
      createBaseApplication(events),
      callOperations.application,
    );

    await Effect.runPromise(application.startCallSession(command));
    expect(callOperations.sessions[0]).toMatchObject({
      recordingEnabled: true,
      transcriptionEnabled: true,
    });

    await Effect.runPromise(
      application.processTwilioStatus({
        callSid: 'CA-1',
        callStatus: 'in-progress',
        answeredBy: 'human',
      }),
    );
    await Effect.runPromise(
      application.processTwilioStatus({
        callSid: 'CA-1',
        callStatus: 'in-progress',
        answeredBy: 'human',
      }),
    );

    expect(events.filter((event) => event === 'recording:CA-1')).toHaveLength(1);
    expect(events).toContain('recording-started:RE-1');
  });

  it('does not break the connected call when recording startup fails', async () => {
    const events: string[] = [];
    const callOperations = createCallOperations(events);
    const application = createCallHistoryDialerApplication(
      createBaseApplication(events, { recordingFails: true }),
      callOperations.application,
    );

    await expect(
      Effect.runPromise(
        application.processTwilioStatus({
          callSid: 'CA-1',
          callStatus: 'in-progress',
          answeredBy: 'human',
        }),
      ),
    ).resolves.toEqual({ received: true, groupId: 'group-1' });
    expect(events).toContain('recording-failed:RECORDING_START_FAILED');
  });

  it('uses conference-owned workspace and session context for stream opt-in', async () => {
    const events: string[] = [];
    const callOperations = createCallOperations(events);
    const application = createCallHistoryDialerApplication(
      createBaseApplication(events),
      callOperations.application,
    );

    const twiml = await Effect.runPromise(
      application.generateTwilioCustomerTwiml({ callSid: 'CA-1' }),
    );

    expect(twiml).toContain('track="both_tracks"');
    expect(twiml).toContain('name="sessionId" value="session-1"');
    expect(callOperations.providerContextReads()).toBe(0);
  });
});
