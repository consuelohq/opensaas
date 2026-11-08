import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const assets = [
  { name: 'consuelo-dialer-og-20261028.png', output: 'public/consuelo-dialer-og-20261028.png', format: 'png' },
  { name: 'consuelo-dialer-pricing-og-20261028.png', output: 'public/consuelo-dialer-pricing-og-20261028.png', format: 'png' },
  { name: 'consuelo-dialer-pricing-og-20261030.png', output: 'public/consuelo-dialer-pricing-og-20261030.png', format: 'png' },
  ...[1, 2, 3, 4].map((index) => ({ name: `dialer-cloud-0${index}.webp`, output: `public/images/clouds/dialer-cloud-0${index}.webp`, format: 'webp' })),
] as const;

for (const asset of assets) {
  const encoded = (await readFile(join(packageRoot, 'assets/encoded', `${asset.name}.base64`), 'utf8')).trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
    throw new Error(`Invalid base64 asset: ${asset.name}`);
  }

  const bytes = Buffer.from(encoded, 'base64');
  const valid = asset.format === 'png'
    ? bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid) {
    throw new Error(`Invalid image signature: ${asset.name}`);
  }

  const outputPath = join(packageRoot, asset.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, bytes);
}

// Embed-demo assets are derived from the first-party dialer source at build
// time. Keep WOFF2 binaries out of GitHub API task.push (which reads UTF-8).
const embedPublic = join(packageRoot, '../lead-connector/src/embed/public');
const demoAssets = join(packageRoot, 'public/demo/assets');
await mkdir(demoAssets, { recursive: true });
for (const font of ['interface', 'wordmark']) {
  const encoded = (await readFile(join(embedPublic, 'fonts', font + '.woff2.base64'), 'utf8')).trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
    throw new Error('Invalid first-party demo font: ' + font);
  }
  const data = Buffer.from(encoded, 'base64');
  if (data.toString('ascii', 0, 4) !== 'wOF2') {
    throw new Error('Invalid WOFF2 signature: ' + font);
  }
  await writeFile(join(demoAssets, font + '.woff2'), data);
}
for (const license of ['inter-LICENSE.txt', 'bodoni-moda-LICENSE.txt']) {
  await copyFile(join(embedPublic, 'fonts', license), join(demoAssets, license));
}
await copyFile(join(embedPublic, 'consuelo-logo.svg'), join(packageRoot, 'public/consuelo-logo.svg'));

// Generate icons from SVG so publication never rewrites binary source bytes.
for (const [name, size] of [['favicon-32x32.png', 32], ['apple-touch-icon.png', 180]] as const) {
  await sharp(join(packageRoot, 'public/favicon.svg')).resize(size, size).png().toFile(join(packageRoot, 'public', name));
}
