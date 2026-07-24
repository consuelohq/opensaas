import { cpSync, mkdirSync, rmSync } from 'node:fs';
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
cpSync(
  join(packageRoot, 'src', 'embed', 'index.html'),
  join(outputDirectory, 'index.html'),
);
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
