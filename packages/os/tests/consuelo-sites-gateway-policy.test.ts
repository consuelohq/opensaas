import { describe, expect, it } from 'vitest';

import {
  CONSUELO_GATEWAY_SOURCE_MODE_POLICY,
  resolveConsueloGatewayDegradation,
  resolveConsueloGatewaySourceModePolicy,
} from '../scripts/lib/consuelo-sites-gateway-policy';

describe('Consuelo Sites Gateway source-mode policy', () => {
  it('should preserve local-networked, cloud-compute, and local-off-network semantics generically', () => {
    expect(CONSUELO_GATEWAY_SOURCE_MODE_POLICY).toMatchObject({
      'local-networked': {
        computeLocation: 'user-device',
        requiresRelay: true,
        supportsRunnerControl: false,
        sitesHydration: 'consuelo-gateway',
      },
      'cloud-compute': {
        computeLocation: 'consuelo-managed-runner',
        requiresRelay: false,
        supportsRunnerControl: true,
        sitesHydration: 'consuelo-gateway',
      },
      'local-off-network': {
        computeLocation: 'user-device',
        bridgeRequired: true,
        sitesHydration: 'bridge-required',
      },
    });
  });

  it('should return bridge-required degraded state for local-off-network without bridge', () => {
    const policy = resolveConsueloGatewaySourceModePolicy('local-off-network');

    expect(resolveConsueloGatewayDegradation(policy, false)).toEqual({
      state: 'bridge-required',
      circuitState: 'open',
      retryPolicy: 'manual-bridge-required',
    });
  });

  it('should return healthy state when a required bridge exists', () => {
    const policy = resolveConsueloGatewaySourceModePolicy('local-off-network');

    expect(resolveConsueloGatewayDegradation(policy, true)).toEqual({
      state: 'healthy',
      circuitState: 'closed',
      retryPolicy: 'normal',
    });
  });
});
