import { Effect } from 'effect';

import { createRailwayService } from '../railway/service';
import { cloudflareDeploymentProviderAdapter } from './cloudflare';
import { providerError, type ProviderError } from './errors';
import { createDeploymentProviderService } from './service';
import type {
  DeploymentProviderService,
  ProviderExecutionOptions,
} from './types';
import { createVercelProviderAdapter } from './vercel';

export const deploymentProviders = ['railway', 'vercel', 'cloudflare'] as const;
export type DeploymentProviderName = (typeof deploymentProviders)[number];

export const deploymentToolNames = [
  'deployment.detect',
  'deployment.context',
  'deployment.list',
  'deployment.status',
  'deployment.logs',
  'deployment.deploy',
  'deployment.environment',
  'deployment.raw',
] as const;
export type DeploymentToolName = (typeof deploymentToolNames)[number];

type FacadeExecutionInput = {
  provider: DeploymentProviderName;
  approved?: boolean;
  approvalReason?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export type DeploymentFacadeInput =
  | (FacadeExecutionInput & { tool: 'deployment.detect' })
  | (FacadeExecutionInput & {
    tool: 'deployment.context';
    action: 'auth' | 'current';
  })
  | (FacadeExecutionInput & {
    tool: 'deployment.list';
    resource: 'projects' | 'services' | 'deployments' | 'domains';
    projectId?: string;
    environment?: string;
    serviceId?: string;
    cursor?: string;
    limit?: number;
  })
  | (FacadeExecutionInput & {
    tool: 'deployment.status';
    deploymentId: string;
    serviceId?: string;
    environment?: string;
  })
  | (FacadeExecutionInput & {
    tool: 'deployment.logs';
    deploymentId?: string;
    serviceId?: string;
    environment?: string;
    cursor?: string;
    limit?: number;
    since?: string;
    until?: string;
    filter?: string;
    kind?: 'runtime' | 'build';
    latest?: boolean;
  })
  | (FacadeExecutionInput & {
    tool: 'deployment.deploy';
    action: 'deploy' | 'redeploy' | 'promote';
    target?: string;
    projectId?: string;
    serviceId?: string;
    source?: string;
    deploymentId?: string;
    environment?: string;
    wait?: boolean;
  })
  | (FacadeExecutionInput & {
    tool: 'deployment.environment';
    action: 'list' | 'set' | 'delete';
    name?: string;
    value?: string;
    scope?: string;
    projectId?: string;
    environment?: string;
    serviceId?: string;
    skipDeploys?: boolean;
  })
  | (FacadeExecutionInput & {
    tool: 'deployment.raw';
    args: string[];
  });

export type DeploymentFacadeServiceResolver = (
  provider: DeploymentProviderName,
) => DeploymentProviderService;

export type DeploymentFacadeOptions = {
  resolveService?: DeploymentFacadeServiceResolver;
};

const defaultServiceResolver: DeploymentFacadeServiceResolver = (provider) => {
  if (provider === 'railway') {
    return createRailwayService() as DeploymentProviderService;
  }
  if (provider === 'vercel') {
    return createDeploymentProviderService(createVercelProviderAdapter());
  }
  return createDeploymentProviderService(cloudflareDeploymentProviderAdapter);
};

const executionOptions = (input: FacadeExecutionInput): ProviderExecutionOptions => ({
  ...(input.approved === undefined
    ? {}
    : {
      approval: {
        approved: input.approved,
        ...(input.approvalReason ? { reason: input.approvalReason } : {}),
      },
    }),
  ...(input.timeoutMs === undefined ? {} : { timeoutMs: input.timeoutMs }),
  ...(input.signal ? { signal: input.signal } : {}),
});

const recoveryByProvider = {
  railway: {
    install: 'npm install -g @railway/cli',
    authenticate: 'railway login',
  },
  vercel: {
    install: 'npm install -g vercel',
    authenticate: 'vercel login',
  },
  cloudflare: {
    install: 'npm install -g wrangler',
    authenticate: 'wrangler login',
  },
} as const;

const addRecovery = (error: ProviderError): ProviderError => {
  if (error.recovery) return error;
  const provider = deploymentProviders.includes(error.provider as DeploymentProviderName)
    ? error.provider as DeploymentProviderName
    : null;
  if (!provider) return error;
  const commands = recoveryByProvider[provider];
  if (error.code === 'CLI_MISSING') {
    return providerError({
      code: error.code,
      provider: error.provider,
      operation: error.operation,
      message: error.message,
      diagnostics: error.diagnostics,
      approval: error.approval,
      recovery: {
        action: 'install_cli',
        command: commands.install,
        message: `Install the ${provider} CLI, then rerun deployment.detect.`,
      },
    });
  }
  if (error.code === 'UNAUTHENTICATED') {
    return providerError({
      code: error.code,
      provider: error.provider,
      operation: error.operation,
      message: error.message,
      diagnostics: error.diagnostics,
      approval: error.approval,
      recovery: {
        action: 'authenticate_cli',
        command: commands.authenticate,
        message: `Authenticate the ${provider} CLI locally, then retry the read operation.`,
      },
    });
  }
  return error;
};

const requireString = (value: string | undefined, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} is required`);
  }
  return value;
};

export const executeDeploymentFacade = (
  input: DeploymentFacadeInput,
  options: DeploymentFacadeOptions = {},
): Effect.Effect<unknown, ProviderError> => {
  const service = (options.resolveService || defaultServiceResolver)(input.provider);
  const common = executionOptions(input);

  let effect: Effect.Effect<unknown, ProviderError>;
  try {
    switch (input.tool) {
      case 'deployment.detect':
        effect = service.detect();
        break;
      case 'deployment.context':
        effect = input.action === 'auth'
          ? service.authStatus()
          : service.contextCurrent(common);
        break;
      case 'deployment.list': {
        if (input.resource === 'projects') {
          effect = service.projectList({ ...common, cursor: input.cursor, limit: input.limit });
        } else if (input.resource === 'services') {
          effect = service.serviceList({
            ...common,
            projectId: input.projectId,
            environment: input.environment,
            cursor: input.cursor,
            limit: input.limit,
          });
        } else if (input.resource === 'deployments') {
          effect = service.deploymentList({
            ...common,
            projectId: input.projectId,
            environment: input.environment,
            serviceId: input.serviceId,
            cursor: input.cursor,
            limit: input.limit,
          });
        } else {
          effect = service.domainList({
            ...common,
            projectId: input.projectId,
            cursor: input.cursor,
            limit: input.limit,
          });
        }
        break;
      }
      case 'deployment.status':
        effect = service.deploymentStatus({
          ...common,
          deploymentId: input.deploymentId,
          serviceId: input.serviceId,
          environment: input.environment,
        });
        break;
      case 'deployment.logs':
        effect = service.logsRead({
          ...common,
          deploymentId: input.deploymentId,
          serviceId: input.serviceId,
          environment: input.environment,
          cursor: input.cursor,
          limit: input.limit,
          since: input.since,
          until: input.until,
          filter: input.filter,
          kind: input.kind,
          latest: input.latest,
        });
        break;
      case 'deployment.deploy':
        if (input.action === 'deploy') {
          effect = service.deploy({
            ...common,
            target: requireString(input.target, 'target'),
            projectId: input.projectId,
            serviceId: input.serviceId,
            source: input.source,
          });
        } else if (input.action === 'redeploy') {
          effect = service.redeploy({
            ...common,
            deploymentId: input.deploymentId,
            serviceId: input.serviceId,
            environment: input.environment,
            wait: input.wait,
            target: input.target,
          });
        } else {
          effect = service.deploymentPromote({
            ...common,
            deploymentId: requireString(input.deploymentId, 'deploymentId'),
          });
        }
        break;
      case 'deployment.environment':
        if (input.action === 'list') {
          effect = service.environmentListNames({
            ...common,
            projectId: input.projectId,
            environment: input.environment,
            serviceId: input.serviceId,
          });
        } else if (input.action === 'set') {
          effect = service.environmentSet({
            ...common,
            name: requireString(input.name, 'name'),
            value: requireString(input.value, 'value'),
            scope: input.scope,
            environment: input.environment,
            serviceId: input.serviceId,
            skipDeploys: input.skipDeploys,
          });
        } else {
          effect = service.environmentDelete({
            ...common,
            name: requireString(input.name, 'name'),
            scope: input.scope,
            environment: input.environment,
            serviceId: input.serviceId,
            skipDeploys: input.skipDeploys,
          });
        }
        break;
      case 'deployment.raw':
        effect = service.raw({ ...common, args: input.args });
        break;
    }
  } catch (cause: unknown) {
    effect = Effect.fail(providerError({
      code: 'INVALID_INPUT',
      provider: input.provider,
      operation: input.tool === 'deployment.detect' ? 'detect' : 'raw',
      message: cause instanceof Error ? cause.message : String(cause),
      cause,
    }));
  }

  return effect.pipe(Effect.mapError(addRecovery));
};
