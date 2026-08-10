import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildObservabilityTracesSite } from '../scripts/lib/observability-traces-site';

describe('Observability Traces table', () => {
  it('renders the established trace table directly instead of a cockpit or click-to-open shell', () => {
    const html = buildObservabilityTracesSite();

    expect(html).toContain('<title>Traces - Observability</title>');
    expect(html).toContain('class="trace-shell"');
    expect(html).toContain('placeholder="Search traces..."');
    expect(html).toContain('<option value="1d">1 day</option>');
    expect(html).toContain('<span>Time</span>');
    expect(html).toContain('<span>Tool</span>');
    expect(html).toContain('<span>Latency</span>');
    expect(html).toContain('<span>Tokens</span>');
    expect(html).toContain('<span>Branch</span>');
    expect(html).toContain('<span>Input</span>');
    expect(html).toContain('<span>Output</span>');
    expect(html).toContain('<span>Trace</span>');
    expect(html).toContain('<span>Status</span>');
    expect(html).toContain('<span>Cost</span>');

    expect(html).not.toContain('Live tracing cockpit');
    expect(html).not.toContain('data-testid="trace-launcher"');
    expect(html).not.toContain('data-open-traces');
    expect(html).not.toContain('data-trace-modal');
    expect(html).not.toContain('data-inspector');
    expect(html).not.toContain('Trace scope');
    expect(html).not.toContain('Click any row');
    expect(html).not.toContain('Recent errors');
    expect(html).not.toContain('trace-rail');
    expect(html).not.toContain('Trace Burn Intelligence');
  });

  it('hydrates backlog and live rows through authenticated same-origin gateway routes', () => {
    const html = buildObservabilityTracesSite();

    expect(html).toContain('/gateway/traces/recent');
    expect(html).toContain('/gateway/traces/events');
    expect(html).toContain('new EventSource');
    expect(html).toContain("credentials: 'same-origin'");
    expect(html).toContain('stableTraceKey');
    expect(html).toContain('data-live-state');
    expect(html).not.toContain('localhost');
    expect(html).not.toContain('127.0.0.1');
  });

  it('keeps the table private and dependency-free in the browser', () => {
    const html = buildObservabilityTracesSite();

    expect(html).not.toContain('cdn.jsdelivr.net');
    expect(html).not.toContain('<script src="https://');
    expect(html).not.toContain('ReactDOM');
    expect(html).not.toMatch(/https?:\/\/(?:localhost|127\.0\.0\.1|100\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/);
  });

  it('keeps the Astro source aligned to the same direct table product model', () => {
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../../consuelo-website/src/pages/os/observability/traces.astro'),
      'utf8',
    );

    expect(source).toContain('Traces - Observability');
    expect(source).toContain('/observability/traces');
    expect(source).toContain('/gateway/traces/recent');
    expect(source).toContain('/gateway/traces/events');
    expect(source).toContain('Search traces...');
    expect(source).not.toContain('data-trace-modal');
    expect(source).not.toContain('data-inspector');
    expect(source).not.toContain('Live tracing cockpit');
    expect(source).not.toContain('Trace Burn Intelligence');
    expect(source).not.toContain('cdn.jsdelivr.net');
    expect(source).not.toMatch(/ReactDOM/);
  });
});
