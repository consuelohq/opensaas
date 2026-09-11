import { afterAll, beforeAll, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, type Browser } from 'playwright';
import {
  createTraceSitesGatewayLiveEndpoints,
  traceGatewayScopeFromHeaders,
} from '../scripts/lib/trace-sites-gateway-live-endpoints';
import { createFixtureTraceSitesReadBackend } from '../scripts/lib/trace-sites-gateway-read-layer';

let browser: Browser;
let bundle: string;
const temp = mkdtempSync(join(tmpdir(), 'trace-request-regression-'));
beforeAll(async () => {
  writeFileSync(
    join(temp, 'entry.ts'),
    'import { installTraceVirtualList } from ' +
      JSON.stringify(
        resolve(
          import.meta.dir,
          '../scripts/lib/trace-site-inspector/virtual-list-browser.ts',
        ),
      ) +
      '; import { installTraceLiveUpdates } from ' +
      JSON.stringify(
        resolve(
          import.meta.dir,
          '../scripts/lib/trace-site-inspector/live-browser.ts',
        ),
      ) +
      '; window.TraceList = { installTraceVirtualList, installTraceLiveUpdates };',
  );
  execFileSync('bun', [
    'build',
    join(temp, 'entry.ts'),
    '--target=browser',
    '--format=iife',
    '--global-name=TraceList',
    '--outfile=' + join(temp, 'list.js'),
  ]);
  bundle = readFileSync(join(temp, 'list.js'), 'utf8');
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
});
afterAll(async () => {
  await browser?.close();
  rmSync(temp, { recursive: true, force: true });
});

test('filtering a sparse result and rendering it does not fetch history without scroll intent', async () => {
  const page = await browser.newPage();
  try {
    page.on('pageerror', (error) => process.stderr.write(error.message + '\n'));
    await page.setContent(
      '<div class="trxTablePane"><div data-trace-virtual-list style="height:300px;overflow:auto"><div data-trace-virtual-content></div></div><div class="trxFooter"></div></div>',
    );
    await page.addScriptTag({ content: bundle });
    await page.evaluate(() => {
      const target = window as unknown as {
        TraceList: { installTraceVirtualList(): void };
        __traceRowsByTraceId: Map<string, Record<string, unknown>>;
        historyRequests: number;
      };
      target.__traceRowsByTraceId = new Map(
        Array.from({ length: 100 }, (_, i) => [
          String(i),
          {
            id: String(i),
            traceId: String(i),
            tool: 'fs.read',
            metadata: { rowid: i + 1 },
          },
        ]),
      );
      target.historyRequests = 0;
      document.addEventListener('trace:prefetch-request', (event) => {
        event.preventDefault();
        const detail = (event as CustomEvent).detail;
        target.historyRequests += 1;
        if (detail.query)
          detail.accept([{ id: 'match', tool: 'fs.read' }], 'id:older');
        else if (target.historyRequests < 5)
          detail.accept(
            [{ id: 'older-' + target.historyRequests, tool: 'fs.read' }],
            'id:older-' + target.historyRequests,
          );
      });
      target.TraceList.installTraceVirtualList();
      (
        window as unknown as {
          __traceVirtualList: { setQuery(query: string): void };
        }
      ).__traceVirtualList.setQuery('tool:fs.read');
    });
    await page.waitForTimeout(600);
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { historyRequests: number }).historyRequests,
      ),
    ).toBe(1);
  } finally {
    await page.close();
  }
});

test('cursor SSE sends real frames and remains open for subsequent local reads until cancellation', async () => {
  let reads = 0;
  const backend = createFixtureTraceSitesReadBackend({ recentEvents: [] });
  backend.readNewerPage = async () => ({
    rows: [{ id: String(++reads), tool: 'fs.read' }],
    nextCursor: String(reads).padStart(12, '0'),
  });
  const endpoints = createTraceSitesGatewayLiveEndpoints({
    backend,
    resolveScope: traceGatewayScopeFromHeaders,
  });
  const abort = new AbortController();
  const response = await endpoints.handle(
    new Request(
      'https://testing.consuelohq.com/gateway/traces/events?direction=newer&cursor=000000000000&includeRawPayload=true',
      {
        signal: abort.signal,
        headers: {
          'x-consuelo-workspace-id': 'wrk_test',
          'x-consuelo-workspace-host': 'testing.consuelohq.com',
        },
      },
    ),
  );
  expect(response.status).toBe(200);
  const reader = response.body!.getReader();
  try {
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain('event: page\n');
    expect(reads).toBe(1);
    const next = await reader.read();
    expect(next.done).toBe(false);
    expect(new TextDecoder().decode(next.value)).toContain(
      '"direction":"newer"',
    );
  } finally {
    abort.abort();
    await reader.cancel();
  }
  const stoppedAt = reads;
  await new Promise((done) => setTimeout(done, 1100));
  expect(reads).toBe(stoppedAt);
}, 10000);

test('sparse filtered history advances exactly once per explicit load', async () => {
  const page = await browser.newPage();
  try {
    await page.setContent(
      '<div class="trxTablePane"><div data-trace-virtual-list style="height:300px;overflow:auto"></div><div class="trxFooter"></div></div>',
    );
    await page.addScriptTag({ content: bundle });
    await page.evaluate(`(() => {
      window.__traceRowsByTraceId = new Map([['seed', {id:'seed', tool:'fs.read'}]]);
      window.requests = [];
      document.addEventListener('trace:prefetch-request', event => {event.preventDefault();window.requests.push(event.detail);});
      window.TraceList.installTraceVirtualList();
    })()`);
    await page.waitForTimeout(100);
    expect(await page.evaluate('window.requests.length')).toBe(0);
    await page.getByRole('button', { name: 'Load older traces' }).click();
    expect(await page.evaluate('window.requests.length')).toBe(1);
    await page.waitForTimeout(100);
    expect(
      await page.getByRole('button', { name: 'Loading…' }).isDisabled(),
    ).toBe(true);
    await page.evaluate(
      "window.requests[0].accept([{id:'older',tool:'fs.read'}], 'id:next')",
    );
    await page.waitForTimeout(100);
    expect(await page.evaluate('window.requests.length')).toBe(1);
    await page.getByRole('button', { name: 'Load older traces' }).click();
    expect(await page.evaluate('window.requests.length')).toBe(2);
  } finally {
    await page.close();
  }
});

test('an obsolete A to B to A search response cannot overwrite the current results', async () => {
  const page = await browser.newPage();
  try {
    await page.setContent(
      '<div class="trxTablePane"><div data-trace-virtual-list style="height:300px;overflow:auto"></div><div class="trxFooter"></div></div>',
    );
    await page.addScriptTag({ content: bundle });
    await page.evaluate(`(() => {
      window.__traceRowsByTraceId = new Map([['seed', {id:'seed', tool:'fs.read'}]]);
      window.requests = [];
      document.addEventListener('trace:prefetch-request', event => {event.preventDefault();window.requests.push(event.detail);});
      window.TraceList.installTraceVirtualList();
    })()`);
    await page.waitForTimeout(60);
    for (const query of ['tool:fs.read', 'tool:fs.write', 'tool:fs.read']) {
      await page.evaluate((query) => {
        (
          window as unknown as {
            __traceVirtualList: { setQuery(query: string): void };
          }
        ).__traceVirtualList.setQuery(query);
      }, query);
      await page.waitForTimeout(1100);
    }
    expect(await page.evaluate('window.requests.length')).toBe(3);
    expect(await page.evaluate('window.requests[0].signal.aborted')).toBe(true);
    await page.evaluate(
      "window.requests[2].accept([{id:'current',tool:'fs.read'}], null);window.requests[0].accept([{id:'stale',tool:'fs.read'}], 'id:stale')",
    );
    expect(
      await page.evaluate("window.__traceRowsByTraceId.has('current')"),
    ).toBe(true);
    expect(
      await page.evaluate("window.__traceRowsByTraceId.has('stale')"),
    ).toBe(false);
  } finally {
    await page.close();
  }
});

test('live fallback respects Retry-After, stays quiet when hidden, and retries the snapshot after failure', async () => {
  const page = await browser.newPage();
  try {
    await page.setContent('<div class="trxTablePane"></div>');
    await page.clock.install({ time: new Date('2026-09-11T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-09-11T00:00:01Z'));
    await page.addScriptTag({ content: bundle });
    await page.evaluate(`(() => {
      window.calls = [];
      window.loaded = null;
      window.__traceVirtualList = {replaceRows(rows){window.loaded=rows;},prependRows(){}};
      window.__consueloTraceHistoryTransport = {async fetchJson(url) {
        window.calls.push(url);
        if(window.calls.length===1) throw Object.assign(new Error('limited'),{status:429,retryAfterMs:60000});
        return url.includes('live-traces') ? {rows:[{id:'loaded'}],nextCursor:null} : {ok:true,data:{direction:'newer',rows:[],nextCursor:null}};
      }};
      window.TraceList.installTraceLiveUpdates();
    })()`);
    await page.waitForTimeout(20);
    expect(await page.locator('[role=status]').textContent()).toContain(
      'rate limited',
    );
    await page.clock.runFor(59_000);
    expect(await page.evaluate('window.calls.length')).toBe(1);
    await page.clock.runFor(1_001);
    await page.waitForTimeout(20);
    expect(await page.evaluate('window.calls.length')).toBe(2);
    expect(await page.evaluate('window.loaded[0].id')).toBe('loaded');
    expect(await page.evaluate('window.calls[1]')).toContain(
      'live-traces.json',
    );
    await page.evaluate(
      "Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'))",
    );
    await page.clock.runFor(300_000);
    expect(await page.evaluate('window.calls.length')).toBe(2);
    await page.evaluate(
      "Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'))",
    );
    await page.clock.runFor(1);
    await page.waitForTimeout(20);
    expect(await page.evaluate('window.calls.length')).toBe(3);
  } finally {
    await page.close();
  }
});

test('one live owner uses SSE without polling and backs off when a stream closes immediately', async () => {
  const page = await browser.newPage();
  try {
    await page.setContent('<div class="trxTablePane"></div>');
    await page.clock.install({ time: new Date('2026-09-11T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-09-11T00:00:01Z'));
    await page.addScriptTag({ content: bundle });
    await page.evaluate(`(() => {
      window.calls=0;window.streams=[];window.rows=[];
      window.__traceVirtualList={replaceRows(rows){window.rows=rows;},prependRows(rows){window.rows.unshift(...rows);}};
      window.__consueloTraceHistoryTransport={
        async fetchJson(url){window.calls++;return url.includes('live-traces')?{rows:[],nextCursor:null}:{ok:true,data:{direction:'newer',rows:[],nextCursor:null}};},
        openEvents(url){const stream=new EventTarget();stream.closed=false;stream.close=()=>{stream.closed=true;};window.streams.push(stream);return stream;}
      };
      window.TraceList.installTraceLiveUpdates();
    })()`);
    await page.waitForTimeout(20);
    expect(await page.evaluate('window.calls')).toBe(1);
    expect(await page.evaluate('window.streams.length')).toBe(1);
    await page.clock.runFor(20_000);
    await page.evaluate(
      "window.streams[0].dispatchEvent(new MessageEvent('page',{data:JSON.stringify({ok:true,data:{direction:'newer',rows:[{id:'streamed'}],nextCursor:'000000000001'}})}))",
    );
    expect(await page.evaluate('window.rows[0].id')).toBe('streamed');
    expect(await page.evaluate('window.calls')).toBe(1);
    await page.evaluate("window.streams[0].onerror(new Event('error'))");
    expect(await page.evaluate('window.streams[0].closed')).toBe(true);
    await page.clock.runFor(14_999);
    expect(await page.evaluate('window.calls')).toBe(1);
    await page.clock.runFor(1);
    await page.waitForTimeout(20);
    expect(await page.evaluate('window.calls')).toBe(2);
    expect(await page.evaluate('window.streams.length')).toBe(1);
    await page.evaluate('window.TraceList.installTraceLiveUpdates()');
    await page.waitForTimeout(20);
    expect(
      await page.evaluate(
        'window.streams.filter(stream=>!stream.closed).length',
      ),
    ).toBe(1);
  } finally {
    await page.close();
  }
});

test('the shipped page shows throttling and does not issue requests when its bundle is evaluated twice', async () => {
  const { buildObservabilityTracesSite } =
    await import('../scripts/lib/observability-traces-site');
  const html = buildObservabilityTracesSite();
  const inspector = readFileSync(
    resolve(
      import.meta.dir,
      '../assets/vendor/observability-traces-v38/inspector.js',
    ),
    'utf8',
  );
  const page = await browser.newPage();
  const errors: string[] = [];
  let recentRequests = 0;
  try {
    page.on('pageerror', (error) => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-09-11T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-09-11T00:00:01Z'));
    await page.route('https://traces.test/**', async (route) => {
      if (new URL(route.request().url()).pathname === '/tracing') {
        await route.fulfill({ contentType: 'text/html', body: html });
      } else if (route.request().url().includes('/gateway/traces/recent')) {
        recentRequests++;
        await route.fulfill({
          status: 429,
          headers: { 'retry-after': '60' },
          contentType: 'text/html',
          body: 'Rate limited',
        });
      } else {
        await route.fulfill({ status: 404, body: 'Not found' });
      }
    });
    await page.goto('https://traces.test/tracing', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForFunction(() =>
      document
        .querySelector('[data-trace-live-status]')
        ?.textContent?.includes('rate limited'),
    );
    expect(recentRequests).toBe(1);
    await page.addScriptTag({ content: inspector });
    await page.clock.runFor(30_000);
    expect(recentRequests).toBe(1);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
}, 15000);

test('scrolling near the end loads one page and a live prepend preserves the scroll position without fetching history', async () => {
  const page = await browser.newPage();
  try {
    await page.setContent(
      '<div class="trxTablePane"><div data-trace-virtual-list style="height:300px;overflow:auto"><div data-trace-virtual-content style="position:relative"></div></div><div class="trxFooter"></div></div>',
    );
    await page.addScriptTag({ content: bundle });
    await page.evaluate(`(() => {
      window.__traceRowsByTraceId=new Map(Array.from({length:100},(_,i)=>[String(i),{id:String(i),tool:'fs.read'}]));
      window.requests=[];
      document.addEventListener('trace:prefetch-request',event=>{event.preventDefault();window.requests.push(event.detail);});
      window.TraceList.installTraceVirtualList();
    })()`);
    await page.waitForTimeout(120);
    await page.locator('[data-trace-virtual-list]').hover();
    await page.mouse.wheel(0, 3700);
    await page.waitForFunction('window.requests.length === 1');
    expect(await page.evaluate('window.requests.length')).toBe(1);
    await page.evaluate(
      "window.requests[0].accept(Array.from({length:100},(_,i)=>({id:'older'+i,tool:'fs.read'})), 'id:older100')",
    );
    await page.waitForTimeout(80);
    const before = await page
      .locator('[data-trace-virtual-list]')
      .evaluate((el) => el.scrollTop);
    await page.evaluate(
      "window.__traceVirtualList.prependRows([{id:'new',tool:'fs.read'}])",
    );
    await page.waitForTimeout(100);
    const after = await page
      .locator('[data-trace-virtual-list]')
      .evaluate((el) => el.scrollTop);
    expect(after).toBeGreaterThanOrEqual(before);
    expect(await page.evaluate('window.requests.length')).toBe(1);
    expect(
      await page
        .locator('[data-trace-virtual-list]')
        .getAttribute('data-trace-retained'),
    ).toBe('201');
  } finally {
    await page.close();
  }
}, 15000);

test('cursor streams enforce scope and redact payloads with the same rules as history', async () => {
  const backend = createFixtureTraceSitesReadBackend({ recentEvents: [] });
  let reads = 0;
  backend.readNewerPage = async () => {
    reads++;
    return {
      rows: [{ id: 'safe', input: { secret: 'private' } }],
      nextCursor: '000000000001',
    };
  };
  const endpoints = createTraceSitesGatewayLiveEndpoints({
    backend,
    resolveScope: traceGatewayScopeFromHeaders,
  });
  const base =
    'https://testing.consuelohq.com/gateway/traces/events?direction=newer&cursor=000000000000';
  const denied = await endpoints.handle(
    new Request(base, { headers: { 'x-consuelo-trace-read': 'false' } }),
  );
  expect(denied.status).toBe(403);
  expect(reads).toBe(0);
  const response = await endpoints.handle(new Request(base));
  const reader = response.body!.getReader();
  try {
    const chunk = await reader.read();
    const text = new TextDecoder().decode(chunk.value);
    expect(text).toContain('safe');
    expect(text).not.toContain('private');
  } finally {
    await reader.cancel();
  }
});

test('the shipped page hydrates and receives native EventSource deltas over one HTTP connection', async () => {
  const { buildObservabilityTracesSite } =
    await import('../scripts/lib/observability-traces-site');
  let historyRequests = 0;
  let streamRequests = 0;
  let delivered = false;
  const backend = createFixtureTraceSitesReadBackend({ recentEvents: [] });
  backend.readHistoryPage = async () => ({
    rows: [
      { id: 'seed', traceId: 'seed', tool: 'fs.read', metadata: { rowid: 1 } },
    ],
    nextCursor: null,
  });
  backend.readNewerPage = async () => {
    if (delivered) return { rows: [], nextCursor: '000000000002' };
    delivered = true;
    return {
      rows: [
        {
          id: 'delta',
          traceId: 'delta',
          tool: 'fs.write',
          metadata: { rowid: 2 },
        },
      ],
      nextCursor: '000000000002',
    };
  };
  const endpoints = createTraceSitesGatewayLiveEndpoints({
    backend,
    resolveScope: traceGatewayScopeFromHeaders,
  });
  const html = buildObservabilityTracesSite();
  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === '/tracing')
        return new Response(html, { headers: { 'content-type': 'text/html' } });
      if (path === '/gateway/traces/recent') historyRequests++;
      if (path === '/gateway/traces/events') streamRequests++;
      const forwarded = new Request(
        'https://testing.consuelohq.com' +
          new URL(request.url).pathname +
          new URL(request.url).search,
        { signal: request.signal },
      );
      return endpoints.handle(forwarded);
    },
  });
  const page = await browser.newPage();
  const errors: string[] = [];
  try {
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.port + '/tracing', {
      waitUntil: 'domcontentloaded',
    });
    await page
      .waitForFunction(
        "window.__traceRowsByTraceId?.has('delta')",
        {},
        { timeout: 5000 },
      )
      .catch(async (error) => {
        process.stderr.write(
          JSON.stringify({
            historyRequests,
            streamRequests,
            errors,
            status: await page
              .locator('[data-trace-live-status]')
              .textContent(),
            keys: await page.evaluate(
              '[...window.__traceRowsByTraceId.keys()]',
            ),
          }) + '\n',
        );
        throw error;
      });
    expect(await page.evaluate("window.__traceRowsByTraceId.has('seed')")).toBe(
      true,
    );
    expect(historyRequests).toBe(1);
    expect(streamRequests).toBe(1);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await server.stop(true);
  }
}, 15000);
