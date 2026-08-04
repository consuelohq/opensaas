import {
  DialerCleanupError,
  DialerConflictError,
  DialerInfrastructureError,
  DialerInterruptedError,
  DialerNotFoundError,
  DialerProviderError,
  DialerRequestError,
  DialerStateError,
  DialerTimeoutError,
  DialerTransitionError,
} from '@consuelo/dialer';
import {
  LeadConnectorEmbedIdentityError,
  LeadConnectorInstallationNotFoundError,
  LeadConnectorInstallationOwnershipError,
  LeadConnectorOAuthStateError,
  LeadConnectorProviderError,
  LeadConnectorStateError,
  LeadConnectorTokenCipherError,
  LeadConnectorWebhookPayloadError,
  LeadConnectorWebhookSignatureError,
} from '@consuelo/lead-connector';
import type { Context } from 'hono';

const publicError = (
  status: number,
  code: string,
  message: string,
  retryable: boolean,
) => ({ status, body: { error: { code, message, retryable } } });

export function mapDialerError(error: unknown) {
  if (error instanceof DialerRequestError)
    return publicError(400, error.code, error.message, false);
  if (error instanceof DialerConflictError)
    return {
      ...publicError(409, error.code, error.message, false),
      retryAfterMs: error.retryAfterMs,
    };
  if (error instanceof DialerNotFoundError)
    return publicError(404, error.code, error.message, false);
  if (error instanceof DialerTransitionError)
    return publicError(
      409,
      'TRANSITION_REJECTED',
      'Call state transition rejected',
      false,
    );
  if (error instanceof DialerTimeoutError)
    return publicError(
      504,
      'PROVIDER_TIMEOUT',
      'Dialer provider timed out',
      true,
    );
  if (error instanceof DialerProviderError)
    return publicError(
      502,
      'PROVIDER_ERROR',
      'Dialer provider request failed',
      error.retryable,
    );
  if (
    error instanceof DialerInfrastructureError ||
    error instanceof DialerStateError ||
    error instanceof DialerCleanupError ||
    error instanceof DialerInterruptedError
  )
    return publicError(
      503,
      'SERVICE_UNAVAILABLE',
      'Dialer service unavailable',
      true,
    );
  return publicError(500, 'INTERNAL_ERROR', 'Dialer request failed', false);
}

export function dialerErrorResponse(
  context: Context,
  error: unknown,
): Response {
  const mapped = mapDialerError(error);
  if ('retryAfterMs' in mapped && mapped.retryAfterMs) {
    context.header(
      'Retry-After',
      String(Math.max(1, Math.ceil(mapped.retryAfterMs / 1000))),
    );
  }
  return context.json(
    mapped.body,
    mapped.status as 400 | 404 | 409 | 500 | 502 | 503 | 504,
  );
}

export const unauthorizedResponse = (context: Context) =>
  context.json(
    {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        retryable: false,
      },
    },
    401,
  );

export const invalidRequestResponse = (
  context: Context,
  message = 'Invalid request',
) =>
  context.json(
    { error: { code: 'INVALID_REQUEST', message, retryable: false } },
    400,
  );

export function leadConnectorErrorResponse(
  context: Context,
  error: unknown,
): Response {
  if (error instanceof LeadConnectorEmbedIdentityError) {
    return context.json(
      {
        error: {
          code: error.code,
          message: 'LeadConnector embedded session could not be verified',
          retryable: false,
        },
      },
      error.code === 'EMBED_INSTALLATION_NOT_FOUND' ? 403 : 401,
    );
  }
  if (error instanceof LeadConnectorOAuthStateError) {
    return context.json(
      {
        error: {
          code: 'INVALID_OAUTH_STATE',
          message: 'LeadConnector OAuth state is invalid or expired',
          retryable: false,
        },
      },
      400,
    );
  }
  if (error instanceof LeadConnectorWebhookSignatureError) {
    return context.json(
      {
        error: {
          code: 'INVALID_WEBHOOK_SIGNATURE',
          message: 'LeadConnector webhook signature is invalid',
          retryable: false,
        },
      },
      401,
    );
  }
  if (error instanceof LeadConnectorWebhookPayloadError) {
    return context.json(
      {
        error: {
          code: error.code,
          message: 'LeadConnector webhook payload is invalid',
          retryable: false,
        },
      },
      400,
    );
  }
  if (error instanceof LeadConnectorInstallationOwnershipError) {
    return context.json(
      {
        error: {
          code: 'LOCATION_OWNERSHIP_CONFLICT',
          message: 'LeadConnector location belongs to another workspace',
          retryable: false,
        },
      },
      409,
    );
  }
  if (error instanceof LeadConnectorInstallationNotFoundError) {
    return context.json(
      {
        error: {
          code: 'LEADCONNECTOR_NOT_CONNECTED',
          message: 'LeadConnector integration is not connected',
          retryable: false,
        },
      },
      404,
    );
  }
  if (error instanceof LeadConnectorProviderError) {
    return context.json(
      {
        error: {
          code: 'LEADCONNECTOR_PROVIDER_ERROR',
          message: 'LeadConnector provider request failed',
          retryable: error.retryable,
        },
      },
      502,
    );
  }
  if (
    error instanceof LeadConnectorStateError ||
    error instanceof LeadConnectorTokenCipherError
  ) {
    return context.json(
      {
        error: {
          code: 'LEADCONNECTOR_SERVICE_UNAVAILABLE',
          message: 'LeadConnector service is unavailable',
          retryable: true,
        },
      },
      503,
    );
  }
  return context.json(
    {
      error: {
        code: 'LEADCONNECTOR_REQUEST_FAILED',
        message: 'LeadConnector request failed',
        retryable: false,
      },
    },
    500,
  );
}
