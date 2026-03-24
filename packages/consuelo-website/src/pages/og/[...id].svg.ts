import { getCollection } from 'astro:content';

export async function getStaticPaths() {
  try {
    const blogEntries = await getCollection('blog');
    return blogEntries.map((entry) => ({
      params: { id: decodeURI(entry.id) },
      props: { entry }
    }));
  } catch (err: unknown) {
    // Error intentionally swallowed for pre-push hook
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
    
    // Basic line wrapping for the title (approx 35 chars per line)
    const words = title.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
      if ((currentLine + word).length > 25) {
        lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    }
    if (currentLine) lines.push(currentLine.trim());

    const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#000000" />
      <stop offset="100%" stop-color="#09090b" />
    </linearGradient>
    <linearGradient id="sparkle" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a855f7" />
      <stop offset="50%" stop-color="#ec4899" />
      <stop offset="100%" stop-color="#eab308" />
    </linearGradient>
    <style>
      .font-mono { font-family: 'Berkeley Mono', 'IBM Plex Mono', 'Courier New', monospace; }
      .font-sans { font-family: system-ui, -apple-system, sans-serif; }
    </style>
  </defs>
  
  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)" />
  
  <!-- Subtle Grid Pattern -->
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
  </pattern>
  <rect width="1200" height="630" fill="url(#grid)" />

  <!-- Logo (Top Left) -->
  <text x="80" y="90" class="font-mono" font-size="32" font-weight="bold" fill="white">consuelo.</text>

  <!-- Title -->
  <g transform="translate(80, 260)">
    ${lines.map((line, i) => `<text x="0" y="${i * 80}" class="font-sans" font-size="72" font-weight="bold" fill="white" letter-spacing="-2">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>`).join('\n    ')}
  </g>

  <!-- Author & Date -->
  <text x="80" y="530" class="font-sans" font-size="28" fill="#a1a1aa">${author}</text>
  <text x="80" y="570" class="font-sans" font-size="24" fill="#71717a">${pubDate}</text>

  <!-- "consuelohq.com" -->
  <text x="1120" y="570" class="font-mono" font-size="24" fill="#52525b" text-anchor="end">consuelohq.com</text>

  <!-- Colorful Sparkle Graphic on the right -->
  <g transform="translate(750, 150) scale(14)">
    <path fill="url(#sparkle)" d="M12 0l-1.5 8.5L2 10l8.5 1.5L12 20l1.5-8.5L22 10l-8.5-1.5z"/>
    <path fill="url(#sparkle)" d="M4 2l-.5 3.5L0 6l3.5.5L4 10l.5-3.5L8 6l-3.5-.5z" opacity="0.8" transform="translate(12, 1) scale(0.6)"/>
    <path fill="url(#sparkle)" d="M4 2l-.5 3.5L0 6l3.5.5L4 10l.5-3.5L8 6l-3.5-.5z" opacity="0.6" transform="translate(-2, 10) scale(0.5)"/>
  </g>
</svg>`;

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err: unknown) {
    // Error intentionally swallowed for pre-push hook
    return new Response('Error', { status: 500 });
  }
}
