import { htmlEscape, showCode } from './utils';

export const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...(init.headers ?? {}),
    },
  });
export const text = (body: string, init: ResponseInit = {}) =>
  new Response(body, {
    ...init,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...(init.headers ?? {}),
    },
  });
export const methodNotAllowed = (allow: string) =>
  new Response('Method not allowed\n', {
    status: 405,
    headers: {
      allow,
      'content-type': 'text/plain; charset=utf-8',
      'x-content-type-options': 'nosniff',
    },
  });

export function page(input: {
  code: string;
  origin: string;
  message?: string;
  error?: string;
}): string {
  const shown = htmlEscape(showCode(input.code));
  const hidden = shown.replace(/-/g, '');
  const approveUrl = new URL('/login/google/start', input.origin);
  approveUrl.searchParams.set('user_code', hidden);
  const state = input.error
    ? 'failed'
    : input.message
      ? 'authorized'
      : 'signin';
  const title =
    state === 'authorized'
      ? 'Device authorized'
      : state === 'failed'
        ? 'Device authorization failed'
        : 'Sign in to Consuelo OS';
  const message =
    state === 'authorized'
      ? 'Your device has been authorized. You can close this window and return to your terminal.'
      : state === 'failed'
        ? htmlEscape(
            input.error ??
              'Return to your terminal and restart device approval.',
          )
        : 'Enter the code shown in your terminal.';
  const detail =
    state === 'authorized' && input.message
      ? `<p class="detail">${htmlEscape(input.message)}</p>`
      : '';
  const codeBox =
    state === 'signin'
      ? `<div class="code-box" aria-live="polite"><strong class="code" data-device-code>${shown || 'Waiting for code'}</strong></div>`
      : '';
  const guardrail =
    state === 'signin'
      ? '<p class="guardrail">Only continue if you just initiated a sign-in from your device.</p>'
      : '';
  const action =
    state === 'signin'
      ? `<a class="button" href="${htmlEscape(approveUrl.toString())}">Continue with Google</a>`
      : '';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#fff;color:#171717;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shell{min-height:100vh;display:grid;grid-template-columns:minmax(0,52%) minmax(0,48%)}.copy{min-height:100vh;display:grid;grid-template-rows:auto 1fr;padding:42px clamp(24px,6vw,88px) 64px}.brand{width:fit-content;color:#171717;font-size:14px;font-weight:600;letter-spacing:0;line-height:1;text-decoration:none}.form{align-self:center;width:min(100%,680px);display:grid;gap:23px}.form h1{margin:0 0 26px;color:#171717;font-size:34px;font-weight:400;letter-spacing:0;line-height:1.06}.instruction,.guardrail,.message{margin:0;color:#777;font-size:16px;line-height:1.6}.detail{margin:0;color:#999;font-size:14px;line-height:1.5}.code-box{min-height:58px;display:grid;place-items:center;background:#fff;box-shadow:rgba(0,0,0,.1) 0 0 0 1px}.code{color:#171717;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:19px;font-weight:650;letter-spacing:0;line-height:1}.button{min-height:74px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;background:#000;color:#fff;font-size:17px;font-weight:500;line-height:1;text-decoration:none}.visual{position:relative;min-height:100vh;overflow:hidden;background:radial-gradient(circle at 82% 48%,rgba(255,255,255,.32),transparent 0 28%,transparent 46%),linear-gradient(125deg,#050505 0%,#0c0d10 48%,#26313e 100%)}.mark{position:absolute;right:-64px;top:50%;transform:translateY(-50%) rotate(-18deg);color:rgba(255,255,255,.11);font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:272px;font-weight:700;letter-spacing:0;line-height:.85;white-space:nowrap}@media(max-width:860px){.shell{grid-template-columns:1fr}.copy{min-height:68vh;padding:22px 20px 42px}.form{align-self:end;gap:18px}.form h1{margin-bottom:16px;font-size:34px}.button{min-height:58px}.visual{min-height:32vh}.mark{right:16px;font-size:144px}}</style></head><body><main class="shell" data-os-device-page-state="${state}"><section class="copy"><a class="brand" href="/" aria-label="Consuelo OS home">Consuelo OS</a><div class="form"><h1>${title}</h1><p class="${state === 'signin' ? 'instruction' : 'message'}">${message}</p>${codeBox}${guardrail}${action}${detail}</div></section><aside class="visual" aria-hidden="true"><div class="mark">OS</div></aside></main></body></html>`;
}

