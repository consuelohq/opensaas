import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { expect, it } from 'vitest';
import { buildObservabilityTracesSite } from '../scripts/lib/observability-traces-site';

const browserTest = existsSync(chromium.executablePath()) ? it : it.skip;

browserTest(
  'keeps complete trace payloads readable with the call rail open and preserves navigation',
  async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 1600, height: 1000 },
      });
      page.setDefaultTimeout(8_000);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const first = {
        id: 'read-1',
        traceId: 'read-1',
        name: 'code.call',
        branch: 'task/trace-site/readable-inspector',
        startTime: '2026-10-29T04:00:00Z',
        ok: true,
        status: 'success',
        code: 'OK',
        durationMs: 1250,
        inputTokens: 120,
        outputTokens: 450,
        tokens: 570,
        rawInputJson: JSON.stringify({
          requestId: 'request-1',
          taskSession: 'tsk_example',
          language: 'python',
          mode: 'read',
          code: 'print("A long useful example")\n'.repeat(40),
        }),
        rawResultJson: JSON.stringify({
          ok: true,
          code: 'OK',
          message: 'command completed',
          data: {
            stdout:
              (
                'A complete line of output with 0 plain zeros and meaningful content. '.repeat(
                  4,
                ) + '\n'
              ).repeat(35) + 'END OF OUTPUT',
            exitCode: 0,
          },
        }),
      };
      const batch = {
        id: 'batch-1',
        traceId: 'batch-1',
        name: 'batch',
        branch: first.branch,
        startTime: '2026-10-29T03:59:59Z',
        ok: true,
        status: 'success',
        durationMs: 500,
        rawInputJson: '{}',
        batchResultsJson: [
          {
            traceId: 'failed-child',
            tool: 'fs.read',
            ok: false,
            code: 'NOT_FOUND',
            message: 'File not found',
          },
        ],
      };
      const rows = [first, batch];
      const html = buildObservabilityTracesSite();
      await page.addInitScript(() =>
        localStorage.setItem('consuelo.trace-inspector.width', '1250'),
      );
      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === '/traces')
          return route.fulfill({ contentType: 'text/html', body: html });
        if (url.pathname === '/gateway/traces/recent') {
          const direction = url.searchParams.get('direction') ?? 'older';
          return route.fulfill({
            json: {
              ok: true,
              data: {
                direction,
                rows: direction === 'older' ? rows : [],
                nextCursor: null,
              },
            },
          });
        }
        if (url.pathname === '/gateway/traces/events') {
          return route.fulfill({
            contentType: 'text/event-stream',
            body: 'event: heartbeat\ndata: {}\n\n',
          });
        }
        return route.fulfill({ status: 404, body: '' });
      });
      await page.goto('http://trace.test/traces', {
        waitUntil: 'domcontentloaded',
      });
      await page.locator('.trxRow[data-trace-key="read-1"]').click();
      await page.waitForSelector('.tiReadingTabs');
      expect(
        await page
          .locator('[data-ti-section-tab="output"]')
          .getAttribute('aria-selected'),
      ).toBe('true');
      expect(await page.locator('.tiSectionBody').textContent()).toContain(
        'END OF OUTPUT',
      );
      expect(await page.locator('.tiInspector .tiSummaryHero').count()).toBe(0);
      expect(await page.locator('.tiFailureCount').textContent()).toBe(
        '1 failed',
      );
      expect(await page.locator('.tiLoadedCount').textContent()).toBe(
        '3 calls loaded',
      );
      expect(await page.locator('.tiCallStatus').textContent()).toBe('✤');

      const wide = await page.evaluate(() => {
        const sidebar = document.querySelector<HTMLElement>('.tiSidebar')!;
        const value = document.querySelector<HTMLElement>('.tiLongField dd')!;
        const panel = document.querySelector<HTMLElement>('.tiSectionBody')!;
        return {
          sidebar: sidebar.getBoundingClientRect().width,
          value: value.getBoundingClientRect().width,
          panel: panel.getBoundingClientRect().width,
          right: value.getBoundingClientRect().right,
          viewport: innerWidth,
          tabFont: parseFloat(
            getComputedStyle(document.querySelector('.tiReadingTabs button')!)
              .fontSize,
          ),
          font: getComputedStyle(document.querySelector('.tiCodeValue')!)
            .fontFamily,
        };
      });
      expect(wide.right).toBeLessThanOrEqual(wide.viewport);
      expect(wide.tabFont).toBeGreaterThanOrEqual(13);
      expect(wide.sidebar).toBeLessThanOrEqual(300);
      expect(wide.value).toBeGreaterThan(wide.panel * 0.95);
      expect(wide.font).toContain('Courier New');

      await page.locator('[data-ti-section-tab="output"]').focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(
        () =>
          document
            .querySelector('[data-ti-section-tab="input"]')
            ?.getAttribute('aria-selected') === 'true',
      );
      const spacing = await page.evaluate(() => {
        const field = [...document.querySelectorAll('.tiField')].find(
          (node) => node.querySelector('dt')?.textContent === 'language',
        )!;
        return (
          field.querySelector('dd')!.getBoundingClientRect().left -
          field.querySelector('dt')!.getBoundingClientRect().right
        );
      });
      expect(spacing).toBeLessThanOrEqual(20);
      expect(await page.locator('.tiSectionBody').textContent()).not.toContain(
        'request-1',
      );
      await page.locator('[data-ti-mode="json"]').click();
      expect(await page.locator('.tiRawJson').textContent()).toContain(
        'request-1',
      );
      await page.locator('[data-ti-mode="formatted"]').click();
      expect(
        await page
          .locator('[data-ti-section-tab="input"]')
          .getAttribute('aria-selected'),
      ).toBe('true');

      await page.evaluate(() => {
        const view = window as Window & {
          __traceRowsByTraceId?: Map<string, Record<string, unknown>>;
        };
        const row = view.__traceRowsByTraceId?.get('read-1');
        if (!row) throw new Error('Missing selected history row');
        view.__traceRowsByTraceId?.set('read-1', { ...row, durationMs: 1500 });
        view.__traceRowsByTraceId?.set('new-live', {
          ...row,
          id: 'new-live',
          traceId: 'new-live',
          name: 'fs.search',
        });
        document.dispatchEvent(new Event('trace:selection-change'));
      });
      await page.waitForFunction(() =>
        document
          .querySelector('.tiSelectedMeta')
          ?.textContent?.includes('1.50s'),
      );
      expect(
        await page
          .locator('[data-ti-section-tab="input"]')
          .getAttribute('aria-selected'),
      ).toBe('true');
      expect(
        await page
          .locator('[data-ti-peer-select] option[value="new-live"]')
          .count(),
      ).toBe(1);

      const screenshotDir = process.env.CONSUELO_TRACE_READING_SCREENSHOTS;
      if (screenshotDir) mkdirSync(screenshotDir, { recursive: true });
      await page.locator('[data-ti-section-tab="output"]').click();
      for (const colorScheme of ['dark', 'light'] as const) {
        await page.emulateMedia({ colorScheme });
        for (const [width, height] of [
          [1600, 1000],
          [1024, 768],
          [667, 375],
          [568, 320],
          [390, 844],
        ]) {
          await page.setViewportSize({ width, height });
          await page.waitForFunction(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          );
          const header = await page
            .locator('.tiInspector > .tiToolbar')
            .boundingBox();
          expect(header?.y).toBeGreaterThanOrEqual(38);
          const clipped = await page
            .locator('.tiTextValue, .tiCodeValue')
            .evaluateAll(
              (nodes) =>
                nodes.filter(
                  (node) =>
                    node.scrollWidth > node.clientWidth + 1 ||
                    node.getBoundingClientRect().right > innerWidth + 1,
                ).length,
            );
          expect(clipped).toBe(0);
          const contrast = await page
            .locator('.tiCodeValue')
            .first()
            .evaluate((node) => {
              const style = getComputedStyle(node);
              const luminance = (color: string): number => {
                const rgb = (color.match(/[\d.]+/g) ?? [])
                  .slice(0, 3)
                  .map(Number)
                  .map((channel) => {
                    const value = channel / 255;
                    return value <= 0.04045
                      ? value / 12.92
                      : ((value + 0.055) / 1.055) ** 2.4;
                  });
                return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
              };
              const a = luminance(style.color),
                b = luminance(style.backgroundColor);
              return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            });
          expect(contrast).toBeGreaterThanOrEqual(4.5);
          if (screenshotDir)
            await page.screenshot({
              path: join(
                screenshotDir,
                'trace-reading-' + colorScheme + '-' + width + '.png',
              ),
            });
        }
      }
      await page.selectOption('[data-ti-peer-select]', 'failed-child');
      await page.waitForFunction(() =>
        document
          .querySelector('.tiCallError')
          ?.textContent?.includes('NOT_FOUND'),
      );
      expect(await page.locator('.tiSelectedMeta').textContent()).toContain(
        'Failed',
      );
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  },
  45_000,
);
