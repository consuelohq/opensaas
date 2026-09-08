import {
  createWorkspaceCloudflareD1RouteRegistry,
  type WorkspaceRouteD1Resolution,
} from '../../../../scripts/lib/workspace-cloudflare-d1-route-registry';
import { resolveCentralMcpFacadeScope } from '../../../../scripts/lib/tool-scope-authorization';
import { MODERN_MCP_PROTOCOL_VERSION } from '../../../../scripts/lib/mcp-protocol';
import {
  encodeMcpNodeRoutingContext,
  inspectMcpNodeRoutingBody,
  normalizeMcpTaskSession,
  normalizeMcpWorkSession,
  stripMcpRoutingNodeId,
  MCP_NODE_CONTEXT_HEADER,
  MCP_ROUTE_SOURCE_HEADER,
  type McpNodeRoutingContext,
  type McpNodeRouteSource,
} from '../../../../scripts/lib/mcp-node-routing';
import { json } from '../http';
import type {
  DeviceAuthorityLogger,
  Store,
  WorkspaceRouteRegistryBinding,
} from '../types';
import { hasGrantedScope, hash } from '../utils';
import { mcpResourceUrl } from './mcp-oauth';
import { safeWorkspaceNode, workspaceDefaultNodeId, workspaceNodePresence } from './nodes';
import { WORKSPACE_SESSION_AFFINITY_TTL_MS } from '../stores';

export function bearerToken(request: Request): string | undefined {
  const authorization = request.headers.get('authorization')?.trim() ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() || undefined;
}

export function centralMcpUnauthorized(origin: string): Response {
  return json(
    { error: 'unauthorized', message: 'OAuth bearer token is required.' },
    {
      status: 401,
      headers: {
        'www-authenticate':
          'Bearer resource_metadata="' +
          new URL('/.well-known/oauth-protected-resource', origin).toString() +
          '"',
      },
    },
  );
}

export function centralMcpSafeError(input: {
  status: number;
  code: string;
  message?: string;
  details?: Record<string, unknown>;
}): Response {
  return json(
    {
      error: {
        ...(input.details ?? {}),
        code: input.code,
        message: input.message ?? input.code,
      },
    },
    { status: input.status },
  );
}

export async function centralMcpOperationScope(request: Request): Promise<string | null> {
  if (request.method !== 'POST') return null;
  let payload: unknown;
  try {
    payload = await request.clone().json();
  } catch {
    return 'mcp:call';
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'mcp:call';
  }
  const record = payload as Record<string, unknown>;
  if (record.method !== 'tools/call') return null;
  const requestParams = record.params;
  if (
    !requestParams ||
    typeof requestParams !== 'object' ||
    Array.isArray(requestParams)
  ) {
    return 'mcp:call';
  }
  const params = requestParams as Record<string, unknown>;
  if (params.name === 'get_steering') return 'route:/mcp:read';
  if (params.name !== 'call') return 'mcp:call';
  const args = params.arguments;
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return 'mcp:call';
  }
  const facadeArgs = args as Record<string, unknown>;
  const toolName = facadeArgs.tool;
  return typeof toolName === 'string' && toolName.trim()
    ? resolveCentralMcpFacadeScope(toolName, facadeArgs.input)
    : 'mcp:call';
}

type CentralMcpFacadeOutcome = {
  ok: boolean;
  taskSession?: string;
  workSession?: string;
};

const EXPLICIT_NODE_LIFECYCLE_RECOVERY_TOOLS = new Set([
  'lifecycle.status',
  'lifecycle.update',
]);

const LEGACY_MANAGED_CLOUD_RELEASE_CHANNELS = new Set([
  'stable',
  'beta',
  'canary',
  'dev',
]);

type LegacyLifecycleRewriteResult =
  | { ok: true; body: string }
  | { ok: false; code: string; message: string };

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function legacyManagedCloudLifecycleBootstrapCommand(channel: string): string {
  const script = [
    'import { chmodSync, existsSync, lstatSync, mkdirSync, renameSync, writeFileSync } from "node:fs";',
    'import { resolve } from "node:path";',
    `const channel=${JSON.stringify(channel)};`,
    'const metadataUrl="http://metadata.google.internal/computeMetadata/v1/instance/attributes/startup-script";',
    'const response=await fetch(metadataUrl,{headers:{"Metadata-Flavor":"Google"}});',
    'if(!response.ok)throw new Error("managed cloud startup metadata unavailable");',
    'const startupScript=await response.text();',
    'if(startupScript.length===0||startupScript.length>262144)throw new Error("managed cloud startup metadata invalid");',
    'const assignment=(name)=>{',
    'const quote=String.fromCharCode(39);',
    'const prefix="  "+name+"="+quote;',
    'const suffix=quote+" "+String.fromCharCode(92);',
    'const lines=startupScript.split(/\\r?\\n/).filter((line)=>line.startsWith("  "+name+"="));',
    'if(lines.length!==1)throw new Error("managed cloud release metadata missing");',
    'const line=lines[0];',
    'if(!line.startsWith(prefix)||!line.endsWith(suffix))throw new Error("managed cloud release metadata malformed");',
    'const value=line.slice(prefix.length,line.length-suffix.length);',
    'if(!value||value.includes(quote))throw new Error("managed cloud release metadata malformed");',
    'return value;',
    '};',
    'const releaseBaseUrl=assignment("CONSUELO_RELEASE_BASE_URL");',
    'const releaseUrl=new URL(releaseBaseUrl);',
    'if(releaseUrl.protocol!=="https:"||releaseUrl.hostname!=="storage.googleapis.com"||releaseUrl.username||releaseUrl.password||releaseUrl.port||releaseUrl.search||releaseUrl.hash||releaseUrl.pathname.split("/").filter(Boolean).length===0)throw new Error("managed cloud release origin is not trusted");',
    'const releaseKeysJson=assignment("CONSUELO_RELEASE_PUBLIC_KEYS_JSON");',
    'if(releaseKeysJson.length>65536)throw new Error("managed cloud release key metadata too large");',
    'let releaseKeys;',
    'try{releaseKeys=JSON.parse(releaseKeysJson);}catch{throw new Error("managed cloud release key metadata invalid");}',
    'if(!releaseKeys||typeof releaseKeys!=="object"||Array.isArray(releaseKeys))throw new Error("managed cloud release key metadata invalid");',
    'const releaseKeyEntries=Object.entries(releaseKeys);',
    'if(releaseKeyEntries.length===0||releaseKeyEntries.length>32)throw new Error("managed cloud release key metadata invalid");',
    'for(const [keyId,publicKey] of releaseKeyEntries){if(typeof publicKey!=="string"||keyId.length===0||keyId.length>128||keyId.trim()!==keyId||publicKey.length===0||publicKey.length>8192||publicKey.trim()!==publicKey||!publicKey.startsWith("-----BEGIN PUBLIC KEY-----")||!publicKey.endsWith("-----END PUBLIC KEY-----")||publicKey.includes("PRIVATE KEY"))throw new Error("managed cloud release key metadata invalid");}',
    'const home=process.env.CONSUELO_HOME?.trim();',
    'if(!home||!home.startsWith("/"))throw new Error("CONSUELO_HOME unavailable");',
    'const runtimeDir=resolve(home,"runtime");',
    'mkdirSync(runtimeDir,{recursive:true,mode:0o700});',
    'const trustPath=resolve(runtimeDir,"trusted-release-keys.json");',
    'if(existsSync(trustPath)){const existing=lstatSync(trustPath);if(existing.isSymbolicLink()||!existing.isFile())throw new Error("trusted release key path is unsafe");}',
    'const temporaryTrustPath=trustPath+".recovery-"+process.pid+"-"+Date.now();',
    'writeFileSync(temporaryTrustPath,JSON.stringify(releaseKeys,null,2)+"\\n",{encoding:"utf8",mode:0o600,flag:"wx"});',
    'chmodSync(temporaryTrustPath,0o600);',
    'renameSync(temporaryTrustPath,trustPath);',
    'chmodSync(trustPath,0o600);',
    'const lifecyclePath=resolve(runtimeDir,"current","scripts","lifecycle.ts");',
    'if(!existsSync(lifecyclePath))throw new Error("legacy lifecycle updater unavailable");',
    'const child=Bun.spawnSync([process.execPath,lifecyclePath,"update","--channel",channel,"--yes","--json"],{env:{...process.env,CONSUELO_RELEASE_BASE_URL:releaseBaseUrl,CONSUELO_RELEASE_PUBLIC_KEYS_JSON:JSON.stringify(releaseKeys),CONSUELO_RELEASE_GCP_METADATA_AUTH:"1"}});',
    'if(child.stdout)process.stdout.write(child.stdout);',
    'if(child.stderr)process.stderr.write(child.stderr);',
    'process.exit(child.exitCode??1);',
  ].join('');
  if (script.includes("'")) {
    throw new Error('legacy managed-cloud bootstrap must remain shell-literal safe');
  }
  return `/home/consuelo/.bun/bin/bun -e '${script}'`;
}

function rewriteLegacyManagedCloudLifecycleUpdate(
  requestBody: string,
): LegacyLifecycleRewriteResult {
  let payload: unknown;
  try {
    payload = JSON.parse(requestBody) as unknown;
  } catch {
    return {
      ok: false,
      code: 'WORKSPACE_NODE_LEGACY_LIFECYCLE_INPUT_INVALID',
      message: 'Stale-node lifecycle recovery requires a valid MCP request body.',
    };
  }
  if (!isJsonObject(payload) || payload.method !== 'tools/call') {
    return {
      ok: false,
      code: 'WORKSPACE_NODE_LEGACY_LIFECYCLE_INPUT_INVALID',
      message: 'Stale-node lifecycle recovery requires a facade tools/call request.',
    };
  }
  const params = payload.params;
  if (!isJsonObject(params) || params.name !== 'call') {
    return {
      ok: false,
      code: 'WORKSPACE_NODE_LEGACY_LIFECYCLE_INPUT_INVALID',
      message: 'Stale-node lifecycle recovery requires the Consuelo facade call tool.',
    };
  }
  const argumentsValue = params.arguments;
  if (!isJsonObject(argumentsValue) || argumentsValue.tool !== 'lifecycle.update') {
    return {
      ok: false,
      code: 'WORKSPACE_NODE_LEGACY_LIFECYCLE_INPUT_INVALID',
      message: 'Stale-node lifecycle recovery only supports lifecycle.update.',
    };
  }
  const lifecycleInput = argumentsValue.input ?? {};
  if (!isJsonObject(lifecycleInput)) {
    return {
      ok: false,
      code: 'WORKSPACE_NODE_LEGACY_LIFECYCLE_INPUT_INVALID',
      message: 'Stale-node lifecycle recovery input must be an object.',
    };
  }
  const unexpectedKeys = Object.keys(lifecycleInput).filter(
    (key) => key !== 'channel' && key !== 'version',
  );
  if (unexpectedKeys.length > 0) {
    return {
      ok: false,
      code: 'WORKSPACE_NODE_LEGACY_LIFECYCLE_INPUT_INVALID',
      message: 'Stale-node lifecycle recovery received unsupported input fields.',
    };
  }
  if (Object.prototype.hasOwnProperty.call(lifecycleInput, 'version')) {
    return {
      ok: false,
      code: 'WORKSPACE_NODE_LEGACY_LIFECYCLE_VERSION_UNSUPPORTED',
      message: 'Exact-version updates are unavailable until the node reaches a modern lifecycle facade.',
    };
  }
  const channel = lifecycleInput.channel ?? 'stable';
  if (
    typeof channel !== 'string'
    || !LEGACY_MANAGED_CLOUD_RELEASE_CHANNELS.has(channel)
  ) {
    return {
      ok: false,
      code: 'WORKSPACE_NODE_LEGACY_LIFECYCLE_INPUT_INVALID',
      message: 'Stale managed-cloud recovery supports stable, beta, canary, or dev only.',
    };
  }
  return {
    ok: true,
    body: JSON.stringify({
      ...payload,
      params: {
        ...params,
        arguments: {
          tool: 'mac.call',
          input: {
            command: legacyManagedCloudLifecycleBootstrapCommand(channel),
          },
        },
      },
    }),
  };
}

async function centralMcpFacadeOutcome(response: Response): Promise<CentralMcpFacadeOutcome> {
  if (!response.ok) return { ok: false };
  try {
    const envelope = await response.clone().json() as unknown;
    if (!isJsonObject(envelope) || 'error' in envelope) return { ok: false };
    const result = envelope.result;
    if (!isJsonObject(result) || result.isError === true || !Array.isArray(result.content)) {
      return { ok: false };
    }
    const textItem = result.content.find(
      (item) => isJsonObject(item) && item.type === 'text' && typeof item.text === 'string',
    );
    if (!isJsonObject(textItem) || typeof textItem.text !== 'string') return { ok: false };
    const facade = JSON.parse(textItem.text) as unknown;
    if (!isJsonObject(facade) || facade.ok !== true) return { ok: false };
    const data = facade.data;
    const taskSession = isJsonObject(data)
      ? normalizeMcpTaskSession(data.taskSession)
      : undefined;
    const workSession = isJsonObject(data)
      ? normalizeMcpWorkSession(data.workSession)
      : undefined;
    return {
      ok: true,
      ...(taskSession ? { taskSession } : {}),
      ...(workSession ? { workSession } : {}),
    };
  } catch {
    return { ok: false };
  }
}

export function centralMcpUpstreamUrl(input: {
  tunnelOriginUrl: string;
  inboundUrl: URL;
}): string {
  const upstreamUrl = new URL(input.tunnelOriginUrl);
  const basePath = upstreamUrl.pathname.replace(/\/$/, '');
  upstreamUrl.pathname = basePath + input.inboundUrl.pathname;
  upstreamUrl.search = input.inboundUrl.search;
  return upstreamUrl.toString();
}

export function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

export async function edgeSignature(input: {
  secret: string;
  method: string;
  pathWithSearch: string;
  workspaceId: string;
  surface: string;
  timestamp: string;
  nonce: string;
}): Promise<string> {
  try {
    const canonical = [
      input.method.toUpperCase(),
      input.pathWithSearch,
      input.workspaceId,
      input.surface,
      input.timestamp,
      input.nonce,
    ].join('\n');
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(input.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(canonical),
    );
    return 'sha256=' + hex(new Uint8Array(signature));
  } catch {
    throw new Error('edge request signing failed');
  }
}

export async function centralMcpProxyRequest(input: {
  request: Request;
  body?: string;
  resolution: Extract<WorkspaceRouteD1Resolution, { allowed: true }>;
  upstreamUrl: string;
  routeSource?: McpNodeRouteSource;
  nodeRoutingContext?: McpNodeRoutingContext;
  internalSigningSecret?: string;
}): Promise<Request> {
  try {
    const inboundUrl = new URL(input.request.url);
    const headers = new Headers(input.request.headers);
    headers.delete('x-consuelo-workspace-id');
    headers.delete('x-consuelo-hostname');
    headers.delete('x-consuelo-route');
    headers.delete('x-consuelo-surface');
    headers.delete('x-consuelo-edge-signature');
    headers.delete('x-consuelo-edge-timestamp');
    headers.delete('x-consuelo-edge-nonce');
    headers.delete('x-consuelo-connector-id');
    headers.delete('x-consuelo-node-id');
    headers.delete(MCP_NODE_CONTEXT_HEADER);
    headers.delete(MCP_ROUTE_SOURCE_HEADER);
    if (input.body !== undefined) headers.delete('content-length');

    headers.set('x-consuelo-workspace-id', input.resolution.workspaceId);
    headers.set('x-consuelo-hostname', input.resolution.hostname);
    headers.set('x-consuelo-route', input.resolution.route);
    headers.set('x-consuelo-surface', input.resolution.surface);

    if (input.resolution.target.kind === 'os-connector') {
      headers.set(
        'x-consuelo-connector-id',
        input.resolution.target.connectorId,
      );
      if (input.resolution.nodeId) {
        headers.set('x-consuelo-node-id', input.resolution.nodeId);
      }
    }
    if (input.routeSource) headers.set(MCP_ROUTE_SOURCE_HEADER, input.routeSource);
    if (input.nodeRoutingContext) {
      headers.set(
        MCP_NODE_CONTEXT_HEADER,
        encodeMcpNodeRoutingContext(input.nodeRoutingContext),
      );
    }

    const internalSigningSecret = input.internalSigningSecret?.trim();
    if (internalSigningSecret) {
      const edgeTimestamp = String(Date.now());
      const edgeNonce = crypto.randomUUID();
      headers.set('x-consuelo-edge-timestamp', edgeTimestamp);
      headers.set('x-consuelo-edge-nonce', edgeNonce);
      headers.set(
        'x-consuelo-edge-signature',
        await edgeSignature({
          secret: internalSigningSecret,
          method: input.request.method,
          pathWithSearch: inboundUrl.pathname + inboundUrl.search,
          workspaceId: input.resolution.workspaceId,
          surface: input.resolution.surface,
          timestamp: edgeTimestamp,
          nonce: edgeNonce,
        }),
      );
    }

    const init: RequestInit & { duplex?: 'half' } = {
      headers,
      method: input.request.method,
    };

    if (input.request.method !== 'GET' && input.request.method !== 'HEAD') {
      init.body = input.body ?? input.request.body;
      init.duplex = 'half';
    }

    return new Request(input.upstreamUrl, init);
  } catch (error: unknown) {
    throw new Error(
      error instanceof Error
        ? error.message
        : 'central MCP proxy request failed',
    );
  }
}

async function centralMcpNodeRoutingContext(input: {
  store: Store;
  accountId: string;
  workspaceId: string;
  workspaceHost: string;
  currentNodeId: string;
  routeSource: McpNodeRouteSource;
  nowMs: number;
  operationalLogger?: DeviceAuthorityLogger;
}): Promise<McpNodeRoutingContext | undefined> {
  try {
    const workspace = await input.store.byAccountWorkspace(input.accountId);
    if (!workspace || workspace.workspaceHost !== input.workspaceHost) return undefined;
    const defaultNodeId = workspaceDefaultNodeId(workspace);
    const nodes = (await input.store.listWorkspaceNodes(input.accountId))
      .filter(
        (node) =>
          node.workspaceHost === input.workspaceHost &&
          (node.state ?? 'active') !== 'revoked',
      )
      .sort((left, right) => {
        const leftPriority = left.nodeId === input.currentNodeId
          ? 0
          : left.nodeId === defaultNodeId
            ? 1
            : 2;
        const rightPriority = right.nodeId === input.currentNodeId
          ? 0
          : right.nodeId === defaultNodeId
            ? 1
            : 2;
        return leftPriority - rightPriority || left.createdAt - right.createdAt;
      })
      .slice(0, 32)
      .map((node) => {
        const safe = safeWorkspaceNode(node, input.nowMs);
        return {
          nodeId: node.nodeId,
          displayName: (node.displayName ?? node.nodeName).trim().slice(0, 120),
          role: node.role,
          platform: (node.platform ?? 'unknown').trim().slice(0, 40),
          channel: safe.channel,
          ...(safe.osVersion ? { osVersion: safe.osVersion } : {}),
          ...(safe.mcpProtocolVersion
            ? { mcpProtocolVersion: safe.mcpProtocolVersion }
            : {}),
          readiness: safe.readiness,
          compatibility: safe.compatibility,
          presence: workspaceNodePresence(node, input.nowMs),
          state: (node.state ?? 'active').trim().slice(0, 40),
        };
      });
    return {
      version: 1,
      workspaceId: input.workspaceId,
      currentNodeId: input.currentNodeId,
      ...(defaultNodeId ? { defaultNodeId } : {}),
      routeSource: input.routeSource,
      nodes,
    };
  } catch (error: unknown) {
    try {
      input.operationalLogger?.warn(
        '[OsDeviceAuthority] MCP node directory unavailable',
        {
          component: 'os-device-authority',
          operation: 'mcp-node-directory',
          accountId: input.accountId,
          workspaceId: input.workspaceId,
          workspaceHost: input.workspaceHost,
          failure: error instanceof Error ? error.name : 'UnknownError',
        },
      );
    } catch {
      // Logging must never turn the steering directory's fail-open path into a request failure.
    }
    return undefined;
  }
}

function reportSessionAffinityBookkeepingFailure(input: {
  operationalLogger?: DeviceAuthorityLogger;
  accountId: string;
  workspaceId: string;
  workspaceHost: string;
  sessionKind: 'task' | 'work';
  sessionId: string;
  nodeId: string;
  outcome: 'conflict' | 'error';
  error?: unknown;
}): void {
  try {
    const taskSession = input.sessionKind === 'task' ? input.sessionId : undefined;
    input.operationalLogger?.warn(
      input.sessionKind === 'task'
        ? '[OsDeviceAuthority] Task affinity bookkeeping failed'
        : '[OsDeviceAuthority] Work session affinity bookkeeping failed',
      {
        component: 'os-device-authority',
        operation: input.sessionKind === 'task'
          ? 'task-affinity-bookkeeping'
          : 'work-session-affinity-bookkeeping',
        accountId: input.accountId,
        workspaceId: input.workspaceId,
        workspaceHost: input.workspaceHost,
        sessionKind: input.sessionKind,
        sessionId: input.sessionId,
        ...(taskSession ? { taskSession } : {}),
        failure: input.error instanceof Error
          ? input.error.name
          : input.outcome === 'conflict'
            ? 'Conflict'
            : 'UnknownError',
        nodeId: input.nodeId,
        outcome: input.outcome,
      },
    );
  } catch {
    // Bookkeeping observability must never replace an already-completed MCP response.
  }
}

export async function proxyCentralMcpRequest(input: {
  request: Request;
  store: Store;
  origin: string;
  nowMs: number;
  routeRegistry?: WorkspaceRouteRegistryBinding;
  internalSigningSecret?: string;
  operationalLogger?: DeviceAuthorityLogger;
  fetchImpl: typeof fetch;
}): Promise<Response> {
  try {
    const token = bearerToken(input.request);
    if (!token) return centralMcpUnauthorized(input.origin);

    const stored = await input.store.byMcpOAuthAccessToken(await hash(token));
    if (
      !stored ||
      input.nowMs >= stored.expiresAt ||
      stored.resource !== mcpResourceUrl(input.origin)
    ) {
      return centralMcpUnauthorized(input.origin);
    }
    if (!hasGrantedScope(stored.scopes, 'route:/mcp:read')) {
      return centralMcpSafeError({
        status: 403,
        code: 'MISSING_SCOPE',
        message: 'OAuth token does not grant MCP route access.',
      });
    }
    const operationScope = await centralMcpOperationScope(input.request);
    if (operationScope && !hasGrantedScope(stored.scopes, operationScope)) {
      return centralMcpSafeError({
        status: 403,
        code: 'MISSING_SCOPE',
        message: 'OAuth token does not grant the requested MCP operation.',
      });
    }
    if (!input.routeRegistry) {
      return centralMcpSafeError({
        status: 503,
        code: 'WORKSPACE_ROUTE_REGISTRY_UNAVAILABLE',
      });
    }

    const inboundUrl = new URL(input.request.url);
    const requestBody = input.request.method === 'POST'
      ? await input.request.clone().text()
      : '';
    const routingInspection = inspectMcpNodeRoutingBody(requestBody);
    if (!routingInspection.ok) {
      return centralMcpSafeError({
        status: 400,
        code: routingInspection.code,
        message: routingInspection.message,
      });
    }
    let proxyRequestBody = requestBody;
    const headerNodeId =
      input.request.headers.get('x-consuelo-node-id')?.trim() || undefined;
    if (
      routingInspection.nodeId &&
      headerNodeId &&
      routingInspection.nodeId !== headerNodeId
    ) {
      return centralMcpSafeError({
        status: 400,
        code: 'NODE_ROUTE_MISMATCH',
        message: 'MCP body nodeId does not match the explicit node routing header.',
      });
    }
    const requestedNodeId = routingInspection.nodeId ?? headerNodeId;
    const routedSession = routingInspection.taskSession
      ? { sessionKind: 'task' as const, sessionId: routingInspection.taskSession }
      : routingInspection.workSession
        ? { sessionKind: 'work' as const, sessionId: routingInspection.workSession }
        : undefined;
    let sessionAffinity = routedSession
      ? await input.store.byWorkspaceSessionAffinity({
          accountId: stored.accountId,
          workspaceHost: stored.workspaceHost,
          sessionKind: routedSession.sessionKind,
          sessionId: routedSession.sessionId,
          nowMs: input.nowMs,
        })
      : undefined;
    if (
      sessionAffinity &&
      requestedNodeId &&
      requestedNodeId !== sessionAffinity.ownerNodeId
    ) {
      return centralMcpSafeError({
        status: 409,
        code: sessionAffinity.sessionKind === 'task'
          ? 'TASK_NODE_MISMATCH'
          : 'WORK_SESSION_NODE_MISMATCH',
        message: sessionAffinity.sessionKind === 'task'
          ? 'The requested node does not own this task session.'
          : 'The requested node does not own this work session.',
      });
    }
    const resolvedNodeId = sessionAffinity?.ownerNodeId ?? requestedNodeId;
    const routeSource: McpNodeRouteSource = sessionAffinity
      ? sessionAffinity.sessionKind
      : requestedNodeId
        ? 'explicit'
        : 'default';
    const resolution = await createWorkspaceCloudflareD1RouteRegistry(
      input.routeRegistry,
    ).resolve({
      host: stored.workspaceHost,
      path: inboundUrl.pathname,
      method: input.request.method,
      ...(resolvedNodeId ? { nodeId: resolvedNodeId } : {}),
      nowMs: input.nowMs,
    });
    if (resolution.allowed === false) {
      return centralMcpSafeError({
        status: resolution.status,
        code: resolution.errorCode,
        message: resolution.diagnostic?.message,
      });
    }
    if (resolution.target.kind !== 'os-connector') {
      return centralMcpSafeError({
        status: 404,
        code: 'WORKSPACE_HOSTNAME_ROUTE_NOT_FOUND',
      });
    }

    const resolvedNode = resolution.nodeId
      ? await input.store.byWorkspaceNode(stored.accountId, resolution.nodeId)
      : undefined;
    if (resolution.nodeId && !resolvedNode) {
      return centralMcpSafeError({
        status: 409,
        code: 'WORKSPACE_NODE_NOT_READY',
        message: 'The routed node is not available for OS execution.',
        details: { nodeId: resolution.nodeId },
      });
    }
    if (resolution.nodeId && resolvedNode) {
      const safeNode = safeWorkspaceNode(resolvedNode, input.nowMs);
      if (safeNode.state === 'revoked') {
        return centralMcpSafeError({
          status: 404,
          code: 'WORKSPACE_NODE_REVOKED',
          message: 'The requested node has been revoked.',
          details: { nodeId: resolution.nodeId },
        });
      }
      const strictReadiness = routeSource === 'explicit';
      const lifecycleRecovery =
        strictReadiness &&
        routingInspection.facadeTool !== undefined &&
        EXPLICIT_NODE_LIFECYCLE_RECOVERY_TOOLS.has(routingInspection.facadeTool);
      if (
        strictReadiness
        && routingInspection.facadeTool === 'lifecycle.update'
        && safeNode.compatibility !== 'compatible'
      ) {
        const legacyRewrite = rewriteLegacyManagedCloudLifecycleUpdate(requestBody);
        if (!legacyRewrite.ok) {
          return centralMcpSafeError({
            status: 400,
            code: legacyRewrite.code,
            message: legacyRewrite.message,
            details: { nodeId: resolution.nodeId },
          });
        }
        proxyRequestBody = legacyRewrite.body;
      }
      if (
        !lifecycleRecovery &&
        (
          safeNode.compatibility === 'incompatible'
          || (strictReadiness && safeNode.compatibility !== 'compatible')
        )
      ) {
        return centralMcpSafeError({
          status: 409,
          code: 'WORKSPACE_NODE_UPDATE_REQUIRED',
          message: 'The requested node must update before it can run this OS call.',
          details: {
            nodeId: resolution.nodeId,
            osVersion: safeNode.osVersion,
            mcpProtocolVersion: safeNode.mcpProtocolVersion,
            requiredProtocolVersion: MODERN_MCP_PROTOCOL_VERSION,
          },
        });
      }
      if (
        !lifecycleRecovery &&
        (
          safeNode.readiness === 'not_ready'
          || (strictReadiness && safeNode.readiness !== 'ready')
        )
      ) {
        return centralMcpSafeError({
          status: 409,
          code: 'WORKSPACE_NODE_NOT_READY',
          message: 'The requested node is online but not ready for OS execution.',
          details: {
            nodeId: resolution.nodeId,
            osVersion: safeNode.osVersion,
            readiness: safeNode.readiness,
          },
        });
      }
    }

    if (
      sessionAffinity?.workspaceId &&
      sessionAffinity.workspaceId !== resolution.workspaceId &&
      resolution.nodeId === sessionAffinity.ownerNodeId
    ) {
      try {
        const refreshed = sessionAffinity.sessionKind === 'task'
          ? await input.store.claimWorkspaceTaskAffinity({
              accountId: stored.accountId,
              workspaceId: resolution.workspaceId,
              workspaceHost: stored.workspaceHost,
              taskSession: sessionAffinity.sessionId,
              ownerNodeId: sessionAffinity.ownerNodeId,
              createdAt: sessionAffinity.createdAt,
              updatedAt: input.nowMs,
              expiresAt: input.nowMs + WORKSPACE_SESSION_AFFINITY_TTL_MS,
            })
          : await input.store.claimWorkspaceSessionAffinity({
              accountId: stored.accountId,
              workspaceId: resolution.workspaceId,
              workspaceHost: stored.workspaceHost,
              sessionKind: sessionAffinity.sessionKind,
              sessionId: sessionAffinity.sessionId,
              ownerNodeId: sessionAffinity.ownerNodeId,
              createdAt: sessionAffinity.createdAt,
              updatedAt: input.nowMs,
              expiresAt: input.nowMs + WORKSPACE_SESSION_AFFINITY_TTL_MS,
            });
        if (
          refreshed.status !== 'conflict' &&
          refreshed.affinity.ownerNodeId === resolution.nodeId &&
          refreshed.affinity.workspaceId === resolution.workspaceId
        ) {
          sessionAffinity = refreshed.affinity;
        }
      } catch {
        // Preserve the existing fail-closed workspace mismatch below when reconciliation fails.
      }
    }

    if (
      sessionAffinity?.workspaceId &&
      sessionAffinity.workspaceId !== resolution.workspaceId
    ) {
      return centralMcpSafeError({
        status: 409,
        code: sessionAffinity.sessionKind === 'task'
          ? 'TASK_WORKSPACE_MISMATCH'
          : 'WORK_SESSION_WORKSPACE_MISMATCH',
        message: sessionAffinity.sessionKind === 'task'
          ? 'Task affinity does not belong to the resolved workspace.'
          : 'Work session affinity does not belong to the resolved workspace.',
      });
    }

    const nodeRoutingContext = routingInspection.getSteering && resolution.nodeId
      ? await centralMcpNodeRoutingContext({
          store: input.store,
          accountId: stored.accountId,
          workspaceId: resolution.workspaceId,
          workspaceHost: stored.workspaceHost,
          currentNodeId: resolution.nodeId,
          routeSource,
          nowMs: input.nowMs,
          operationalLogger: input.operationalLogger,
        })
      : undefined;

    const proxyRequest = await centralMcpProxyRequest({
      request: input.request,
      ...(input.request.method === 'POST'
        ? { body: stripMcpRoutingNodeId(proxyRequestBody) }
        : {}),
      resolution,
      upstreamUrl: centralMcpUpstreamUrl({
        tunnelOriginUrl: resolution.target.tunnelOriginUrl,
        inboundUrl,
      }),
      routeSource,
      nodeRoutingContext,
      internalSigningSecret: input.internalSigningSecret,
    });

    const upstreamResponse = await input.fetchImpl(proxyRequest);
    if (
      resolution.nodeId &&
      routingInspection.facadeTool &&
      input.request.method === 'POST'
    ) {
      let bookkeepingSession = routedSession;
      try {
        const outcome = await centralMcpFacadeOutcome(upstreamResponse);
        if (outcome.ok) {
          if (routingInspection.facadeTool === 'session.start') {
            bookkeepingSession = outcome.taskSession
              ? { sessionKind: 'task', sessionId: outcome.taskSession }
              : outcome.workSession
                ? { sessionKind: 'work', sessionId: outcome.workSession }
                : undefined;
          } else if (routingInspection.facadeTool === 'task.start' && outcome.taskSession) {
            bookkeepingSession = { sessionKind: 'task', sessionId: outcome.taskSession };
          }
          if (
            bookkeepingSession?.sessionKind === 'task'
            && routingInspection.facadeTool === 'task.finish'
          ) {
            await input.store.releaseWorkspaceTaskAffinity({
              accountId: stored.accountId,
              workspaceHost: stored.workspaceHost,
              taskSession: bookkeepingSession.sessionId,
              ownerNodeId: resolution.nodeId,
            });
          } else if (
            bookkeepingSession
            && (
              routingInspection.facadeTool === 'task.start'
              || routingInspection.facadeTool === 'session.start'
              || Boolean(sessionAffinity)
            )
          ) {
            const claimed = bookkeepingSession.sessionKind === 'task'
              ? await input.store.claimWorkspaceTaskAffinity({
                  accountId: stored.accountId,
                  workspaceId: resolution.workspaceId,
                  workspaceHost: stored.workspaceHost,
                  taskSession: bookkeepingSession.sessionId,
                  ownerNodeId: resolution.nodeId,
                  createdAt: sessionAffinity?.createdAt ?? input.nowMs,
                  updatedAt: input.nowMs,
                  expiresAt: input.nowMs + WORKSPACE_SESSION_AFFINITY_TTL_MS,
                })
              : await input.store.claimWorkspaceSessionAffinity({
                  accountId: stored.accountId,
                  workspaceId: resolution.workspaceId,
                  workspaceHost: stored.workspaceHost,
                  sessionKind: bookkeepingSession.sessionKind,
                  sessionId: bookkeepingSession.sessionId,
                  ownerNodeId: resolution.nodeId,
                  createdAt: sessionAffinity?.createdAt ?? input.nowMs,
                  updatedAt: input.nowMs,
                  expiresAt: input.nowMs + WORKSPACE_SESSION_AFFINITY_TTL_MS,
                });
            if (claimed.status === 'conflict') {
              reportSessionAffinityBookkeepingFailure({
                operationalLogger: input.operationalLogger,
                accountId: stored.accountId,
                workspaceId: resolution.workspaceId,
                workspaceHost: stored.workspaceHost,
                sessionKind: bookkeepingSession.sessionKind,
                sessionId: bookkeepingSession.sessionId,
                nodeId: resolution.nodeId,
                outcome: 'conflict',
              });
            }
          }
        }
      } catch (error: unknown) {
        if (bookkeepingSession) {
          reportSessionAffinityBookkeepingFailure({
            operationalLogger: input.operationalLogger,
            accountId: stored.accountId,
            workspaceId: resolution.workspaceId,
            workspaceHost: stored.workspaceHost,
            sessionKind: bookkeepingSession.sessionKind,
            sessionId: bookkeepingSession.sessionId,
            nodeId: resolution.nodeId,
            outcome: 'error',
            error,
          });
        }
      }
    }

    return upstreamResponse;
  } catch {
    return centralMcpSafeError({
      status: 500,
      code: 'CENTRAL_MCP_PROXY_FAILED',
    });
  }
}
