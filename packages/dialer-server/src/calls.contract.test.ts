import { describe, expect, it, mock } from 'bun:test';
import { Effect } from 'effect';

import { DialerNotFoundError } from '@consuelo/dialer';

import { createDialerServer } from './app';
import type { DialerServerDependencies } from './contracts';

const createDependencies = () => {
  const application = {
    startCallSession: mock(() => Effect.die('unused')),
    getCallSession: mock(() => Effect.die('unused')),
    terminateCallSession: mock(() => Effect.die('unused')),
    processTwilioStatus: mock(() => Effect.die('unused')),
    generateTwilioCustomerTwiml: mock(() => Effect.die('unused')),
    generateTwilioAgentTwiml: mock(() => Effect.die('unused')),
    markAgentReady: mock(() => Effect.die('unused')),
    listActiveCalls: mock(() =>
      Effect.succeed([
        {
          id: 'session-active',
          status: 'connected',
          representative: 'Test Rep',
          transcriptStatus: 'processing',
          calls: [],
        },
      ]),
    ),
    listCallHistory: mock(() =>
      Effect.succeed({
        calls: [
          {
            id: 'session-history',
            status: 'completed',
            startedAt: '2026-08-04T12:00:00.000Z',
            calls: [{ providerCallId: 'CA-1', role: 'winner' }],
          },
        ],
        nextCursor: 'cursor-2',
      }),
    ),
    getCallDetail: mock(({ callId }: { callId: string }) =>
      callId === 'other-workspace'
        ? Effect.fail(
            new DialerNotFoundError({
              code: 'NOT_FOUND',
              message: 'Call not found',
              retryable: false,
            }),
          )
        : Effect.succeed({
            id: callId,
            status: 'completed',
            calls: [],
            opportunity: { status: 'open', monetaryValue: 1250 },
          }),
    ),
    getCallTranscript: mock(() =>
      Effect.succeed([
        {
          id: 'segment-1',
          sequence: 1,
          track: 'inbound',
          speaker: 'inbound',
          text: 'Hello',
        },
      ]),
    ),
    beginTranscriptionSession: mock(() =>
      Effect.succeed({ status: 'pending' }),
    ),
    processTranscriptionFrame: mock(() => Effect.succeed({ accepted: true })),
    completeTranscriptionSession: mock(() =>
      Effect.succeed({ status: 'ready' }),
    ),
    failTranscriptionSession: mock(() => Effect.succeed({ status: 'failed' })),
    recordDisposition: mock(() =>
      Effect.succeed({
        recorded: true as const,
        crmSyncStatus: 'synced' as const,
      }),
    ),
  };
  return {
    application,
    authenticate: mock(async () => ({
      workspaceId: 'workspace-1',
      userId: 'user-1',
    })),
    verifyTwilioSignature: mock(async () => true),
  } as unknown as DialerServerDependencies & {
    application: typeof application;
  };
};

const request = (path: string) =>
  new Request(`https://dialer.test${path}`, {
    headers: { authorization: 'Bearer test-token' },
  });

describe('workspace-scoped call operations routes', () => {
  it('delegates active and cursor-paginated history queries with workspace identity', async () => {
    const dependencies = createDependencies();
    const app = createDialerServer(dependencies);
    const active = await app.fetch(request('/v1/calls/active'));
    const history = await app.fetch(
      request('/v1/calls?status=completed&cursor=cursor-1&limit=25'),
    );

    expect(active.status).toBe(200);
    expect(history.status).toBe(200);
    expect(dependencies.application.listActiveCalls).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
    });
    expect(dependencies.application.listCallHistory).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      status: 'completed',
      cursor: 'cursor-1',
      limit: 25,
    });
    expect(await history.json()).toMatchObject({ nextCursor: 'cursor-2' });
  });

  it('returns detail and transcript only through workspace-scoped application calls', async () => {
    const dependencies = createDependencies();
    const app = createDialerServer(dependencies);
    const detail = await app.fetch(request('/v1/calls/session-history'));
    const transcript = await app.fetch(
      request('/v1/calls/session-history/transcript'),
    );

    expect(detail.status).toBe(200);
    expect(transcript.status).toBe(200);
    expect(dependencies.application.getCallDetail).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      callId: 'session-history',
    });
    expect(dependencies.application.getCallTranscript).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      callId: 'session-history',
    });
  });

  it('does not disclose a cross-workspace call', async () => {
    const dependencies = createDependencies();
    const response = await createDialerServer(dependencies).fetch(
      request('/v1/calls/other-workspace'),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
  });
});
