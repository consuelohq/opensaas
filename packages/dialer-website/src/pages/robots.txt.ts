import type { APIRoute } from 'astro';
export const GET: APIRoute = () => new Response(import.meta.env.PUBLIC_SITE_CHANNEL === 'production' ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
