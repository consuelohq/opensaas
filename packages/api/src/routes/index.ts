import { errorHandler } from '../middleware/error-handler.js';
import type { ApiRequest, ApiResponse } from '../types.js';

/** Route descriptor — framework-agnostic */
export interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  handler: (req: ApiRequest, res: ApiResponse) => Promise<void>;
}

// Import + re-export route modules
import { analyticsRoutes } from './analytics.js';
import { callRoutes } from './calls.js';
import { coachingRoutes } from './coaching.js';
import { contactRoutes } from './contacts.js';
import { fileRoutes } from './files.js';
import { knowledgeRoutes } from './knowledge.js';
import { localPresenceRoutes } from './local-presence.js';
import { parallelRoutes } from './parallel.js';
import { queueRoutes } from './queues.js';
import { voiceRoutes } from './voice.js';
export { analyticsRoutes, callRoutes, coachingRoutes, contactRoutes, fileRoutes, knowledgeRoutes, localPresenceRoutes, parallelRoutes, queueRoutes, voiceRoutes };
export { setupCoachingWebSocket, broadcastTranscript } from './coaching.js';

/** Health check route */
export const healthRoutes = (): RouteDefinition[] => [
  { method: 'GET' as const, path: "/health", handler: async (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  }},
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

/** All v1 routes combined */
export const allRoutes = (): RouteDefinition[] => [
  ...healthRoutes(),
  ...callRoutes(),
  ...coachingRoutes(),
  ...contactRoutes(),
  ...knowledgeRoutes(),
  ...fileRoutes(),
  ...localPresenceRoutes(),
  ...parallelRoutes(),
  ...queueRoutes(),
  ...voiceRoutes(),
  ...analyticsRoutes(),
  ...webhookRoutes(),
];
