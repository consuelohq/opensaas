import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
await sharp(fileURLToPath(new URL('../public/dialer-docs-social.svg', import.meta.url))).png().toFile(fileURLToPath(new URL('../public/dialer-docs-social.png', import.meta.url)));
process.stdout.write('Generated Dialer docs social image.\n');
