import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('interactive GHL Dialer demo', () => {
  it('replaces the placeholder with a real ungated, source-derived workspace', () => {
    const page = read('src/pages/demo.astro');
    expect(page).toContain('src="/demo/workspace/"');
    expect(page).toContain('title="Interactive Consuelo Dialer"');
    expect(page).not.toContain('guided walkthrough is being prepared');
    expect(page).toContain('href="/pricing"');
  });

  it('uses the production embed renderer and state machine, not generic mock screenshots', () => {
    expect(existsSync(resolve(root, 'src/pages/demo/workspace.astro'))).toBe(true);
    const simulator = read('src/scripts/demo/dialer-simulator.ts');
    expect(simulator).toContain('renderLeadConnectorEmbed');
    expect(simulator).toContain('createInitialEmbedState');
    expect(simulator).toContain('reduceEmbedState');
    expect(simulator).toContain('simulation');
  });

  it('includes offline outbound, inbound, outcome and Mercury flows without backend requests', () => {
    const simulator = read('src/scripts/demo/dialer-simulator.ts');
    expect(simulator).toContain('inbound-readiness');
    expect(simulator).toContain('inbound-accept');
    expect(simulator).toContain("form.dataset.form === 'disposition'");
    expect(simulator).toContain('script-next');
    expect(simulator).toContain('workspace-call-options');
    expect(simulator).not.toMatch(/\bfetch\s*\(|new\s+WebSocket\s*\(|XMLHttpRequest|createLeadConnectorEmbedApi|Twilio\.Device/);
  });

  it('identifies fictional data and disables outbound network in a contained frame', () => {
    const stage = read('src/pages/demo/workspace.astro');
    expect(stage).toContain('connect-src \'none\'');
    expect(stage).toContain('All people and calls are simulated');
    expect(stage).toContain('content="noindex,nofollow"');
    expect(stage).toContain('data-demo-dialer');
    expect(read('astro.config.mjs')).toContain("!pathname.startsWith('/demo/workspace/')");
  });

  it('derives exact first-party fonts and logo at build time without committing binary sources', () => {
    const materializer = read('scripts/materialize-public-assets.ts');
    expect(materializer).toContain('lead-connector/src/embed/public');
    expect(materializer).toContain("font + '.woff2.base64'");
    expect(materializer).toContain("data.toString('ascii', 0, 4) !== 'wOF2'");
    expect(read('.gitignore')).toContain('/public/demo/assets/');
  });

  it('launches the browser demo regression on Linux CI as well as macOS', () => {
    const browserTest = read('scripts/test-demo-browser.mjs');
    expect(browserTest).toContain('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH');
    expect(browserTest).toContain('/usr/bin/google-chrome');
    expect(browserTest).toContain('find((path) => existsSync(path))');
  });
});
