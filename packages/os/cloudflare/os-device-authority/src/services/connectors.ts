import {
  createWorkspaceEdgeRouteSeedRecord,
  createWorkspaceEdgeRouteSeedSql,
} from '../../../../scripts/lib/workspace-edge-route-seed';
import { upsertWorkspaceNodeTargetInD1 } from '../../../../scripts/lib/workspace-cloudflare-d1-route-registry';
import {
  applyWorkspaceCloudflareProvisioning,
  createCloudflareWorkspaceProvisioningClient,
} from '../../../../scripts/lib/workspace-cloudflare-provisioning';
import {
  DEFAULT_CONNECTOR_LOCAL_SERVICE_URL,
  DEFAULT_SITE_CONTENT_TYPE,
  DEFAULT_SITE_ID,
  DEFAULT_SITE_SNAPSHOT_KEY,
  DEFAULT_SITE_SNAPSHOT_VERSION_ID,
} from '../constants';
import type {
  DefaultSiteSnapshot,
  Env,
  Grant,
  WorkspaceConnectorProvisioner,
  WorkspaceRouteRegistryBinding,
} from '../types';
import {
  baseDomainFromHost,
  connectorIdFromNodeId,
  host,
} from '../utils';
import { grantWorkspace } from './grants';

export function defaultSiteSnapshot(
  input?: DefaultSiteSnapshot,
): Required<DefaultSiteSnapshot> {
  return {
    key: input?.key?.trim() || DEFAULT_SITE_SNAPSHOT_KEY,
    versionId: input?.versionId?.trim() || DEFAULT_SITE_SNAPSHOT_VERSION_ID,
    siteId: input?.siteId?.trim() || DEFAULT_SITE_ID,
    contentType: input?.contentType?.trim() || DEFAULT_SITE_CONTENT_TYPE,
    cachePolicy: input?.cachePolicy ?? 'static-shell',
  };
}

export function createWorkspaceConnectorProvisionerFromEnv(
  env: Env,
  fetchImpl: typeof fetch,
): WorkspaceConnectorProvisioner | undefined {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const zoneId = env.CLOUDFLARE_ZONE_ID?.trim();
  const apiToken = env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !zoneId || !apiToken) return undefined;

  const cloudflare = createCloudflareWorkspaceProvisioningClient({
    accountId,
    apiToken,
    apiBaseUrl: env.OS_DEVICE_AUTH_CLOUDFLARE_API_BASE_URL,
    fetchImpl,
  });

  return async (input) => {
    try {
      const baseDomain =
        env.OS_DEVICE_AUTH_BASE_DOMAIN?.trim() ||
        baseDomainFromHost(input.workspaceHost);
      const localServiceUrl =
        env.OS_DEVICE_AUTH_CONNECTOR_LOCAL_SERVICE_URL?.trim() ||
        DEFAULT_CONNECTOR_LOCAL_SERVICE_URL;
      const result = await applyWorkspaceCloudflareProvisioning({
        cloudflare,
        input: {
          workspaceId: input.workspaceId,
          workspaceSlug: input.workspaceSlug,
          baseDomain,
          cloudflareZoneId: zoneId,
          connectorId: input.connectorId,
          edgeHostname:
            env.OS_DEVICE_AUTH_WORKSPACE_EDGE_HOSTNAME?.trim() ||
            `workspace-edge.${baseDomain}`,
          localServiceUrl,
        },
      });

      if (host(result.workspaceHostname) !== host(input.workspaceHost)) {
        throw new Error(
          'provisioned workspace hostname did not match device workspace host',
        );
      }

      return {
        connectorId: result.connectorBootstrap.connectorId,
        cloudflareTunnelToken: result.connectorBootstrap.tunnelCredential,
        tunnelOriginUrl: `https://${result.osTunnelHostname}`,
        localServiceUrl,
      };
    } catch (error: unknown) {
      throw new Error(
        `workspace connector provisioning failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
}

export async function registerApprovedWorkspaceRoute(input: {
  routeRegistry?: WorkspaceRouteRegistryBinding;
  workspaceConnectorProvisioner?: WorkspaceConnectorProvisioner;
  grant: Grant;
  defaultSiteSnapshot?: DefaultSiteSnapshot;
}): Promise<void> {
  if (
    !input.routeRegistry ||
    (!input.routeRegistry.exec &&
      !input.routeRegistry.prepare &&
      !input.routeRegistry.dumpHostnameRow)
  )
    throw new Error('workspace route registry is not configured');
  try {
    if (!input.workspaceConnectorProvisioner) {
      throw new Error('workspace connector provisioning is not configured');
    }
    const workspace = grantWorkspace(input.grant);
    const workspaceId = workspace.workspaceId;
    const nodeId = input.grant.nodeId ?? workspace.workspaceSlug;
    const connectorId = connectorIdFromNodeId(nodeId);
    const connector = await input.workspaceConnectorProvisioner({
      workspaceId,
      workspaceSlug: workspace.workspaceSlug,
      workspaceHost: workspace.workspaceHost,
      connectorId,
    });
    const snapshot = defaultSiteSnapshot(input.defaultSiteSnapshot);
    input.grant.cloudflareTunnelToken = connector.cloudflareTunnelToken;
    const seedInput = {
      workspaceId,
      workspaceSlug: workspace.workspaceSlug,
      hostname: workspace.workspaceHost,
      baseDomain: baseDomainFromHost(workspace.workspaceHost),
      siteSnapshotKey: snapshot.key,
      siteVersionId: snapshot.versionId,
      publishedSiteIds: [snapshot.siteId],
      connectorId: connector.connectorId,
      tunnelOriginUrl: connector.tunnelOriginUrl,
      localServiceUrl: connector.localServiceUrl,
    };
    if (input.routeRegistry.prepare || input.routeRegistry.dumpHostnameRow) {
      await upsertWorkspaceNodeTargetInD1(input.routeRegistry, {
        record: createWorkspaceEdgeRouteSeedRecord(seedInput),
        target: {
          nodeId,
          connectorId: connector.connectorId,
          connectorStatus: 'connected',
          tunnelOriginUrl: connector.tunnelOriginUrl,
          state: 'active',
          lastSeenAt: input.grant.nodeLastSeenAt ?? Date.now(),
          heartbeatTtlMs: 60_000,
        },
        makeDefault: input.grant.nodeRole === 'home',
        localServiceUrl: connector.localServiceUrl,
      });
    } else {
      await input.routeRegistry.exec?.(createWorkspaceEdgeRouteSeedSql(seedInput));
    }
  } catch (error: unknown) {
    throw new Error(
      `workspace route setup failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
