import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

const forbiddenArchitecture =
  /(?:twenty|recoil|nestjs|graphql|twilio|node:|from ['"]effect['"]|access.?token|refresh.?token|client.?secret|token.?cipher|webhook.?secret)/i;
const forbiddenBranding = /(?:\bGHL\b|GoHighLevel|HighLevel)/i;
const allowedProviderWireOrigins = ['https://app.gohighlevel.com'];

const stripAllowedProviderWireOrigins = (text: string): string => {
  let scanned = text;
  for (const origin of allowedProviderWireOrigins) {
    scanned = scanned.replaceAll(origin, 'https://provider-shell.example');
  }
  return scanned;
};

describe('LeadConnector browser architecture and branding', () => {
  it('contains no forbidden branding or server/runtime dependencies in browser source and public assets', () => {
    const files = readdirSync('packages/lead-connector/src/embed', {
      recursive: true,
      withFileTypes: false,
    })
      .map(String)
      .filter(
        (path) =>
          /\.(?:ts|css|html|js)$/.test(path) && !path.endsWith('.test.ts'),
      );
    expect(files.length).toBeGreaterThan(0);
    for (const relativePath of files) {
      const text = readFileSync(
        join('packages/lead-connector/src/embed', relativePath),
        'utf8',
      );
      const scanned = stripAllowedProviderWireOrigins(text);
      expect(scanned).not.toMatch(forbiddenArchitecture);
      expect(scanned).not.toMatch(forbiddenBranding);
    }
    const asset = readFileSync(
      'packages/lead-connector/src/embed/public/consuelo-lead-connector-click-to-call.js',
      'utf8',
    );
    expect(asset).not.toMatch(forbiddenBranding);
  });

  it('builds a browser-only bundle without forbidden dependencies or branding', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'lead-connector-embed-'));
    temporaryDirectories.push(directory);
    const result = await Bun.build({
      entrypoints: ['packages/lead-connector/src/embed/main.ts'],
      outdir: directory,
      target: 'browser',
      minify: true,
    });
    expect(result.success).toBe(true);
    const built = readdirSync(directory, {
      recursive: true,
      withFileTypes: false,
    })
      .map(String)
      .filter((path) => /\.(?:js|css)$/.test(path));
    expect(built.length).toBeGreaterThan(0);
    for (const relativePath of built) {
      const text = readFileSync(join(directory, relativePath), 'utf8');
      const scanned = stripAllowedProviderWireOrigins(text);
      expect(scanned).not.toMatch(forbiddenArchitecture);
      expect(scanned).not.toMatch(forbiddenBranding);
    }
    expect(
      readFileSync('packages/lead-connector/src/embed/index.html', 'utf8'),
    ).toContain('href="./main.css"');
  });

  it('targets the actual approved live or sandbox custom-page origin for click-to-call messages', () => {
    const asset = readFileSync(
      'packages/lead-connector/src/embed/public/consuelo-lead-connector-click-to-call.js',
      'utf8',
    );
    expect(asset).toContain('https://calls.consuelohq.com');
    expect(asset).toContain(
      'https://consuelo-lead-connector-embed.kokayi-90b.workers.dev',
    );
    expect(asset).toContain('approvedOrigins');
    expect(asset).toContain('postMessage(message, origin)');
    expect(asset).toContain('event.source !== frame.contentWindow');
    expect(asset).toContain('event.origin !== origin');
    expect(asset).not.toContain("postMessage(message, '*')");
  });

  it('owns one route-aware launcher and one compact overlay iframe lifecycle', () => {
    const asset = readFileSync(
      'packages/lead-connector/src/embed/public/consuelo-lead-connector-click-to-call.js',
      'utf8',
    );
    expect(asset).toContain("var overlayPath = '/overlay'");
    expect(asset).toContain("var launcherId = 'consuelo-dialer-launcher'");
    expect(asset).toContain("var hostId = 'consuelo-dialer-overlay-host'");
    expect(asset).toContain('name="consuelo-dialer"');
    expect(asset).toContain('function routeAllowed');
    expect(asset).toContain("'/opportunities'");
    expect(asset).toContain("'/contacts'");
    expect(asset).toContain('function openOverlay');
    expect(asset).toContain('function minimizeOverlay');
    expect(asset).toContain('function closeOverlay');
    expect(asset).toContain('function syncRoute');
    expect(asset).not.toContain("postMessage(message, '*')");
  });

  it('publishes a separate wrapped Marketplace artifact while keeping the public script executable', () => {
    const asset = readFileSync(
      'packages/lead-connector/src/embed/public/consuelo-lead-connector-click-to-call.js',
      'utf8',
    );
    const buildSource = readFileSync(
      'packages/lead-connector/scripts/build-embed.ts',
      'utf8',
    );

    expect(() => new Function(asset)).not.toThrow();
    expect(asset).not.toContain('<script');
    expect(buildSource).toContain(
      'consuelo-lead-connector-click-to-call.marketplace.html',
    );
    expect(buildSource).toContain('<script>');
    expect(buildSource).toContain('</script>');
  });

  it('creates the iframe on demand and preserves a busy session across route changes', () => {
    const asset = readFileSync(
      'packages/lead-connector/src/embed/public/consuelo-lead-connector-click-to-call.js',
      'utf8',
    );
    const createHostStart = asset.indexOf('function createOverlayHost');
    const ensureFrameStart = asset.indexOf('function ensureOverlayFrame');
    const openOverlayStart = asset.indexOf('function openOverlay');
    const targetContextStart = asset.indexOf('function targetContext');
    const syncRouteStart = asset.indexOf('function syncRoute');
    const messageHandlerStart = asset.indexOf("window.addEventListener('message'");

    expect(createHostStart).toBeGreaterThan(-1);
    expect(ensureFrameStart).toBeGreaterThan(createHostStart);
    expect(openOverlayStart).toBeGreaterThan(ensureFrameStart);
    expect(targetContextStart).toBeGreaterThan(openOverlayStart);
    expect(syncRouteStart).toBeGreaterThan(-1);
    expect(messageHandlerStart).toBeGreaterThan(syncRouteStart);

    expect(asset.slice(createHostStart, ensureFrameStart)).not.toContain(
      '<iframe',
    );
    expect(asset.slice(ensureFrameStart, openOverlayStart)).toContain(
      '<iframe name="consuelo-dialer"',
    );
    expect(asset.slice(openOverlayStart, targetContextStart)).toContain(
      'ensureOverlayFrame()',
    );
    expect(asset).toContain('var busy = false');
    expect(asset.slice(syncRouteStart, messageHandlerStart)).toContain(
      'if (busy && document.getElementById(hostId))',
    );
    expect(asset).toContain('busy = true');
    expect(asset).toContain('busy = false');
  });

  it('keeps comma-separated selector literals safe for Marketplace editor persistence', () => {
    const asset = readFileSync(
      'packages/lead-connector/src/embed/public/consuelo-lead-connector-click-to-call.js',
      'utf8',
    );
    const selectorLiterals = [
      ...asset.matchAll(/(['"])([^'"\n]*\[[^'"\n]*,[^'"\n]*)\1/g),
    ].map((match) => match[2]);
    expect(selectorLiterals.length).toBeGreaterThan(0);
    expect(
      Math.max(...selectorLiterals.map((literal) => literal.length)),
    ).toBeLessThanOrEqual(50);
  });

  it('restarts the trusted parent bootstrap exchange when authentication is retried', () => {
    const source = readFileSync(
      'packages/lead-connector/src/embed/main.ts',
      'utf8',
    );
    expect(source).toContain("if (action === 'retry') {");
    expect(source).toContain('bridge.requestUserContext();');
  });
});
