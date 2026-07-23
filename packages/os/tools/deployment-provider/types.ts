import type { Effect } from 'effect';

import type { ProviderError } from './errors';
import type {
  DeploymentProviderCapability,
  DeploymentProviderOperation,
  ProviderOperationPolicy,
} from './schema';

export type ProviderVersion = {
  raw: string;
  major: number;
  minor: number;
  patch: number;
};

export type ProviderApproval = {
  approved: boolean;
  reason?: string;
};

export type ProviderExecutionOptions = {
  approval?: ProviderApproval;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export type ProviderResourceReference = {
  id: string;
  name?: string;
};

export type ProviderContext = {
  project?: ProviderResourceReference;
  team?: ProviderResourceReference;
  scope?: ProviderResourceReference;
  environment?: ProviderResourceReference;
  service?: ProviderResourceReference;
};

export type ProviderProject = {
  id: string;
  name: string;
};

export type ProviderProjectList = {
  projects: ProviderProject[];
  cursor?: string;
};

export type ProviderProjectLinkResult = {
  project: ProviderResourceReference;
  scope?: ProviderResourceReference;
  linked: boolean;
};

export type ProviderProjectConfiguration = {
  id: string;
  name: string;
  framework?: string;
  nodeVersion?: string;
  rootDirectory?: string;
  team?: ProviderResourceReference;
  scope?: ProviderResourceReference;
  domains: string[];
};

export type ProviderDomain = {
  name: string;
  registrar?: string;
  nameservers?: string;
  verified?: boolean;
  projectId?: string;
};

export type ProviderDomainList = {
  domains: ProviderDomain[];
  cursor?: string;
};

export type ProviderDeployment = {
  id: string;
  status: string;
  url?: string;
  createdAt?: string;
  projectId?: string;
  environment?: string;
  serviceId?: string;
};

export type ProviderDeploymentList = {
  deployments: ProviderDeployment[];
  cursor?: string;
};

export type ProviderLogEntry = {
  message: string;
  timestamp?: string;
  level?: string;
  stream?: string;
};

export type ProviderLogResult = {
  entries: ProviderLogEntry[];
  cursor?: string;
  truncated?: boolean;
};

export type ProviderDeploymentMutationResult = {
  deploymentId: string;
  status?: string;
  url?: string;
};

export type ProviderEnvironmentSetResult = {
  name: string;
  scopes: string[];
  updated: boolean;
};

export type ProviderEnvironmentDeleteResult = {
  name: string;
  scopes: string[];
  deleted: boolean;
};

export type ProviderDetection = {
  provider: string;
  executable: string;
  version: ProviderVersion;
};

export type ProviderAuthStatus = {
  authenticated: boolean;
  identity?: string;
  source: 'cli';
};

export type ProviderEnvironmentVariableMetadata = {
  name: string;
  scopes: string[];
  present: boolean;
};

export type ProviderRawResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  stdoutTruncated?: boolean;
  stderrTruncated?: boolean;
};

export type DeploymentProviderOperationInputMap = {
  detect: ProviderExecutionOptions;
  'auth.status': ProviderExecutionOptions;
  'context.current': ProviderExecutionOptions;
  'project.list': ProviderExecutionOptions & {
    cursor?: string;
    limit?: number;
  };
  'project.link': ProviderExecutionOptions & {
    project: string;
    scope?: string;
    path?: string;
  };
  'project.configuration': ProviderExecutionOptions & {
    projectId?: string;
  };
  'domain.list': ProviderExecutionOptions & {
    projectId?: string;
    cursor?: string;
    limit?: number;
  };
  'deployment.list': ProviderExecutionOptions & {
    projectId?: string;
    environment?: string;
    serviceId?: string;
    cursor?: string;
    limit?: number;
  };
  'deployment.status': ProviderExecutionOptions & {
    deploymentId: string;
  };
  'logs.read': ProviderExecutionOptions & {
    deploymentId?: string;
    serviceId?: string;
    environment?: string;
    cursor?: string;
    limit?: number;
    since?: string;
  };
  deploy: ProviderExecutionOptions & {
    target: string;
    projectId?: string;
    serviceId?: string;
    source?: string;
  };
  redeploy: ProviderExecutionOptions & {
    deploymentId: string;
    target?: string;
  };
  'deployment.promote': ProviderExecutionOptions & {
    deploymentId: string;
  };
  'environment.listNames': ProviderExecutionOptions & {
    projectId?: string;
    environment?: string;
  };
  'environment.set': ProviderExecutionOptions & {
    name: string;
    value: string;
    scope?: string;
  };
  'environment.delete': ProviderExecutionOptions & {
    name: string;
    scope?: string;
  };
  raw: ProviderExecutionOptions & {
    args: string[];
  };
};

export type DeploymentProviderOperationOutputMap = {
  detect: ProviderDetection;
  'auth.status': ProviderAuthStatus;
  'context.current': ProviderContext;
  'project.list': ProviderProjectList;
  'project.link': ProviderProjectLinkResult;
  'project.configuration': ProviderProjectConfiguration;
  'domain.list': ProviderDomainList;
  'deployment.list': ProviderDeploymentList;
  'deployment.status': ProviderDeployment;
  'logs.read': ProviderLogResult;
  deploy: ProviderDeploymentMutationResult;
  redeploy: ProviderDeploymentMutationResult;
  'deployment.promote': ProviderDeploymentMutationResult;
  'environment.listNames': ProviderEnvironmentVariableMetadata[];
  'environment.set': ProviderEnvironmentSetResult;
  'environment.delete': ProviderEnvironmentDeleteResult;
  raw: ProviderRawResult;
};

export type ProviderCommandOperation = Exclude<DeploymentProviderOperation, 'detect'>;
export type ProviderOperationInput<
  Operation extends DeploymentProviderOperation = DeploymentProviderOperation,
> = DeploymentProviderOperationInputMap[Operation];
export type ProviderOperationOutput<
  Operation extends DeploymentProviderOperation = DeploymentProviderOperation,
> = DeploymentProviderOperationOutputMap[Operation];

export type ProviderCommand = {
  command?: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdin?: string;
};

export type ProviderProcessRequest = {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  signal?: AbortSignal;
  stdin?: string;
};

export type ProviderProcessResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  cancelled: boolean;
  runtimeMissing: boolean;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
};

export type ProviderProcess = {
  readonly execPath: string;
  run: (
    request: ProviderProcessRequest,
  ) => Effect.Effect<ProviderProcessResult, never>;
};

export type ProviderAdapterOperationOutputMap = Omit<
  DeploymentProviderOperationOutputMap,
  'detect' | 'auth.status' | 'environment.listNames'
> & {
  'auth.status': unknown;
  'environment.listNames': unknown;
};

export type ProviderOperationDefinition<
  Operation extends ProviderCommandOperation = ProviderCommandOperation,
> = {
  capability: Operation;
  policy?: ProviderOperationPolicy | ((input: DeploymentProviderOperationInputMap[Operation]) => ProviderOperationPolicy);
  acceptPartialResult?: (result: ProviderProcessResult) => boolean;
  command: (input: DeploymentProviderOperationInputMap[Operation]) => ProviderCommand;
  parse: (
    result: ProviderProcessResult,
    input: DeploymentProviderOperationInputMap[Operation],
  ) => ProviderAdapterOperationOutputMap[Operation];
};

export type ProviderOperationDefinitions = {
  [Operation in ProviderCommandOperation]?: ProviderOperationDefinition<Operation>;
};

export type DeploymentProviderAdapter = {
  provider: string;
  executable: string;
  capabilities: readonly DeploymentProviderCapability[];
  version: {
    args: string[];
    parse: (output: string) => ProviderVersion | null;
    supports: (version: ProviderVersion) => boolean;
  };
  operations: ProviderOperationDefinitions;
};

export type DeploymentProviderService = {
  policy: <Operation extends DeploymentProviderOperation>(
    operation: Operation,
    input?: Partial<DeploymentProviderOperationInputMap[Operation]>,
  ) => ProviderOperationPolicy;
  detect: () => Effect.Effect<ProviderDetection, ProviderError>;
  authStatus: () => Effect.Effect<ProviderAuthStatus, ProviderError>;
  contextCurrent: (
    input?: DeploymentProviderOperationInputMap['context.current'],
  ) => Effect.Effect<ProviderContext, ProviderError>;
  projectList: (
    input?: DeploymentProviderOperationInputMap['project.list'],
  ) => Effect.Effect<ProviderProjectList, ProviderError>;
  projectLink: (
    input: DeploymentProviderOperationInputMap['project.link'],
  ) => Effect.Effect<ProviderProjectLinkResult, ProviderError>;
  projectConfiguration: (
    input?: DeploymentProviderOperationInputMap['project.configuration'],
  ) => Effect.Effect<ProviderProjectConfiguration, ProviderError>;
  domainList: (
    input?: DeploymentProviderOperationInputMap['domain.list'],
  ) => Effect.Effect<ProviderDomainList, ProviderError>;
  deploymentList: (
    input?: DeploymentProviderOperationInputMap['deployment.list'],
  ) => Effect.Effect<ProviderDeploymentList, ProviderError>;
  deploymentStatus: (
    input: DeploymentProviderOperationInputMap['deployment.status'],
  ) => Effect.Effect<ProviderDeployment, ProviderError>;
  logsRead: (
    input?: DeploymentProviderOperationInputMap['logs.read'],
  ) => Effect.Effect<ProviderLogResult, ProviderError>;
  deploy: (
    input: DeploymentProviderOperationInputMap['deploy'],
  ) => Effect.Effect<ProviderDeploymentMutationResult, ProviderError>;
  redeploy: (
    input: DeploymentProviderOperationInputMap['redeploy'],
  ) => Effect.Effect<ProviderDeploymentMutationResult, ProviderError>;
  deploymentPromote: (
    input: DeploymentProviderOperationInputMap['deployment.promote'],
  ) => Effect.Effect<ProviderDeploymentMutationResult, ProviderError>;
  environmentListNames: (
    input?: DeploymentProviderOperationInputMap['environment.listNames'],
  ) => Effect.Effect<ProviderEnvironmentVariableMetadata[], ProviderError>;
  environmentSet: (
    input: DeploymentProviderOperationInputMap['environment.set'],
  ) => Effect.Effect<ProviderEnvironmentSetResult, ProviderError>;
  environmentDelete: (
    input: DeploymentProviderOperationInputMap['environment.delete'],
  ) => Effect.Effect<ProviderEnvironmentDeleteResult, ProviderError>;
  raw: (
    input: DeploymentProviderOperationInputMap['raw'],
  ) => Effect.Effect<ProviderRawResult, ProviderError>;
  execute: <Operation extends ProviderCommandOperation>(
    operation: Operation,
    input: DeploymentProviderOperationInputMap[Operation],
  ) => Effect.Effect<DeploymentProviderOperationOutputMap[Operation], ProviderError>;
};
