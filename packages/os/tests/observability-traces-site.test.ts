import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildObservabilityTracesSite } from '../scripts/lib/observability-traces-site';

describe('Observability Traces shell', () => {
  it('renders Observability as the surface and Traces as the current module', () => {
    const html = buildObservabilityTracesSite();

    expect(html).toContain('<title>Traces - Observability</title>');
    expect(html).toContain('<div class="eyebrow">Observability</div>');
    expect(html).toContain('<h1>Traces</h1>');
    expect(html).toContain('href="/observability/traces"');
    expect(html).toContain('Live tracing cockpit');
    expect(html).not.toContain('Trace Burn Intelligence');
  });

  it('ports the trace cockpit onto authenticated same-origin gateway routes', () => {
    const html = buildObservabilityTracesSite();

    expect(html).toContain('data-testid="trace-launcher"');
    expect(html).toContain('data-trace-modal');
    expect(html).toContain('data-inspector');
    expect(html).toContain('/gateway/traces/recent');
    expect(html).toContain('/gateway/traces/summary');
    expect(html).toContain('/gateway/traces/events');
    expect(html).toContain('new EventSource');
    expect(html).toContain("credentials: 'same-origin'");
    expect(html).toContain('stableTraceKey');
    expect(html).toContain('generatedAt');
    expect(html).not.toContain('localhost');
    expect(html).not.toContain('127.0.0.1');
  });

  it('keeps private observability free of third-party runtime dependencies', () => {
    const html = buildObservabilityTracesSite();

    expect(html).not.toContain('cdn.jsdelivr.net');
    expect(html).not.toContain('<script src=\"https://');
    expect(html).not.toContain('ReactDOM');
    expect(html).toContain('.animate(');
  });

  it('keeps an Astro source for the durable Observability to Traces product model', () => {
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../../consuelo-website/src/pages/os/observability/traces.astro'),
      'utf8',
    );

    expect(source).toContain('Traces - Observability');
    expect(source).toContain('/observability/traces');
    expect(source).toContain('/gateway/traces/recent');
    expect(source).toContain('/gateway/traces/summary');
    expect(source).toContain('/gateway/traces/events');
    expect(source).not.toContain('cdn.jsdelivr.net');
    expect(source).not.toContain('Trace Burn Intelligence');
    expect(source).not.toMatch(/ReactDOM/);
  });
});
