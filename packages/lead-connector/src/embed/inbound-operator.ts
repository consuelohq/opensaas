import {
  EmbedApiError,
  EmbedSessionExpiredError,
  type EmbedFetch,
} from './api-client.js';

export type InboundOperatorPresence = 'online' | 'away' | 'offline';
export type InboundOperatorEndpointKind = 'browser' | 'phone';
export type InboundOperatorAssignmentPhase =
  | 'offering'
  | 'connecting'
  | 'connected'
  | 'unknown'
  | 'wrap_up';

export type InboundOperatorEndpoint = {
  endpointId: string;
  kind: InboundOperatorEndpointKind;
  healthy: boolean;
  label: string;
};

export type InboundOperatorAssignment = {
  assignmentId: string;
  requestId: string;
  generation: number;
  phase: InboundOperatorAssignmentPhase;
  offerExpiresAt: string | null;
  endpointId: string | null;
  externalStarted: boolean;
  connectedAt: string | null;
  unknownSince: string | null;
  wrapUpUntil: string | null;
};

export type InboundOperatorOffer = {
  assignmentId: string;
  requestId: string;
  generation: number;
  queueId: string;
  queueName: string;
  callerLabel: string;
  waitingSeconds: number;
  offerExpiresAt: string;
  ownerRepId: string | null;
  eligibleEndpoints: string[];
};

export type InboundOperatorQueueSnapshot = {
  queueId: string;
  queueName: string;
  waitingCount: number;
  oldestWaitSeconds: number;
  serviceableCount: number;
  businessHours: 'open' | 'after-hours' | 'holiday' | 'closed';
  overflow: 'standby' | 'callback' | 'voicemail' | 'active';
};

export type InboundOperatorConfiguration = {
  numberLabel: string;
  maskedNumber: string;
  teamName: string;
  hoursLabel: string;
  overflowLabel: string;
};

export type InboundOperatorSnapshot = {
  serverTime: string;
  rep: {
    repId: string;
    ready: boolean;
    presence: InboundOperatorPresence;
    endpoints: InboundOperatorEndpoint[];
    capacityPhase: InboundOperatorAssignmentPhase | null;
    assignment: InboundOperatorAssignment | null;
  };
  offers: InboundOperatorOffer[];
  queue: InboundOperatorQueueSnapshot;
  configuration: InboundOperatorConfiguration;
};

export type InboundOperatorState = InboundOperatorSnapshot & {
  phase: 'idle' | 'loading' | 'ready' | 'reconnecting' | 'error';
  lastSyncAt: string | null;
  pendingAction: {
    action: 'readiness' | 'accept' | 'decline' | 'wrap_up';
    assignmentId?: string;
  } | null;
  error: { code: string; message: string; recoverable: boolean } | null;
};

export type InboundOperatorActionResult = {
  accepted: boolean;
  status: 'accepted' | 'declined' | 'stale' | 'expired' | 'rejected';
  snapshot?: InboundOperatorSnapshot;
  message?: string;
};

export type InboundOperatorApi = {
  setSessionToken: (token: string | null) => void;
  getSnapshot: () => Promise<InboundOperatorSnapshot>;
  setReadiness: (input: {
    ready: boolean;
    endpoints: Array<{ endpointId: string; kind: InboundOperatorEndpointKind }>;
  }) => Promise<InboundOperatorSnapshot>;
  acceptOffer: (input: {
    assignmentId: string;
    generation: number;
    endpointId: string;
    attemptId: string;
  }) => Promise<InboundOperatorActionResult>;
  declineOffer: (input: {
    assignmentId: string;
    generation: number;
    reason?: string;
  }) => Promise<InboundOperatorActionResult>;
  reconnect: () => Promise<InboundOperatorSnapshot>;
  finishWrapUp: (input: {
    assignmentId: string;
    generation: number;
    disposition: string;
    note?: string;
  }) => Promise<InboundOperatorSnapshot>;
  getConfiguration: () => Promise<InboundOperatorConfiguration>;
  updateConfiguration: (
    input: InboundOperatorConfiguration,
  ) => Promise<InboundOperatorConfiguration>;
};

export const createInitialInboundOperatorState = (): InboundOperatorState => ({
  phase: 'idle',
  serverTime: new Date(0).toISOString(),
  rep: {
    repId: '',
    ready: false,
    presence: 'offline',
    endpoints: [],
    capacityPhase: null,
    assignment: null,
  },
  offers: [],
  queue: {
    queueId: '',
    queueName: 'Inbound queue',
    waitingCount: 0,
    oldestWaitSeconds: 0,
    serviceableCount: 0,
    businessHours: 'closed',
    overflow: 'standby',
  },
  configuration: {
    numberLabel: 'Inbound number',
    maskedNumber: 'Private number',
    teamName: 'Sales team',
    hoursLabel: 'Hours unavailable',
    overflowLabel: 'Fallback unavailable',
  },
  lastSyncAt: null,
  pendingAction: null,
  error: null,
});

export type InboundOperatorStateEvent =
  | { type: 'SNAPSHOT_LOADING' }
  | { type: 'SNAPSHOT_LOADED'; snapshot: InboundOperatorSnapshot }
  | { type: 'READINESS_CONFIRMED'; snapshot: InboundOperatorSnapshot }
  | { type: 'ASSIGNMENT_UPDATED'; assignment: InboundOperatorAssignment | null }
  | {
      type: 'ACTION_STARTED';
      action: 'readiness' | 'accept' | 'decline' | 'wrap_up';
      assignmentId?: string;
    }
  | {
      type: 'ACTION_CONFIRMED';
      action: 'accept' | 'decline' | 'wrap_up';
      snapshot: InboundOperatorSnapshot;
    }
  | {
      type: 'ACTION_REJECTED';
      action: 'accept' | 'decline' | 'wrap_up';
      assignmentId?: string;
      code: string;
      message: string;
    }
  | { type: 'RECOVERY_REQUIRED'; code: string; message: string }
  | { type: 'RECONNECTED'; snapshot: InboundOperatorSnapshot }
  | {
      type: 'CONFIGURATION_LOADED';
      configuration: InboundOperatorConfiguration;
    }
  | { type: 'CONFIGURATION_SAVED'; configuration: InboundOperatorConfiguration }
  | { type: 'FAILED'; code: string; message: string; recoverable: boolean };

const projectSnapshot = (
  state: InboundOperatorState,
  snapshot: InboundOperatorSnapshot,
  phase: InboundOperatorState['phase'] = 'ready',
): InboundOperatorState => ({
  ...state,
  ...snapshot,
  phase,
  lastSyncAt: snapshot.serverTime,
  pendingAction: null,
  error: null,
});

export const reduceInboundOperatorState = (
  state: InboundOperatorState,
  event: InboundOperatorStateEvent,
): InboundOperatorState => {
  switch (event.type) {
    case 'SNAPSHOT_LOADING':
      return { ...state, phase: 'loading', error: null };
    case 'SNAPSHOT_LOADED':
      return projectSnapshot(state, event.snapshot);
    case 'READINESS_CONFIRMED':
      return projectSnapshot(state, event.snapshot);
    case 'ASSIGNMENT_UPDATED':
      return {
        ...state,
        rep: {
          ...state.rep,
          assignment: event.assignment,
          capacityPhase: event.assignment?.phase ?? null,
        },
        error: null,
      };
    case 'ACTION_STARTED':
      return {
        ...state,
        pendingAction: {
          action: event.action,
          assignmentId: event.assignmentId,
        },
        error: null,
      };
    case 'ACTION_CONFIRMED':
      return projectSnapshot(state, event.snapshot);
    case 'ACTION_REJECTED':
      return {
        ...state,
        pendingAction: null,
        error: { code: event.code, message: event.message, recoverable: true },
      };
    case 'RECOVERY_REQUIRED':
      return {
        ...state,
        phase: 'reconnecting',
        error: { code: event.code, message: event.message, recoverable: true },
      };
    case 'RECONNECTED':
      return projectSnapshot(state, event.snapshot);
    case 'CONFIGURATION_LOADED':
    case 'CONFIGURATION_SAVED':
      return { ...state, configuration: event.configuration, error: null };
    case 'FAILED':
      return {
        ...state,
        phase: 'error',
        pendingAction: null,
        error: {
          code: event.code,
          message: event.message,
          recoverable: event.recoverable,
        },
      };
  }
};

const toJson = (input: unknown): RequestInit => ({
  method: 'POST',
  body: JSON.stringify(input),
});

type ErrorBody = {
  error?: { code?: string; message?: string; retryable?: boolean };
};

export const createLeadConnectorInboundOperatorApi = (options: {
  baseUrl: string;
  fetch?: EmbedFetch;
}): InboundOperatorApi => {
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  let sessionToken: string | null = null;

  const request = async <T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> => {
    const response = await fetcher(baseUrl + path, {
      ...init,
      headers: {
        accept: 'application/json',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(sessionToken ? { authorization: 'Bearer ' + sessionToken } : {}),
        ...init.headers,
      },
    });
    const body = (await response.json().catch(() => ({}))) as T & ErrorBody;
    if (response.status === 401) throw new EmbedSessionExpiredError();
    if (!response.ok) {
      throw new EmbedApiError(
        body.error?.code ?? 'REQUEST_FAILED',
        body.error?.message ?? 'Inbound operator request failed',
        body.error?.retryable === true,
        response.status,
      );
    }
    return body;
  };

  return {
    setSessionToken: (token) => {
      sessionToken = token;
    },
    getSnapshot: () =>
      request<InboundOperatorSnapshot>('/v1/inbound/operator/snapshot'),
    setReadiness: (input) =>
      request<InboundOperatorSnapshot>(
        '/v1/inbound/operator/readiness',
        toJson(input),
      ),
    acceptOffer: (input) =>
      request<InboundOperatorActionResult>(
        '/v1/inbound/operator/offers/accept',
        toJson(input),
      ),
    declineOffer: (input) =>
      request<InboundOperatorActionResult>(
        '/v1/inbound/operator/offers/decline',
        toJson(input),
      ),
    reconnect: () =>
      request<InboundOperatorSnapshot>(
        '/v1/inbound/operator/reconnect',
        toJson({}),
      ),
    finishWrapUp: (input) =>
      request<InboundOperatorSnapshot>(
        '/v1/inbound/operator/wrap-up',
        toJson(input),
      ),
    getConfiguration: () =>
      request<InboundOperatorConfiguration>(
        '/v1/inbound/operator/configuration',
      ),
    updateConfiguration: (input) =>
      request<InboundOperatorConfiguration>(
        '/v1/inbound/operator/configuration',
        {
          method: 'PATCH',
          body: JSON.stringify(input),
        },
      ),
  };
};
