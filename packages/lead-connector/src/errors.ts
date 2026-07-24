import { Data } from 'effect';

export class LeadConnectorOAuthStateError extends Data.TaggedError(
  'LeadConnectorOAuthStateError',
)<{
  code: 'INVALID_OAUTH_STATE';
  message: string;
  retryable: false;
}> {}

export class LeadConnectorInstallationNotFoundError extends Data.TaggedError(
  'LeadConnectorInstallationNotFoundError',
)<{
  workspaceId?: string;
  locationId?: string;
  message: string;
  retryable: false;
}> {}

export class LeadConnectorInstallationOwnershipError extends Data.TaggedError(
  'LeadConnectorInstallationOwnershipError',
)<{
  locationId: string;
  workspaceId: string;
  ownerWorkspaceId: string;
  message: string;
  retryable: false;
}> {}

export class LeadConnectorProviderError extends Data.TaggedError(
  'LeadConnectorProviderError',
)<{
  operation: string;
  status?: number;
  message: string;
  retryable: boolean;
  cause?: unknown;
}> {}

export class LeadConnectorStateError extends Data.TaggedError(
  'LeadConnectorStateError',
)<{
  operation: string;
  message: string;
  retryable: boolean;
  cause?: unknown;
}> {}

export class LeadConnectorTokenCipherError extends Data.TaggedError(
  'LeadConnectorTokenCipherError',
)<{
  operation: 'encrypt' | 'decrypt';
  message: string;
  retryable: false;
  cause?: unknown;
}> {}

export class LeadConnectorWebhookSignatureError extends Data.TaggedError(
  'LeadConnectorWebhookSignatureError',
)<{
  code: 'INVALID_WEBHOOK_SIGNATURE';
  message: string;
  retryable: false;
}> {}

export class LeadConnectorWebhookPayloadError extends Data.TaggedError(
  'LeadConnectorWebhookPayloadError',
)<{
  code: 'INVALID_WEBHOOK_PAYLOAD' | 'UNSUPPORTED_WEBHOOK_EVENT';
  message: string;
  retryable: false;
}> {}

export type LeadConnectorError =
  | LeadConnectorOAuthStateError
  | LeadConnectorInstallationNotFoundError
  | LeadConnectorInstallationOwnershipError
  | LeadConnectorProviderError
  | LeadConnectorStateError
  | LeadConnectorTokenCipherError
  | LeadConnectorWebhookSignatureError
  | LeadConnectorWebhookPayloadError;

export const errorMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);
