import { existsSync, mkdirSync } from 'node:fs';
import { chromium, type Page } from 'playwright';
import { expect, it } from 'vitest';
import { buildObservabilityTracesSite } from '../scripts/lib/observability-traces-site';
const browserTest = existsSync(chromium.executablePath()) ? it : it.skip;
const rows = [
  {
    id: 'success',
    traceId: 'success',
    name: 'fs.read',
    startTime: '2026-10-29T19:39:00Z',
    durationMs: 578,
    ok: true,
    status: 'success',
    branch: 'task/trace-site-makeover/current',
    inputTokens: 10,
    outputTokens: 568,
    tokens: 578,
    resolvedNodeId: 'node_local',
    resolvedNodeName: 'Local Mac',
    routeSource: 'default',
    rawInputJson: { path: 'src/routes.ts' },
    rawResultJson: {
      ok: true,
      code: 'OK',
      data: { content: '## Captured source\n\nReadable content' },
    },
  },
  {
    id: 'error',
    traceId: 'error',
    name: 'fs.read',
    startTime: '2026-10-29T19:38:00Z',
    durationMs: 117,
    ok: false,
    status: 'error',
    branch: 'task/trace-site-makeover/current',
    inputTokens: 12,
    outputTokens: 21,
    tokens: 33,
    resolvedNodeId: 'node_local',
    resolvedNodeName: 'Local Mac',
    routeSource: 'default',
    rawInputJson: { path: 'src/missing.ts' },
    rawResultJson: {
      ok: false,
      code: 'NOT_FOUND',
      message: 'Captured file was not found',
    },
  },
  {
    id: 'historical',
    traceId: 'historical',
    name: 'fs.read',
    ok: true,
    status: 'success',
    branch: 'task/trace-site-makeover/current',
    tokenCountsRecorded: { input: false, output: false, total: false },
    inputTokens: 0,
    outputTokens: 0,
    tokens: 0,
    rawInputJson: { path: 'old.ts' },
  },
];
async function fixture(page: Page) {
  const html = buildObservabilityTracesSite();
  await page.addInitScript(() =>
    localStorage.setItem('consuelo.trace-inspector.width', '1100'),
  );
  await page.route('**/*', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/traces')
      return route.fulfill({ contentType: 'text/html', body: html });
    if (path === '/gateway/traces/recent')
      return route.fulfill({
        json: {
          ok: true,
          data: { direction: 'older', rows, nextCursor: null },
        },
      });
    if (path === '/gateway/traces/events')
      return route.fulfill({
        contentType: 'text/event-stream',
        body: 'event: heartbeat\ndata: {}\n\n',
      });
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto('https://trace.test/traces', {
    waitUntil: 'domcontentloaded',
  });
  await page.locator('.trxRow[data-trace-key="success"]').waitFor();
}
for (const colorScheme of ['dark', 'light'] as const)
  browserTest(
    'keeps the ' +
      colorScheme +
      ' table borderless and aligned through Cost, with field-wide feedback',
    async () => {
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({
          viewport: { width: 2560, height: 1200 },
          colorScheme,
        });
        await fixture(page);
        const row = page.locator('.trxRow[data-trace-key="success"]');
        const geometry = await page.evaluate(() => {
          const head = document.querySelector('.trxHead')!,
            table = document.querySelector('.trxTable')!,
            row = document.querySelector('.trxRow')!;
          return {
            head: getComputedStyle(head).backgroundColor,
            body: getComputedStyle(document.querySelector('.trxTablePane')!)
              .backgroundColor,
            border: getComputedStyle(row).borderBottomWidth,
            headBorder: getComputedStyle(head).borderBottomWidth,
            padding: getComputedStyle(table).paddingRight,
            endGap:
              table.getBoundingClientRect().right -
              head.lastElementChild!.getBoundingClientRect().right,
          };
        });
        expect(geometry.head).toBe(geometry.body);
        expect(geometry.border).toBe('0px');
        expect(geometry.headBorder).toBe('0px');
        expect(geometry.padding).toBe('0px');
        expect(Math.abs(geometry.endGap)).toBeLessThan(2);
        await row.hover();
        await page.waitForTimeout(150);
        const feedback = await row
          .locator(':scope > div')
          .evaluateAll((cells) =>
            cells
              .slice(1)
              .map((cell) => ({
                filter: getComputedStyle(cell).filter,
                transform: getComputedStyle(cell).transform,
              })),
          );
        expect(
          feedback.every(
            (style) => style.filter !== 'none' && style.transform !== 'none',
          ),
        ).toBe(true);
        const successSession = await row
          .locator('.trxBranch')
          .evaluate((node) => getComputedStyle(node).color);
        const error = page.locator('.trxRow[data-trace-key="error"]');
        const colors = await error
          .locator(':scope > div:not(.trxBranch)')
          .evaluateAll((cells) =>
            cells
              .flatMap((cell) => [cell, ...cell.querySelectorAll('*')])
              .filter((node) => node.textContent?.trim())
              .map((node) => getComputedStyle(node).color),
          );
        const red = await error.evaluate((node) => {
          const probe = document.createElement('span');
          probe.style.color = 'var(--ti-red)';
          node.append(probe);
          const color = getComputedStyle(probe).color;
          probe.remove();
          return color;
        });
        expect(colors.every((color) => color === red)).toBe(true);
        expect(
          await error
            .locator('.trxBranch')
            .evaluate((node) => getComputedStyle(node).color),
        ).toBe(successSession);
        const shots = process.env.CONSUELO_TRACE_READING_SCREENSHOTS;
        if (shots) {
          mkdirSync(shots, { recursive: true });
          await page.screenshot({ path: shots + '/borderless-table-' + colorScheme + '.png' });
        }
        await row.click();
        await page.locator('.tiInspector').waitFor({ state: 'visible' });
        expect(
          await row.evaluate((node) => getComputedStyle(node).outlineStyle),
        ).toBe('none');
        expect(
          await row.evaluate((node) => getComputedStyle(node).boxShadow),
        ).toBe('none');
        await page.locator('[data-ti-close]').click();
        expect(
          await page
            .locator('.trxRow[data-trace-key="historical"] .trxNode')
            .textContent(),
        ).toContain('Not recorded');
        expect(
          await page
            .locator('.trxRow[data-trace-key="historical"] .trxTokens')
            .getAttribute('data-trace-tooltip'),
        ).toContain('not recorded');
        await page.keyboard.press('Tab');
        await row.focus();
        expect(await row.evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        expect(await row.locator(':scope > div').first().evaluate(node => getComputedStyle(node).transform)).toBe('none');
      } finally {
        await browser.close();
      }
    },
    20000,
  );
browserTest(
  'joins the table to a draggable inspector edge and separates content with headings instead of dividers',
  async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 1600, height: 1000 },
        colorScheme: 'dark',
      });
      await fixture(page);
      await page.locator('.trxRow[data-trace-key="success"]').click();
      const before = await page.evaluate(() => {
        const table = document
            .querySelector('.trxTablePane')!
            .getBoundingClientRect(),
          inspector = document
            .querySelector('.tiInspector')!
            .getBoundingClientRect(),
          divider = document
            .querySelector('.tiDivider')!
            .getBoundingClientRect();
        return {
          tableRight: table.right,
          inspectorLeft: inspector.left,
          inspectorWidth: inspector.width,
          dividerLeft: divider.left,
          dividerWidth: divider.width,
        };
      });
      expect(Math.abs(before.inspectorLeft - before.tableRight)).toBeLessThan(
        2,
      );
      expect(
        Math.abs(
          before.dividerLeft + before.dividerWidth / 2 - before.tableRight,
        ),
      ).toBeLessThan(2);
      expect(before.dividerWidth).toBeGreaterThanOrEqual(8);
      const sectionStyles = await page
        .locator(
          '.tiReading > header,.tiDiagnostics,.tiResultCard,.tiToolbar,.tiPeer,.tiSidebar',
        )
        .evaluateAll((nodes) =>
          nodes.map((node) => ({
            className: node.className,
            top: getComputedStyle(node).borderTopWidth,
            bottom: getComputedStyle(node).borderBottomWidth,
            left: getComputedStyle(node).borderLeftWidth,
            right: getComputedStyle(node).borderRightWidth,
          })),
        );
      expect(sectionStyles.filter(style => Object.entries(style).some(([key, width]) => key !== "className" && width !== "0px"))).toEqual([]);
      expect(
        await page
          .locator('.tiReading h3')
          .first()
          .evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
      ).toBe(15);
      expect(
        await page
          .locator('.tiDiagnostics > summary')
          .evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
      ).toBe(13);
      const divider = page.locator('.tiDivider');
      const box = (await divider.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + 100);
      await page.mouse.down();
      await page.mouse.move(box.x - 100, box.y + 100, { steps: 8 });
      await page.mouse.up();
      await page.waitForFunction(
        (width) =>
          document.querySelector('.tiInspector')!.getBoundingClientRect()
            .width >
          width + 70,
        before.inspectorWidth,
      );
      const shots = process.env.CONSUELO_TRACE_READING_SCREENSHOTS;
      if (shots) {
        mkdirSync(shots, { recursive: true });
        await page.screenshot({ path: shots + '/borderless-inspector.png' });
      }
      await divider.click();
      await page.locator('.tiInspector').waitFor({ state: 'hidden' });
    } finally {
      await browser.close();
    }
  },
  20000,
);