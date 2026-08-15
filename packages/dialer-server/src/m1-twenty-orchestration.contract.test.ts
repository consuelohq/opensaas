import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '../../..');
const source = (path: string): string => readFileSync(resolve(root, path), 'utf8');

describe('M1 Twenty orchestration boundary', () => {
  it('keeps call-start application composition in @consuelo/dialer', () => {
    const index = source('packages/dialer/src/index.ts');
    const application = source(
      'packages/dialer/src/application/dialer-call-start-application.ts',
    );

    expect(index).toContain('createDialerCallStartApplication');
    expect(application).toContain('Layer.succeed(DialerTargetRepository');
    expect(application).toContain('Layer.succeed(DialerCallRepository');
    expect(application).toContain('Layer.succeed(DialerCallRuntime');
    expect(application).toContain('liveDialerIdGeneratorLayer');
    expect(application).toContain('startDialerCall(command)');
  });

  it('reduces Twenty to a compatibility adapter instead of an application factory', () => {
    const service = source(
      'packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-call-start.service.ts',
    );
    const infrastructure = source(
      'packages/twenty-server/src/engine/core-modules/consuelo-api/infrastructure/twenty-dialer-call-start.infrastructure.ts',
    );

    expect(service).toContain('createDialerCallStartApplication');
    expect(service).not.toContain('liveDialerIdGeneratorLayer');
    expect(service).not.toContain('Layer.mergeAll');
    expect(service).not.toMatch(/\bstartDialerCall\(params\)\.pipe/);
    expect(infrastructure).toContain('createPorts()');
    expect(infrastructure).not.toContain('createApplicationLayer()');
    expect(infrastructure).not.toContain('Layer.succeed(DialerTargetRepository');
  });

  it('does not prematurely delete the evidence-gated compatibility endpoints', () => {
    const manifest = JSON.parse(
      source('packages/dialer-server/compatibility-cutover.json'),
    ) as {
      evidence: { liveHumanWinner: boolean };
      compatibility: { legacyTwentyDialerAdapters: string };
    };

    expect(manifest.evidence.liveHumanWinner).toBe(false);
    expect(manifest.compatibility.legacyTwentyDialerAdapters).toBe('preserved');
  });
});
