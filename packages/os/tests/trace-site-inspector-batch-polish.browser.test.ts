import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { expect, it } from 'vitest';
import { buildObservabilityTracesSite } from '../scripts/lib/observability-traces-site';
const browserTest = existsSync(chromium.executablePath()) ? it : it.skip;
browserTest(
  'keeps a batch child interactive when a standalone copy of the trace is also loaded',
  async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 1600, height: 1000 },
        colorScheme: 'dark',
      });
      const child = {
        now: '2026-10-29T18:25:37Z',
        ok: true,
        code: 'OK',
        message: 'command completed',
        traceId: 'shared-child',
        durationMs: 196,
        inputTokens: 7,
        outputTokens: 100,
        totalTokens: 107,
        data: {
          identifier: 'DEV-1',
          title: 'Captured issue',
          description:
            '## Current operational state\n\nA **readable** result.\n\n' +
            'Useful document text.\n'.repeat(100),
        },
      };
      const standalone = {
        id: 'facade:shared-child',
        recordId: 'facade:shared-child',
        traceId: 'shared-child',
        name: 'linear.issue',
        ok: true,
        status: 'success',
        rawInputJson: { identifier: 'DEV-1' },
        rawResultJson: child,
        tokenCountsRecorded: { input: false, output: false, total: false },
        inputTokens: 0,
        outputTokens: 0,
        tokens: 0,
      };
      const batch = {
        id: 'batch-row',
        recordId: 'batch-row',
        traceId: 'batch-trace',
        name: 'batch',
        ok: true,
        status: 'success',
        rawInputJson: {
          steps: [{ tool: 'linear.issue', input: { identifier: 'DEV-1' } }],
        },
        batchResultsJson: [child],
        rawResultJson: { ok: true, code: 'OK', data: { results: [child] } },
      };
      const children = Array.from({ length: 19 }, (_, index) => ({
        ...child,
        traceId: index ? 'shared-child-' + index : child.traceId,
        data: { ...child.data, identifier: 'DEV-' + (index + 1) },
      }));
      batch.batchResultsJson = children;
      batch.rawResultJson.data.results = children;
      batch.rawInputJson.steps = children.map((item) => ({
        tool: 'linear.issue',
        input: { identifier: item.data.identifier },
      }));
      const rows = [
        batch,
        ...children.map((item) => ({
          ...standalone,
          id: 'facade:' + item.traceId,
          recordId: 'facade:' + item.traceId,
          traceId: item.traceId,
          rawResultJson: {
            ...item,
            inputTokens: undefined,
            outputTokens: undefined,
            totalTokens: undefined,
          },
        })),
      ];
      const html = buildObservabilityTracesSite();
      await page.addInitScript(() =>
        localStorage.setItem('consuelo.trace-inspector.width', '1200'),
      );
      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === '/traces')
          return route.fulfill({ contentType: 'text/html', body: html });
        if (url.pathname === '/gateway/traces/recent')
          return route.fulfill({
            json: {
              ok: true,
              data: { direction: 'older', rows, nextCursor: null },
            },
          });
        if (url.pathname === '/gateway/traces/events')
          return route.fulfill({
            contentType: 'text/event-stream',
            body: 'event: heartbeat\ndata: {}\n\n',
          });
        return route.fulfill({ status: 404, body: '' });
      });
      await page.goto('https://trace.test/traces', {
        waitUntil: 'domcontentloaded',
      });
      await page.locator('.trxRow[data-trace-key="batch-row"]').click();
      await page.locator('.tiPeerChild').first().click();
      await page.waitForFunction(() =>
        document
          .querySelector('.tiSelectedMeta')
          ?.textContent?.includes('linear.issue'),
      );
      const identity = await page.evaluate(() => ({
        key: (window as Window & { __traceSelectedKey?: string }).__traceSelectedKey,
        mounted:
          document.querySelector<HTMLElement>('.tiInspector')?.dataset
            .tiTraceKey,
      }));
      expect(identity.key).toBe(identity.mounted);
      const replacements = await page.evaluate(async () => {
        let count = 0;
        const observer = new MutationObserver((mutations) => {
          count += mutations.filter(
            (m) => m.target === document.querySelector('[data-inspector]'),
          ).length;
        });
        observer.observe(document.querySelector('[data-inspector]')!, {
          childList: true,
        });
        await new Promise((resolve) => setTimeout(resolve, 300));
        observer.disconnect();
        return count;
      });
      expect(replacements).toBeLessThan(2);
      const selectionStyle = await page
        .locator('.tiPeer.active')
        .evaluate((node) => ({
          background: getComputedStyle(node).backgroundColor,
          shadow: getComputedStyle(node).boxShadow,
        }));
      expect(selectionStyle.background).toBe('rgba(0, 0, 0, 0)');
      expect(selectionStyle.shadow).toBe('none');
      expect(
        await page
          .locator('.trxRow.selected')
          .first()
          .evaluate((node) => getComputedStyle(node).backgroundColor),
      ).toBe('rgba(0, 0, 0, 0)');
      const screenshots = process.env.CONSUELO_TRACE_READING_SCREENSHOTS;
      if (screenshots) {
        mkdirSync(screenshots, { recursive: true });
        await page.screenshot({
          path: screenshots + '/batch-child-interactive.png',
        });
      }
      expect(
        await page
          .locator('[data-ti-section="output"] .tiMarkdown h2')
          .textContent(),
      ).toBe('Current operational state');
      expect(
        await page.locator('.tiDiagnostics').getAttribute('open'),
      ).not.toBeNull();
      const preview = page.locator('.tiPreview');
      await preview.hover();
      await page.mouse.wheel(0, 500);
      await page.waitForFunction(
        () => document.querySelector('.tiPreview')!.scrollTop > 100,
      );
      await page.locator('[data-ti-mode="json"]').click();
      await page.waitForSelector('.tiRawJson');
      await page.locator('[data-ti-mode="formatted"]').click();
      await page.waitForSelector('.tiMarkdown');
      await page.locator('.tiDiagnostics > summary').click();
      expect(
        await page.locator('.tiDiagnostics').getAttribute('open'),
      ).toBeNull();
      await page.locator('.tiPeer[data-trace-key="batch-row"]').click();
      await page.locator('[data-ti-close]').click();
      await page.locator('[data-show-filters]').click();
      await page.locator('.trxFilterPanel').waitFor({ state: 'visible' });
      await page.locator('.trxFilterPanel').evaluate(node =>
        Promise.all(node.getAnimations().map(animation => animation.finished)),
      );
      const boxes = await page.evaluate(() => {
        const panel = document
          .querySelector('.trxFilterPanel')!
          .getBoundingClientRect();
        const close = document
          .querySelector('[data-trace-filter-close]')!
          .getBoundingClientRect();
        return {
          panel: { bottom: panel.bottom, right: panel.right },
          close: { bottom: close.bottom, right: close.right },
          borders: [...document.querySelectorAll('.trxFilterSection')].map(
            (node) => getComputedStyle(node).borderTopWidth,
          ),
        };
      });
      expect(boxes.panel.bottom - boxes.close.bottom).toBeLessThan(25);
      expect(boxes.panel.bottom).toBeGreaterThan(500);
      expect(boxes.panel.right - boxes.close.right).toBeLessThan(25);
      expect(boxes.borders.every((width) => parseFloat(width) === 0)).toBe(
        true,
      );
      if (screenshots)
        await page.screenshot({
          path: screenshots + '/filters-bottom-close.png',
        });
      await page.locator('[data-trace-filter-close]').click();
      expect(await page.locator('.trxFilterPanel').isVisible()).toBe(false);
    } finally {
      await browser.close();
    }
  },
  20000,
);
