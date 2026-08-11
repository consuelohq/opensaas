export type LeadConnectorConfiguration = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authorizationUrl: string;
  apiBaseUrl: string;
  tokenRefreshSkewSeconds: number;
  userType: 'Location';
};

export type LeadConnectorOAuthState = {
  state: string;
  workspaceId: string;
  redirectUri: string;
  expiresAt: string;
};

export type LeadConnectorInstallation = {
  installationId: string;
  workspaceId: string;
  locationId: string;
  accessTokenCiphertext: string;
  refreshTokenCiphertext: string;
  expiresAt: string;
  scopes: string[];
  connectedAt: string;
  updatedAt: string;
};

export type LeadConnectorUserContext = {
  userId: string;
  companyId: string;
  role: string;
  type: 'agency' | 'location';
  activeLocation: string | null;
  versionId: string | null;
  appStatus: string | null;
};

export type LeadConnectorEmbedIdentity = {
  workspaceId: string;
  userId: string;
  installationId: string;
  locationId: string;
  role: string;
  contextType: 'agency' | 'location';
};

export type LeadConnectorHttpMethod = 'DELETE' | 'GET' | 'POST' | 'PUT';

export type LeadConnectorHttpRequest = {
  method: LeadConnectorHttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
};

export type LeadConnectorHttpResponse = {
  status: number;
  body: unknown;
};

export type LeadConnectorContact = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  tags: string[];
};

export type LeadConnectorOpportunity = {
  id: string;
  name: string;
  contactId: string | null;
  pipelineId: string | null;
  stageId: string | null;
  status: string | null;
  monetaryValue: number | null;
};

export type LeadConnectorPipelineStage = {
  id: string;
  name: string;
  position: number;
};

export type LeadConnectorPipeline = {
  id: string;
  name: string;
  stages: LeadConnectorPipelineStage[];
};

export type LeadConnectorQueueCandidate = {
  opportunityId: string;
  contactId: string;
  contactName: string;
  phone: string;
  status: string | null;
  monetaryValue: number | null;
};

export type LeadConnectorQueuePreview = {
  pipelineId: string;
  pipelineName: string;
  stageId: string;
  stageName: string;
  opportunityTotal: number;
  callableTotal: number;
  truncated: boolean;
  candidates: LeadConnectorQueueCandidate[];
};

export type LeadConnectorWebhookEventType =
  | 'contact.created'
  | 'contact.deleted'
  | 'contact.updated'
  | 'installation.uninstalled'
  | 'opportunity.created'
  | 'opportunity.deleted'
  | 'opportunity.updated';

export type LeadConnectorWebhookEvent = {
  id: string;
  type: LeadConnectorWebhookEventType;
  workspaceId: string;
  locationId: string;
  occurredAt: string | null;
  data: Record<string, unknown>;
};

export type LeadConnectorWebhookProcessResult = {
  accepted: true;
  duplicate: boolean;
  workspaceId: string;
  event: LeadConnectorWebhookEvent | null;
};
