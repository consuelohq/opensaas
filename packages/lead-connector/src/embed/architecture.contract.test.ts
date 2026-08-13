import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const temporaryDirectories: string[] = [];
const embedRoot = import.meta.dir;
const packageRoot = join(embedRoot, '..', '..');
const publicRoot = join(embedRoot, 'public');
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

const forbiddenArchitecture =
  /(?:twenty|recoil|nestjs|graphql|node:|from ['"]effect['"]|client.?secret|token.?cipher|webhook.?secret)/i;
const forbiddenBundledServerMarkers = [
  '@consuelo/dialer',
  "from 'twilio'",
  'TWILIO_AUTH_TOKEN',
  'TWILIO_API_SECRET',
  'TWILIO_TWIML_APP_SID',
  'TWILIO_ACCOUNT_SID',
];
const forbiddenBranding = /(?:\bGHL\b|GoHighLevel|HighLevel)/i;
const allowedProviderWireOrigins = [
  'https://app.gohighlevel.com',
  'https://*.twilio.com',
  'wss://*.twilio.com',
];

const stripAllowedProviderWireOrigins = (text: string): string => {
  let scanned = text;
  for (const origin of allowedProviderWireOrigins) {
    scanned = scanned.replaceAll(origin, 'https://provider-shell.example');
  }
  return scanned;
};

describe('LeadConnector browser architecture and branding', () => {
  it('contains no forbidden branding or server/runtime dependencies in browser source and public assets', () => {
    const files = readdirSync(embedRoot, {
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
        join(embedRoot, relativePath),
        'utf8',
      );
      const scanned = stripAllowedProviderWireOrigins(text);
      expect(scanned).not.toMatch(forbiddenArchitecture);
      expect(scanned).not.toMatch(forbiddenBranding);
      if (relativePath !== 'agent-voice.ts') {
        expect(scanned).not.toMatch(/twilio/i);
      } else {
        expect(scanned).toContain("from '@twilio/voice-sdk'");
        expect(scanned).not.toContain("from 'twilio'");
      }
    }
    const asset = readFileSync(
      join(publicRoot, 'consuelo-lead-connector-click-to-call.js'),
      'utf8',
    );
    expect(asset).not.toMatch(forbiddenBranding);
  });

  it('builds a browser-only bundle without forbidden dependencies or branding', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'lead-connector-embed-'));
    temporaryDirectories.push(directory);
    const result = await Bun.build({
      entrypoints: [join(embedRoot, 'main.ts')],
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
      for (const marker of forbiddenBundledServerMarkers) {
        expect(scanned).not.toContain(marker);
      }
      if (relativePath.endsWith('.js')) {
        expect(scanned).toContain('SessionId');
      }
    }
    expect(
      readFileSync(join(embedRoot, 'index.html'), 'utf8'),
    ).toContain('href="./main.css"');
  });

  it('targets the actual approved live or sandbox custom-page origin for click-to-call messages', () => {
    const asset = readFileSync(
      join(publicRoot, 'consuelo-lead-connector-click-to-call.js'),
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
      join(publicRoot, 'consuelo-lead-connector-click-to-call.js'),
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

  it('authenticates the overlay through the supported Custom JS session context API', () => {
    const asset = readFileSync(
      join(publicRoot, 'consuelo-lead-connector-click-to-call.js'),
      'utf8',
    );

    expect(asset).toContain("var appId = '690cbca9af44827eb89887b1'");
    expect(asset).toContain('window.exposeSessionDetails');
    expect(asset).toContain('function loadSessionContext');
    expect(asset).toContain("message: 'REQUEST_USER_DATA_RESPONSE'");
    expect(asset).toContain('payload: encryptedData');
    expect(asset).not.toContain('console.log');
  });

  it('anchors the launcher beside native Contacts and Opportunities controls', () => {
    const asset = readFileSync(
      join(publicRoot, 'consuelo-lead-connector-click-to-call.js'),
      'utf8',
    );
    const stylesheet = readFileSync(
      join(publicRoot, 'consuelo-lead-connector-click-to-call.css'),
      'utf8',
    );

    expect(asset).toContain('function findLauncherAnchor');
    expect(asset).toContain("document.getElementById('tb_lists')");
    expect(asset).toContain("document.getElementById('tb_opportunities-tab')");
    expect(asset).toContain('function placeLauncher');
    expect(asset).toContain("insertAdjacentElement('afterend', launcher)");
    expect(stylesheet).not.toContain('left: 248px');
    expect(stylesheet).toContain('right: 24px');
  });

  it('publishes a separate wrapped Marketplace artifact while keeping the public script executable', () => {
    const asset = readFileSync(
      join(publicRoot, 'consuelo-lead-connector-click-to-call.js'),
      'utf8',
    );
    const buildSource = readFileSync(
      join(packageRoot, 'scripts', 'build-embed.ts'),
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
      join(publicRoot, 'consuelo-lead-connector-click-to-call.js'),
      'utf8',
    );
    const createHostStart = asset.indexOf('function createOverlayHost');
    const ensureFrameStart = asset.indexOf('function ensureOverlayFrame');
    const openOverlayStart = asset.indexOf('function openOverlay');
    const targetContextStart = asset.indexOf('function targetContext');
    const syncRouteStart = asset.indexOf('function syncRoute');
    const messageHandlerStart = asset.indexOf(
      "window.addEventListener('message'",
    );

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
      join(publicRoot, 'consuelo-lead-connector-click-to-call.js'),
      'utf8',
    );
    const selectorLiterals = [
      ...asset.matchAll(/(['"])([^'"\n]*\[[^'"\n]*,[^'"\n]*)\1/g),
    ].map((match) => match[2]);
    expect(selectorLiterals.every((literal) => literal.length <= 50)).toBe(
      true,
    );
  });

  it('wires progressive commercial billing forms and confirmation actions to the controller', () => {
    const source = readFileSync(join(embedRoot, 'main.ts'), 'utf8');
    expect(source).toContain(
      "form.dataset.form === 'commercial-billing-checkout'",
    );
    expect(source).toContain(
      "form.dataset.form === 'commercial-billing-change'",
    );
    expect(source).toContain('controller.previewBillingChange(quantities)');
    expect(source).toContain("action === 'apply-billing-change'");
    expect(source).toContain('controller.applyBillingChange({');
    expect(source).toContain("action === 'cancel-billing-preview'");
    expect(source).toContain('controller.clearBillingPreview()');
  });

  it('restarts the trusted parent bootstrap exchange when authentication is retried', () => {
    const source = readFileSync(
      join(embedRoot, 'main.ts'),
      'utf8',
    );
    expect(source).toContain("if (action === 'retry') {");
    expect(source).toContain('bridge.requestUserContext();');
  });
});
