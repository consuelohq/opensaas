import { errorHandler } from '../middleware/error-handler.js';
import type { ApiRequest, ApiResponse } from '../types.js';

/** Route descriptor — framework-agnostic */
export interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  handler: (req: ApiRequest, res: ApiResponse) => Promise<void>;
}

// Import + re-export route modules
import { callRoutes } from './calls.js';
import { coachingRoutes } from './coaching.js';
import { contactRoutes } from './contacts.js';
import { voiceRoutes } from './voice.js';
export { callRoutes, coachingRoutes, contactRoutes, voiceRoutes };

/** /v1/analytics routes */
export const analyticsRoutes = (): RouteDefinition[] => [
  { method: 'POST', path: '/v1/analytics/analyze', handler: errorHandler(async (req, res) => {
    // STUB: implement with Analytics.analyzeCall() (DEV-698)
    res.status(200).json({ message: 'Use @consuelo/analytics for full implementation' });
  })},
  { method: 'GET', path: '/v1/analytics/transcript/:callSid', handler: errorHandler(async (req, res) => {
    // STUB: implement with AnalyticsStore.getTranscript() (DEV-698)
    res.status(200).json({ callSid: req.params?.callSid, transcript: [] });
  })},
  { method: 'GET', path: '/v1/analytics/metrics', handler: errorHandler(async (_req, res) => {
    // STUB: implement with AnalyticsStore.getAnalytics() (DEV-698)
    res.status(200).json({ metrics: {} });
  })},
];

/** /v1/webhooks routes (Twilio callbacks) */
export const webhookRoutes = (): RouteDefinition[] => [
  { method: 'POST', path: '/v1/webhooks/transcription', handler: errorHandler(async (_req, res) => {
    // STUB: implement with processTranscriptionEvent() (DEV-698)
    res.status(200).json({ received: true });
  })},
  { method: 'POST', path: '/v1/webhooks/status', handler: errorHandler(async (_req, res) => {
    // STUB: implement with status callback handler (DEV-698)
    res.status(200).json({ received: true });
  })},
];

/** Health check route */
export const healthRoutes = (): RouteDefinition[] => [
  { method: 'GET', path: '/health', handler: async (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  }},
];

/** All v1 routes combined */
export const allRoutes = (): RouteDefinition[] => [
  ...healthRoutes(),
  ...callRoutes(),
  ...coachingRoutes(),
  ...contactRoutes(),
  ...voiceRoutes(),
  ...analyticsRoutes(),
  ...webhookRoutes(),
];
