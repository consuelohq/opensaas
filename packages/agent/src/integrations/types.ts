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
