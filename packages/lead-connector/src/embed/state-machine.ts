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

export type EmbedDialerSetup = {
  mode: 'queue' | 'single';
  callingMode: 'predictive' | 'single';
  requestedFanout: 1 | 2 | 3;
  preferLocalPresence: boolean;
  callerIdNumber: string | null;
};

export type EmbedQueueSelection = {
  pipelineId: string;
  pipelineName: string;
  stageId: string;
  stageName: string;
  opportunityTotal: number;
  callableTotal: number;
};

export type EmbedAdminCall = {
  id: string;
  representative?: string | null;
  contactId?: string | null;
  contactName?: string | null;
  queueId?: string | null;
  status: string;
  elapsedSeconds?: number;
  activeLineCount?: number;
  transcriptStatus?: 'pending' | 'processing' | 'ready' | 'failed' | null;
  startedAt?: string | null;
  durationSeconds?: number | null;
  requestedFanout?: number | null;
  actualFanout?: number | null;
  disposition?: string | null;
  note?: string | null;
  tags?: string[];
  crmSyncStatus?: 'pending' | 'synced' | 'failed' | null;
  opportunity?: {
    id?: string | null;
    status?: string | null;
    monetaryValue?: number | null;
    pipelineId?: string | null;
    stageId?: string | null;
  } | null;
  currentOpportunity?: {
    id?: string | null;
    status?: string | null;
    monetaryValue?: number | null;
    pipelineId?: string | null;
    stageId?: string | null;
  } | null;
  calls: Array<{
    providerCallId: string;
    role?: 'active' | 'winner' | 'loser' | null;
    status?: string | null;
    callerIdentity?: string | null;
    amdResult?: string | null;
    terminalOutcome?: string | null;
    durationSeconds?: number | null;
  }>;
  transferEvents?: Array<{
    id: string;
    type: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
  }>;
};

export type EmbedTranscriptSegment = {
  id: string;
  sequence: number;
  track: 'inbound' | 'outbound';
  speaker: string;
  text: string;
  startMs?: number | null;
  endMs?: number | null;
};

export type EmbedFailure = {
  code: string;
  message: string;
  recoverable: boolean;
};

export type EmbedCommercialCallerContext = {
  planCode: 'single' | 'standard' | 'power';
  trial: boolean;
  callerIds: string[];
  connectedMinutes: number;
  remainingMinutes: number | null;
  lineOptions: number[];
  predictive: boolean;
  recordings: boolean;
  transcripts: boolean;
  canStartCall: boolean;
  denialCode: string | null;
  billing: {
    state: string;
    graceEndsAt: string | null;
  };
};

export type EmbedCommercialDashboard = {
  workspaceId: string;
  catalog: {
    plans: Record<
      'single' | 'standard' | 'power',
      {
        code: string;
        priceCents: number;
        maxNumbersPerSeat: number;
        includedMinutes: number | null;
        predictive: boolean;
        recordings: boolean;
        transcripts: boolean;
      }
    >;
    trial: {
      includedMinutes: number;
      maxSeats: number;
      maxNumbers: number;
      planCode: string;
    };
    additionalNumberPriceCents: number;
    includedNumbersPerSeat: number;
    paymentGraceDays: number;
  };
  subscription: Record<string, unknown> | null;
  seats: Array<Record<string, unknown>>;
  numbers: Array<Record<string, unknown>>;
  usage: Record<string, unknown>;
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
  callerIds: string[];
  commercialCaller: EmbedCommercialCallerContext | null;
  commercialDashboard: EmbedCommercialDashboard | null;
  commercialNumberSearchResults: Array<Record<string, unknown>>;
  commercialNumberTargetUserId: string;
  filters: EmbedFilters;
  setup: EmbedDialerSetup;
  selectedQueue: EmbedQueueSelection | null;
  resourcesRefreshing: boolean;
  selectedTargets: LeadConnectorClickToCallTarget[];
  selectionStrategy: 'single' | 'predictive';
  activeSessionId: string | null;
  callSession: EmbedCallSession | null;
  callLegs: EmbedCallLeg[];
  activeCalls: EmbedAdminCall[];
  callHistory: EmbedAdminCall[];
  callHistoryCursor: string | null;
  selectedCallDetail: EmbedAdminCall | null;
  selectedCallTranscript: EmbedTranscriptSegment[];
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
  | { type: 'RESOURCES_REFRESH_STARTED' }
  | { type: 'RESOURCES_REFRESH_FINISHED' }
  | {
      type: 'COMMERCIAL_CALLER_LOADED';
      caller: EmbedCommercialCallerContext;
    }
  | {
      type: 'COMMERCIAL_DASHBOARD_LOADED';
      dashboard: EmbedCommercialDashboard;
    }
  | {
      type: 'COMMERCIAL_NUMBER_SEARCHED';
      numbers: Array<Record<string, unknown>>;
      userId: string;
    }
  | { type: 'SETUP_CHANGED'; setup: Partial<EmbedDialerSetup> }
  | {
      type: 'QUEUE_SELECTED';
      queue: EmbedQueueSelection;
      targets: LeadConnectorClickToCallTarget[];
    }
  | { type: 'START_REQUESTED'; strategy: 'single' | 'predictive' }
  | { type: 'SESSION_UPDATED'; session: EmbedCallSession }
  | { type: 'PAUSED' }
  | { type: 'RESUMED' }
  | { type: 'STOP_REQUESTED' }
  | { type: 'DISPOSITION_SUBMITTED' }
  | {
      type: 'CALLS_LOADED';
      activeCalls: EmbedAdminCall[];
      callHistory: EmbedAdminCall[];
      nextCursor: string | null;
    }
  | {
      type: 'CALL_HISTORY_APPENDED';
      calls: EmbedAdminCall[];
      nextCursor: string | null;
    }
  | { type: 'CALL_DETAIL_LOADED'; detail: EmbedAdminCall }
  | {
      type: 'CALL_TRANSCRIPT_LOADED';
      segments: EmbedTranscriptSegment[];
    }
  | { type: 'FAILED'; code: string; message: string; recoverable: boolean }
  | { type: 'RETRY_REQUESTED' }
  | { type: 'SESSION_EXPIRED' }
  | { type: 'RETURN_HOME' }
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
  callerIds: [],
  commercialCaller: null,
  commercialDashboard: null,
  commercialNumberSearchResults: [],
  commercialNumberTargetUserId: '',
  filters: { query: '', pipelineId: null, stageId: null },
  setup: {
    mode: 'queue',
    callingMode: 'predictive',
    requestedFanout: 1,
    preferLocalPresence: true,
    callerIdNumber: null,
  },
  selectedQueue: null,
  resourcesRefreshing: false,
  selectedTargets: [],
  selectionStrategy: 'single',
  activeSessionId: null,
  callSession: null,
  callLegs: [],
  activeCalls: [],
  callHistory: [],
  callHistoryCursor: null,
  selectedCallDetail: null,
  selectedCallTranscript: [],
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
        resourcesRefreshing: false,
      };
    case 'FILTERS_CHANGED':
      return { ...state, filters: { ...state.filters, ...event.filters } };
    case 'RESOURCES_REFRESH_STARTED':
      return { ...state, resourcesRefreshing: true };
    case 'RESOURCES_REFRESH_FINISHED':
      return { ...state, resourcesRefreshing: false };
    case 'COMMERCIAL_CALLER_LOADED': {
      const lineOptions = event.caller.lineOptions.filter(
        (line): line is 1 | 2 | 3 => line === 1 || line === 2 || line === 3,
      );
      const requestedFanout = lineOptions.includes(state.setup.requestedFanout)
        ? state.setup.requestedFanout
        : (lineOptions.at(-1) ?? 1);
      return {
        ...state,
        callerIds: event.caller.callerIds,
        commercialCaller: event.caller,
        setup: {
          ...state.setup,
          callingMode: event.caller.predictive
            ? state.setup.callingMode
            : 'single',
          requestedFanout: event.caller.predictive ? requestedFanout : 1,
          callerIdNumber:
            state.setup.callerIdNumber &&
            event.caller.callerIds.includes(state.setup.callerIdNumber)
              ? state.setup.callerIdNumber
              : null,
        },
      };
    }
    case 'COMMERCIAL_DASHBOARD_LOADED':
      return { ...state, commercialDashboard: event.dashboard };
    case 'COMMERCIAL_NUMBER_SEARCHED':
      return {
        ...state,
        commercialNumberSearchResults: event.numbers,
        commercialNumberTargetUserId: event.userId,
      };
    case 'SETUP_CHANGED': {
      const setup = { ...state.setup, ...event.setup };
      if (setup.mode === 'single' || setup.callingMode === 'single') {
        setup.callingMode = 'single';
        setup.requestedFanout = 1;
      }
      return {
        ...state,
        setup,
        selectedQueue: setup.mode === 'single' ? null : state.selectedQueue,
      };
    }
    case 'QUEUE_SELECTED':
      return {
        ...state,
        phase: 'ready',
        setup: { ...state.setup, mode: 'queue' },
        selectedQueue: event.queue,
        selectedTargets: event.targets,
        error: null,
      };
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
    case 'RETURN_HOME':
      return {
        ...state,
        phase: 'ready',
        resumePhase: null,
        activeSessionId: null,
        callSession: null,
        callLegs: [],
        selectedCallDetail: null,
        selectedCallTranscript: [],
        selectedTargets:
          state.setup.mode === 'single' ? [] : state.selectedTargets,
        error: null,
      };
    case 'CALLS_LOADED':
      return {
        ...state,
        activeCalls: event.activeCalls,
        callHistory: event.callHistory,
        callHistoryCursor: event.nextCursor,
      };
    case 'CALL_HISTORY_APPENDED': {
      const callsById = new Map(
        [...state.callHistory, ...event.calls].map((call) => [call.id, call]),
      );
      return {
        ...state,
        callHistory: [...callsById.values()],
        callHistoryCursor: event.nextCursor,
      };
    }
    case 'CALL_DETAIL_LOADED':
      return { ...state, selectedCallDetail: event.detail };
    case 'CALL_TRANSCRIPT_LOADED':
      return { ...state, selectedCallTranscript: event.segments };
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
    setup: {
      ...state.setup,
      mode: 'single',
      callingMode: 'single',
      requestedFanout: 1,
    },
    selectedQueue: null,
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
