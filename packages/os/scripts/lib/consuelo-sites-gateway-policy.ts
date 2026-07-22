import type {
  ConsueloGatewayDegradation,
  ConsueloGatewaySourceMode,
  ConsueloGatewaySourceModePolicy,
} from './consuelo-sites-gateway-types';

export const CONSUELO_GATEWAY_SOURCE_MODE_POLICY: Record<ConsueloGatewaySourceMode, ConsueloGatewaySourceModePolicy> = {
  'local-networked': {
    sourceMode: 'local-networked',
    computeLocation: 'user-device',
    sitesHydration: 'consuelo-gateway',
    requiresRelay: true,
    bridgeRequired: false,
    supportsRunnerControl: false,
  },
  'cloud-compute': {
    sourceMode: 'cloud-compute',
    computeLocation: 'consuelo-managed-runner',
    sitesHydration: 'consuelo-gateway',
    requiresRelay: false,
    bridgeRequired: false,
    supportsRunnerControl: true,
  },
  'local-off-network': {
    sourceMode: 'local-off-network',
    computeLocation: 'user-device',
    sitesHydration: 'bridge-required',
    requiresRelay: false,
    bridgeRequired: true,
    supportsRunnerControl: false,
  },
};

export function createConsueloGatewaySourceModePolicy(
  overrides: Partial<Record<ConsueloGatewaySourceMode, ConsueloGatewaySourceModePolicy>> = {},
): Record<ConsueloGatewaySourceMode, ConsueloGatewaySourceModePolicy> {
  return {
    ...CONSUELO_GATEWAY_SOURCE_MODE_POLICY,
    ...overrides,
  };
}

export function resolveConsueloGatewaySourceModePolicy(
  sourceMode: ConsueloGatewaySourceMode,
  policy: Record<ConsueloGatewaySourceMode, ConsueloGatewaySourceModePolicy> = CONSUELO_GATEWAY_SOURCE_MODE_POLICY,
): ConsueloGatewaySourceModePolicy {
  return policy[sourceMode];
}

export function resolveConsueloGatewayDegradation(
  sourceModePolicy: ConsueloGatewaySourceModePolicy,
  bridgeConfigured: boolean,
): ConsueloGatewayDegradation {
  if (sourceModePolicy.bridgeRequired && !bridgeConfigured) {
    return {
      state: 'bridge-required',
      circuitState: 'open',
      retryPolicy: 'manual-bridge-required',
    };
  }

  return {
    state: 'healthy',
    circuitState: 'closed',
    retryPolicy: 'normal',
  };
}
