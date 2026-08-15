export type WorkspaceSurfaceId =
  | 'overview'
  | 'tracing'
  | 'nodes'
  | 'tools'
  | 'secrets'
  | 'documentation';

type WorkspaceRouteGroup = 'Observe' | 'Configure' | 'Connect' | 'Guides' | null;

const WORKSPACE_ROUTES: Array<{
  id: WorkspaceSurfaceId | 'artifacts' | 'diffs' | 'chatgpt-connect' | 'claude-connect';
  label: string;
  href: string;
  group: WorkspaceRouteGroup;
  description: string;
  external?: boolean;
}> = [
  {
    id: 'overview',
    label: 'Home',
    href: '/configuration',
    group: null,
    description: 'Workspace health and operating context.',
  },
  {
    id: 'tracing',
    label: 'Tracing',
    href: '/tracing',
    group: 'Observe',
    description: 'Inspect live traces and tool execution.',
  },
  {
    id: 'artifacts',
    label: 'Artifacts',
    href: '/artifacts',
    group: 'Observe',
    description: 'Browse agent work and generated outputs.',
  },
  {
    id: 'diffs',
    label: 'Code',
    href: '/diffs',
    group: 'Observe',
    description: 'Review code diffs and changes.',
  },
  {
    id: 'nodes',
    label: 'Nodes',
    href: '/nodes',
    group: 'Configure',
    description: 'Choose where Consuelo runs.',
  },
  {
    id: 'tools',
    label: 'Tools',
    href: '/tools',
    group: 'Configure',
    description: 'Manage tools, skills, and workflows.',
  },
  {
    id: 'secrets',
    label: 'Secrets',
    href: '/secrets',
    group: 'Configure',
    description: 'Manage credential bindings without revealing values.',
  },
  {
    id: 'chatgpt-connect',
    label: 'ChatGPT',
    href: 'https://chatgpt.com/plugins#settings/Connectors?create-connector=true&redirectAfter=%2Fplugins',
    group: 'Connect',
    description: 'Add Consuelo as a custom MCP connector.',
    external: true,
  },
  {
    id: 'claude-connect',
    label: 'Claude',
    href: 'https://claude.ai/customize/connectors',
    group: 'Connect',
    description: 'Add Consuelo as a custom MCP connector.',
    external: true,
  },
  {
    id: 'documentation',
    label: 'Documentation',
    href: '/docs',
    group: 'Guides',
    description: 'Guides, setup, and operating references.',
  },
];

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderRouteOption(
  route: (typeof WORKSPACE_ROUTES)[number],
  active: WorkspaceSurfaceId,
  primary = false,
): string {
  const current = route.id === active ? ' aria-current="page"' : '';
  const className = primary
    ? 'workspace-route-option workspace-route-primary'
    : route.group === 'Connect'
      ? 'workspace-route-option workspace-route-card'
      : 'workspace-route-option';
  const external = route.external
    ? ' target="_blank" rel="noopener noreferrer"'
    : '';
  return `<a class="${className}" role="menuitem"${current}${external} href="${escapeHtml(route.href)}"><span>${escapeHtml(route.label)}</span><small>${escapeHtml(route.description)}</small></a>`;
}

function renderRouteGroup(
  group: Exclude<WorkspaceRouteGroup, null>,
  active: WorkspaceSurfaceId,
): string {
  const links = WORKSPACE_ROUTES
    .filter((route) => route.group === group)
    .map((route) => renderRouteOption(route, active))
    .join('');
  return `<section class="workspace-route-group" data-route-group="${group}"><p>${group}</p>${links}</section>`;
}

export function renderWorkspaceChromeBar(
  active: WorkspaceSurfaceId,
  title: string,
): string {
  const traceCompat = active === 'tracing';
  const menuShortcut = traceCompat ? '' : ' data-workspace-menu-shortcut';
  const fullscreenControl = traceCompat ? '' : ' data-workspace-fullscreen';
  const overviewRoute = WORKSPACE_ROUTES.find((route) => route.id === 'overview');
  if (!overviewRoute) throw new Error('Workspace Home route is required.');
  return `<div class="trxChrome" data-workspace-chrome>
    <div class="trxDots" aria-label="Window controls">
      <button class="trxDot red" type="button" data-window-control="close" data-close-traces data-workspace-home aria-label="Go to Nodes"></button>
      <button class="trxDot yellow" type="button" data-window-control="sidebar"${menuShortcut} aria-label="${traceCompat ? 'Toggle trace sidebar' : 'Open workspace routes'}"></button>
      <button class="trxDot green" type="button" data-window-control="fullscreen"${fullscreenControl} aria-label="Toggle fullscreen"></button>
    </div>
    <div class="trxChromeTitle workspace-route-control">
      <button type="button" class="workspace-route-trigger" data-workspace-route-trigger aria-haspopup="menu" aria-expanded="false" aria-controls="workspace-route-menu">
        <span>${escapeHtml(title)}</span><span class="workspace-route-chevron" aria-hidden="true">⌄</span>
      </button>
      <div id="workspace-route-menu" class="workspace-route-menu" data-workspace-route-menu role="menu" aria-label="Workspace routes" hidden>
        <div class="workspace-route-primary-slot">${renderRouteOption(overviewRoute, active, true)}</div>
        ${renderRouteGroup('Observe', active)}
        ${renderRouteGroup('Configure', active)}
        ${renderRouteGroup('Connect', active)}
        ${renderRouteGroup('Guides', active)}
      </div>
    </div>
    <div class="trxChromeActions"><span class="trxClock" data-workspace-clock>--:--</span></div>
  </div>`;
}

export function workspaceRouteSwitcherStyles(): string {
  return `
    :root {
      --workspace-chrome-bg: #f4efe7;
      --workspace-chrome-ink: #29251f;
      --workspace-chrome-muted: #756d63;
      --workspace-chrome-border: rgba(41, 37, 31, 0.14);
      --workspace-menu-bg: rgba(255, 255, 248, 0.98);
      --workspace-menu-ink: #29251f;
      --workspace-menu-muted: #756d63;
      --workspace-menu-border: rgba(41, 37, 31, 0.16);
      --workspace-menu-rule: rgba(41, 37, 31, 0.10);
      --workspace-menu-hover: rgba(41, 37, 31, 0.06);
      --workspace-menu-current: rgba(164, 66, 37, 0.10);
      --workspace-menu-accent: #a44225;
      --workspace-menu-shadow: 0 24px 70px rgba(49, 37, 24, 0.18);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --workspace-chrome-bg: #151515;
        --workspace-chrome-ink: #ddd7ce;
        --workspace-chrome-muted: #999187;
        --workspace-chrome-border: rgba(221, 215, 206, 0.12);
        --workspace-menu-bg: rgba(21, 21, 21, 0.98);
        --workspace-menu-ink: #ddd7ce;
        --workspace-menu-muted: #999187;
        --workspace-menu-border: rgba(221, 215, 206, 0.16);
        --workspace-menu-rule: rgba(221, 215, 206, 0.10);
        --workspace-menu-hover: rgba(221, 215, 206, 0.07);
        --workspace-menu-current: rgba(252, 141, 98, 0.11);
        --workspace-menu-accent: #fc8d62;
        --workspace-menu-shadow: 0 24px 70px rgba(0, 0, 0, 0.48);
      }
    }
    @view-transition { navigation: auto; }
    .trxChrome[data-workspace-chrome] { view-transition-name: workspace-chrome; background: var(--workspace-chrome-bg) !important; color: var(--workspace-chrome-ink) !important; border-bottom-color: var(--workspace-chrome-border) !important; }
    .trxChrome[data-workspace-chrome] .trxChromeTitle, .trxChrome[data-workspace-chrome] .workspace-route-trigger { color: var(--workspace-chrome-ink) !important; }
    .trxChrome[data-workspace-chrome] .trxClock, .trxChrome[data-workspace-chrome] .workspace-route-chevron { color: var(--workspace-chrome-muted) !important; }
    .workspace-view, .trxBody { view-transition-name: workspace-body; }
    ::view-transition-old(workspace-chrome), ::view-transition-new(workspace-chrome) { animation-duration: 90ms; }
    ::view-transition-old(workspace-body), ::view-transition-new(workspace-body) { animation-duration: 140ms; animation-timing-function: ease-out; }
    @media (prefers-reduced-motion: reduce) { ::view-transition-group(*) { animation-duration: 0.01ms !important; } }
    .workspace-route-control { position: relative; z-index: 90; min-width: 0; }
    .workspace-route-trigger { appearance: none; border: 0; background: transparent; color: inherit; font: inherit; display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 30px; padding: 2px 9px; border-radius: 7px; cursor: pointer; }
    .workspace-route-trigger:hover, .workspace-route-trigger[aria-expanded="true"] { background: var(--workspace-menu-hover); }
    .workspace-route-trigger:focus-visible { outline: none; background: var(--workspace-menu-current); color: var(--workspace-menu-accent); box-shadow: inset 0 -2px 0 var(--workspace-menu-accent); }
    .workspace-route-chevron { font-size: 12px; transform: translateY(-1px); }
    .workspace-route-menu { position: absolute; top: calc(100% + 10px); left: 50%; transform: translateX(-50%); width: min(360px, calc(100vw - 28px)); max-height: min(540px, calc(100vh - 72px)); overflow: auto; padding: 8px; border: 1px solid var(--workspace-menu-border); border-radius: 13px; background: var(--workspace-menu-bg); color: var(--workspace-menu-ink); box-shadow: var(--workspace-menu-shadow); backdrop-filter: blur(18px); text-align: left; }
    .workspace-route-primary-slot { padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid var(--workspace-menu-rule); }
    .workspace-route-primary { grid-template-columns: 78px minmax(0, 1fr); }
    .workspace-route-group { display: grid; gap: 2px; }
    .workspace-route-group + .workspace-route-group { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--workspace-menu-rule); }
    .workspace-route-group > p { margin: 4px 8px 5px; color: var(--workspace-menu-muted); font: 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .11em; text-transform: uppercase; }
    .workspace-route-option { display: grid; grid-template-columns: 78px minmax(0, 1fr); gap: 12px; align-items: baseline; padding: 9px 8px; border-radius: 8px; color: var(--workspace-menu-ink); text-decoration: none; }
    .workspace-route-option:hover, .workspace-route-option:focus-visible { background: var(--workspace-menu-hover); color: var(--workspace-menu-ink); outline: none; }
    .workspace-route-option[aria-current="page"] { color: var(--workspace-menu-accent); background: var(--workspace-menu-current); }
    .workspace-route-option span { font: 13px/1.25 Georgia, "Times New Roman", serif; }
    .workspace-route-option small { color: var(--workspace-menu-muted); font: 10px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace; }
    .workspace-route-group[data-route-group="Connect"] { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
    .workspace-route-group[data-route-group="Connect"] > p { grid-column: 1 / -1; }
    .workspace-route-card { grid-template-columns: 1fr; gap: 5px; align-content: start; min-height: 72px; border: 1px solid var(--workspace-menu-rule); padding: 10px; }
    .workspace-route-card span { font-size: 15px; }
    @media (max-width: 560px) {
      .workspace-route-menu { position: fixed; top: 52px; left: 50vw; right: auto; transform: translateX(-50%); width: min(360px, calc(100vw - 24px)); max-height: calc(100dvh - 64px); }
      .workspace-route-option { grid-template-columns: 70px minmax(0, 1fr); }
    }
  `;
}

export function workspaceChromeClientScript(): string {
  return String.raw`
    (() => {
      const trigger = document.querySelector('[data-workspace-route-trigger]');
      const shortcut = document.querySelector('[data-workspace-menu-shortcut]');
      const menu = document.querySelector('[data-workspace-route-menu]');
      const close = document.querySelector('button[data-close-traces]');
      const fullscreen = document.querySelector('[data-workspace-fullscreen]');
      const clock = document.querySelector('[data-workspace-clock]');
      const TRACE_PREFETCH_KEY = 'consuelo:tracing-prefetch:v1';
      const TRACE_PREFETCH_URL = '/gateway/traces/recent?direction=older&cursor=latest&limit=40&site=trace-burn-intelligence&sourceMode=local-networked&includeRawPayload=false';
      const TRACE_PREFETCH_MAX_BYTES = 250000;
      const TRACE_PREFETCH_TTL_MS = 20000;
      const warmedRoutes = new Set();
      let tracePrefetchPromise = null;
      const sameOriginRoute = (href) => {
        try {
          const url = new URL(href, window.location.href);
          return url.origin === window.location.origin ? url.pathname + url.search + url.hash : null;
        } catch {
          return null;
        }
      };
      const warmRoute = (href) => {
        const route = sameOriginRoute(href);
        if (!route || warmedRoutes.has(route) || route === window.location.pathname + window.location.search + window.location.hash) return;
        warmedRoutes.add(route);
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = route;
        link.as = 'document';
        link.setAttribute('data-workspace-prefetch', '');
        document.head.appendChild(link);
      };
      const warmTracingPreview = () => {
        if (window.location.pathname === '/tracing') return Promise.resolve();
        if (tracePrefetchPromise) return tracePrefetchPromise;
        tracePrefetchPromise = fetch(TRACE_PREFETCH_URL, {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { accept: 'application/json' },
        }).then((response) => {
          if (!response.ok) throw new Error('trace prefetch returned ' + response.status);
          return response.json();
        }).then((payload) => {
          const savedAt = Date.now();
          const encoded = JSON.stringify({ savedAt, payload });
          if (encoded.length <= TRACE_PREFETCH_MAX_BYTES) {
            sessionStorage.setItem(TRACE_PREFETCH_KEY, encoded);
            window.setTimeout(() => {
              try {
                const raw = sessionStorage.getItem(TRACE_PREFETCH_KEY);
                const cached = raw ? JSON.parse(raw) : null;
                if (cached && Number(cached.savedAt || 0) === savedAt) sessionStorage.removeItem(TRACE_PREFETCH_KEY);
              } catch {
                try { sessionStorage.removeItem(TRACE_PREFETCH_KEY); } catch {}
              }
            }, TRACE_PREFETCH_TTL_MS);
          }
        }).catch(() => {
          // Trace prefetch is opportunistic; live Tracing remains the source of truth.
        }).finally(() => {
          tracePrefetchPromise = null;
        });
        return tracePrefetchPromise;
      };
      const warmMenuRoutes = () => {
        if (!(menu instanceof HTMLElement)) return;
        menu.querySelectorAll('a[href]').forEach((link) => {
          if (link instanceof HTMLAnchorElement) warmRoute(link.getAttribute('href') || '');
        });
        void warmTracingPreview();
      };
      const warmIntent = (event) => {
        const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
        if (!(target instanceof HTMLAnchorElement) || !(menu instanceof HTMLElement) || !menu.contains(target)) return;
        const href = target.getAttribute('href') || '';
        warmRoute(href);
        if (sameOriginRoute(href)?.startsWith('/tracing')) void warmTracingPreview();
      };
      const setMenuOpen = (open) => {
        if (!(trigger instanceof HTMLButtonElement) || !(menu instanceof HTMLElement)) return;
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        menu.hidden = !open;
        if (open) {
          warmMenuRoutes();
          const current = menu.querySelector('[aria-current="page"]');
          const first = current || menu.querySelector('[role="menuitem"]');
          if (first instanceof HTMLElement) window.requestAnimationFrame(() => first.focus());
        }
      };
      const toggleMenu = () => {
        if (!(trigger instanceof HTMLButtonElement)) return;
        setMenuOpen(trigger.getAttribute('aria-expanded') !== 'true');
      };
      trigger?.addEventListener('click', toggleMenu);
      menu?.addEventListener('pointerover', warmIntent);
      menu?.addEventListener('focusin', warmIntent);
      menu?.addEventListener('touchstart', warmIntent, { passive: true });
      shortcut?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleMenu();
      });
      close?.addEventListener('click', () => { location.assign('/'); });
      fullscreen?.addEventListener('click', async (event) => {
        event.preventDefault();
        const root = document.documentElement;
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else if (root.requestFullscreen) await root.requestFullscreen();
        } catch {
          // Fullscreen is optional; route navigation remains available.
        }
      });
      document.addEventListener('pointerdown', (event) => {
        if (!(menu instanceof HTMLElement) || menu.hidden) return;
        const target = event.target;
        if (target instanceof Node && !menu.contains(target) && trigger instanceof Node && !trigger.contains(target)) setMenuOpen(false);
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && trigger instanceof HTMLButtonElement && trigger.getAttribute('aria-expanded') === 'true') {
          event.preventDefault();
          event.stopPropagation();
          setMenuOpen(false);
          trigger.focus();
        }
      });
      const updateClock = () => {
        if (!(clock instanceof HTMLElement)) return;
        clock.textContent = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
      };
      updateClock();
      window.setInterval(updateClock, 30_000);
      const scheduleWarmHome = () => warmRoute('/configuration');
      if ('requestIdleCallback' in window) window.requestIdleCallback(scheduleWarmHome, { timeout: 1200 });
      else window.setTimeout(scheduleWarmHome, 180);
    })();
  `;
}
