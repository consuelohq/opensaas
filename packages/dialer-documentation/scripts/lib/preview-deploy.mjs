export function requirePreviewOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Set DOCS_SITE_URL to the isolated HTTPS preview origin before deploy:preview.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      ['docs.consuelohq.com', 'os.consuelohq.com', 'consuelohq.com', 'www.consuelohq.com'].includes(url.hostname)) {
    throw new Error('DOCS_SITE_URL must be an isolated HTTPS preview origin, without a path or production domain.');
  }
  return url.origin;
}
