import type { LeadConnectorEmbedApi } from './api-client.js';
import type { LeadConnectorAgentVoice } from './agent-voice.js';
import { EmbedSessionExpiredError } from './api-client.js';
import type { LeadConnectorClickToCallTarget } from './protocol.js';
import {
  createInitialEmbedState,
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

  const reportUnexpectedFailure = (error: unknown): void => {
    dispatch({
      type: 'FAILED',
      code: 'UNEXPECTED_EMBED_FAILURE',
      message:
        error instanceof Error ? error.message : 'Embedded dialer failed',
      recoverable: true,
    });
  };

  const loadResources = async (): Promise<void> => {
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
        await loadResources();
      } catch (error: unknown) {
        reportUnexpectedFailure(error);
      }
    },
    loadResources,
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
    selectTarget: (target: LeadConnectorClickToCallTarget) => {
      state = selectEmbedTarget(state, target);
      publish();
    },
    removeTarget: (dedupeKey: string) => {
      state = removeEmbedTarget(state, dedupeKey);
      publish();
    },
    startCall: async (strategy: 'single' | 'predictive'): Promise<void> => {
      try {
        if (state.selectedTargets.length === 0) {
          dispatch({
            type: 'FAILED',
            code: 'TARGET_REQUIRED',
            message: 'Select at least one callable target',
            recoverable: true,
          });
          return;
        }
        dispatch({ type: 'START_REQUESTED', strategy });
        await input.voice.prepare();
        const targets =
          strategy === 'single'
            ? state.selectedTargets.slice(0, 1)
            : state.selectedTargets;
        const request =
          strategy === 'single'
            ? {
                source: 'direct',
                selectionStrategy: 'single',
                requestedFanout: 1,
                targetPhone: targets[0]?.phone,
                contactId: targets[0]?.contactId ?? undefined,
              }
            : {
                source: 'queue',
                selectionStrategy: 'predictive',
                requestedFanout: targets.length,
                targetPhones: targets.map((target) => target.phone),
                contactIds: targets
                  .map((target) => target.contactId)
                  .filter((value): value is string => value !== null),
              };
        const result = await run(() => input.api.startCallSession(request));
        if (!result) return;
        const statusId = result.providerGroupId ?? result.sessionId;
        try {
          await input.voice.connect(statusId);
          const ready = await run(() => input.api.markAgentReady(statusId));
          if (!ready) {
            input.voice.disconnect();
            await input.api.terminateCallSession(statusId).catch(() => undefined);
            return;
          }
          if (ready.remainingCleanup > 0) {
            throw new Error('Agent conference did not become ready');
          }
        } catch (error: unknown) {
          input.voice.disconnect();
          await input.api.terminateCallSession(statusId).catch(() => undefined);
          throw error;
        }
        const session = await run(() => input.api.getCallSession(statusId));
        if (session) dispatch({ type: 'SESSION_UPDATED', session });
      } catch (error: unknown) {
        reportUnexpectedFailure(error);
      }
    },
    refreshSession: async (): Promise<void> => {
      try {
        const sessionId = state.activeSessionId;
        if (!sessionId) return;
        const session = await run(() => input.api.getCallSession(sessionId));
        if (session) dispatch({ type: 'SESSION_UPDATED', session });
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
        input.voice.disconnect();
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
        input.voice.disconnect();
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
        const result = await run(() =>
          input.api.recordDisposition({ contactId, ...inputValue }),
        );
        if (result?.recorded) dispatch({ type: 'DISPOSITION_SUBMITTED' });
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
    reset: () => dispatch({ type: 'RESET' }),
  };
};
