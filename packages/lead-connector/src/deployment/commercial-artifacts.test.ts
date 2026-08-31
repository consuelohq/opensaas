import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createLeadConnectorCustomMenu } from './custom-menu';

const read = (path: string): string => readFileSync(path, 'utf8');
const packageRoot = join(import.meta.dir, '..', '..');
const repoRoot = join(packageRoot, '..', '..');
const fromPackage = (...parts: string[]): string => join(packageRoot, ...parts);
const fromRepo = (...parts: string[]): string => join(repoRoot, ...parts);

describe('commercial deployment artifacts', () => {
  it('installs an admin-only GHL menu at /admin with microphone permission', () => {
    expect(
      createLeadConnectorCustomMenu({
        embedUrl: 'https://dialer.example.com',
        locationId: 'location-one',
      }),
    ).toEqual(
      expect.objectContaining({
        url: 'https://dialer.example.com/admin',
        openMode: 'iframe',
        userRole: 'admin',
        allowMicrophone: true,
        allowCamera: false,
      }),
    );
  });

  it('builds independently versioned marketplace JavaScript and CSS artifacts', () => {
    const build = read(fromPackage('scripts', 'build-embed.ts'));

    expect(build).toContain('marketplace');
    expect(build).toContain('javascript');
    expect(build).toContain('css');
    expect(build).toContain('build-marker');
  });

  it('centers a responsive modal backdrop while preserving a stable native launcher', () => {
    const css = read(
      fromPackage('src', 'embed', 'public', 'consuelo-lead-connector-click-to-call.css'),
    );
    const javascript = read(
      fromPackage('src', 'embed', 'public', 'consuelo-lead-connector-click-to-call.js'),
    );

    expect(css).toContain('position: fixed');
    expect(css).toContain('inset: 0');
    expect(css).toContain('align-items: center');
    expect(css).toContain('justify-content: center');
    expect(css).toContain('84vh');
    expect(css).toContain('clamp(');
    expect(javascript).toContain('consuelo-dialer-launcher');
    expect(javascript).toContain('tb_lists');
    expect(javascript).toContain('view-label');
  });

  it('removes obsolete metering workspace and build references', () => {
    const candidates = [
      'package.json',
      'eslint.config.mjs',
      'packages/os/scripts/artifacts-design.ts',
      'packages/twenty-docker/twenty/Dockerfile',
      'packages/twenty-docker/twenty/Dockerfile.worker',
    ];

    for (const path of candidates) {
      expect(read(fromRepo(path))).not.toContain('packages/metering');
      expect(read(fromRepo(path))).not.toContain('@consuelo/metering');
    }
    expect(existsSync(fromRepo('packages', 'metering', 'package.json'))).toBe(false);
    expect(existsSync(fromRepo('scripts', 'run-dev-1024.sh'))).toBe(false);
    expect(read(fromRepo('yarn.lock'))).not.toContain('@consuelo/metering');
  });
});
