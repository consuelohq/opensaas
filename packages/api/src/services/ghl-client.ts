import * as Sentry from '@sentry/node';

// region — types

export interface GHLContact {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  tags: string[];
  source: string;
  customFields: Array<{ id: string; value: string }>;
  dnd: boolean;
  dateAdded: string;
  dateUpdated: string;
}

export interface GHLContactList {
  contacts: GHLContact[];
  meta: { total: number; startAfterId?: string; startAfter?: number };
}

export interface GHLOpportunity {
  id: string;
  name: string;
  monetaryValue: number;
  pipelineId: string;
  pipelineStageId: string;
  status: 'open' | 'won' | 'lost' | 'abandoned';
  contactId: string;
  dateAdded: string;
}

export interface GHLOpportunityList {
  opportunities: GHLOpportunity[];
  meta: { total: number; startAfterId?: string; startAfter?: number };
}

export interface GHLPipeline {
  id: string;
  name: string;
  stages: GHLPipelineStage[];
}

export interface GHLPipelineStage {
  id: string;
  name: string;
  position: number;
}

export interface GHLTaskCreate {
  title: string;
  body?: string;
  dueDate?: string;
  completed?: boolean;
  assignedTo?: string;
}

// endregion

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 10_000;

// sliding-window rate limiter — tracks request timestamps, waits when at capacity
class RateLimiter {
  private timestamps: number[] = [];

  async wait(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

    if (this.timestamps.length >= RATE_LIMIT_MAX) {
      const oldest = this.timestamps[0];
      const waitMs = RATE_LIMIT_WINDOW_MS - (now - oldest) + 50;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return this.wait();
    }

    this.timestamps.push(Date.now());
  }
}

export class GHLClient {
  private getToken: () => Promise<string>;
  private locationId: string;
  private rateLimiter = new RateLimiter();
  private refreshAndRetry: (() => Promise<string>) | null;

  constructor(
    getToken: () => Promise<string>,
    locationId: string,
    refreshAndRetry?: () => Promise<string>,
  ) {
    this.getToken = getToken;
    this.locationId = locationId;
    // optional separate refresh callback — if not provided, getToken is used for retry too
    this.refreshAndRetry = refreshAndRetry ?? null;
  }

  private async request<T>(path: string, options?: RequestInit, isRetry = false): Promise<T> {
    try {
      await this.rateLimiter.wait();
      const token = await this.getToken();

      const response = await fetch(`${GHL_API_BASE}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Version: GHL_API_VERSION,
          ...options?.headers,
        },
      });

      // 401 auto-retry: refresh token and try once more
      if (response.status === 401 && !isRetry) {
        const refresher = this.refreshAndRetry ?? this.getToken;
        const newToken = await refresher();
        this.getToken = () => Promise.resolve(newToken);
        return this.request<T>(path, options, true);
      }

      if (!response.ok) {
        const text = await response.text();
        Sentry.captureMessage(`GHL API error: ${response.status} ${path}`, { extra: { body: text } });
        throw new Error(`GHL API ${response.status}: ${text}`);
      }

      return response.json() as Promise<T>;
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  // region — contacts

  async getContacts(params?: {
    limit?: number;
    startAfterId?: string;
    query?: string;
  }): Promise<GHLContactList> {
    try {
      const searchParams = new URLSearchParams({ locationId: this.locationId });
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.startAfterId) searchParams.set('startAfterId', params.startAfterId);
      if (params?.query) searchParams.set('query', params.query);
      return await this.request<GHLContactList>(`/contacts/?${searchParams}`);
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  async getContact(id: string): Promise<GHLContact> {
    try {
      const data = await this.request<{ contact: GHLContact }>(`/contacts/${id}`);
      return data.contact;
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  async createContact(data: Partial<GHLContact>): Promise<GHLContact> {
    try {
      const result = await this.request<{ contact: GHLContact }>('/contacts/', {
        method: 'POST',
        body: JSON.stringify({ ...data, locationId: this.locationId }),
      });
      return result.contact;
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  async updateContact(id: string, data: Partial<GHLContact>): Promise<GHLContact> {
    try {
      const result = await this.request<{ contact: GHLContact }>(`/contacts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return result.contact;
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  async deleteContact(id: string): Promise<void> {
    try {
      await this.request<Record<string, unknown>>(`/contacts/${id}`, { method: 'DELETE' });
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  // endregion

  // region — opportunities

  async getOpportunities(pipelineId: string): Promise<GHLOpportunityList> {
    try {
      const searchParams = new URLSearchParams({ locationId: this.locationId, pipelineId });
      return await this.request<GHLOpportunityList>(`/opportunities/search?${searchParams}`);
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  async getOpportunity(id: string): Promise<GHLOpportunity> {
    try {
      return await this.request<GHLOpportunity>(`/opportunities/${id}`);
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  async updateOpportunity(id: string, data: Partial<GHLOpportunity>): Promise<GHLOpportunity> {
    try {
      return await this.request<GHLOpportunity>(`/opportunities/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  // endregion

  // region — pipelines

  async getPipelines(): Promise<GHLPipeline[]> {
    try {
      const data = await this.request<{ pipelines: GHLPipeline[] }>(
        `/opportunities/pipelines?locationId=${this.locationId}`,
      );
      return data.pipelines;
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  // endregion

  // region — notes & tasks

  async createNote(contactId: string, body: string): Promise<void> {
    try {
      await this.request<Record<string, unknown>>(`/contacts/${contactId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  async createTask(contactId: string, data: GHLTaskCreate): Promise<void> {
    try {
      await this.request<Record<string, unknown>>(`/contacts/${contactId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  // endregion
}
