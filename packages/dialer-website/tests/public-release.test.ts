import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { publicReleasePlan } from '../scripts/release-public-sites.mjs';

describe('public release phase boundaries', () => {
  it('preserves the legacy surfaces by default and mounts OS before the switch', () => {
    expect(publicReleasePlan('website', 'legacy').map((s) => s.name)).toEqual(['legacy-website']);
    expect(publicReleasePlan('docs', 'legacy').map((s) => s.name)).toEqual(['legacy-docs']);
    expect(publicReleasePlan('website', 'os-mounted').map((s) => s.name)).toEqual(['os-website']);
    expect(publicReleasePlan('docs', 'os-mounted').map((s) => s.name)).toEqual(['legacy-docs', 'os-docs']);
  });
  it('keeps OS mounts updated when Dialer owns the primary public domains', () => {
    expect(publicReleasePlan('website', 'dialer').map((s) => s.name)).toEqual(['os-website', 'dialer-website']);
    expect(publicReleasePlan('docs', 'dialer').map((s) => s.name)).toEqual(['legacy-docs', 'os-docs', 'dialer-docs']);
    for (const surface of ['website', 'docs']) for (const phase of ['legacy', 'os-mounted', 'dialer']) {
      for (const step of publicReleasePlan(surface, phase)) {
        expect(step.cwd).not.toContain('packages/os');
        expect(JSON.stringify(step)).not.toMatch(/device-authority|workspace-edge|migrate|railway|secret put/);
      }
    }
  });
  it('limits OS routing to the public namespaces and keeps previews route-free', () => {
    const root = resolve(import.meta.dir, '../../..');
    for (const [pkg, namespace] of [['consuelo-website', 'about'], ['documentation', 'docs']]) {
      const prod = JSON.parse(readFileSync(resolve(root, 'packages', pkg, 'wrangler.os.jsonc'), 'utf8'));
      const preview = JSON.parse(readFileSync(resolve(root, 'packages', pkg, 'wrangler.os-preview.jsonc'), 'utf8'));
      expect(prod.routes.map((r: { pattern: string }) => r.pattern)).toEqual([`os.consuelohq.com/${namespace}*`]);
      expect(prod).not.toHaveProperty('durable_objects');
      expect(prod).not.toHaveProperty('d1_databases');
      expect(prod).not.toHaveProperty('kv_namespaces');
      expect(preview.routes).toEqual([]);
      expect(preview.name).not.toBe(prod.name);
    }
  });
  it('fails closed for unknown phase or surface', () => {
    expect(() => publicReleasePlan('website', 'typo')).toThrow();
    expect(() => publicReleasePlan('os', 'dialer')).toThrow();
  });
});
