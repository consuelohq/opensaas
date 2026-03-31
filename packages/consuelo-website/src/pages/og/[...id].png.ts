import { getCollection } from 'astro:content';
import { Resvg } from '@resvg/resvg-js';

export async function getStaticPaths() {
  try {
    const blogEntries = await getCollection('blog');
    return blogEntries.map((entry) => ({
      params: { id: decodeURI(entry.id) },
      props: { entry }
    }));
  } catch (err: unknown) {
    return [];
  }
}

import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ props }) => {
  try {
    const { entry } = props;
    const title = entry.data.title;
    const author = entry.data.author || 'Kokayi Cobb';
    const pubDate = entry.data.pubDate ? new Date(entry.data.pubDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    
    const words = title.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
      if ((currentLine + word).length > 30) {
        lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    }
    if (currentLine) lines.push(currentLine.trim());

    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .mono { font-family: 'Courier New', monospace; }
      .sans { font-family: Arial, Helvetica, sans-serif; }
    </style>
  </defs>
  
  <rect width="1200" height="630" fill="#070707" />

  <text x="80" y="88" class="mono" font-size="28" font-weight="700" fill="#ffffff">consuelo.</text>

  <line x1="80" y1="120" x2="1120" y2="120" stroke="#1a1a1a" stroke-width="1" />

  <g transform="translate(80, 280)">
    ${lines.slice(0, 4).map((line, i) => `<text x="0" y="${i * 72}" class="sans" font-size="60" font-weight="700" fill="#ffffff" letter-spacing="-2">${esc(line)}</text>`).join('\n    ')}
  </g>

  <text x="80" y="560" class="sans" font-size="22" fill="#666666">${esc(author)}${pubDate ? '  ·  ' + esc(pubDate) : ''}</text>

  <text x="1120" y="560" class="mono" font-size="20" fill="#333333" text-anchor="end">consuelohq.com</text>
</svg>`;

const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
const png = resvg.render().asPng();

return new Response(png as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err: unknown) {
    return new Response('Error', { status: 500 });
  }
}
