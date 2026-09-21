import type { Hono } from 'hono';

import { json } from '../http';
import type { DeviceAuthorityRuntime } from '../types';
import {
  authorizationServerMetadata,
  oauthProtectedResourceMetadata,
} from '../services/mcp-oauth';
import { syntheticCheckoutConfigured } from '../services/synthetic-checkout';
import { universalLoginResponse } from './web-auth';

export function registerHealthRoutes(
  app: Hono,
  runtime: DeviceAuthorityRuntime,
): void {
  app.get('/', (context) => universalLoginResponse(context.req.raw, runtime));
  app.all('/health', () =>
    json({
      ok: true,
      service: 'consuelo-os-device-authority',
      connector_provisioning_configured: Boolean(
        runtime.workspaceRouteRegistry?.exec &&
        runtime.workspaceConnectorProvisioner,
      ),
      managed_cloud_billing_configured: Boolean(
        runtime.stripeSecretKey?.trim() && runtime.stripeWebhookSecret?.trim(),
      ),
      managed_cloud_synthetic_checkout_configured: syntheticCheckoutConfigured(runtime),
      checkout_observability_configured: Boolean(runtime.checkoutObservability),
    }),
  );
  app.all('/.well-known/oauth-authorization-server', () =>
    json(authorizationServerMetadata(runtime.origin)),
  );
  const protectedResource = () =>
    json(oauthProtectedResourceMetadata(runtime.origin));
  app.all('/.well-known/oauth-protected-resource', protectedResource);
  app.all('/.well-known/oauth-protected-resource/mcp', protectedResource);
}
