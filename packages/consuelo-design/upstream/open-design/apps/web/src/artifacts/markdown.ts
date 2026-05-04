function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderMarkdownToSafeHtml(markdown: string): string {
  const blocks = markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  return blocks
    .map((block) => {
      if (block.startsWith('# ')) return `<h1>${escapeHtml(block.slice(2).trim())}</h1>`;
      if (block.startsWith('## ')) return `<h2>${escapeHtml(block.slice(3).trim())}</h2>`;
      if (block.startsWith('### ')) return `<h3>${escapeHtml(block.slice(4).trim())}</h3>`;
      if (block.startsWith('```')) return `<pre><code>${escapeHtml(block.replace(/^```[a-zA-Z0-9_-]*\n?/, '').replace(/```$/, ''))}</code></pre>`;
      return `<p>${escapeHtml(block).replaceAll('\n', '<br />')}</p>`;
    })
    .join('\n');
}
