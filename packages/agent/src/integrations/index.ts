export type {
  IntegrationCategory,
  AuthMethod,
  IntegrationDefinition,
  IntegrationCapability,
  OAuthConfig,
  ApiKeyConfig,
  ConnectionStatus,
  IntegrationConnection,
  ConnectRequest,
  OAuthCallbackRequest,
  IntegrationStore,
  EncryptFn,
  DecryptFn,
} from './types.js';

export { INTEGRATION_REGISTRY, formatIntegrationContext } from './registry.js';
export { IntegrationConnectionService } from './service.js';
export type { IntegrationServiceOptions } from './service.js';
