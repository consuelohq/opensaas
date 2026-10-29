import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { docsSidebar, footerSections } from '../src/lib/docs-navigation.ts';
import { collectInvalidDocumentationLinks, isMissingDocumentationLink } from './lib/docs-links.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const content = resolve(root, 'src/content/docs');
const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = resolve(directory, entry.name);
  return entry.isDirectory() ? walk(path) : /\.mdx?$/.test(path) ? [path] : [];
});
const files = walk(content);
const routeForFile = (file) => {
  const slug = file.slice(content.length + 1).replace(/\.mdx?$/, '').replace(/\/index$/, '');
  return slug === 'index' ? '/' : '/' + slug + '/';
};
const routes = new Set(files.map(routeForFile));
const failures = [];
const linkOptions = {
  routes,
  assetExists: (path) => existsSync(resolve(root, 'public', path.slice(1))),
};
const checkLink = (href, source) => {
  if (isMissingDocumentationLink(href, '/', linkOptions)) failures.push(`${source}: missing ${href}`);
};
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  if (!/^---\n[\s\S]*?title: .+[\s\S]*?description: .+[\s\S]*?status: preview[\s\S]*?\n---/.test(text)) failures.push(`${file}: incomplete metadata`);
  for (const href of collectInvalidDocumentationLinks(text, routeForFile(file), linkOptions)) failures.push(`${file}: missing ${href}`);
  if (/install\.consuelohq\.com|consuelo connect|zero latency|100% answer/i.test(text)) failures.push(`${file}: inherited or unsupported claim`);
}
const visit = (items) => items.forEach((item) => 'slug' in item ? checkLink('/' + item.slug + '/', 'sidebar') : visit(item.items));
docsSidebar.forEach((group) => visit(group.items));
footerSections.forEach((group) => { checkLink(group.href, 'footer'); group.links.forEach((link) => checkLink(link.href, 'footer')); });
if (failures.length) { process.stderr.write(failures.join('\n') + '\n'); process.exitCode = 1; }
else process.stdout.write(`Validated ${files.length} Dialer pages, all sidebar/footer destinations and internal content links.\n`);
