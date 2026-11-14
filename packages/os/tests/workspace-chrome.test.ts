import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { describe, expect, it } from 'vitest';

import { renderWorkspaceChromeBar, workspaceChromeClientScript } from '../scripts/lib/workspace-chrome';

const browserTest = existsSync(chromium.executablePath()) ? it : it.skip;

browserTest('reserves bare and Option+number for user hotkeys; navigates only with Ctrl+Shift+number', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const html = '<!doctype html><html><body>' +
      renderWorkspaceChromeBar('overview', 'Home', {
        extraSections: [{ id: 'custom', label: 'Custom', links: [{ label: 'Journal', href: '/journal' }] }],
      }) +
      '<input id="editing" aria-label="Editing">' +
      '<script>' + workspaceChromeClientScript() + '</script></body></html>';
    await page.route('**/*', (route) => {
      if (new URL(route.request().url()).pathname === '/configuration') {
        return route.fulfill({ contentType: 'text/html', body: html });
      }
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Destination</title>' });
    });
    await page.goto('https://internal.consuelohq.com/configuration');
    const expected = await page.locator('[data-workspace-route-menu] a[href]').evaluateAll(
      (links) => links.slice(0, 10).map((link) => link.querySelector('span')?.textContent?.trim()),
    );
    expect(expected.slice(0, 6)).toEqual(['Home', 'Tracing', 'Artifacts', 'Code', 'Journal', 'Users & installs']);
    await page.locator('#editing').focus();
    await page.keyboard.press('2');
    expect(page.url()).toBe('https://internal.consuelohq.com/configuration');
    expect(await page.locator('#editing').inputValue()).toBe('2');
    await page.locator('#editing').blur();
    await page.keyboard.press('Shift+/');
    const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await dialog.waitFor({ state: 'visible' });
    expect(await dialog.textContent()).toContain('Journal');
    expect(await dialog.textContent()).toContain('Users & installs');
    await page.keyboard.press('Escape');
    expect(await dialog.count()).toBe(0);
    await page.keyboard.press('5');
    expect(page.url()).toBe('https://internal.consuelohq.com/configuration');
    await page.keyboard.press('Alt+0');
    expect(page.url()).toBe('https://internal.consuelohq.com/configuration');
    await page.keyboard.press('Control+Shift+Digit5');
    await page.waitForURL('**/journal');
  } finally {
    await browser.close();
  }
}, 25000);

it('registers the contextual trace shortcuts independently from universal route navigation', () => {
  const chrome = workspaceChromeClientScript();
  expect(chrome).toContain('dialog.dataset.workspaceShortcutsDialog');
  expect(chrome).toContain('data-workspace-shortcuts');
  expect(chrome).toContain('event.isComposing');
  expect(chrome).toContain('data-workspace-route-menu');
});

describe('workspace chrome custom routes', () => {
  it('adds the private users shortcut only on the internal host when the menu does not already contain it', () => {
    const client = workspaceChromeClientScript();

    expect(client).toContain("const INTERNAL_WORKSPACE_HOST = 'internal.consuelohq.com';");
    expect(client).toContain("const INTERNAL_USERS_ROUTE = '/users';");
    expect(client).toContain("window.location.hostname.toLowerCase() !== INTERNAL_WORKSPACE_HOST");
    expect(client).toContain("[data-workspace-internal-route]");
    expect(client).toContain("[data-private-route-return-to=\"/users\"]");
    expect(client).toContain("section.dataset.customRouteGroup = 'internal'");
    expect(client).toContain("link.dataset.privateRouteHost = INTERNAL_WORKSPACE_HOST");
    expect(client).toContain("link.dataset.privateRouteReturnTo = INTERNAL_USERS_ROUTE");
    expect(client).toContain("link.setAttribute('data-workspace-internal-route', '')");
    expect(client).toContain("label.textContent = 'Users & installs'");
  });

  it('renders validated launcher sections in the current route menu and turns the private dashboard link into a same-origin handoff', () => {
    const html = renderWorkspaceChromeBar('overview', 'Home', {
      extraSections: [
        {
          id: 'internal',
          label: 'Internal <ops>',
          links: [
            {
              label: 'Users & installs',
              href: 'https://internal.consuelohq.com/users?view=recent',
            },
          ],
        },
      ],
    });

    expect(html).toContain('data-custom-route-group="internal"');
    expect(html).toContain('>Home</span>');
    expect(html).toContain('aria-label="Go to Home"');
    expect(html).toContain('>Internal &lt;ops&gt;</p>');
    expect(html).not.toContain('<ops>');
    expect(html).toContain('>Users &amp; installs</span>');
    expect(html).toContain('/auth/handoff/start?target_host=internal.consuelohq.com&amp;return_to=%2Fusers%3Fview%3Drecent');
    expect(html).toContain('data-private-route-host=\"internal.consuelohq.com\"');
    expect(html).toContain('data-private-route-return-to=\"/users?view=recent\"');
    const client = workspaceChromeClientScript();
    expect(client).toContain('[data-private-route-host]');
    expect(client).toContain('window.location.hostname.toLowerCase() === targetHost');
    expect(client).toContain('event.button !== 0');
    expect(client).toContain('event.metaKey || event.ctrlKey || event.shiftKey || event.altKey');
    expect(client).toContain('window.location.assign(returnTo)');
    expect(html).not.toContain('href="https://internal.consuelohq.com/users?view=recent"');
    expect(html).not.toContain('target="_blank" rel="noopener noreferrer" href="/auth/handoff/start');
  });

  it('keeps ordinary HTTPS custom links external without changing stock routes', () => {
    const html = renderWorkspaceChromeBar('tools', 'Tools', {
      extraSections: [
        {
          id: 'team',
          label: 'Team',
          links: [{ label: 'Runbook', href: 'https://docs.example.com/runbook' }],
        },
      ],
    });

    expect(html).toContain('data-custom-route-group="team"');
    expect(html).toContain('href="https://docs.example.com/runbook"');
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
    expect(html).toContain('href="/configuration"');
    expect(html).toContain('href="/tracing"');
  });
});
