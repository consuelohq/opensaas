import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { describe, expect, test } from 'bun:test';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const callbackPath = join(
  packageRoot,
  'src/pages/calls/api/integrations/oauth/callback.astro',
);

const readCallbackSource = () => readFile(callbackPath, 'utf8');

describe('LeadConnector OAuth callback compatibility route', () => {
  test('forwards the untouched browser query string to the canonical Worker callback', async () => {
    const source = await readCallbackSource();

    expect(source).toContain(
      'https://consuelo-lead-connector-embed.kokayi-90b.workers.dev/v1/integrations/leadconnector/callback',
    );
    expect(source).toContain('window.location.search');
    expect(source).toContain('target.search = window.location.search');
    expect(source).toContain('window.location.replace(target.toString())');
  });

  test('executes the redirect with synthetic parameters without parsing them', async () => {
    const source = await readCallbackSource();
    const script = source.match(/<script is:inline>([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeTruthy();

    let replacedUrl = null;
    vm.runInNewContext(script, {
      URL,
      window: {
        location: {
          search: '?sample=alpha&next=beta%20gamma',
          replace: (url) => {
            replacedUrl = url;
          },
        },
      },
    });

    expect(replacedUrl).toBe(
      'https://consuelo-lead-connector-embed.kokayi-90b.workers.dev/v1/integrations/leadconnector/callback?sample=alpha&next=beta%20gamma',
    );
  });

  test('does not render, log, or persist OAuth parameters', async () => {
    const source = await readCallbackSource();

    expect(source).toContain('name="referrer" content="no-referrer"');
    expect(source).toContain('name="robots" content="noindex,nofollow"');
    expect(source).not.toMatch(/console\./);
    expect(source).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
    expect(source).not.toMatch(/searchParams\.get\(['"](?:code|state)['"]\)/);
    expect(source).not.toMatch(/textContent\s*=.*(?:code|state)/i);
  });
});
