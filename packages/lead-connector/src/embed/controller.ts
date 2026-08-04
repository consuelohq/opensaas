import type { LeadConnectorEmbedApi } from './api-client.js';
import type { LeadConnectorAgentVoice } from './agent-voice.js';
import { EmbedSessionExpiredError } from './api-client.js';
import {
  normalizeClickToCallTarget,
  type LeadConnectorClickToCallTarget,
} from './protocol.js';
import {
  createInitialEmbedState,
  isTerminalEmbedSession,
  reduceEmbedState,
  removeEmbedTarget,
  selectEmbedTarget,
  type LeadConnectorEmbedState,
} from './state-machine.js';

export type LeadConnectorEmbedController = ReturnType<
  typeof createLeadConnectorEmbedController
>;

export const createLeadConnectorEmbedController = (input: {
  api: LeadConnectorEmbedApi;
  voice: LeadConnectorAgentVoice;
  initialState?: LeadConnectorEmbedState;
}) => {
  let state = input.initialState ?? createInitialEmbedState();
  let activeVoiceSessionId: string | null = null;
  let activeRecordSessionId: string | null = null;
  let resourceRefresh: Promise<void> | null = null;
  const listeners = new Set<(state: LeadConnectorEmbedState) => void>();

  const publish = (): void => {
    for (const listener of listeners) listener(state);
  };

  const dispatch = (
    event: Parameters<typeof reduceEmbedState>[1],
  ): LeadConnectorEmbedState => {
    state = reduceEmbedState(state, event);
    publish();
    return state;
  };

  const run = async <T>(operation: () => Promise<T>): Promise<T | null> => {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof EmbedSessionExpiredError) {
        input.api.setSessionToken(null);
        dispatch({ type: 'SESSION_EXPIRED' });
        return null;
      }
      const message =
        error instanceof Error ? error.message : 'Dialer request failed';
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : 'REQUEST_FAILED';
      const recoverable =
        typeof error === 'object' && error !== null && 'retryable' in error
          ? error.retryable === true
          : true;
      dispatch({ type: 'FAILED', code, message, recoverable });
      return null;
    }
  };

  const disconnectVoice = (): void => {
    if (!activeVoiceSessionId) return;
    activeVoiceSessionId = null;
    input.voice.disconnect();
  };

  const projectSession = (
    session: Parameters<typeof isTerminalEmbedSession>[0],
  ): void => {
    if (isTerminalEmbedSession(session)) disconnectVoice();
    dispatch({ type: 'SESSION_UPDATED', session });
  };

  const reportUnexpectedFailure = (error: unknown): void => {
    dispatch({
      type: 'FAILED',
      code: 'UNEXPECTED_EMBED_FAILURE',
      message:
        error instanceof Error ? error.message : 'Embedded dialer failed',
      recoverable: true,
    });
  };

  const activeResourcePhases = new Set<LeadConnectorEmbedState['phase']>([
    'starting',
    'dialing',
    'ringing',
    'connected',
    'paused',
    'wrapping-up',
  ]);

  const refreshResources = (options: { force?: boolean } = {}): Promise<void> => {
    if (!state.sessionToken) return Promise.resolve();
    if (!options.force && activeResourcePhases.has(state.phase)) {
      return Promise.resolve();
    }
    if (resourceRefresh) return resourceRefresh;
    dispatch({ type: 'RESOURCES_REFRESH_STARTED' });
    resourceRefresh = (async () => {
      try {
        const resources = await run(() =>
          Promise.all([
            input.api.listContacts({ limit: 50 }),
            input.api.searchOpportunities({ limit: 100 }),
            input.api.listPipelines(),
          ]).then(([contacts, opportunities, pipelines]) => ({
            contacts: contacts.contacts,
            contactTotal: contacts.total,
            opportunities: opportunities.opportunities,
            opportunityTotal: opportunities.total,
            pipelines,
          })),
        );
        if (resources) dispatch({ type: 'RESOURCES_LOADED', ...resources });
      } catch (error: unknown) {
        reportUnexpectedFailure(error);
      } finally {
        dispatch({ type: 'RESOURCES_REFRESH_FINISHED' });
        resourceRefresh = null;
      }
    })();
    return resourceRefresh;
  };

  const loadCallOperations = async (): Promise<void> => {
    try {
      const calls = await run(() =>
        Promise.all([
          input.api.listActiveCalls(),
          input.api.listCallHistory({ limit: 50 }),
        ]).then(([activeCalls, history]) => ({
          activeCalls,
          callHistory: history.calls,
          nextCursor: history.nextCursor,
        })),
      );
      if (calls) dispatch({ type: 'CALLS_LOADED', ...calls });
    } catch (error: unknown) {
      reportUnexpectedFailure(error);
    }
  };

  const startCall = async (
    strategy: 'single' | 'predictive',
  ): Promise<void> => {
    try {
      if (state.selectedTargets.length === 0) {
        dispatch({
          type: 'FAILED',
          code: 'TARGET_REQUIRED',
          message:
            state.setup.mode === 'queue'
              ? 'Choose a callable pipeline stage'
              : 'Select a callable contact or enter a phone number',
          recoverable: true,
        });
        return;
      }
      const queueMode =
        state.selectedQueue !== null ||
        (strategy === 'predictive' && state.selectedTargets.length > 1);
      const effectiveStrategy = queueMode ? strategy : 'single';
      dispatch({ type: 'START_REQUESTED', strategy: effectiveStrategy });
      await input.voice.prepare();
      const targets = queueMode
        ? state.selectedTargets
        : state.selectedTargets.slice(0, 1);
      const request = queueMode
        ? {
            source: 'queue',
            ...(state.selectedQueue
              ? {
                  queueId: `${state.selectedQueue.pipelineId}:${state.selectedQueue.stageId}`,
                  pipelineId: state.selectedQueue.pipelineId,
                  stageId: state.selectedQueue.stageId,
                }
              : {}),
            selectionStrategy: effectiveStrategy,
            requestedFanout:
              effectiveStrategy === 'single'
                ? 1
                : state.selectedQueue
                  ? state.setup.requestedFanout
                  : Math.min(3, targets.length),
            preferLocalPresence: state.setup.preferLocalPresence,
            ...(state.setup.callerIdNumber
              ? { callerIdNumber: state.setup.callerIdNumber }
              : {}),
            targetPhones: targets.map((target) => target.phone),
            contactIds: targets
              .map((target) => target.contactId)
              .filter((value): value is string => value !== null),
          }
        : (() => {
            const target = targets[0];
            const opportunity = state.opportunities.find(
              (item) => item.id === target?.opportunityId,
            );
            return {
              source: 'direct',
              selectionStrategy: 'single',
              requestedFanout: 1,
              preferLocalPresence: state.setup.preferLocalPresence,
              ...(state.setup.callerIdNumber
                ? { callerIdNumber: state.setup.callerIdNumber }
                : {}),
              targetPhone: target?.phone,
              contactId: target?.contactId ?? undefined,
              contactName: target?.name ?? undefined,
              opportunityId: opportunity?.id,
              pipelineId: opportunity?.pipelineId ?? undefined,
              stageId: opportunity?.stageId ?? undefined,
              opportunitySnapshot: opportunity
                ? {
                    id: opportunity.id,
                    status: opportunity.status,
                    monetaryValue: opportunity.monetaryValue,
                    pipelineId: opportunity.pipelineId,
                    stageId: opportunity.stageId,
                  }
                : undefined,
            };
          })();
      const result = await run(() => input.api.startCallSession(request));
      if (!result) return;
      const statusId = result.providerGroupId ?? result.sessionId;
      activeVoiceSessionId = statusId;
      activeRecordSessionId = result.sessionId;
      try {
        await input.voice.connect(statusId);
        const ready = await run(() => input.api.markAgentReady(statusId));
        if (!ready) {
          disconnectVoice();
          await input.api.terminateCallSession(statusId).catch(() => undefined);
          return;
        }
        if (ready.remainingCleanup > 0) {
          throw new Error('Agent conference did not become ready');
        }
      } catch (error: unknown) {
        disconnectVoice();
        await input.api.terminateCallSession(statusId).catch(() => undefined);
        throw error;
      }
      const session = await run(() => input.api.getCallSession(statusId));
      if (session) projectSession(session);
    } catch (error: unknown) {
      reportUnexpectedFailure(error);
    }
  };

  return {
    getState: (): LeadConnectorEmbedState => state,
    subscribe: (listener: (next: LeadConnectorEmbedState) => void) => {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    authenticate: async (encryptedData: string): Promise<void> => {
      try {
        dispatch({ type: 'AUTHENTICATION_STARTED' });
        const session = await run(() =>
          input.api.createEmbedSession(encryptedData),
        );
        if (!session) return;
        input.api.setSessionToken(session.token);
        dispatch({
          type: 'AUTHENTICATED',
          token: session.token,
          expiresAt: session.expiresAt,
        });
        await Promise.all([
          refreshResources({ force: true }),
          loadCallOperations(),
        ]);
      } catch (error: unknown) {
        reportUnexpectedFailure(error);
      }
    },
    loadResources: () => refreshResources({ force: true }),
    refreshResources,
    loadCallOperations,
    loadMoreCallHistory: async (): Promise<void> => {
      try {
        const cursor = state.callHistoryCursor;
        if (!cursor) return;
        const history = await run(() =>
          input.api.listCallHistory({ cursor, limit: 50 }),
        );
        if (history) {
          dispatch({
            type: 'CALL_HISTORY_APPENDED',
            calls: history.calls,
            nextCursor: history.nextCursor,
          });
        }
      } catch (error: unknown) {
        reportUnexpectedFailure(error);
      }
    },
    selectCall: async (callId: string): Promise<void> => {
      try {
        const selected = await run(() =>
          Promise.all([
            input.api.getCallDetail(callId),
            input.api.getCallTranscript(callId),
          ]),
        );
        if (!selected) return;
        dispatch({ type: 'CALL_DETAIL_LOADED', detail: selected[0] });
        dispatch({ type: 'CALL_TRANSCRIPT_LOADED', segments: selected[1] });
      } catch (error: unknown) {
        reportUnexpectedFailure(error);
      }
    },
    searchContacts: async (query: string): Promise<void> => {
      try {
        dispatch({ type: 'FILTERS_CHANGED', filters: { query } });
        const contacts = await run(() =>
          input.api.listContacts({ query, limit: 50 }),
        );
        if (contacts) {
          dispatch({
            type: 'RESOURCES_LOADED',
            contacts: contacts.contacts,
            contactTotal: contacts.total,
            opportunities: state.opportunities,
            opportunityTotal: state.opportunityTotal,
            pipelines: state.pipelines,
          });
        }
      } catch (error: unknown) {
        reportUnexpectedFailure(error);
      }
    },
    searchOpportunities: async (filters: {
      query?: string;
      pipelineId?: string | null;
      stageId?: string | null;
    }): Promise<void> => {
      try {
        dispatch({ type: 'FILTERS_CHANGED', filters });
        const opportunities = await run(() =>
          input.api.searchOpportunities({
            query: filters.query,
            pipelineId: filters.pipelineId ?? undefined,
            stageId: filters.stageId ?? undefined,
            limit: 100,
          }),
        );
        if (opportunities) {
          dispatch({
            type: 'RESOURCES_LOADED',
            contacts: state.contacts,
            contactTotal: state.contactTotal,
            opportunities: opportunities.opportunities,
            opportunityTotal: opportunities.total,
            pipelines: state.pipelines,
          });
        }
      } catch (error: unknown) {
        reportUnexpectedFailure(error);
      }
    },
    updateSetup: (setup: Partial<LeadConnectorEmbedState['setup']>) =>
      dispatch({ type: 'SETUP_CHANGED', setup }),
    selectQueue: async (selection: {
      pipelineId: string;
      stageId: string;
    }): Promise<void> => {
      try {
        const preview = await run(() =>
          input.api.resolveQueueCandidates(selection),
        );
        if (!preview) return;
        const targets = preview.candidates.flatMap((candidate) => {
          const target = normalizeClickToCallTarget({
            phone: candidate.phone,
            contactId: candidate.contactId,
            name: candidate.contactName,
            opportunityId: candidate.opportunityId,
          });
          return target ? [target] : [];
        });
        dispatch({
          type: 'QUEUE_SELECTED',
          queue: {
            pipelineId: preview.pipelineId,
            pipelineName: preview.pipelineName,
            stageId: preview.stageId,
            stageName: preview.stageName,
            opportunityTotal: preview.opportunityTotal,
            callableTotal: preview.callableTotal,
          },
          targets,
        });
      } catch (error: unknown) {
        reportUnexpectedFailure(error);
      }
    },
    selectTarget: (target: LeadConnectorClickToCallTarget) => {
      state = selectEmbedTarget(state, target);
      publish();
    },
    removeTarget: (dedupeKey: string) => {
      state = removeEmbedTarget(state, dedupeKey);
      publish();
    },
    startConfiguredCall: async (): Promise<void> => {
      const strategy =
        state.setup.mode === 'single' ? 'single' : state.setup.callingMode;
      await startCall(strategy);
    },
    startCall,
    refreshSession: async (): Promise<void> => {
      try {
        const sessionId = state.activeSessionId;
        if (!sessionId) return;
        const session = await run(() => input.api.getCallSession(sessionId));
        if (session) projectSession(session);
      } catch (error: unknown) {
        reportUnexpectedFailure(error);
      }
    },
    pause: () => dispatch({ type: 'PAUSED' }),
    resume: () => dispatch({ type: 'RESUMED' }),
    stop: async (): Promise<void> => {
      try {
        const sessionId = state.activeSessionId;
        dispatch({ type: 'STOP_REQUESTED' });
        disconnectVoice();
        if (!sessionId) return;
        await run(() => input.api.terminateCallSession(sessionId));
      } catch (error: unknown) {
        reportUnexpectedFailure(error);
      }
    },
    hangUp: async (): Promise<void> => {
      try {
        const sessionId = state.activeSessionId;
        dispatch({ type: 'STOP_REQUESTED' });
        disconnectVoice();
        if (!sessionId) return;
        await run(() => input.api.terminateCallSession(sessionId));
      } catch (error: unknown) {
        reportUnexpectedFailure(error);
      }
    },
    submitDisposition: async (inputValue: {
      disposition: string;
      note?: string;
      tags?: string[];
    }): Promise<void> => {
      try {
        const contactId =
          state.callLegs.find((leg) => leg.role === 'winner')?.contactId ??
          state.selectedTargets[0]?.contactId;
        if (!contactId) {
          dispatch({
            type: 'FAILED',
            code: 'CONTACT_REQUIRED',
            message: 'A contact is required to record a disposition',
            recoverable: true,
          });
          return;
        }
        const sessionId = activeRecordSessionId;
        if (!sessionId) {
          dispatch({
            type: 'FAILED',
            code: 'CALL_SESSION_REQUIRED',
            message: 'A call session is required to record a disposition',
            recoverable: true,
          });
          return;
        }
        const result = await run(() =>
          input.api.recordDisposition({ sessionId, contactId, ...inputValue }),
        );
        if (result?.recorded) {
          activeRecordSessionId = null;
          dispatch({ type: 'DISPOSITION_SUBMITTED' });
          await Promise.all([
            loadCallOperations(),
            refreshResources({ force: true }),
          ]);
        }
      } catch (error: unknown) {
        reportUnexpectedFailure(error);
      }
    },
    retry: () => dispatch({ type: 'RETRY_REQUESTED' }),
    fail: (inputValue: {
      code: string;
      message: string;
      recoverable: boolean;
    }) => dispatch({ type: 'FAILED', ...inputValue }),
    returnHome: () => {
      activeRecordSessionId = null;
      disconnectVoice();
      dispatch({ type: 'RETURN_HOME' });
    },
    reset: () => dispatch({ type: 'RESET' }),
  };
};
