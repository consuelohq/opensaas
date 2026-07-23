import { Effect } from 'effect';

import { providerError, type ProviderError } from '../deployment-provider/errors';
import {
  createDeploymentProviderService,
  type DeploymentProviderServiceOptions,
} from '../deployment-provider/service';
import type {
  DeploymentProviderOperationInputMap,
  DeploymentProviderService,
  ProviderDeployment,
  ProviderDeploymentMutationResult,
} from '../deployment-provider/types';
import { createRailwayAdapter } from './adapter';

export type RailwayRedeployInput = DeploymentProviderOperationInputMap['redeploy'] & {
  serviceId: string;
};

export type RailwayService = Omit<DeploymentProviderService, 'redeploy'> & {
  redeploy: (input: RailwayRedeployInput) => Effect.Effect<ProviderDeploymentMutationResult, ProviderError>;
};

export type RailwayServiceOptions = DeploymentProviderServiceOptions & {
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
  pollIntervalMs?: number;
};

const terminalSuccess = new Set(['SUCCESS', 'COMPLETED', 'READY']);
const terminalFailure = new Set(['FAILED', 'CRASHED', 'REMOVED', 'CANCELLED', 'CANCELED']);

const sleepDefault = (milliseconds: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

const findNewDeployment = (
  before: readonly ProviderDeployment[],
  after: readonly ProviderDeployment[],
): ProviderDeployment | undefined => {
  const beforeIds = new Set(before.map((deployment) => deployment.id));
  return after.find((deployment) => !beforeIds.has(deployment.id));
};

export const createRailwayService = (options: RailwayServiceOptions = {}): RailwayService => {
  const adapter = createRailwayAdapter();
  const core = createDeploymentProviderService(adapter, options);
  const sleep = options.sleep || sleepDefault;
  const now = options.now || Date.now;
  const pollIntervalMs = options.pollIntervalMs ?? 15_000;

  const redeploy = (input: RailwayRedeployInput): Effect.Effect<ProviderDeploymentMutationResult, ProviderError> => {
    return Effect.gen(function* () {
      const policy = core.policy('redeploy');
      if (policy.approval?.required && input.approval?.approved !== true) {
        return yield* Effect.fail(providerError({
          code: 'APPROVAL_REQUIRED',
          provider: adapter.provider,
          operation: 'redeploy',
          message: 'railway redeploy requires explicit approval',
          approval: policy.approval,
        }));
      }

      const timeoutMs = input.timeoutMs ?? 15 * 60_000;
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60 * 60_000) {
        return yield* Effect.fail(providerError({
          code: 'INVALID_INPUT',
          provider: adapter.provider,
          operation: 'redeploy',
          message: 'Railway redeploy timeout must be between 1 ms and 1 hour',
        }));
      }
      const startedAt = now();
      const deadline = startedAt + timeoutMs;
      const listInput = {
        serviceId: input.serviceId,
        environment: input.environment,
        limit: 20,
        timeoutMs: input.timeoutMs,
        signal: input.signal,
      } satisfies DeploymentProviderOperationInputMap['deployment.list'];

      const before = yield* core.deploymentList(listInput);
      yield* core.redeploy({
        serviceId: input.serviceId,
        environment: input.environment,
        timeoutMs: input.timeoutMs,
        signal: input.signal,
        approval: input.approval,
      });

      let current: ProviderDeployment | undefined;
      while (!current) {
        const after = yield* core.deploymentList(listInput);
        current = findNewDeployment(before.deployments, after.deployments);
        if (current) break;
        if (now() >= deadline) {
          return yield* Effect.fail(providerError({
            code: 'TIMEOUT',
            provider: adapter.provider,
            operation: 'redeploy',
            message: `railway redeploy timed out waiting for a new deployment for ${input.serviceId}`,
          }));
        }
        yield* Effect.tryPromise({
          try: () => sleep(pollIntervalMs),
          catch: () => providerError({
            code: 'CANCELLED',
            provider: adapter.provider,
            operation: 'redeploy',
            message: 'railway redeploy wait was interrupted',
          }),
        });
      }

      if (!input.wait) {
        return {
          deploymentId: current.id,
          serviceId: input.serviceId,
          status: current.status,
          ...(current.url ? { url: current.url } : {}),
          waited: false,
        };
      }

      while (true) {
        const status = current.status.toUpperCase();
        if (terminalSuccess.has(status)) {
          return {
            deploymentId: current.id,
            serviceId: input.serviceId,
            status: current.status,
            ...(current.url ? { url: current.url } : {}),
            waited: true,
          };
        }
        if (terminalFailure.has(status)) {
          return yield* Effect.fail(providerError({
            code: 'COMMAND_FAILED',
            provider: adapter.provider,
            operation: 'redeploy',
            message: `railway redeploy ${current.id} finished with ${current.status}`,
          }));
        }
        if (now() >= deadline) {
          return yield* Effect.fail(providerError({
            code: 'TIMEOUT',
            provider: adapter.provider,
            operation: 'redeploy',
            message: `railway redeploy ${current.id} timed out after ${timeoutMs} ms`,
          }));
        }
        yield* Effect.tryPromise({
          try: () => sleep(pollIntervalMs),
          catch: () => providerError({
            code: 'CANCELLED',
            provider: adapter.provider,
            operation: 'redeploy',
            message: 'railway redeploy wait was interrupted',
          }),
        });
        const deployments = yield* core.deploymentList(listInput);
        current = deployments.deployments.find((deployment) => deployment.id === current?.id)
          || deployments.deployments[0]
          || current;
      }
    });
  };

  return {
    ...core,
    redeploy,
  };
};
