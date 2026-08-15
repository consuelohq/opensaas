import { describe, expect, it } from 'vitest';

import { classifyConsueloChanges } from '../scripts/ci-plan';

describe('Consuelo CI plan', () => {
  it('routes every Consuelo-owned package through verify without waking product lanes unnecessarily', () => {
    expect(classifyConsueloChanges(['packages/cli/src/auth.ts'])).toEqual({
      verify: true,
      workflowSecurity: false,
      osContracts: false,
      dialer: false,
      sitesGatewayCloudflare: false,
    });
  });

  it('keeps legacy Twenty package-only changes outside Consuelo verification', () => {
    expect(classifyConsueloChanges(['packages/twenty-front/src/App.tsx'])).toEqual({
      verify: false,
      workflowSecurity: false,
      osContracts: false,
      dialer: false,
      sitesGatewayCloudflare: false,
    });
  });

  it('keeps the temporary Twenty Consuelo API bridge in the dialer lane', () => {
    expect(
      classifyConsueloChanges([
        'packages/twenty-server/src/engine/core-modules/consuelo-api/consuelo-api.controller.ts',
      ]),
    ).toEqual({
      verify: true,
      workflowSecurity: false,
      osContracts: false,
      dialer: true,
      sitesGatewayCloudflare: false,
    });
  });

  it('routes OS and Sites Gateway changes to their focused lanes', () => {
    expect(
      classifyConsueloChanges([
        'packages/os/cloudflare/workspace-edge/src/index.ts',
      ]),
    ).toEqual({
      verify: true,
      workflowSecurity: false,
      osContracts: true,
      dialer: false,
      sitesGatewayCloudflare: true,
    });
  });

  it('preserves the existing broad gateway classification', () => {
    expect(classifyConsueloChanges(['packages/os/tests/security-gateway.test.ts'])).toMatchObject({
      verify: true,
      osContracts: true,
      sitesGatewayCloudflare: true,
    });
  });

  it('routes dialer package changes to verify and the release package lane', () => {
    expect(classifyConsueloChanges(['packages/dialer-server/src/app.ts'])).toEqual({
      verify: true,
      workflowSecurity: false,
      osContracts: false,
      dialer: true,
      sitesGatewayCloudflare: false,
    });
  });

  it.each(['package.json', 'yarn.lock', '.yarnrc.yml', 'bun.lock', 'bunfig.toml', '.bun-version'])(
    'treats root package-manager control file %s as cross-cutting',
    (file) => {
      expect(classifyConsueloChanges([file])).toMatchObject({
        verify: true,
        dialer: true,
      });
    },
  );

  it('routes workflow changes through workflow security and keeps Consuelo release workflows in the dialer lane', () => {
    expect(
      classifyConsueloChanges(['.github/workflows/consuelo-production-release.yaml']),
    ).toEqual({
      verify: true,
      workflowSecurity: true,
      osContracts: false,
      dialer: true,
      sitesGatewayCloudflare: false,
    });
  });
});
