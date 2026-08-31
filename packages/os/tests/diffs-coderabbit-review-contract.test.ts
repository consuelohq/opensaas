import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('CodeRabbit Diffs review contracts', () => {
  it('keeps the source-control POST body read inside the route error boundary', () => {
    const text = source('scripts/server/routes/settings.ts');
    const start = text.indexOf("app.post('/gateway/configuration/source-control'");
    const end = text.indexOf("for (const route of SNAPSHOT_ROUTES)", start);
    const block = text.slice(start, end);
    expect(block.indexOf('try {')).toBeGreaterThanOrEqual(0);
    expect(block.indexOf('try {')).toBeLessThan(block.indexOf('const body = await request.clone().text();'));
  });

  it('uses generic public source-control validation messages', () => {
    const settingsRoutes = source('scripts/server/routes/settings.ts');
    const sitesGateway = source('scripts/lib/settings-sites-gateway-endpoints.ts');
    expect(settingsRoutes).toContain("message: 'Source-control configuration is invalid.'");
    expect(sitesGateway).toContain("message: 'Source-control configuration is invalid.'");
    expect(sitesGateway).toContain("message: 'Source-control configuration is unavailable.'");
  });

  it('uses named nested Diffs path parameters', () => {
    const routes = source('scripts/server/routes/diffs.ts');
    expect(routes).toContain("tree/:ref/:path{.*}");
    expect(routes).toContain("history/:ref/:path{.*}");
    expect(routes).toContain("context.req.param('path')");
    expect(routes).not.toContain("context.req.param('*')");
  });

  it('bounds the Diffs read cache and times out GitHub mutation requests', () => {
    const service = source('scripts/server/services/diffs-gateway.ts');
    expect(service).toContain('PRODUCT_READ_CACHE_MAX_ENTRIES');
    expect(service).toMatch(/productReadCache\.size\s*>=\s*PRODUCT_READ_CACHE_MAX_ENTRIES/);
    expect(service).toContain('GITHUB_MUTATION_TIMEOUT_MS');
    expect(service.match(/signal:\s*AbortSignal\.timeout\(GITHUB_MUTATION_TIMEOUT_MS\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
