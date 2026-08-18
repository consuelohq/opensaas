import {
  createCloudflareD1InstallControlPlaneRepository,
  type InstallControlPlaneD1Database,
} from '../../../scripts/lib/install-control-plane-d1';
import { createInstallDiagnosticBundleStore } from '../../../scripts/lib/install-control-plane-r2';
import { createDeviceAuthorityInstallObservability } from '../../../scripts/lib/install-observability';
import { createOsDeviceAuthorityHandler } from './app';
import {
  DEFAULT_SITE_SNAPSHOT_KEY,
  DEFAULT_SITE_SNAPSHOT_VERSION_ID,
  ORIGIN,
} from './constants';
import { createDefaultManagedCloudPricingRuntime } from '../../../scripts/lib/managed-cloud-public-pricing';
import { createCheckoutObservability } from './services/checkout-observability';
import { createWorkspaceConnectorProvisionerFromEnv } from './services/connectors';
import { managedCloudPricingFromJson } from './services/managed-cloud-pricing';
import { DurableStore } from './stores';
import type { Env, StateLike } from './types';

export class OsDeviceGrantDurableObject {
  private handler: (request: Request) => Promise<Response>;

  constructor(state: StateLike, env: Env) {
    const installControlPlaneRepository =
      env.WORKSPACE_ROUTE_REGISTRY &&
      typeof env.WORKSPACE_ROUTE_REGISTRY.prepare === 'function'
        ? createCloudflareD1InstallControlPlaneRepository(
            env.WORKSPACE_ROUTE_REGISTRY as unknown as InstallControlPlaneD1Database,
          )
        : undefined;
    const successfulDiagnosticRetentionDays =
      env.OS_INSTALL_SUCCESS_DIAGNOSTIC_RETENTION_DAYS?.trim()
        ? Number.parseInt(env.OS_INSTALL_SUCCESS_DIAGNOSTIC_RETENTION_DAYS, 10)
        : 0;
    const installDiagnosticBundleStore =
      installControlPlaneRepository && env.INSTALL_DIAGNOSTICS
        ? createInstallDiagnosticBundleStore({
            bucket: env.INSTALL_DIAGNOSTICS,
            repository: installControlPlaneRepository,
            successfulRetentionDays: successfulDiagnosticRetentionDays,
          })
        : undefined;
    const installTelemetryObserver = installControlPlaneRepository
      ? createDeviceAuthorityInstallObservability({
          repository: installControlPlaneRepository,
          posthogApiKey: env.POSTHOG_API_KEY,
          posthogHost: env.POSTHOG_HOST,
          fetchImpl: (url, init) => globalThis.fetch(url, init),
        })
      : undefined;
    this.handler = createOsDeviceAuthorityHandler({
      store: new DurableStore(state.storage),
      installControlPlaneRepository,
      installDiagnosticBundleStore,
      installTelemetryObserver,
      installSentryDsn: env.SENTRY_DSN,
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
      operatorEnrollmentResetSecret: env.OS_ENROLLMENT_RESET_SECRET,
      operationalLogger: env.OS_DEVICE_AUTH_LOGGER,
      managedCloudProvisionerSecret: env.OS_MANAGED_CLOUD_PROVISIONER_SECRET,
      managedCloudEnrollmentSecret: env.OS_MANAGED_CLOUD_ENROLLMENT_SECRET,
      stripeSecretKey: env.OS_STRIPE_SECRET_KEY,
      stripeWebhookSecret: env.OS_STRIPE_WEBHOOK_SECRET,
      stripeApiBaseUrl: env.OS_STRIPE_API_BASE_URL,
      stripeSyntheticSecretKey: env.OS_STRIPE_SYNTHETIC_SECRET_KEY,
      stripeSyntheticWebhookSecret: env.OS_STRIPE_SYNTHETIC_WEBHOOK_SECRET,
      stripeSyntheticAccountIds: env.OS_STRIPE_SYNTHETIC_ACCOUNT_IDS,
      stripeSyntheticWorkspaceIds: env.OS_STRIPE_SYNTHETIC_WORKSPACE_IDS,
      checkoutObservability:
        env.POSTHOG_API_KEY?.trim() || env.SENTRY_DSN?.trim()
          ? createCheckoutObservability({
              posthogApiKey: env.POSTHOG_API_KEY,
              posthogHost: env.POSTHOG_HOST,
              sentryDsn: env.SENTRY_DSN,
              fetchImpl: (url, init) => globalThis.fetch(url, init),
            })
          : undefined,
      managedCloudPricing: managedCloudPricingFromJson({
        policyJson: env.OS_MANAGED_CLOUD_PRICING_POLICY_JSON,
        rateCardsJson: env.OS_MANAGED_CLOUD_RATE_CARDS_JSON,
        fallback: createDefaultManagedCloudPricingRuntime(),
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
