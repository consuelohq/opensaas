export function prefixMarkdownUrls({ base = '/' } = {}) {
  const prefix = base.replace(/\/$/, '');
  const rebase = (value) => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    && value !== prefix && !value.startsWith(prefix + '/') && !value.startsWith(prefix + '?') && !value.startsWith(prefix + '#') ? prefix + value : value;
  return (tree) => {
    const visit = (node) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'raw' && typeof node.value === 'string') {
        node.value = node.value.replace(/(\b(?:href|src)=["'])(\/[^"']*)(["'])/g, (_match, start, url, end) => start + rebase(url) + end);
      }
      if (node.properties) for (const key of ['href', 'src']) {
        if (key in node.properties) node.properties[key] = rebase(node.properties[key]);
      }
      for (const attr of node.attributes ?? []) {
        if (attr.type === 'mdxJsxAttribute' && ['href', 'src'].includes(attr.name)) attr.value = rebase(attr.value);
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree);
  };
}
