// email tracking — /t/open, /t/click, /t/unsub
// cloudflare pages function

interface Env {
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  POSTHOG_KEY: string;
}

interface EventContext {
  request: Request;
  params: { action: string };
  env: Env;
  waitUntil: (promise: Promise<unknown>) => void;
}

const PIXEL_GIF_B64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

async function logToSupabase(env: Env, table: string, data: Record<string, unknown>) {
  await fetch(env.SUPABASE_URL + '/rest/v1/' + table, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_KEY,
      'Authorization': 'Bearer ' + env.SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(data),
  });
}

async function patchSupabase(env: Env, table: string, filter: string, data: Record<string, unknown>) {
  await fetch(env.SUPABASE_URL + '/rest/v1/' + table + '?' + filter, {
    method: 'PATCH',
    headers: {
      'apikey': env.SUPABASE_KEY,
      'Authorization': 'Bearer ' + env.SUPABASE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

async function logToPosthog(env: Env, event: string, leadId: string, properties: Record<string, unknown>) {
  if (!env.POSTHOG_KEY) return;
  await fetch('https://us.i.posthog.com/capture/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: env.POSTHOG_KEY,
      event,
      distinct_id: 'lead_' + leadId,
      properties: { ...properties, source: 'email', lead_id: leadId },
    }),
  });
}

export async function onRequestGet(context: EventContext) {
  const url = new URL(context.request.url);
  const action = context.params.action;
  const leadId = url.searchParams.get('id');
  const env = context.env;

  if (!leadId) return new Response('missing id', { status: 400 });

  const now = new Date().toISOString();

  if (action === 'open') {
    context.waitUntil(Promise.all([
      logToSupabase(env, 'interactions', {
        lead_id: parseInt(leadId),
        type: 'email',
        channel: 'gmail',
        direction: 'inbound',
        outcome: 'opened',
        created_at: now,
      }),
      logToPosthog(env, 'email_opened', leadId, {}),
    ]));

    const gif = Uint8Array.from(atob(PIXEL_GIF_B64), c => c.charCodeAt(0));
    return new Response(gif, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  }

  if (action === 'click') {
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) return new Response('missing url', { status: 400 });

    context.waitUntil(Promise.all([
      logToSupabase(env, 'interactions', {
        lead_id: parseInt(leadId),
        type: 'email',
        channel: 'gmail',
        direction: 'inbound',
        outcome: 'clicked',
        content: targetUrl,
        created_at: now,
      }),
      logToPosthog(env, 'email_clicked', leadId, { url: targetUrl }),
    ]));

    return Response.redirect(targetUrl, 302);
  }

  if (action === 'unsub') {
    context.waitUntil(Promise.all([
      logToSupabase(env, 'interactions', {
        lead_id: parseInt(leadId),
        type: 'email',
        channel: 'gmail',
        direction: 'inbound',
        outcome: 'unsubscribed',
        created_at: now,
      }),
      patchSupabase(env, 'leads', 'id=eq.' + leadId, {
        status: 'unsubscribed',
        updated_at: now,
      }),
      logToPosthog(env, 'email_unsubscribed', leadId, {}),
    ]));

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Unsubscribed</title></head>
<body style="background:#0a0a0a;color:#fff;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center">
<h1 style="font-size:24px;font-weight:700">Unsubscribed</h1>
<p style="color:#888;font-size:15px">You won't receive any more emails from us.</p>
</div></body></html>`;

    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  }

  return new Response('not found', { status: 404 });
}
