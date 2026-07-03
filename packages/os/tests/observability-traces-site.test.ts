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

  it('keeps the ported trace cockpit behavior behind OS gateway routes', () => {
    const html = buildObservabilityTracesSite();

    expect(html).toContain('data-testid="trace-launcher"');
    expect(html).toContain('data-trace-modal');
    expect(html).toContain('data-inspector');
    expect(html).toContain('/gateway/traces/recent');
    expect(html).toContain('/gateway/traces/summary');
    expect(html).toContain('/gateway/traces/events');
    expect(html).toContain('new EventSource');
    expect(html).toContain('stableTraceKey');
    expect(html).toContain('generatedAt');
    expect(html).not.toContain('localhost');
    expect(html).not.toContain('127.0.0.1');
  });

  it('preserves the internal motion layer without introducing React', () => {
    const html = buildObservabilityTracesSite();

    expect(html).toContain('gsap@3');
    expect(html).toContain('window.gsap');
    expect(html).not.toContain('react');
    expect(html).not.toContain('ReactDOM');
  });

  it('keeps an Astro source for the durable Observability -> Traces product model', () => {
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../../consuelo-website/src/pages/os/observability/traces.astro'),
      'utf8',
    );

    expect(source).toContain('Traces - Observability');
    expect(source).toContain('/observability/traces');
    expect(source).toContain('/gateway/traces/recent');
    expect(source).toContain('/gateway/traces/summary');
    expect(source).toContain('/gateway/traces/events');
    expect(source).toContain('gsap@3');
    expect(source).not.toContain('Trace Burn Intelligence');
    expect(source).not.toMatch(/ReactDOM/);
  });
});
