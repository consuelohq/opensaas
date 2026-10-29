const docsOrigin = 'https://dialer-docs-links.invalid';

export function resolveDocumentationPath(href, sourceRoute = '/') {
  const value = href.trim();
  if (!value || value.startsWith('#') || value.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  try {
    const resolved = new URL(value, new URL(sourceRoute, docsOrigin));
    return resolved.origin === docsOrigin ? resolved.pathname : null;
  } catch {
    return null;
  }
}

export function isMissingDocumentationLink(href, sourceRoute, { routes, assetExists }) {
  const path = resolveDocumentationPath(href, sourceRoute);
  if (path === null) return false;
  const route = path === '/' ? '/' : path.replace(/\/$/, '') + '/';
  return !routes.has(route) && !assetExists(path);
}

export function collectInvalidDocumentationLinks(text, sourceRoute, options) {
  const invalid = [];
  for (const match of text.matchAll(/\]\(([^)\s]+)\)|href=["']([^"']+)["']/g)) {
    const href = match[1] ?? match[2];
    if (isMissingDocumentationLink(href, sourceRoute, options)) invalid.push(href);
  }
  return invalid;
}
