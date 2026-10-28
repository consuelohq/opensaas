import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePath = join(packageRoot, 'public/images/home/consuelo-mark.svg');

const createIco = (png: Buffer) => {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(32, 6);
  header.writeUInt8(32, 7);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(header.length, 18);
  return Buffer.concat([header, png]);
};

const getMarkGroup = (source: string) => {
  const match = source.match(/<g transform="[^"]+"\s*\n?fill="#0000F2" stroke="none">[\s\S]*<\/g>/);

  if (!match) {
    throw new Error('Unable to locate the Consuelo mark vector group');
  }

  return match[0].replace('fill="#0000F2"', 'fill="#000000"');
};

export const renderCanonicalAppIcon = async () => {
  try {
    const source = await readFile(sourcePath, 'utf8');
    const mark = getMarkGroup(source);

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg data-consuelo-app-icon="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200" role="img" aria-label="Consuelo">
  <defs>
    <clipPath id="consuelo-app-tile">
      <rect width="1200" height="1200" rx="216" />
    </clipPath>
  </defs>
  <g clip-path="url(#consuelo-app-tile)">
    <rect width="1200" height="1200" rx="216" fill="#FFFFFF" />
    <g transform="translate(84 84) scale(0.86)">
      ${mark}
    </g>
  </g>
</svg>
`;
  } catch (error: unknown) {
    throw new Error('Unable to render the canonical Consuelo app icon', { cause: error });
  }
};

export const writeBrandAssets = async () => {
  try {
    const svg = await renderCanonicalAppIcon();
    const publicDir = join(packageRoot, 'public');
    const svgTargets = [
      join(publicDir, 'favicon.svg'),
      join(publicDir, 'logo.svg'),
      join(packageRoot, '../documentation/public/favicon.svg'),
    ];

    await Promise.all(svgTargets.map((target) => writeFile(target, svg)));

    const sizes = [
      ['favicon-32x32.png', 32],
      ['apple-touch-icon.png', 180],
      ['favicon-192x192.png', 192],
      ['favicon-512x512.png', 512],
      ['apple-touch-icon-800x800.png', 800],
    ] as const;

    const rendered = await Promise.all(
      sizes.map(async ([name, size]) => {
        try {
          const png = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
          await writeFile(join(publicDir, name), png);
          return { name, size, png };
        } catch (error: unknown) {
          throw new Error('Unable to render brand asset ' + name, { cause: error });
        }
      }),
    );

    const favicon = rendered.find(({ name }) => name === 'favicon-32x32.png');
    if (!favicon) {
      throw new Error('Missing 32px favicon render');
    }
    await writeFile(join(publicDir, 'favicon.ico'), createIco(favicon.png));

    return [...svgTargets, ...rendered.map(({ name }) => join(publicDir, name))];
  } catch (error: unknown) {
    throw new Error('Unable to write canonical Consuelo brand assets', { cause: error });
  }
};

if (import.meta.main) {
  const outputs = await writeBrandAssets();
  process.stdout.write(`${outputs.join('\n')}\n`);
}
