import type {
  CrmClientOptions,
  SearchFilters,
  PaginationOptions,
  ContactSearchResult,
  DealResult,
  CallRecord,
  IntegrationInfo,
} from './types.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export class CrmClient {
  private baseUrl: string;
  private token: string;

  constructor(options: CrmClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.token = options.token;
  }

  // read operations

  async searchContacts(
    query: string,
    filters?: SearchFilters,
    pagination?: PaginationOptions,
  ): Promise<ContactSearchResult[]> {
    const limit = clampLimit(pagination?.limit);
    return this.request('/api/contacts/search', {
      method: 'POST',
      body: { query, filters, limit, offset: pagination?.offset ?? 0 },
    });
  }

  async getContact(id: string): Promise<unknown> {
    return this.request(`/api/contacts/${encodeURIComponent(id)}`);
  }

  async listDeals(
    filters?: SearchFilters,
    pagination?: PaginationOptions,
  ): Promise<DealResult[]> {
    const limit = clampLimit(pagination?.limit);
    return this.request('/api/deals', {
      method: 'POST',
      body: { filters, limit, offset: pagination?.offset ?? 0 },
    });
  }

  async getCallHistory(
    contactId?: string,
    since?: string,
    pagination?: PaginationOptions,
  ): Promise<CallRecord[]> {
    const limit = clampLimit(pagination?.limit);
    const params = new URLSearchParams();
    if (contactId) params.set('contactId', contactId);
    if (since) params.set('since', since);
    params.set('limit', String(limit));
    if (pagination?.offset) params.set('offset', String(pagination.offset));
    return this.request(`/api/calls?${params.toString()}`);
  }

  async getAnalytics(
    type: string,
    period: string,
    groupBy?: string,
  ): Promise<unknown> {
    const params = new URLSearchParams({ type, period });
    if (groupBy) params.set('groupBy', groupBy);
    return this.request(`/api/analytics?${params.toString()}`);
  }

  async searchKnowledgeBase(
    query: string,
    collection?: string,
  ): Promise<unknown> {
    return this.request('/api/kb/search', {
      method: 'POST',
      body: { query, collection },
    });
  }

  async listIntegrations(): Promise<IntegrationInfo[]> {
    return this.request('/api/integrations');
  }

  // write operations

  async logCall(
    contactId: string,
    outcome: string,
    notes: string,
    nextStep?: string,
  ): Promise<unknown> {
    return this.request('/api/calls', {
      method: 'POST',
      body: { contactId, outcome, notes, nextStep },
    });
  }

  async updateDeal(
    id: string,
    updates: { stage?: string; amount?: number; notes?: string },
  ): Promise<unknown> {
    return this.request(`/api/deals/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: updates,
    });
  }

  async createNote(contactId: string, content: string): Promise<unknown> {
    return this.request('/api/notes', {
      method: 'POST',
      body: { contactId, content },
    });
  }

  async addToQueue(
    contactIds: string[],
    priority?: number,
  ): Promise<unknown> {
    try {
      return await this.request('/api/queue', {
        method: 'POST',
        body: { contactIds, priority },
      });
    } catch (err: unknown) {
      // Sentry.captureException(err) — handled by consuming app
      throw err;
    }
  }

  async createTask(
    title: string,
    dueDate: string,
    contactId?: string,
  ): Promise<unknown> {
    try {
      return await this.request('/api/tasks', {
        method: 'POST',
        body: { title, dueDate, contactId },
      });
    } catch (err: unknown) {
      // Sentry.captureException(err) — handled by consuming app
      throw err;
    }
  }

  // internal

  private async request<TResult>(
    path: string,
    options?: { method?: string; body?: unknown },
  ): Promise<TResult> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: options?.method ?? 'GET',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.token}`,
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => 'unknown error');
        const error = new Error(`CRM API ${response.status}: ${text}`);
        // Sentry.captureException(error) — handled by consuming app
        throw error;
      }

      return response.json() as Promise<TResult>;
    } catch (err: unknown) {
      // Sentry.captureException(err) — handled by consuming app
      throw err;
    }
  }
}

const clampLimit = (limit?: number): number => {
  if (!limit || limit < 1) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
};
