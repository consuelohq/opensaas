import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
import sharp from 'sharp';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const tokensPath = join(packageRoot, 'src/styles/tokens.css');

export const socialCards = {
  home: { fileName: 'consuelo-os-og-20260929-files.png', label: 'CONSUELO OS', headline: ['GIVE YOUR AI', 'ACCESS TO', 'YOUR FILES.'], kicker: 'FILES · TERMINAL · TOOLS', domain: 'consuelohq.com' },
  pricing: { fileName: 'consuelo-pricing-og-20260929-clouds-v2.png', label: 'PRICING', headline: ['THE RIGHT PLAN,', 'FOR EVERY', 'WORKSPACE.'], kicker: 'FREE · PLUS · SUPER · ULTRA', domain: 'consuelohq.com/pricing' },
  changelog: { fileName: 'consuelo-changelog-og-20260929-clouds-v2.png', label: 'CHANGELOG', headline: ["WHAT'S NEW", 'IN YOUR', 'WORKSPACE.'], kicker: 'THE LATEST FROM CONSUELO OS', domain: 'consuelohq.com/changelog' },
  docs: { fileName: 'consuelo-docs-og-20260929-clouds-v2.png', label: 'DOCS', headline: ['BUILD YOUR', 'WORKSPACE,', 'CONNECT AGENTS.'], kicker: 'GET STARTED WITH CONSUELO OS', domain: 'docs.consuelohq.com' },
} as const;

type CardKey = keyof typeof socialCards;

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

export const renderSocialCard = async (key: CardKey) => {
  const card = socialCards[key];
  try {
    const [tokens, bodoniFont, interFont, leftCloud, rightCloud] = await Promise.all([
      readFile(tokensPath, 'utf8'),
      readResolvedFile(
        '@fontsource-variable/bodoni-moda/files/bodoni-moda-latin-wght-normal.woff2',
      ),
      readResolvedFile(
        '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
      ),
      readFile(join(packageRoot, 'assets/encoded/dialer-cloud-01.webp.base64'), 'utf8'),
      readFile(join(packageRoot, 'assets/encoded/dialer-cloud-02.webp.base64'), 'utf8'),
    ]);
    const onBrand = readToken(tokens, '--site-color-on-brand');
    const cardBackground = '#0000F2';
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
                z-index: 3;
                inset: 34px;
                border: 4px solid ${onBrand};
                content: '';
                pointer-events: none;
              }
              .cloud {
                position: absolute;
                z-index: 0;
                max-width: none;
                pointer-events: none;
                -webkit-mask-image: linear-gradient(to right, #000 0%, #000 52%, transparent 88%);
                mask-image: linear-gradient(to right, #000 0%, #000 52%, transparent 88%);
              }
              .cloud--left { width: 760px; left: -220px; bottom: -245px; opacity: 0.56; }
              .cloud--right { width: 820px; right: -300px; top: -120px; opacity: 0.5; }
              .quiet-zone {
                position: absolute;
                z-index: 1;
                inset: 0;
                background: radial-gradient(ellipse at 50% 50%, rgba(0, 0, 242, 0.88), rgba(0, 0, 242, 0.55) 48%, transparent 78%);
                pointer-events: none;
              }
              .top, .bottom, h1 { position: relative; z-index: 2; }
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
              h1 span { display: block; white-space: nowrap; }
              .bottom {
                font-size: 18px;
              }
              .kicker { font-weight: 760; letter-spacing: 2px; }
            </style>
          </head>
          <body>
            <img class="cloud cloud--left" src="data:image/webp;base64,${leftCloud.trim()}" alt="">
            <img class="cloud cloud--right" src="data:image/webp;base64,${rightCloud.trim()}" alt="">
            <div class="quiet-zone"></div>
            <div class="top">
              <span class="brand">consuelo.</span>
              <span class="product">${card.label}</span>
            </div>
            <h1>${card.headline.map((line) => `<span>${line}</span>`).join('')}</h1>
            <div class="bottom">
              <span class="kicker">${card.kicker}</span>
              <span>${card.domain}</span>
            </div>
          </body>
        </html>
      `);
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.cloud').evaluateAll((images) =>
        Promise.all(images.map((image) => (image as HTMLImageElement).decode())),
      );
      await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }));
      await page.screenshot({ type: 'png' });
      await page.waitForTimeout(100);
      const screenshot = await page.screenshot({ type: 'png' });
      return await sharp(screenshot).png({ palette: true, quality: 100, effort: 8 }).toBuffer();
    } finally {
      await browser.close();
    }
  } catch (err: unknown) {
    throw new Error(`Failed to render the social card: ${getErrorMessage(err)}`, {
      cause: err,
    });
  }
};

export const writeSocialCards = async () => {
  try {
    const outputPaths: string[] = [];
    for (const key of Object.keys(socialCards) as CardKey[]) {
      const card = socialCards[key];
      const image = await renderSocialCard(key);
      const outputPath = join(packageRoot, 'public', card.fileName);
      const encodedPath = join(packageRoot, 'assets/encoded', `${card.fileName}.base64`);
      await mkdir(dirname(outputPath), { recursive: true });
      await mkdir(dirname(encodedPath), { recursive: true });
      await writeFile(outputPath, image);
      await writeFile(encodedPath, image.toString('base64') + '\n');
      outputPaths.push(outputPath);
    }
    return outputPaths;
  } catch (err: unknown) {
    throw new Error(`Failed to write social cards: ${getErrorMessage(err)}`, { cause: err });
  }
};

if (import.meta.main) {
  for (const path of await writeSocialCards()) process.stdout.write(path + '\n');
}
