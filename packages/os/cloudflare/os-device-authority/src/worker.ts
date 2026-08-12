import { createOsDeviceAuthorityHandler } from './app';
import {
  DEFAULT_SITE_SNAPSHOT_KEY,
  DEFAULT_SITE_SNAPSHOT_VERSION_ID,
  ORIGIN,
} from './constants';
import { createWorkspaceConnectorProvisionerFromEnv } from './services/connectors';
import { managedCloudPricingFromJson } from './services/managed-cloud-pricing';
import { DurableStore } from './stores';
import type { Env, StateLike } from './types';

export class OsDeviceGrantDurableObject {
  private handler: (request: Request) => Promise<Response>;

  constructor(state: StateLike, env: Env) {
    this.handler = createOsDeviceAuthorityHandler({
      store: new DurableStore(state.storage),
      origin: env.OS_DEVICE_AUTH_ORIGIN ?? ORIGIN,
      approvalAssertionSecret: env.OS_DEVICE_AUTH_ASSERTION_SECRET,
      googleOAuthClientId: env.GOOGLE_OAUTH_CLIENT_ID,
      googleOAuthClientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      workspaceRouteRegistry: env.WORKSPACE_ROUTE_REGISTRY,
      workspaceConnectorProvisioner: createWorkspaceConnectorProvisionerFromEnv(
        env,
        (url, init) => globalThis.fetch(url, init),
      ),
      workspaceEdgeInternalSigningSecret:
        env.WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET,
      managedCloudPricing: managedCloudPricingFromJson({
        policyJson: env.OS_MANAGED_CLOUD_PRICING_POLICY_JSON,
        rateCardsJson: env.OS_MANAGED_CLOUD_RATE_CARDS_JSON,
      }),
      defaultSiteSnapshot: {
        key:
          env.OS_DEVICE_AUTH_DEFAULT_SITE_SNAPSHOT_KEY ??
          DEFAULT_SITE_SNAPSHOT_KEY,
        versionId:
          env.OS_DEVICE_AUTH_DEFAULT_SITE_SNAPSHOT_VERSION_ID ??
          DEFAULT_SITE_SNAPSHOT_VERSION_ID,
      },
    });
  }

  fetch(request: Request): Promise<Response> {
    return this.handler(request);
  }
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return env.DEVICE_GRANTS.get(env.DEVICE_GRANTS.idFromName('global')).fetch(
      request,
    );
  },
};
