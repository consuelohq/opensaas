import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createConnectorOriginHostname,
  createConnectorOriginHostnameRegexSource,
  isConnectorOriginHostname,
} from '../scripts/lib/connector-origin-hostname';

const listSourceFiles = (root: string): string[] => {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(path));
      continue;
    }
    if (/\.(?:[cm]?[jt]s|tsx)$/.test(entry.name)) files.push(path);
  }
  return files;
};

describe('connector origin hostname', () => {
  it('derives a deterministic opaque first-level hostname from a stable connector id', () => {
    const input = {
      connectorId: 'connector_123',
      baseDomain: 'https://ConsueloHQ.com/',
    };

    expect(createConnectorOriginHostname(input)).toBe(
      'c-ad94b888d3062f30e27d571fdeb3d6f4.consuelohq.com',
    );
    expect(createConnectorOriginHostname(input)).toBe(
      createConnectorOriginHostname(input),
    );
  });

  it('produces distinct DNS-safe hostnames without exposing connector or customer text', () => {
    const first = createConnectorOriginHostname({
      connectorId: 'connector_testing45_78_customer_name',
      baseDomain: 'consuelohq.com',
    });
    const second = createConnectorOriginHostname({
      connectorId: 'connector_testing45_79_customer_name',
      baseDomain: 'consuelohq.com',
    });
    const label = first.split('.')[0] ?? '';

    expect(first).not.toBe(second);
    expect(first).toBe(first.toLowerCase());
    expect(label).toMatch(/^c-[0-9a-f]{32}$/);
    expect(label.length).toBeLessThanOrEqual(63);
    expect(first.length).toBeLessThanOrEqual(253);
    expect(first.split('.')).toHaveLength('consuelohq.com'.split('.').length + 1);
    expect(first).not.toMatch(/testing45|customer|connector|name/i);
  });

  it('recognizes only the canonical internal connector hostname class', () => {
    const hostname = createConnectorOriginHostname({
      connectorId: 'connector_123',
      baseDomain: 'consuelohq.com',
    });
    const regexSource = createConnectorOriginHostnameRegexSource({
      baseDomain: 'consuelohq.com',
    });

    expect(regexSource).toBe(
      '^c-[0-9a-f]{32}\\.consuelohq\\.com$',
    );
    expect(isConnectorOriginHostname({ hostname, baseDomain: 'consuelohq.com' })).toBe(true);
    expect(
      isConnectorOriginHostname({
        hostname: hostname.toUpperCase(),
        baseDomain: 'consuelohq.com',
      }),
    ).toBe(true);
    expect(
      isConnectorOriginHostname({
        hostname: 'c-customer.consuelohq.com',
        baseDomain: 'consuelohq.com',
      }),
    ).toBe(false);
    expect(
      isConnectorOriginHostname({
        hostname: 'c-' + 'g'.repeat(32) + '.consuelohq.com',
        baseDomain: 'consuelohq.com',
      }),
    ).toBe(false);
    expect(
      isConnectorOriginHostname({
        hostname: 'c-' + 'a'.repeat(32) + '.nested.consuelohq.com',
        baseDomain: 'consuelohq.com',
      }),
    ).toBe(false);
  });

  it.each([
    { connectorId: '', baseDomain: 'consuelohq.com' },
    { connectorId: 'connector id', baseDomain: 'consuelohq.com' },
    { connectorId: 'connector/id', baseDomain: 'consuelohq.com' },
    { connectorId: 'x'.repeat(256), baseDomain: 'consuelohq.com' },
    { connectorId: 'connector_123', baseDomain: '' },
    { connectorId: 'connector_123', baseDomain: 'localhost' },
    { connectorId: 'connector_123', baseDomain: 'consuelohq.com/path' },
    { connectorId: 'connector_123', baseDomain: 'consuelohq.com:443' },
    { connectorId: 'connector_123', baseDomain: '-consuelo.com' },
    { connectorId: 'connector_123', baseDomain: 'consuelo..com' },
    { connectorId: 'connector_123', baseDomain: 'a'.repeat(64) + '.com' },
    {
      connectorId: 'connector_123',
      baseDomain: [
        'a'.repeat(63),
        'b'.repeat(63),
        'c'.repeat(63),
        'd'.repeat(23),
        'com',
      ].join('.'),
    },
  ])('fails closed for invalid connector or base-domain input %#', (input) => {
    expect(() => createConnectorOriginHostname(input)).toThrow();
  });

  it('prevents production code from generating the retired nested origin class', () => {
    const packageRoot = process.cwd();
    const roots = [join(packageRoot, 'scripts'), join(packageRoot, 'cloudflare')];
    const violations = roots.flatMap((root) =>
      listSourceFiles(root).flatMap((path) => {
        const source = readFileSync(path, 'utf8');
        return source.includes('.os-origin.')
          ? [relative(packageRoot, path)]
          : [];
      }),
    );

    expect(violations).toEqual([]);
  });
});
