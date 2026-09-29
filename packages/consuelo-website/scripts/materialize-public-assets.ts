import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const assets = [
  { name: 'consuelo-os-og-20260929.png', output: 'public/consuelo-os-og-20260929.png', format: 'png' },
  { name: 'consuelo-os-og-20260929.png', output: 'public/consuelo-os-og-20260714.png', format: 'png' },
  ...['os', 'pricing', 'changelog', 'docs'].map((page) => ({
    name: `consuelo-${page}-og-20260929-clouds.png`,
    output: `public/consuelo-${page}-og-20260929-clouds.png`,
    format: 'png',
  })),
  ...['os', 'pricing', 'changelog', 'docs'].map((page) => ({
    name: `consuelo-${page}-og-20260929-clouds-v2.png`,
    output: `public/consuelo-${page}-og-20260929-clouds-v2.png`,
    format: 'png',
  })),
  ...[1, 2, 3, 4].map((index) => ({
    name: `dialer-cloud-0${index}.webp`,
    output: `public/images/clouds/dialer-cloud-0${index}.webp`,
    format: 'webp',
  })),
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
