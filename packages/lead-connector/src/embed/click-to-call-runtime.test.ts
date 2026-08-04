import { afterEach, describe, expect, it, mock } from 'bun:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const asset = readFileSync(
  'packages/lead-connector/src/embed/public/consuelo-lead-connector-click-to-call.js',
  'utf8',
);
const embedOrigin =
  'https://consuelo-lead-connector-embed.kokayi-90b.workers.dev';
const appId = '690cbca9af44827eb89887b1';
const activeDoms: JSDOM[] = [];

afterEach(() => {
  for (const dom of activeDoms.splice(0)) {
    for (const frame of dom.window.document.querySelectorAll('iframe')) {
      frame.remove();
    }
    dom.window.close();
  }
});

const boot = (input: { path: string; body: string }) => {
  const dom = new JSDOM(`<!doctype html><body>${input.body}</body>`, {
    url: `https://app.gohighlevel.com${input.path}`,
    runScripts: 'outside-only',
  });
  activeDoms.push(dom);
  const exposeSessionDetails = mock(async () => 'opaque-encrypted-context');
  Object.defineProperty(dom.window, 'exposeSessionDetails', {
    configurable: true,
    value: exposeSessionDetails,
  });
  dom.window.eval(asset);
  return { dom, exposeSessionDetails };
};

describe('LeadConnector click-to-call runtime', () => {
  it('anchors beside Smart Lists and relays supported Custom JS user context', async () => {
    const { dom, exposeSessionDetails } = boot({
      path: '/v2/location/location-1/contacts',
      body: '<nav><a id="tb_lists">Smart Lists</a><a id="tb_bulk-actions">Bulk Actions</a></nav>',
    });
    const { document } = dom.window;
    const anchor = document.getElementById('tb_lists');
    const launcher = document.getElementById('consuelo-dialer-launcher');

    expect(anchor?.nextElementSibling).toBe(launcher);
    expect(document.querySelectorAll('#consuelo-dialer-launcher')).toHaveLength(
      1,
    );
    expect(document.querySelector('iframe[name="consuelo-dialer"]')).toBeNull();

    launcher?.click();
    const frame = document.querySelector<HTMLIFrameElement>(
      'iframe[name="consuelo-dialer"]',
    );
    expect(frame?.getAttribute('allow')).toBe('microphone');
    expect(frame?.src).toBe(`${embedOrigin}/overlay`);

    const postMessage = mock(() => undefined);
    Object.defineProperty(frame!.contentWindow!, 'postMessage', {
      configurable: true,
      value: postMessage,
    });
    dom.window.dispatchEvent(
      new dom.window.MessageEvent('message', {
        data: { message: 'REQUEST_USER_DATA' },
        origin: embedOrigin,
        source: frame!.contentWindow,
      }),
    );
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(exposeSessionDetails).toHaveBeenCalledWith(appId);
    expect(postMessage).toHaveBeenCalledWith(
      {
        message: 'REQUEST_USER_DATA_RESPONSE',
        payload: 'opaque-encrypted-context',
      },
      embedOrigin,
    );
  });

  it('anchors beside the native Opportunities list control without duplication', () => {
    const { dom } = boot({
      path: '/v2/location/location-1/opportunities',
      body: '<div class="bar"><div class="view"><span class="view-label">Open opportunities</span></div><div class="view" id="list-view"><span class="view-label">List</span></div></div><a id="tb_opportunities-tab">Opportunities</a>',
    });
    const { document } = dom.window;
    const listView = document.getElementById('list-view');
    const launcher = document.getElementById('consuelo-dialer-launcher');

    expect(listView?.nextElementSibling).toBe(launcher);
    dom.window.dispatchEvent(new dom.window.Event('routeLoaded'));
    expect(document.querySelectorAll('#consuelo-dialer-launcher')).toHaveLength(
      1,
    );
    expect(listView?.nextElementSibling).toBe(launcher);
  });
});
