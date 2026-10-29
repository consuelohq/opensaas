import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const step = (name, cwd, env, deploy) => ({ name, cwd, env, deploy });
export function publicReleasePlan(surface, phase = 'legacy') {
  if (!['website', 'docs'].includes(surface)) throw new Error('Unknown public release surface');
  if (!['legacy', 'os-mounted', 'dialer'].includes(phase)) throw new Error('Unknown public release phase');
  const legacyWebsite = step('legacy-website', 'packages/consuelo-website', {}, 'pages');
  const legacyDocs = step('legacy-docs', 'packages/documentation', {}, 'worker');
  const osWebsite = step('os-website', 'packages/consuelo-website', {
    OS_SITE_BASE: '/about', OS_SITE_OUT_DIR: './dist-os', PUBLIC_SITE_ORIGIN: 'https://os.consuelohq.com',
    PUBLIC_DOCS_URL: 'https://os.consuelohq.com/docs',
  }, 'worker');
  const osDocs = step('os-docs', 'packages/documentation', {
    DOCS_BASE_PATH: '/docs', DOCS_OUT_DIR: './dist-os', DOCS_SITE_URL: 'https://os.consuelohq.com',
    PUBLIC_OS_WEBSITE_URL: 'https://os.consuelohq.com/about', DOCS_WRANGLER_CONFIG: './wrangler.os.jsonc',
  }, 'worker');
  const dialerWebsite = step('dialer-website', 'packages/dialer-website', { PUBLIC_SITE_CHANNEL: 'production' }, 'pages');
  const dialerDocs = step('dialer-docs', 'packages/dialer-documentation', {
    DOCS_SITE_URL: 'https://docs.consuelohq.com', DOCS_WRANGLER_CONFIG: './wrangler.production.jsonc',
  }, 'worker');
  if (surface === 'website') return phase === 'legacy' ? [legacyWebsite] : phase === 'os-mounted' ? [osWebsite] : [osWebsite, dialerWebsite];
  return phase === 'legacy' ? [legacyDocs] : phase === 'os-mounted' ? [legacyDocs, osDocs] : [legacyDocs, osDocs, dialerDocs];
}

export function prepareOsWebsiteAssets(cwd, preview = false) {
  const output = resolve(cwd, '.public-assets');
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  cpSync(resolve(cwd, 'dist-os'), resolve(output, 'about'), { recursive: true });
  // Pages-only rewrites must not escape the namespace on the Worker.
  rmSync(resolve(output, 'about/_redirects'), { force: true });
  cpSync(resolve(cwd, 'dist-os/404.html'), resolve(output, '404.html'));
  const headers = readFileSync(resolve(cwd, 'public/_headers'), 'utf8').replace(/^\/(.*)$/gm, '/about/$1');
  writeFileSync(resolve(output, '_headers'), headers + (preview ? '\n/about/*\n  X-Robots-Tag: noindex, nofollow\n' : ''));
  const manifest = JSON.parse(readFileSync(resolve(output, 'about/site.webmanifest'), 'utf8'));
  manifest.start_url = '/about/';
  manifest.scope = '/about/';
  for (const icon of manifest.icons) icon.src = '/about' + icon.src;
  writeFileSync(resolve(output, 'about/site.webmanifest'), JSON.stringify(manifest));
  const robots = resolve(output, 'about/robots.txt');
  writeFileSync(robots, readFileSync(robots, 'utf8').replaceAll('https://consuelohq.com/', 'https://os.consuelohq.com/about/'));

}

function main() {
  const args = process.argv.slice(2);
  const surface = args[args.indexOf('--surface') + 1];
  const phase = process.env.CONSUELO_PUBLIC_SITE_PHASE || 'legacy';
  const deploy = args.includes('--deploy');
  if (deploy && process.env.CI && !process.env.CLOUDFLARE_ACCOUNT_ID) throw new Error('Missing CLOUDFLARE_ACCOUNT_ID');
  const preview = args.includes('--preview');
  if (preview && phase === 'legacy') throw new Error('Preview requires an explicit mounting phase');
  for (const item of publicReleasePlan(surface, phase)) {
    // Staging the new namespaces never updates the legacy production origin.
    if (preview && item.name.startsWith('legacy-')) continue;
    const cwd = resolve(root, item.cwd);
    const env = { ...process.env, ...item.env };
    if (preview && item.name === 'os-docs') { env.DOCS_WRANGLER_CONFIG = './wrangler.os-preview.jsonc'; env.PUBLIC_DOCS_PREVIEW = '1'; }
    if (preview && item.name === 'dialer-docs') env.DOCS_WRANGLER_CONFIG = './wrangler.jsonc';
    if (preview && item.name === 'dialer-website') env.PUBLIC_SITE_CHANNEL = 'preview';
    const run = (command, extra = {}) => {
      const result = spawnSync(command[0], command.slice(1), { cwd, env: { ...env, ...extra }, stdio: 'inherit' });
      if (result.status !== 0) throw new Error(`${item.name} command failed (${result.status})`);
    };
    run(['bun', 'install', '--frozen-lockfile']);
    run(['bun', 'run', 'build']);
    if (item.name === 'os-website') prepareOsWebsiteAssets(cwd, preview);
    if (!deploy) continue;
    // Never make a release fall back from a scoped CI token to local OAuth.
    const token = item.deploy === 'pages' ? process.env.CLOUDFLARE_PAGES_API_TOKEN : process.env.CLOUDFLARE_API_TOKEN;
    if (!token && process.env.CI) throw new Error(`Missing Cloudflare token for ${item.deploy}`);
    const auth = token ? { CLOUDFLARE_API_TOKEN: token } : {};
    if (item.deploy === 'pages') {
      run(['bun', 'x', 'wrangler', 'pages', 'deploy', 'dist', '--project-name', preview ? 'consuelo-dialer-website-preview' : 'consuelo-website', '--branch', 'main', '--commit-hash', process.env.GITHUB_SHA || 'unknown'], auth);
    } else {
      const config = item.name === 'os-website' ? (preview ? 'wrangler.os-preview.jsonc' : 'wrangler.os.jsonc')
        : item.name === 'os-docs' ? 'dist-os/server/wrangler.json' : 'dist/server/wrangler.json';
      if (!existsSync(resolve(cwd, config))) throw new Error('Generated Worker configuration missing');
      run(['bun', 'x', 'wrangler', 'deploy', '--config', config], auth);
    }
  }
}
if (import.meta.main) main();
