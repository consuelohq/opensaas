import { errorHandler } from '../middleware/error-handler.js';
import type { ApiRequest, ApiResponse } from '../types.js';

/** Route descriptor — framework-agnostic */
export interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  handler: (req: ApiRequest, res: ApiResponse) => Promise<void>;
  auth?: boolean;
}

// Import + re-export route modules
import { analyticsRoutes } from './analytics.js';
import { assistantRoutes } from './assistant.js';
import { callRoutes } from './calls.js';
import { coachingRoutes } from './coaching.js';
import { contactRoutes } from './contacts.js';
import { fileRoutes } from './files.js';
import { knowledgeRoutes } from './knowledge.js';
import { localPresenceRoutes } from './local-presence.js';
import { parallelRoutes } from './parallel.js';
import { preferencesRoutes } from './preferences.js';
import { queueRoutes } from './queues.js';
import { voiceRoutes } from './voice.js';
import { workspaceRoutes } from './workspace.js';
import { ghlRoutes } from './ghl.js';
import { ghlIntegrationRoutes } from './integrations/ghl.js';
import { ghlWebhookRoutes } from './webhooks/ghl.js';
import { twilioSettingsRoutes } from './twilio-settings.js';
import { discordAuthRoutes } from './discord-auth.js';
import { subscriptionRoutes } from './subscription.js';
import { stripeWebhookRoutes } from './webhooks/stripe.js';
export {
  analyticsRoutes,
  assistantRoutes,
  callRoutes,
  coachingRoutes,
  contactRoutes,
  discordAuthRoutes,
  fileRoutes,
  knowledgeRoutes,
  localPresenceRoutes,
  parallelRoutes,
  preferencesRoutes,
  queueRoutes,
  voiceRoutes,
  workspaceRoutes,
  ghlRoutes,
  ghlIntegrationRoutes,
  ghlWebhookRoutes,
  twilioSettingsRoutes,
  subscriptionRoutes,
  stripeWebhookRoutes,
};
export { setupCoachingWebSocket, broadcastTranscript } from './coaching.js';

/** /v1/webhooks routes (Twilio callbacks) */
export const webhookRoutes = (): RouteDefinition[] => [
  {
    method: 'POST',
    path: '/v1/webhooks/transcription',
    handler: errorHandler(async (_req, res) => {
      // STUB: implement with processTranscriptionEvent() (DEV-698)
      res
        .status(501)
        .json({
          error: {
            code: 'NOT_IMPLEMENTED',
            message: 'Transcription webhook not yet implemented (DEV-698)',
          },
        });
    }),
  },
  // status webhook moved to voiceRoutes (DEV-816)
];

/** Health check route */
export const healthRoutes = (): RouteDefinition[] => [
  {
    method: 'GET' as const,
    path: '/health',
    handler: async (_req, res) => {
      res
        .status(200)
        .json({ status: 'ok', timestamp: new Date().toISOString() });
    },
  },
];

/** All v1 routes combined */
export const allRoutes = (): RouteDefinition[] => [
  ...healthRoutes(),
  ...discordAuthRoutes(),
  ...assistantRoutes(),
  ...callRoutes(),
  ...coachingRoutes(),
  ...contactRoutes(),
  // fileRoutes before knowledgeRoutes — base resource before extensions
  ...fileRoutes(),
  ...knowledgeRoutes(),
  ...localPresenceRoutes(),
  ...parallelRoutes(),
  ...preferencesRoutes(),
  ...queueRoutes(),
  ...voiceRoutes(),
  ...analyticsRoutes(),
  ...workspaceRoutes(),
  ...ghlRoutes(),
  ...ghlIntegrationRoutes(),
  ...ghlWebhookRoutes(),
  ...twilioSettingsRoutes(),
  ...subscriptionRoutes(),
  ...stripeWebhookRoutes(),
  ...webhookRoutes(),
];
