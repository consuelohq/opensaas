import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { describe, expect, it } from 'vitest';
import { buildObservabilityTracesSite } from '../scripts/lib/observability-traces-site';

const browserTest = existsSync(chromium.executablePath()) ? it : it.skip;
const fixtures = [
  {id:'skill-one',traceId:'skill-one',name:'fs.read',branch:'task/os/session-one',ok:true,status:'success',startTime:'2026-11-14T03:45:09Z',input:'read SKILL.md'},
  {id:'skill-two',traceId:'skill-two',name:'python.read',branch:'task/dialer/session-two',ok:true,status:'success',startTime:'2026-11-14T03:45:08Z',input:'inspect source'},
  {id:'skill-three',traceId:'skill-three',name:'python.verify',branch:'task/os/session-one',ok:true,status:'success',startTime:'2026-11-14T03:45:07Z',input:'run tests'},
];

describe('Trace Burn polish interactions', () => {
  browserTest('clicking a session filters the main list, without selecting the trace', async () => {
    const browser = await chromium.launch({headless:true});
    try {
      const page = await browser.newPage({viewport:{width:1490,height:760}});
      await page.route('**/*', route => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname === '/tracing') return route.fulfill({contentType:'text/html',body:buildObservabilityTracesSite()});
        if (pathname === '/gateway/traces/recent') return route.fulfill({json:{ok:true,data:{direction:'older',rows:fixtures,nextCursor:null}}});
        return route.fulfill({status:404,body:''});
      });
      await page.goto('https://trace.test/tracing',{waitUntil:'domcontentloaded'});
      const rows = page.locator('.trxRow:not(.trxNestedRow)[data-trace-key]');
      await rows.first().waitFor({state:'visible'});
      expect(await rows.count()).toBe(3);
      const selectedBefore = await page.locator('.trxRow.selected').evaluateAll(
        nodes => nodes[0]?.getAttribute('data-trace-key') ?? null,
      );
      await rows.first().locator('.trxBranch').click();
      await page.waitForFunction(() => document.querySelectorAll('.trxRow[data-trace-key]').length === 2);
      expect(await page.locator('.trxRow[data-trace-key] .trxBranch').allTextContents())
        .toEqual(['os/session-one','os/session-one']);
      expect(await page.locator('.trxRow.selected').evaluateAll(
        nodes => nodes[0]?.getAttribute('data-trace-key') ?? null,
      )).toBe(selectedBefore);
      const pill = page.locator('[data-trace-active-session]');
      await pill.waitFor({state:'visible'});
      await pill.click();
      expect(await rows.count()).toBe(3);
    } finally {await browser.close();}
  },25000);

  browserTest('hover tooltip closes on scroll or intentional jiggle without popping into the top-left', async () => {
    const browser = await chromium.launch({headless:true});
    try {
      const page = await browser.newPage({viewport:{width:1420,height:760}});
      await page.route('**/*', route => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname === '/tracing') return route.fulfill({contentType:'text/html',body:buildObservabilityTracesSite()});
        if (pathname === '/gateway/traces/recent') return route.fulfill({json:{ok:true,data:{direction:'older',rows:fixtures,nextCursor:null}}});
        return route.fulfill({status:404,body:''});
      });
      await page.goto('https://trace.test/tracing',{waitUntil:'domcontentloaded'});
      const cell = page.locator('.trxRow[data-trace-key] .trxInputCell').first();
      await cell.waitFor({state:'visible'});
      await cell.hover();
      const tip = page.locator('.trxHoverCard');
      await tip.waitFor({state:'visible',timeout:5000});
      expect(await tip.evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThan(15);
      await page.evaluate(() => document.querySelector('[data-trace-virtual-list]')?.dispatchEvent(new Event('scroll',{bubbles:true})));
      await page.waitForTimeout(100);
      expect(await tip.isVisible()).toBe(false);
      await page.mouse.move(0,0);
      await cell.hover();
      await tip.waitFor({state:'visible',timeout:5000});
      const bounds = await cell.boundingBox();
      if (!bounds) throw new Error('cell bounds missing');
      await page.mouse.move(bounds.x + 18, bounds.y + bounds.height/2);
      await page.mouse.move(bounds.x + 60, bounds.y + bounds.height/2);
      await page.mouse.move(bounds.x + 12, bounds.y + bounds.height/2);
      await page.waitForTimeout(140);
      expect(await tip.isVisible()).toBe(false);
      await page.waitForTimeout(1120);
      expect(await tip.isVisible()).toBe(false);
    } finally {await browser.close();}
  },30000);

  browserTest('the status and cost columns stay visible from desktop through narrow mobile widths', async () => {
    const browser = await chromium.launch({headless:true});
    try {
      const page = await browser.newPage({viewport:{width:1600,height:760}});
      await page.route('**/*', route => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname === '/tracing') return route.fulfill({contentType:'text/html',body:buildObservabilityTracesSite()});
        if (pathname === '/gateway/traces/recent') return route.fulfill({json:{ok:true,data:{direction:'older',rows:fixtures,nextCursor:null}}});
        return route.fulfill({status:404,body:''});
      });
      await page.goto('https://trace.test/tracing',{waitUntil:'domcontentloaded'});
      await page.locator('.trxRow[data-trace-key]').first().waitFor({state:'visible'});
      for (const width of [1600,1100,850,430]) {
        await page.setViewportSize({width,height:760});
        const geometry = await page.evaluate(() => {
          const header = document.querySelector('.trxHead > div:last-child') as HTMLElement;
          const row = document.querySelector('.trxRow[data-trace-key]') as HTMLElement;
          const cost = row.lastElementChild as HTMLElement;
          const status = row.children[row.children.length - 2] as HTMLElement;
          const right = document.documentElement.clientWidth;
          const display = (el: HTMLElement) => el.getBoundingClientRect();
          return {right, costLeft:display(cost).left,costRight:display(cost).right,statusRight:display(status).right,headerRight:display(header).right,costWidth:display(cost).width};
        });
        expect(geometry.costWidth, String(width)).toBeGreaterThan(0);
        expect(geometry.costRight, String(width)).toBeLessThanOrEqual(geometry.right + 1);
        expect(geometry.statusRight, String(width)).toBeLessThanOrEqual(geometry.right + 1);
        expect(geometry.costLeft, String(width)).toBeGreaterThanOrEqual(0);
      }
    } finally {await browser.close();}
  },30000);

  browserTest('keeps text-only hover, inset tool-call separators, and subdued nested scrollbars', async () => {
    const browser = await chromium.launch({headless:true});
    try {
      const page = await browser.newPage({viewport:{width:1490,height:760}});
      await page.route('**/*', route => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname === '/tracing') return route.fulfill({contentType:'text/html',body:buildObservabilityTracesSite()});
        if (pathname === '/gateway/traces/recent') return route.fulfill({json:{ok:true,data:{direction:'older',rows:fixtures,nextCursor:null}}});
        return route.fulfill({status:404,body:''});
      });
      await page.goto('https://trace.test/tracing',{waitUntil:'domcontentloaded'});
      const first = page.locator('.trxRow[data-trace-key]').first();
      await first.waitFor({state:'visible'});
      const normal = await first.evaluate(el => getComputedStyle(el).backgroundColor);
      await first.hover();
      const hovered = await first.evaluate(el => ({
        bg: getComputedStyle(el).backgroundColor,
        filter: getComputedStyle(el.querySelector('.trxToolCell')!).filter,
      }));
      expect(hovered.bg).toBe(normal);
      expect(hovered.filter).toMatch(/brightness/);

      await first.click();
      await page.locator('.tiInspector .tiPeerList').waitFor({state:'visible'});
      const styles = await page.evaluate(() => {
        const peer = document.querySelector('.tiPeer + .tiPeer')!;
        const border = getComputedStyle(peer, '::before');
        const callList = document.querySelector('.tiPeerList')!;
        const preview = document.querySelector('.tiPreview')!;
        const list = document.querySelector('[data-trace-virtual-list]')!;
        return {
          peerExists: Boolean(peer),
          border: border.backgroundColor,
          borderHeight: border.height,
          inset: border.left,
          callScrollbar: getComputedStyle(callList).scrollbarWidth,
          previewScrollbar: getComputedStyle(preview).scrollbarWidth,
          outerScrollbar: getComputedStyle(list).scrollbarWidth,
        };
      });
      expect(styles.peerExists).toBe(true);
      expect(styles.borderHeight).toBe('1px');
      expect(styles.inset).not.toBe('0px');
      expect(styles.callScrollbar).toBe('thin');
      expect(styles.previewScrollbar).toBe('thin');
      expect(styles.outerScrollbar).toBe('none');
    } finally {await browser.close();}
  },25000);
});
