import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TWENTY_SERVER_ROOT = resolve(__dirname, '../../../../..');

const readSource = (relativePath: string) =>
  readFileSync(resolve(TWENTY_SERVER_ROOT, relativePath), 'utf8');

describe('Twenty dialer adapter architecture', () => {
  it('keeps the GraphQL start service free of Twenty persistence and telephony decisions', () => {
    const source = readSource(
      'src/engine/core-modules/consuelo-api/services/dialer-call-start.service.ts',
    );

    expect(source).toContain('startDialerCall(params)');
    expect(source).toContain('TwentyDialerCallStartInfrastructure');
    expect(source).not.toContain('dataSource.query');
    expect(source).not.toContain('initiateGroup({');
    expect(source).not.toContain('acquireLock(');
    expect(source).not.toContain('transferLock(');
    expect(source).not.toContain('createMockCalls(');
  });

  it('keeps the parallel service free of winner, AMD, losing-leg, and telemetry decisions', () => {
    const source = readSource(
      'src/engine/core-modules/consuelo-api/services/parallel.service.ts',
    );

    expect(source).toContain('initiateParallelDial({');
    expect(source).toContain('processParallelCallback({');
    expect(source).toContain('generateParallelCustomerTwiml({');
    expect(source).not.toContain('setWinnerIfAbsent');
    expect(source).not.toContain('normalizeAmdResult');
    expect(source).not.toContain('terminateCall(');
    expect(source).not.toContain('markTelemetryEmittedIfAbsent');
    expect(source).not.toContain('computeTelemetry(');
    expect(source).not.toContain('getReleasableNumbers(');
  });

  it('keeps GraphQL and REST transports as translation-only adapters', () => {
    const resolver = readSource(
      'src/engine/core-modules/consuelo-api/resolvers/dialer-call-start.resolver.ts',
    );
    const controller = readSource(
      'src/engine/core-modules/consuelo-api/controllers/parallel.controller.ts',
    );
    const forbidden = [
      'setWinnerIfAbsent',
      'normalizeAmdResult',
      'terminateCall(',
      'markTelemetryEmittedIfAbsent',
      'computeTelemetry(',
      'acquireLock(',
    ];

    for (const token of forbidden) {
      expect(resolver).not.toContain(token);
      expect(controller).not.toContain(token);
    }
  });

  it('implements explicit package port contracts in Twenty infrastructure', () => {
    const startInfrastructure = readSource(
      'src/engine/core-modules/consuelo-api/infrastructure/twenty-dialer-call-start.infrastructure.ts',
    );
    const parallelInfrastructure = readSource(
      'src/engine/core-modules/consuelo-api/infrastructure/twenty-parallel.infrastructure.ts',
    );

    expect(startInfrastructure).toContain(
      'const targets: DialerTargetRepositoryService',
    );
    expect(startInfrastructure).toContain(
      'const calls: DialerCallRepositoryService',
    );
    expect(startInfrastructure).toContain(
      'const runtime: DialerCallRuntimeService',
    );
    expect(parallelInfrastructure).toContain(
      'const runtime: ParallelCompatibilityRuntimeService',
    );
  });
});
