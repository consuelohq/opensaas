// Middleware
export { authMiddleware, rateLimitMiddleware, errorHandler } from './middleware/index.js';

// Routes
export {
  allRoutes,
  healthRoutes,
  callRoutes,
  coachingRoutes,
  contactRoutes,
  analyticsRoutes,
  webhookRoutes,
} from './routes/index.js';
export type { RouteDefinition } from './routes/index.js';

// Types
export type { ApiConfig, ApiKeyContext, ApiError, ApiRequest, ApiResponse } from './types.js';

// Sentry — re-exported from dedicated module; consumers should import
// from '@consuelo/api/sentry' or ensure @sentry/node is installed.
export type { SentryConfig } from './sentry.js';
