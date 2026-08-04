import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const outputDirectory = join(packageRoot, 'dist', 'embed-app');
rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });

const result = await Bun.build({
  entrypoints: [join(packageRoot, 'src', 'embed', 'main.ts')],
  outdir: outputDirectory,
  target: 'browser',
  minify: true,
  naming: '[name].[ext]',
});
if (!result.success) {
  for (const log of result.logs) process.stderr.write(`${log.message}\n`);
  process.exit(1);
}
const assetVersion = (fileName: 'main.css' | 'main.js'): string =>
  createHash('sha256')
    .update(readFileSync(join(outputDirectory, fileName)))
    .digest('hex')
    .slice(0, 16);

const indexTemplate = readFileSync(
  join(packageRoot, 'src', 'embed', 'index.html'),
  'utf8',
);
const versionedIndex = indexTemplate
  .replace('./main.css', `./main.css?v=${assetVersion('main.css')}`)
  .replace('./main.js', `./main.js?v=${assetVersion('main.js')}`);
writeFileSync(join(outputDirectory, 'index.html'), versionedIndex);
cpSync(
  join(
    packageRoot,
    'src',
    'embed',
    'public',
    'consuelo-lead-connector-click-to-call.js',
  ),
  join(outputDirectory, 'consuelo-lead-connector-click-to-call.js'),
);
cpSync(
  join(
    packageRoot,
    'src',
    'embed',
    'public',
    'consuelo-lead-connector-click-to-call.css',
  ),
  join(outputDirectory, 'consuelo-lead-connector-click-to-call.css'),
);

const clickToCallSource = readFileSync(
  join(
    packageRoot,
    'src',
    'embed',
    'public',
    'consuelo-lead-connector-click-to-call.js',
  ),
  'utf8',
).trim();
if (clickToCallSource.toLowerCase().includes('</script>')) {
  throw new Error('Click-to-call source cannot contain a closing script tag');
}
writeFileSync(
  join(
    outputDirectory,
    'consuelo-lead-connector-click-to-call.marketplace.html',
  ),
  `<script>\n${clickToCallSource}\n</script>\n`,
);
