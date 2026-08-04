import type {
  LeadConnectorContact,
  LeadConnectorOpportunity,
  LeadConnectorPipeline,
} from '../contracts/index.js';
import type { EmbedCallSession } from './state-machine.js';

export class EmbedSessionExpiredError extends Error {
  readonly code = 'SESSION_EXPIRED';
  constructor() {
    super('Embed session expired');
    this.name = 'EmbedSessionExpiredError';
  }
}

export class EmbedApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly status: number,
  ) {
    super(message);
    this.name = 'EmbedApiError';
  }
}

export type EmbedFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type EmbedApiOptions = {
  baseUrl: string;
  fetch?: EmbedFetch;
};

type ErrorBody = {
  error?: { code?: string; message?: string; retryable?: boolean };
};

export const createLeadConnectorEmbedApi = (options: EmbedApiOptions) => {
  const fetcher: EmbedFetch =
    options.fetch ?? globalThis.fetch.bind(globalThis);
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  let sessionToken: string | null = null;

  const request = async <T>(
    path: string,
    init: RequestInit = {},
    tokenOverride?: string,
  ): Promise<T> => {
    const token = tokenOverride ?? sessionToken;
    const response = await fetcher(`${baseUrl}${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    const body = (await response.json().catch(() => ({}))) as T & ErrorBody;
    if (response.status === 401) throw new EmbedSessionExpiredError();
    if (!response.ok) {
      throw new EmbedApiError(
        body.error?.code ?? 'REQUEST_FAILED',
        body.error?.message ?? 'Dialer request failed',
        body.error?.retryable === true,
        response.status,
      );
    }
    return body;
  };

  return {
    setSessionToken: (token: string | null) => {
      sessionToken = token;
    },
    createEmbedSession: (encryptedData: string) =>
      request<{ token: string; expiresAt: string }>('/v1/embed/session', {
        method: 'POST',
        body: JSON.stringify({ encryptedData }),
      }),
    listContacts: (
      input: { query?: string; limit?: number; cursor?: string } = {},
    ) => {
      const query = new URLSearchParams();
      if (input.query) query.set('query', input.query);
      if (input.limit) query.set('limit', String(input.limit));
      if (input.cursor) query.set('cursor', input.cursor);
      const suffix = query.size > 0 ? `?${query.toString()}` : '';
      return request<{
        contacts: LeadConnectorContact[];
        total: number;
        nextCursor: string | null;
      }>(`/v1/integrations/leadconnector/contacts${suffix}`);
    },
    searchOpportunities: (
      input: {
        query?: string;
        pipelineId?: string;
        stageId?: string;
        status?: string;
        limit?: number;
      } = {},
    ) =>
      request<{ opportunities: LeadConnectorOpportunity[]; total: number }>(
        '/v1/integrations/leadconnector/opportunities/search',
        { method: 'POST', body: JSON.stringify(input) },
      ),
    listPipelines: () =>
      request<{ pipelines: LeadConnectorPipeline[] }>(
        '/v1/integrations/leadconnector/pipelines',
      ).then((result) => result.pipelines),
    startCallSession: (input: Record<string, unknown>) =>
      request<{
        sessionId: string;
        providerGroupId: string | null;
        status: string;
        calls: EmbedCallSession['calls'];
      }>('/v1/call-sessions', { method: 'POST', body: JSON.stringify(input) }),
    getVoiceToken: () =>
      request<{ token: string; identity: string; ttl: number }>(
        '/v1/voice/token',
      ),
    markAgentReady: (sessionId: string) =>
      request<{
        groupId: string;
        status: string;
        remainingCleanup: number;
      }>(`/v1/call-sessions/${encodeURIComponent(sessionId)}/agent-ready`, {
        method: 'POST',
      }),
    getCallSession: (sessionId: string) =>
      request<EmbedCallSession>(
        `/v1/call-sessions/${encodeURIComponent(sessionId)}`,
      ),
    terminateCallSession: (sessionId: string) =>
      request<{ groupId: string; status: 'completed' }>(
        `/v1/call-sessions/${encodeURIComponent(sessionId)}/terminate`,
        { method: 'POST' },
      ),
    recordDisposition: (input: {
      contactId: string;
      disposition: string;
      note?: string;
      tags?: string[];
    }) =>
      request<{ recorded: true }>(
        '/v1/integrations/leadconnector/dispositions',
        { method: 'POST', body: JSON.stringify(input) },
      ),
  };
};

export type LeadConnectorEmbedApi = ReturnType<
  typeof createLeadConnectorEmbedApi
>;
