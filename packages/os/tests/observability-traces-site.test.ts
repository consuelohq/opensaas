import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildObservabilityTracesSite } from '../scripts/lib/observability-traces-site';

const canonicalAssetDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../assets/vendor/observability-traces-v38',
);

const assetHash = (name: string) =>
  createHash('sha256')
    .update(readFileSync(resolve(canonicalAssetDir, name)))
    .digest('hex');

describe('Observability Traces canonical Trace Burn surface', () => {
  it('renders the established v38 table shell instead of the Observability cockpit reimplementation', () => {
    const html = buildObservabilityTracesSite();

    expect(html).toContain('<title>Trace Burn Intelligence</title>');
    expect(html).toContain('class="trxShell closed"');
    expect(html).toContain('data-trace-shell');
    expect(html).toContain('data-trace-rows');
    expect(html).toContain('data-inspector');
    expect(html).toContain('data-show-filters');
    expect(html).toContain('data-trace-count');
    expect(html).toContain(
      '<div class="trxHead"><div></div><div>Time</div><div>Tool</div><div>Latency</div><div>Tokens</div><div>Branch</div><div>Input</div><div>Output</div><div>Trace</div><div>Status</div><div>Cost</div></div>',
    );

    expect(html).not.toContain('Live tracing cockpit');
    expect(html).not.toContain('Search traces...');
    expect(html).not.toContain('Rows per page');
    expect(html).not.toContain('Page 1 of');
    expect(html).not.toContain('Recent errors');
    expect(html).not.toContain('class="kpis"');
    expect(html).not.toContain('class="hero"');
  });

  it('uses the exact v38 interaction assets with only same-origin gateway transport', () => {
    const html = buildObservabilityTracesSite();

    expect(html).toContain('trace-overview-polish-v22');
    expect(html).toContain('consuelo-trace-inspector-bootstrap');
    expect(html).toContain('consuelo-trace-history-transport');
    expect(html).toContain('/gateway/traces/recent');
    expect(html).toContain("credentials:'same-origin'");
    expect(html).toContain('includeRawPayload');
    expect(html).toContain('installTracePaginationTransport');
    expect(html).toContain('installLivePolling');
    expect(html).toContain('traceLiveUrl');

    expect(html).not.toContain('/trace-burn-intelligence/_astro/');
    expect(html).not.toContain('<script src="https://');
    expect(html).not.toContain('cdn.jsdelivr.net');
  });

  it('ships no serialized trace backlog or private network origin in the static snapshot', () => {
    const html = buildObservabilityTracesSite();
    const seed = /<script[^>]*id="trace-seed-data"[^>]*>([\s\S]*?)<\/script>/i.exec(html)?.[1];

    expect(seed).toBeDefined();
    expect(JSON.parse(seed ?? '{}')).toMatchObject({ rows: [], failures: [] });
    expect(html).not.toContain('localhost');
    expect(html).not.toContain('127.0.0.1');
    expect(html).not.toMatch(/\b100\.(?:[6-9]\d|1[01]\d|12[0-7])(?:\.\d{1,3}){2}\b/);
    expect(html).not.toMatch(/\b10(?:\.\d{1,3}){3}\b/);
    expect(html).not.toMatch(/\b192\.168(?:\.\d{1,3}){2}\b/);
    expect(html).not.toMatch(/\bc-[a-f0-9]+\.consuelohq\.com\b/i);
    expect(html).not.toMatch(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/i);
  });

  it('keeps the copied v38 shell and built interaction assets byte-identical to the proven local version', () => {
    expect(assetHash('template.html')).toBe(
      '07ac31363ae72831ae79b3785e65630b1e67ee0eee1542acb93a2f56c005bda7',
    );
    expect(assetHash('base.css')).toBe(
      '5115930cfadcbcefc00cabe3ef870a0c719ec9accef439678daa2a097b5ba295',
    );
    expect(assetHash('mobile.css')).toBe(
      'dda1c35064cc31c86bce73a4114031ae779957b2071f1ed9fde6ea8f3618fbad',
    );
    expect(assetHash('inspector.css')).toBe(
      'e01968c5feb6e52ac5aa95e30cc2eebf55f827f0a0ea3f72b7272348894ce751',
    );
    expect(assetHash('table-overview.js')).toBe(
      'a43187999737a2545d2248d93f1aebb29ffee5c4900a6fa64fab2c942339547f',
    );
    expect(assetHash('gsap.js')).toBe(
      '92bb9a96476f983d212a2bc4f54c889039c1696dd4461d40a736860938570fbb',
    );
    expect(assetHash('scroll.js')).toBe(
      '8e0d8d1827ce101fee60b046400b32333d0c4f558875eeec88d629c9b9010e4c',
    );
    expect(assetHash('inspector.js')).toBe(
      '6b3897d2db5171cec4445d7b9f515a51e7bc871cd706bd1f3eea7cfaa36c7489',
    );
  });
});
