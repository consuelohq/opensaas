import type {
  LeadConnectorContact,
  LeadConnectorOpportunity,
  LeadConnectorPipeline,
} from '../contracts/index.js';
import type { LeadConnectorClickToCallTarget } from './protocol.js';

export type LeadConnectorEmbedPhase =
  | 'booting'
  | 'authenticating'
  | 'ready'
  | 'target-selected'
  | 'starting'
  | 'dialing'
  | 'ringing'
  | 'connected'
  | 'paused'
  | 'wrapping-up'
  | 'completed'
  | 'failed';

export type EmbedCallLeg = {
  callSid: string;
  customerNumber: string;
  contactId?: string;
  position: number;
  status: string;
  amdResult?: string;
  role: 'active' | 'winner' | 'loser';
};

export type EmbedCallSession = {
  groupId: string;
  status: string;
  winnerSid: string | null;
  winner: unknown | null;
  calls: Array<{
    callSid: string;
    customerNumber: string;
    contactId?: string;
    position: number;
    status: string;
    amdResult?: string;
  }>;
};

export type EmbedFilters = {
  query: string;
  pipelineId: string | null;
  stageId: string | null;
};

export type EmbedFailure = {
  code: string;
  message: string;
  recoverable: boolean;
};

export type LeadConnectorEmbedState = {
  phase: LeadConnectorEmbedPhase;
  resumePhase: LeadConnectorEmbedPhase | null;
  sessionToken: string | null;
  sessionExpiresAt: string | null;
  contacts: LeadConnectorContact[];
  contactTotal: number;
  opportunities: LeadConnectorOpportunity[];
  opportunityTotal: number;
  pipelines: LeadConnectorPipeline[];
  filters: EmbedFilters;
  selectedTargets: LeadConnectorClickToCallTarget[];
  selectionStrategy: 'single' | 'predictive';
  activeSessionId: string | null;
  callSession: EmbedCallSession | null;
  callLegs: EmbedCallLeg[];
  error: EmbedFailure | null;
};

export type EmbedStateEvent =
  | { type: 'AUTHENTICATION_STARTED' }
  | { type: 'AUTHENTICATED'; token: string; expiresAt: string }
  | {
      type: 'RESOURCES_LOADED';
      contacts: LeadConnectorContact[];
      contactTotal: number;
      opportunities: LeadConnectorOpportunity[];
      opportunityTotal: number;
      pipelines: LeadConnectorPipeline[];
    }
  | { type: 'FILTERS_CHANGED'; filters: Partial<EmbedFilters> }
  | { type: 'START_REQUESTED'; strategy: 'single' | 'predictive' }
  | { type: 'SESSION_UPDATED'; session: EmbedCallSession }
  | { type: 'PAUSED' }
  | { type: 'RESUMED' }
  | { type: 'STOP_REQUESTED' }
  | { type: 'DISPOSITION_SUBMITTED' }
  | { type: 'FAILED'; code: string; message: string; recoverable: boolean }
  | { type: 'RETRY_REQUESTED' }
  | { type: 'SESSION_EXPIRED' }
  | { type: 'RESET' };

export const createInitialEmbedState = (): LeadConnectorEmbedState => ({
  phase: 'booting',
  resumePhase: null,
  sessionToken: null,
  sessionExpiresAt: null,
  contacts: [],
  contactTotal: 0,
  opportunities: [],
  opportunityTotal: 0,
  pipelines: [],
  filters: { query: '', pipelineId: null, stageId: null },
  selectedTargets: [],
  selectionStrategy: 'single',
  activeSessionId: null,
  callSession: null,
  callLegs: [],
  error: null,
});

const TERMINAL_SESSION_STATUSES = new Set([
  'completed',
  'terminated',
  'canceled',
  'failed',
]);

export const isTerminalEmbedSession = (session: EmbedCallSession): boolean =>
  TERMINAL_SESSION_STATUSES.has(session.status.toLowerCase());

const phaseFromSession = (
  session: EmbedCallSession,
): LeadConnectorEmbedPhase => {
  const status = session.status.toLowerCase();
  if (isTerminalEmbedSession(session))
    return status === 'failed' ? 'failed' : 'wrapping-up';
  if (
    session.winnerSid ||
    ['connected', 'in-progress', 'answered'].includes(status)
  ) {
    return 'connected';
  }
  if (status === 'ringing') return 'ringing';
  return 'dialing';
};

const projectCallLegs = (session: EmbedCallSession): EmbedCallLeg[] =>
  session.calls.map((call) => ({
    ...call,
    role:
      call.callSid === session.winnerSid
        ? 'winner'
        : session.winnerSid
          ? 'loser'
          : 'active',
  }));

export const reduceEmbedState = (
  state: LeadConnectorEmbedState,
  event: EmbedStateEvent,
): LeadConnectorEmbedState => {
  switch (event.type) {
    case 'AUTHENTICATION_STARTED':
      return { ...state, phase: 'authenticating', error: null };
    case 'AUTHENTICATED':
      return {
        ...state,
        phase: state.selectedTargets.length > 0 ? 'target-selected' : 'ready',
        sessionToken: event.token,
        sessionExpiresAt: event.expiresAt,
        error: null,
      };
    case 'RESOURCES_LOADED':
      return {
        ...state,
        contacts: event.contacts,
        contactTotal: event.contactTotal,
        opportunities: event.opportunities,
        opportunityTotal: event.opportunityTotal,
        pipelines: event.pipelines,
      };
    case 'FILTERS_CHANGED':
      return { ...state, filters: { ...state.filters, ...event.filters } };
    case 'START_REQUESTED':
      return {
        ...state,
        phase: 'starting',
        selectionStrategy: event.strategy,
        error: null,
      };
    case 'SESSION_UPDATED':
      return {
        ...state,
        phase: phaseFromSession(event.session),
        activeSessionId: event.session.groupId,
        callSession: event.session,
        callLegs: projectCallLegs(event.session),
        error: null,
      };
    case 'PAUSED':
      return {
        ...state,
        phase: 'paused',
        resumePhase:
          state.phase === 'paused'
            ? state.resumePhase
            : ['booting', 'authenticating', 'failed', 'completed'].includes(
                  state.phase,
                )
              ? null
              : state.phase,
      };
    case 'RESUMED':
      return {
        ...state,
        phase:
          state.resumePhase ??
          (state.selectedTargets.length > 0 ? 'target-selected' : 'ready'),
        resumePhase: null,
      };
    case 'STOP_REQUESTED':
      return { ...state, phase: 'wrapping-up' };
    case 'DISPOSITION_SUBMITTED':
      return { ...state, phase: 'completed', selectedTargets: [], error: null };
    case 'FAILED':
      return {
        ...state,
        phase: 'failed',
        error: {
          code: event.code,
          message: event.message,
          recoverable: event.recoverable,
        },
      };
    case 'RETRY_REQUESTED':
      return {
        ...state,
        phase:
          state.error?.code === 'SESSION_EXPIRED'
            ? 'authenticating'
            : state.selectedTargets.length > 0
              ? 'target-selected'
              : 'ready',
        error: null,
      };
    case 'SESSION_EXPIRED':
      return {
        ...state,
        phase: 'authenticating',
        sessionToken: null,
        sessionExpiresAt: null,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Your embed session expired. Reconnect to continue.',
          recoverable: true,
        },
      };
    case 'RESET':
      return createInitialEmbedState();
  }
};

export const selectEmbedTarget = (
  state: LeadConnectorEmbedState,
  target: LeadConnectorClickToCallTarget,
): LeadConnectorEmbedState => {
  if (state.selectedTargets.some((item) => item.dedupeKey === target.dedupeKey))
    return state;
  return {
    ...state,
    phase: 'target-selected',
    selectedTargets: [...state.selectedTargets, target],
  };
};

export const removeEmbedTarget = (
  state: LeadConnectorEmbedState,
  dedupeKey: string,
): LeadConnectorEmbedState => {
  const selectedTargets = state.selectedTargets.filter(
    (target) => target.dedupeKey !== dedupeKey,
  );
  return {
    ...state,
    selectedTargets,
    phase: selectedTargets.length > 0 ? 'target-selected' : 'ready',
  };
};

export const filterEmbedOpportunities = (
  opportunities: LeadConnectorOpportunity[],
  filters: EmbedFilters,
): LeadConnectorOpportunity[] => {
  const query = filters.query.trim().toLowerCase();
  return opportunities.filter((opportunity) => {
    if (filters.pipelineId && opportunity.pipelineId !== filters.pipelineId)
      return false;
    if (filters.stageId && opportunity.stageId !== filters.stageId)
      return false;
    return !query || opportunity.name.toLowerCase().includes(query);
  });
};
