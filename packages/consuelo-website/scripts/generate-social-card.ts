import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { homepageSeo } from '../src/lib/homepage-seo';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const tokensPath = join(packageRoot, 'src/styles/tokens.css');

const readToken = (source: string, name: string) => {
  const match = source.match(new RegExp(`${name}:\\s*([^;]+);`));

  if (!match?.[1]) {
    throw new Error(`Missing website design token: ${name}`);
  }

  return match[1].trim();
};

const escapeXml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const getErrorMessage = (err: unknown) =>
  err instanceof Error ? err.message : 'Unknown error';

export const renderHomepageSocialCard = async () => {
  try {
    const tokens = await readFile(tokensPath, 'utf8');
    const paper = readToken(tokens, '--site-color-paper');
    const ink = readToken(tokens, '--site-color-ink');
    const accent = readToken(tokens, '--site-color-accent');
    const muted = readToken(tokens, '--site-color-muted');
    const [firstLine, ...remainingWords] =
      homepageSeo.socialCardHeadline.split(', ');
    const remainingLine = remainingWords.join(', ');

    const svg = `
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="630" fill="${paper}" />
      <rect x="0" y="0" width="16" height="630" fill="${accent}" />

      <text x="80" y="82" font-family="'Courier New', monospace" font-size="26" font-weight="700" fill="${ink}">consuelo.</text>
      <text x="1120" y="82" text-anchor="end" font-family="'Courier New', monospace" font-size="18" letter-spacing="2" fill="${muted}">CONSUELO OS</text>
      <line x1="80" y1="116" x2="1120" y2="116" stroke="${ink}" stroke-opacity="0.14" />

      <text x="80" y="190" font-family="'Courier New', monospace" font-size="18" font-weight="700" letter-spacing="3" fill="${accent}">ONE WORKSPACE · EVERY AGENT</text>

      <text x="80" y="318" font-family="Georgia, 'Times New Roman', serif" font-size="94" font-weight="400" letter-spacing="-4" fill="${ink}">${escapeXml(firstLine)},</text>
      <text x="80" y="426" font-family="Georgia, 'Times New Roman', serif" font-size="94" font-weight="400" letter-spacing="-4" fill="${ink}">${escapeXml(remainingLine)}</text>

      <line x1="80" y1="522" x2="1120" y2="522" stroke="${ink}" stroke-opacity="0.14" />
      <text x="80" y="570" font-family="'Courier New', monospace" font-size="20" fill="${muted}">consuelohq.com</text>
      <circle cx="1106" cy="564" r="8" fill="${accent}" />
    </svg>
  `;

    return sharp(Buffer.from(svg))
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
  } catch (err: unknown) {
    throw new Error(`Failed to render the homepage social card: ${getErrorMessage(err)}`, {
      cause: err,
    });
  }
};

export const writeHomepageSocialCard = async (
  outputPath = join(packageRoot, 'public/og.png'),
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
