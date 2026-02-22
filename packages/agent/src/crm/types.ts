export type CrmClientOptions = {
  baseUrl: string;
  token: string;
};

export type SearchFilters = Record<string, unknown>;

export type PaginationOptions = {
  limit?: number;
  offset?: number;
};

export type ContactSearchResult = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
};

export type DealResult = {
  id: string;
  name: string;
  stage: string;
  amount?: number;
  contactId?: string;
};

export type CallRecord = {
  id: string;
  contactId: string;
  direction: 'inbound' | 'outbound';
  outcome: string;
  duration: number;
  timestamp: string;
};

export type IntegrationInfo = {
  id: string;
  status: 'connected' | 'disconnected';
  capabilities: string[];
};
