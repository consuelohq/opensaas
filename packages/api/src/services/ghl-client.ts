import * as Sentry from '@sentry/node';

export interface GHLContact {
  id: string;
  locationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  tags: string[];
  customFields: Record<string, unknown>;
  dndStatus?: boolean;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  dateUpdated?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GHLContactList {
  contacts: GHLContact[];
  meta: { total: number; currentPage: number; perPage: number };
}

export interface GHLOpportunity {
  id: string;
  locationId: string;
  contactId: string;
  pipelineId: string;
  pipelineStageId: string;
  name: string;
  monetaryValue: number;
  status: 'open' | 'won' | 'lost';
  createdAt: string;
  updatedAt: string;
}

export interface GHLPipeline {
  id: string;
  locationId: string;
  name: string;
  stages: GHLPipelineStage[];
}

export interface GHLPipelineStage {
  id: string;
  pipelineId: string;
  name: string;
  order: number;
}

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 10_000;

class RateLimiter {
  private timestamps: number[] = [];

  async wait(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(
      (t) => now - t < RATE_LIMIT_WINDOW_MS,
    );

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

  private async request<T>(
    path: string,
    options?: RequestInit,
    isRetry = false,
  ): Promise<T> {
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
        Sentry.captureMessage(`GHL API error: ${response.status} ${path}`, {
          extra: { body: text },
        });
        throw new Error(`GHL API ${response.status}: ${text}`);
      }

      return response.json() as Promise<T>;
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  // region — contacts

  async getContacts(page = 1, limit = 10): Promise<GHLContactList> {
    try {
      const searchParams = new URLSearchParams({
        locationId: this.locationId,
        page: String(page),
        limit: String(limit),
      });
      const data = await this.request<{
        contacts: GHLContact[];
        meta: { total: number; current_page: number; per_page: number };
      }>(`/contacts/?${searchParams}`);
      return {
        contacts: data.contacts,
        meta: {
          total: data.meta.total,
          currentPage: data.meta.current_page,
          perPage: data.meta.per_page,
        },
      };
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  async getContact(id: string): Promise<GHLContact> {
    try {
      const data = await this.request<{ contact: GHLContact }>(
        `/contacts/${id}`,
      );
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

  async updateContact(
    id: string,
    data: Partial<GHLContact>,
  ): Promise<GHLContact> {
    try {
      const result = await this.request<{ contact: GHLContact }>(
        `/contacts/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify(data),
        },
      );
      return result.contact;
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  async deleteContact(id: string): Promise<void> {
    try {
      await this.request<Record<string, unknown>>(`/contacts/${id}`, {
        method: 'DELETE',
      });
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  // endregion

  // region — opportunities

  async getOpportunities(contactId?: string): Promise<GHLOpportunity[]> {
    try {
      const searchParams = new URLSearchParams({ locationId: this.locationId });
      if (contactId) searchParams.set('contactId', contactId);
      const data = await this.request<{ opportunities: GHLOpportunity[] }>(
        `/opportunities/search?${searchParams}`,
      );
      return data.opportunities;
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

  async updateOpportunity(
    id: string,
    data: Partial<GHLOpportunity>,
  ): Promise<GHLOpportunity> {
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

  async getPipelineStages(pipelineId: string): Promise<GHLPipelineStage[]> {
    try {
      const data = await this.request<{
        pipelineStages: Array<{ id: string; name: string; position: number }>;
      }>(
        `/opportunities/pipelines/${pipelineId}/stages?locationId=${this.locationId}`,
      );
      return data.pipelineStages.map((stage) => ({
        id: stage.id,
        pipelineId,
        name: stage.name,
        order: stage.position,
      }));
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  // endregion

  // region — notes & tasks

  async createNote(contactId: string, body: string): Promise<{ id: string }> {
    try {
      const result = await this.request<{ note: { id: string } }>(
        `/contacts/${contactId}/notes`,
        {
          method: 'POST',
          body: JSON.stringify({ body }),
        },
      );
      return { id: result.note.id };
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  async createTask(
    contactId: string,
    task: { title: string; dueDate?: string },
  ): Promise<{ id: string }> {
    try {
      const result = await this.request<{ task: { id: string } }>(
        `/contacts/${contactId}/tasks`,
        {
          method: 'POST',
          body: JSON.stringify(task),
        },
      );
      return { id: result.task.id };
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  // endregion
}
