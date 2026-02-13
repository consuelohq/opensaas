// Middleware
export { authMiddleware, rateLimitMiddleware, errorHandler } from './middleware/index.js';

// Services
export { StorageService } from './services/storage.js';
export type { StorageConfig } from './services/storage.js';

// Routes
export {
  allRoutes,
  healthRoutes,
  callRoutes,
  coachingRoutes,
  contactRoutes,
  fileRoutes,
  analyticsRoutes,
  webhookRoutes,
} from './routes/index.js';
export type { RouteDefinition } from './routes/index.js';

// Types
export type { ApiConfig, AuthContext, ApiError, ApiRequest, ApiResponse } from './types.js';

// Sentry — re-exported from dedicated module; consumers should import
// from '@consuelo/api/sentry' or ensure @sentry/node is installed.
export type { SentryConfig } from './sentry.js';
