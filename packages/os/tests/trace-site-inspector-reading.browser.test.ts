import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { expect, it } from 'vitest';
import { buildObservabilityTracesSite } from '../scripts/lib/observability-traces-site';

const browserTest = existsSync(chromium.executablePath()) ? it : it.skip;
browserTest(
  'keeps one-page semantic call content readable and preserves navigation',
  async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport: { width: 1600, height: 1000 },
        permissions: ['clipboard-read', 'clipboard-write'],
      });
      const page = await context.newPage();
      page.setDefaultTimeout(8000);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const branch = 'task/trace-site/readable-inspector';
      const call = (
        id: string,
        name: string,
        input: unknown,
        data: unknown,
      ) => ({
        id,
        traceId: id,
        name,
        branch,
        startTime: '2026-10-29T04:00:00Z',
        ok: true,
        status: 'success',
        code: 'OK',
        durationMs: 1250,
        inputTokens: 1234,
        outputTokens: 450,
        tokens: 1684,
        rawInputJson: JSON.stringify({
          requestId: 'request-1',
          taskSession: 'tsk_example',
          ...(input as object),
        }),
        rawResultJson: JSON.stringify({
          ok: true,
          code: 'OK',
          message: 'command completed',
          data,
        }),
      });
      const first = call(
        'read-1',
        'code.call',
        {
          language: 'python',
          mode: 'read',
          code: 'print("A long useful example")\n'.repeat(4),
        },
        {
          stdout:
            (
              'A complete line of output with 0 plain zeros and meaningful content. '.repeat(
                4,
              ) + '\n'
            ).repeat(35) + 'END OF OUTPUT',
          exitCode: 0,
        },
      );
      const search = call(
        'search-1',
        'tools.search',
        { query: 'Read source files' },
        {
          results: [
            {
              name: 'fs.read',
              description: 'Read one or more source files',
              signature: 'fs.read({files})',
              schema: {
                type: 'object',
                properties: { files: { type: 'array' } },
              },
            },
          ],
        },
      );
      const files = call(
        'files-1',
        'fs.read',
        {
          files: [
            { path: 'docs/architecture.md', from: 10, to: 40 },
            { path: 'src/routes.ts', from: 1, to: 60 },
          ],
          filesJson: 'duplicate',
        },
        {
          files: [
            {
              path: 'docs/architecture.md',
              mime: 'text/markdown',
              content:
                '# Architecture\n\nThe captured **routing rules**.\n\n- Local\n- Cloud\n\nEND OF DOCUMENT',
            },
          ],
        },
      );
      const steering = call(
        'steering-1',
        'get_steering',
        {},
        {
          content:
            '# Captured steering\n\nRead the **source** at the time of this call.\n\n- Inspect\n- Verify',
          decision: 'full',
        },
      );
      const batch = {
        id: 'batch-1',
        traceId: 'batch-1',
        name: 'batch',
        branch,
        startTime: '2026-10-29T03:59:59Z',
        ok: true,
        status: 'success',
        durationMs: 500,
        batchResultsJson: [
          {
            traceId: 'failed-child',
            tool: 'github',
            ok: false,
            code: 'NOT_FOUND',
            message: 'Cannot find workflow 42',
            data: { reason: 'Workflow removed' },
          },
        ],
      };
      const rows = [first, search, files, steering, batch];
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
      expect(
        await page
          .locator('.trxRow[data-trace-key="read-1"] .trxTokens')
          .textContent(),
      ).toBe('1,684');
      await page.locator('.trxRow[data-trace-key="read-1"]').click();
      await page.waitForSelector('[data-ti-section="input"]');
      expect(await page.locator('[role="tab"]').count()).toBe(0);
      expect(
        await page.locator('.tiReading > header h3').allTextContents(),
      ).toEqual(['Input', 'Output']);
      const output = page.locator('[data-ti-section="output"]');
      const input = page.locator('[data-ti-section="input"]');
      expect(await output.textContent()).toContain('END OF OUTPUT');
      expect(await input.textContent()).not.toContain('request-1');
      expect(await output.textContent()).not.toContain('command completed');
      expect(await page.locator('.tiFailureCount').textContent()).toBe(
        '1 failed',
      );
      expect(await page.locator('.tiLoadedCount').textContent()).toBe(
        '6 calls loaded',
      );
      expect(await page.locator('.tiSelectedMeta').textContent()).toContain(
        'python.read',
      );
      expect(await page.locator('.tiSelectedMeta').textContent()).toContain(
        '1,684 tokens',
      );
      expect(await page.locator('.tiCallStatus').textContent()).toBe('✤');
      const wide = await page.evaluate(() => {
        const sidebar = document.querySelector<HTMLElement>('.tiSidebar')!;
        const value = document.querySelector<HTMLElement>(
          '[data-ti-section="output"] .tiLongField dd',
        )!;
        const panel = document.querySelector<HTMLElement>(
          '[data-ti-section="output"] .tiSectionBody',
        )!;
        return {
          sidebar: sidebar.getBoundingClientRect().width,
          value: value.getBoundingClientRect().width,
          panel: panel.getBoundingClientRect().width,
          right: value.getBoundingClientRect().right,
          viewport: innerWidth,
          order:
            document.querySelector('.tiToolbarIdentity')!.firstElementChild!
              .className,
          font: getComputedStyle(document.querySelector('.tiCodeValue')!)
            .fontFamily,
        };
      });
      expect(wide.sidebar).toBeGreaterThanOrEqual(340);
      expect(wide.right).toBeLessThanOrEqual(wide.viewport);
      expect(wide.value).toBeGreaterThan(wide.panel * 0.95);
      expect(wide.order).toBe('tiSelectedMeta');
      expect(wide.font).toContain('Courier New');
      await input.locator('[data-ti-copy]').click();
      expect(
        await page.evaluate(() => navigator.clipboard.readText()),
      ).toContain('python');
      await output.locator('[data-ti-copy]').click();
      expect(
        await page.evaluate(() => navigator.clipboard.readText()),
      ).toContain('END OF OUTPUT');
      await page.locator('[data-ti-mode="json"]').click();
      expect(await page.locator('.tiRawJson').textContent()).toContain(
        'request-1',
      );
      await page.locator('[data-ti-mode="formatted"]').click();
      await page.waitForSelector('[data-ti-section="input"]');
      expect(
        await page.locator('.tiReading > header h3').allTextContents(),
      ).toEqual(['Input', 'Output']);
      await page.locator('.tiDiagnostics > summary').click();
      await page.evaluate(() => {
        const view = window as Window & {
          __traceRowsByTraceId?: Map<string, Record<string, unknown>>;
        };
        const row = view.__traceRowsByTraceId?.get('read-1');
        if (!row) throw new Error('Missing selected row');
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
        await page.locator('.tiDiagnostics').getAttribute('open'),
      ).not.toBeNull();
      expect(
        await page
          .locator('[data-ti-peer-select] option[value="new-live"]')
          .count(),
      ).toBe(1);
      await page.locator('.tiDiagnostics > summary').click();

      await page.locator('.tiPreview').evaluate((node) => (node.scrollTop = 0));
      const screenshotDir = process.env.CONSUELO_TRACE_READING_SCREENSHOTS;
      if (screenshotDir) mkdirSync(screenshotDir, { recursive: true });
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
            .locator('.tiTextValue,.tiCodeValue')
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
              const luminance = (color: string) => {
                const rgb = (color.match(/[\d.]+/g) ?? [])
                  .slice(0, 3)
                  .map(Number)
                  .map((channel) => {
                    const v = channel / 255;
                    return v <= 0.04045
                      ? v / 12.92
                      : ((v + 0.055) / 1.055) ** 2.4;
                  });
                return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
              };
              let ancestor: Element | null = node;
              let background = style.backgroundColor;
              while (
                ancestor &&
                (background === 'transparent' ||
                  background === 'rgba(0, 0, 0, 0)')
              ) {
                background = getComputedStyle(ancestor).backgroundColor;
                ancestor = ancestor.parentElement;
              }
              const a = luminance(style.color),
                b = luminance(background);
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
      const selectCall = async (id: string) => {
        await page.selectOption('[data-ti-peer-select]', id);
        await page.waitForFunction(
          (key) =>
            document
              .querySelector('.tiInspector')
              ?.getAttribute('data-ti-trace-key') === key,
          id,
        );
      };
      await selectCall('files-1');
      expect(await page.locator('.tiFileTargets li').count()).toBe(2);
      expect(await input.textContent()).not.toContain('filesJson');
      expect(await output.locator('.tiMarkdown h1').textContent()).toBe(
        'Architecture',
      );
      await selectCall('search-1');
      expect(await output.locator('.tiResultCard h4').textContent()).toBe(
        'fs.read',
      );
      expect(
        await output.getByText('Read one or more source files').isVisible(),
      ).toBe(true);
      await selectCall('steering-1');
      expect(await output.locator('.tiMarkdown h1').textContent()).toBe(
        'Captured steering',
      );
      await selectCall('failed-child');
      await page.waitForFunction(() =>
        document
          .querySelector('.tiCallError')
          ?.textContent?.includes('Cannot find workflow 42'),
      );
      expect(await page.locator('.tiCallError').isVisible()).toBe(true);
      expect(await page.locator('.tiSelectedMeta').textContent()).toContain(
        'Failed',
      );
      if (screenshotDir) {
        await page.setViewportSize({ width: 1600, height: 1000 });
        for (const key of [
          'files-1',
          'search-1',
          'steering-1',
          'failed-child',
        ]) {
          await page.locator('.tiPeer[data-trace-key="' + key + '"]').click();
          await page.waitForFunction(
            (id) =>
              document
                .querySelector('.tiInspector')
                ?.getAttribute('data-ti-trace-key') === id,
            key,
          );
          await page.screenshot({
            path: join(screenshotDir, 'trace-semantic-' + key + '.png'),
          });
        }
      }
      expect(
        await page
          .locator('.tiInspector')
          .evaluate((node) => Number(getComputedStyle(node).opacity)),
      ).toBe(1);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  },
  45000,
);
