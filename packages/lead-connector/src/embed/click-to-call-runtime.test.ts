import { afterEach, describe, expect, it, mock } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';

const asset = readFileSync(
  join(import.meta.dir, 'public', 'consuelo-lead-connector-click-to-call.js'),
  'utf8',
);
const embedOrigin = 'https://calls.consuelohq.com';
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

  it('remounts and reauthenticates after GHL replaces route DOM', async () => {
    const { dom, exposeSessionDetails } = boot({
      path: '/v2/location/location-1/contacts',
      body: '<nav><a id="tb_lists">Smart Lists</a></nav>',
    });
    const { document } = dom.window;
    document.getElementById('consuelo-dialer-launcher')?.click();
    const firstFrame = document.querySelector<HTMLIFrameElement>(
      'iframe[name="consuelo-dialer"]',
    );
    expect(firstFrame).not.toBeNull();

    const firstPostMessage = mock(() => undefined);
    Object.defineProperty(firstFrame!.contentWindow!, 'postMessage', {
      configurable: true,
      value: firstPostMessage,
    });
    dom.window.dispatchEvent(
      new dom.window.MessageEvent('message', {
        data: { message: 'REQUEST_USER_DATA' },
        origin: embedOrigin,
        source: firstFrame!.contentWindow,
      }),
    );
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
    expect(exposeSessionDetails).toHaveBeenCalledTimes(1);

    document.getElementById('consuelo-dialer-overlay-host')?.remove();
    document.getElementById('consuelo-dialer-launcher')?.remove();
    document.body.innerHTML +=
      '<div class="bar"><div class="view" id="list-view"><span class="view-label">List</span></div></div>';
    dom.window.history.pushState(
      {},
      '',
      '/v2/location/location-1/opportunities',
    );
    dom.window.dispatchEvent(new dom.window.Event('routeLoaded'));

    const launcher = document.getElementById('consuelo-dialer-launcher');
    expect(launcher).not.toBeNull();
    launcher?.click();
    const secondFrame = document.querySelector<HTMLIFrameElement>(
      'iframe[name="consuelo-dialer"]',
    );
    expect(secondFrame).not.toBeNull();
    expect(secondFrame).not.toBe(firstFrame);

    const secondPostMessage = mock(() => undefined);
    Object.defineProperty(secondFrame!.contentWindow!, 'postMessage', {
      configurable: true,
      value: secondPostMessage,
    });
    dom.window.dispatchEvent(
      new dom.window.MessageEvent('message', {
        data: { message: 'REQUEST_USER_DATA' },
        origin: embedOrigin,
        source: secondFrame!.contentWindow,
      }),
    );
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(exposeSessionDetails).toHaveBeenCalledTimes(2);
    expect(secondPostMessage).toHaveBeenCalledWith(
      {
        message: 'REQUEST_USER_DATA_RESPONSE',
        payload: 'opaque-encrypted-context',
      },
      embedOrigin,
    );
    expect(document.querySelectorAll('#consuelo-dialer-launcher')).toHaveLength(
      1,
    );
    expect(
      document.querySelectorAll('iframe[name="consuelo-dialer"]'),
    ).toHaveLength(1);
  });

  it('refreshes signed context on a route change without replacing a connected iframe', async () => {
    const { dom, exposeSessionDetails } = boot({
      path: '/v2/location/location-1/contacts',
      body: '<nav><a id="tb_lists">Smart Lists</a></nav>',
    });
    const { document } = dom.window;
    document.getElementById('consuelo-dialer-launcher')?.click();
    const frame = document.querySelector<HTMLIFrameElement>(
      'iframe[name="consuelo-dialer"]',
    );
    expect(frame).not.toBeNull();
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
    expect(exposeSessionDetails).toHaveBeenCalledTimes(1);
    postMessage.mockClear();

    document.body.insertAdjacentHTML(
      'beforeend',
      '<div class="bar"><div class="view" id="list-view"><span class="view-label">List</span></div></div>',
    );
    dom.window.history.pushState(
      {},
      '',
      '/v2/location/location-1/opportunities',
    );
    dom.window.dispatchEvent(new dom.window.Event('routeLoaded'));
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(
      document.querySelector<HTMLIFrameElement>(
        'iframe[name="consuelo-dialer"]',
      ),
    ).toBe(frame);
    expect(exposeSessionDetails).toHaveBeenCalledTimes(2);
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
  it('does not reopen a session the rep minimized when another busy update arrives', () => {
    const { dom } = boot({
      path: '/v2/location/location-1/contacts',
      body: '<nav><a id="tb_lists">Smart Lists</a></nav>',
    });
    const doc = dom.window.document;
    doc.getElementById('consuelo-dialer-launcher')?.click();
    const frame = doc.querySelector<HTMLIFrameElement>(
      'iframe[name="consuelo-dialer"]',
    )!;
    const send = () =>
      dom.window.dispatchEvent(
        new dom.window.MessageEvent('message', {
          origin: embedOrigin,
          source: frame.contentWindow,
          data: {
            type: 'consuelo.leadconnector/busy',
            version: 1,
            sessionId: 'session-1',
          },
        }),
      );
    send();
    doc.querySelector<HTMLButtonElement>('[data-action="minimize"]')?.click();
    send();
    const host = doc.getElementById('consuelo-dialer-overlay-host');
    expect(host?.getAttribute('data-minimized')).toBe('true');
    expect(doc.querySelector('iframe[name="consuelo-dialer"]')).toBe(frame);
    expect(
      doc.querySelector<HTMLElement>('.consuelo-dialer-panel')?.hidden,
    ).toBe(false);
  });

  it('keeps a receiving-calls iframe mounted and compact while the rep uses another CRM page', () => {
    const { dom } = boot({
      path: '/v2/location/location-1/contacts',
      body: '<nav><a id="tb_lists">Smart Lists</a></nav>',
    });
    const doc = dom.window.document;
    doc.getElementById('consuelo-dialer-launcher')?.click();
    const frame = doc.querySelector<HTMLIFrameElement>(
      'iframe[name="consuelo-dialer"]',
    )!;
    dom.window.dispatchEvent(
      new dom.window.MessageEvent('message', {
        origin: embedOrigin,
        source: frame.contentWindow,
        data: {
          type: 'consuelo.leadconnector/session-status',
          version: 1,
          active: true,
          mode: 'inbound',
          status: 'available',
        },
      }),
    );
    doc.querySelector<HTMLButtonElement>('[data-action="minimize"]')?.click();
    dom.window.history.pushState(
      {},
      '',
      '/v2/location/location-1/conversations',
    );
    dom.window.dispatchEvent(new dom.window.Event('routeLoaded'));
    expect(doc.querySelector('iframe[name="consuelo-dialer"]')).toBe(frame);
    expect(
      doc
        .getElementById('consuelo-dialer-overlay-host')
        ?.getAttribute('data-minimized'),
    ).toBe('true');
    expect(
      doc.querySelector<HTMLElement>('.consuelo-dialer-panel')?.hidden,
    ).toBe(false);
  });

  it('accepts explicit workspace handoff only from the approved native admin iframe and sends a launch once', () => {
    const { dom } = boot({
      path: '/v2/location/location-1/custom-menu-link/test',
      body: '<iframe id="native" src="https://calls.consuelohq.com/admin"></iframe><iframe id="public" src="https://calls.consuelohq.com/call/sales"></iframe>',
    });
    const document = dom.window.document;
    const launch = {
      id: 'explicit-user-action',
      mode: 'inbound',
      action: 'inbound-readiness',
      ready: true,
      endpoints: [{ endpointId: 'phone', kind: 'phone' }],
    };
    const dispatch = (source: Window, origin = embedOrigin) =>
      dom.window.dispatchEvent(
        new dom.window.MessageEvent('message', {
          source,
          origin,
          data: {
            type: 'consuelo.leadconnector/open-workspace',
            version: 1,
            launch,
          },
        }),
      );
    dispatch(
      document.querySelector<HTMLIFrameElement>('#public')!.contentWindow!,
    );
    expect(document.querySelector('iframe[name="consuelo-dialer"]')).toBeNull();
    dispatch(
      document.querySelector<HTMLIFrameElement>('#native')!.contentWindow!,
      'https://attacker.test',
    );
    expect(document.querySelector('iframe[name="consuelo-dialer"]')).toBeNull();
    dispatch(
      document.querySelector<HTMLIFrameElement>('#native')!.contentWindow!,
    );
    const frame = document.querySelector<HTMLIFrameElement>(
      'iframe[name="consuelo-dialer"]',
    )!;
    expect(frame).not.toBeNull();
    const messages: unknown[] = [];
    Object.defineProperty(frame.contentWindow!, 'postMessage', {
      configurable: true,
      value: (message: unknown) => messages.push(message),
    });
    for (let i = 0; i < 2; i++)
      dom.window.dispatchEvent(
        new dom.window.MessageEvent('message', {
          source: frame.contentWindow,
          origin: embedOrigin,
          data: { type: 'consuelo.leadconnector/ready', version: 1 },
        }),
      );
    expect(
      messages.filter(
        (m) =>
          typeof m === 'object' &&
          m !== null &&
          'type' in m &&
          m.type === 'consuelo.leadconnector/workspace-launch',
      ),
    ).toEqual([
      { type: 'consuelo.leadconnector/workspace-launch', version: 1, launch },
    ]);
  });

  it('raises a new incoming offer once and then respects minimization of repeated offer snapshots', () => {
    const { dom } = boot({
      path: '/v2/location/location-1/contacts',
      body: '<a id="tb_lists">Smart Lists</a>',
    });
    const document = dom.window.document;
    document.getElementById('consuelo-dialer-launcher')!.click();
    const frame = document.querySelector<HTMLIFrameElement>(
      'iframe[name="consuelo-dialer"]',
    )!;
    const status = (value: string) =>
      dom.window.dispatchEvent(
        new dom.window.MessageEvent('message', {
          source: frame.contentWindow,
          origin: embedOrigin,
          data: {
            type: 'consuelo.leadconnector/session-status',
            version: 1,
            active: true,
            mode: 'inbound',
            status: value,
          },
        }),
      );
    status('available');
    document.querySelector<HTMLElement>('[data-action="minimize"]')!.click();
    status('offering');
    expect(
      document
        .getElementById('consuelo-dialer-overlay-host')!
        .getAttribute('data-minimized'),
    ).toBe('false');
    document.querySelector<HTMLElement>('[data-action="minimize"]')!.click();
    status('offering');
    expect(
      document
        .getElementById('consuelo-dialer-overlay-host')!
        .getAttribute('data-minimized'),
    ).toBe('true');
  });
});
