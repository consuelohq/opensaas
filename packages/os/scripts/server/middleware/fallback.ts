import { hasGeneratedAuthConfig } from './auth';
import { jsonResponse, unauthorized } from './errors';

export function routeNotFoundResponse(): Response {
  if (!hasGeneratedAuthConfig()) {
    return unauthorized(
      'CONSUELO_AUTH_REQUIRED',
      'Generated Consuelo OS auth is required.',
    );
  }
  return jsonResponse({
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  }, 404);
}
