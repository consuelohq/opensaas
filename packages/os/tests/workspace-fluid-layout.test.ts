import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { workspaceWindowShellStyles, renderWorkspaceChromeBar } from '../scripts/lib/workspace-chrome';
import { buildObservabilityTracesSite } from '../scripts/lib/observability-traces-site';
import { publishArtifact } from '../scripts/lib/artifacts';

describe('shared workspace full-bleed layout', () => {
  it('retains the mac-style chrome while eliminating tablet and touch-screen gutters', () => {
    const shell = workspaceWindowShellStyles();
    expect(shell).toContain('padding: 14px'); // desktop window frame
    expect(shell).toContain('min-height: calc(100dvh - 28px)');
    expect(shell).toContain('@media (max-width: 1200px), (any-pointer: coarse)');
    expect(shell).toContain('width: 100vw; min-height: 100dvh; border: 0; border-radius: 0;');
    const chrome = renderWorkspaceChromeBar('artifacts', 'School');
    expect(chrome).toContain('data-workspace-route-trigger');
    expect(chrome).toContain('href="/configuration"');
    expect(chrome).toContain('aria-current="page" href="/artifacts"');
  });

  it('renders the Artifacts archive as full-width unboxed rows, not a card gallery', () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-fluid-artifacts-'));
    try {
      const source = join(home, 'seed.html');
      writeFileSync(source, '<!doctype html><html><body>Seed</body></html>');
      publishArtifact({ home, target: source, path: '/fluid', title: 'Fluid', category: 'school', now: '2026-10-28T00:00:00.000Z' });
      const page = readFileSync(join(home, 'sites', 'artifacts', 'index.html'), 'utf8');
      expect(page).toContain('.shell { width:100%; max-width:none;');
      expect(page).toContain('.post-list { display:grid; grid-template-columns:1fr;');
      expect(page).toContain('.post-item { display:grid;');
      expect(page).toContain('data-artifact-row');
      expect(page).toContain('.post-item:hover { background: transparent; }');
      expect(page).not.toContain('grid-template-columns:repeat(auto-fit, minmax(min(100%, 300px), 1fr))');
      expect(page).toContain('<picture class="brand-mark">');
      const lightSrc = page.match(/<img data-consuelo-logo src="data:image\/png;base64,([^"]+)"/)?.[1];
      const darkSrc = page.match(/<source media="\(prefers-color-scheme: dark\)" srcset="data:image\/png;base64,([^"]+)"/)?.[1];
      for (const source of [lightSrc, darkSrc]) {
        expect(source).toBeTruthy();
        expect(Buffer.from(source!, 'base64').subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      }
      expect(page).toContain('href="/artifacts/fluid"');
      expect(page).toContain('data-share-artifact');
      expect(page).toContain('data-workspace-chrome');
    } finally { rmSync(home, {recursive:true,force:true}); }
  });

  it('fills an iPad Tracing modal without applying the phone-only table layout', () => {
    const html = buildObservabilityTracesSite();
    expect(html).toContain('@media (max-width: 1200px), (any-pointer: coarse) {');
    expect(html).toContain('#tbmLiveTraceModal[aria-hidden="false"] .trxShell{width:100vw!important;max-width:100vw!important;height:100dvh!important;');
    expect(html).toContain('#tbmLiveTraceModal .trxTableScroll{width:100%!important;max-width:100%!important;');
  });
});
