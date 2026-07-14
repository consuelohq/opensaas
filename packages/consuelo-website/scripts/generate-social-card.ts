import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const tokensPath = join(packageRoot, 'src/styles/tokens.css');

const readToken = (source: string, name: string) => {
  const match = source.match(new RegExp(`${name}:\\s*([^;]+);`));

  if (!match?.[1]) {
    throw new Error(`Missing website design token: ${name}`);
  }

  return match[1].trim();
};

const getErrorMessage = (err: unknown) =>
  err instanceof Error ? err.message : 'Unknown error';

const readResolvedFile = (specifier: string) =>
  readFile(fileURLToPath(import.meta.resolve(specifier)));

export const renderHomepageSocialCard = async () => {
  try {
    const [tokens, bodoniFont, interFont] = await Promise.all([
      readFile(tokensPath, 'utf8'),
      readResolvedFile(
        '@fontsource-variable/bodoni-moda/files/bodoni-moda-latin-wght-normal.woff2',
      ),
      readResolvedFile(
        '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
      ),
    ]);
    const onBrand = readToken(tokens, '--site-color-on-brand');
    const cardBackground = '#000000';
    const bodoniData = bodoniFont.toString('base64');
    const interData = interFont.toString('base64');
    const browser = await chromium.launch();

    try {
      const page = await browser.newPage({
        viewport: { width: 1200, height: 630 },
        deviceScaleFactor: 1,
      });
      await page.setContent(`
        <!doctype html>
        <html>
          <head>
            <style>
              @font-face {
                font-family: 'Card Bodoni';
                src: url(data:font/woff2;base64,${bodoniData}) format('woff2');
                font-weight: 100 900;
              }
              @font-face {
                font-family: 'Card Inter';
                src: url(data:font/woff2;base64,${interData}) format('woff2');
                font-weight: 100 900;
              }
              * { box-sizing: border-box; }
              html, body { width: 1200px; height: 630px; margin: 0; overflow: hidden; }
              body {
                position: relative;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                background: ${cardBackground};
                color: ${onBrand};
                padding: 70px 78px 66px;
                font-family: 'Card Inter', sans-serif;
              }
              body::before {
                position: absolute;
                inset: 34px;
                border: 4px solid ${onBrand};
                content: '';
                pointer-events: none;
              }
              .top, .bottom { display: flex; align-items: center; justify-content: space-between; }
              .brand { font-size: 25px; font-weight: 760; }
              .product { font-size: 17px; font-weight: 760; letter-spacing: 3px; }
              h1 {
                margin: 0;
                font-family: 'Card Bodoni', Georgia, serif;
                font-size: 92px;
                font-weight: 430;
                letter-spacing: -3px;
                line-height: 1.02;
              }
              h1 span { display: block; }
              .bottom {
                border-top: 1px solid color-mix(in srgb, ${onBrand} 45%, transparent);
                padding-top: 24px;
                font-size: 18px;
              }
              .kicker { font-weight: 760; letter-spacing: 2px; }
            </style>
          </head>
          <body>
            <div class="top">
              <span class="brand">consuelo.</span>
              <span class="product">CONSUELO OS</span>
            </div>
            <h1>
              <span>YOUR WORKSPACE,</span>
              <span>CONNECTED TO</span>
              <span>EVERY AGENT.</span>
            </h1>
            <div class="bottom">
              <span class="kicker">ONE WORKSPACE · EVERY AGENT</span>
              <span>consuelohq.com</span>
            </div>
          </body>
        </html>
      `);
      await page.evaluate(() => document.fonts.ready);
      return await page.screenshot({ type: 'png' });
    } finally {
      await browser.close();
    }
  } catch (err: unknown) {
    throw new Error(`Failed to render the homepage social card: ${getErrorMessage(err)}`, {
      cause: err,
    });
  }
};

export const writeHomepageSocialCard = async (
  outputPath = join(packageRoot, 'public/consuelo-os-og-20260713.png'),
) => {
  try {
    const image = await renderHomepageSocialCard();
    await writeFile(outputPath, image);
    return outputPath;
  } catch (err: unknown) {
    throw new Error(`Failed to write the homepage social card: ${getErrorMessage(err)}`, {
      cause: err,
    });
  }
};

if (import.meta.main) {
  const outputPath = await writeHomepageSocialCard();
  process.stdout.write(`${outputPath}\n`);
}
