export type IntegrationCategory =
  | 'crm'
  | 'payments'
  | 'communication'
  | 'maps'
  | 'enrichment'
  | 'analytics'
  | 'storage'
  | 'custom';

export type AuthMethod = 'api_key' | 'oauth2' | 'basic' | 'bearer';

export type OAuthConfig = {
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  pkce: boolean;
};

export type ApiKeyConfig = {
  fields: { name: string; label: string; placeholder: string; secret: boolean }[];
};

export type IntegrationCapability = {
  name: string;
  description: string;
  exampleCode: string;
};

export type IntegrationDefinition = {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  authMethod: AuthMethod;
  authConfig: OAuthConfig | ApiKeyConfig;
  capabilities: IntegrationCapability[];
  sdkPackage: string | null;
  envVarPrefix: string;
  docsUrl: string;
  iconUrl: string;
};

// --- connection management types (DEV-973) ---

export type ConnectionStatus = 'connected' | 'pending' | 'error' | 'expired';

export type IntegrationConnection = {
  id: string;
  workspaceId: string;
  userId: string;
  integrationId: string;
  status: ConnectionStatus;
  lastHealthCheck: Date | null;
  healthError: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type ConnectRequest = {
  integrationId: string;
  credentials?: Record<string, string>;
  redirectUrl?: string;
};

export type OAuthCallbackRequest = {
  code: string;
  state: string;
};

// DB-agnostic store — consuming app provides the implementation
export type IntegrationStore = {
  findByUser(workspaceId: string, userId: string): Promise<IntegrationConnection[]>;
  findById(id: string): Promise<IntegrationConnection | null>;
  findByIntegration(workspaceId: string, userId: string, integrationId: string): Promise<IntegrationConnection | null>;
  create(conn: Omit<IntegrationConnection, 'id' | 'createdAt' | 'updatedAt'>): Promise<IntegrationConnection>;
  update(id: string, data: Partial<Pick<IntegrationConnection, 'status' | 'lastHealthCheck' | 'healthError' | 'metadata'>>): Promise<IntegrationConnection>;
  delete(id: string): Promise<void>;
};

export type EncryptFn = (plaintext: string) => Promise<string>;
export type DecryptFn = (ciphertext: string) => Promise<string>;
