export type WorkspaceSurfaceId =
  | 'tracing'
  | 'nodes'
  | 'tools'
  | 'overview'
  | 'secrets';

type WorkspaceRouteGroup = 'Observe' | 'Configure' | 'Connect' | 'Guides';

type WorkspaceRoute = {
  id: WorkspaceSurfaceId | 'chatgpt-connect' | 'claude-connect' | 'documentation';
  label: string;
  href: string;
  group: WorkspaceRouteGroup;
  description: string;
  external?: boolean;
};

const WORKSPACE_ROUTES: WorkspaceRoute[] = [
  {
    id: 'tracing',
    label: 'Tracing',
    href: '/tracing',
    group: 'Observe',
    description: 'Inspect live agent and tool execution.',
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
    id: 'overview',
    label: 'Home',
    href: '/configuration',
    group: 'Configure',
    description: 'Review workspace connections and source control.',
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
    description: 'Open Consuelo documentation and setup guides.',
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

function renderRouteGroup(
  group: WorkspaceRouteGroup,
  active: WorkspaceSurfaceId,
): string {
  const links = WORKSPACE_ROUTES
    .filter((route) => route.group === group)
    .map((route) => {
      const current = route.id === active ? ' aria-current="page"' : '';
      const external = route.external ? ' target="_blank" rel="noopener noreferrer"' : '';
      const cardClass = group === 'Connect' ? ' workspace-route-card' : '';
      return `<a class="workspace-route-option${cardClass}" role="menuitem"${current}${external} href="${escapeHtml(route.href)}"><span>${escapeHtml(route.label)}</span><small>${escapeHtml(route.description)}</small></a>`;
    })
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
    @view-transition { navigation: auto; }
    .trxChrome { view-transition-name: workspace-chrome; }
    .workspace-view, .trxBody { view-transition-name: workspace-body; }
    ::view-transition-old(workspace-chrome), ::view-transition-new(workspace-chrome) { animation-duration: 90ms; }
    ::view-transition-old(workspace-body), ::view-transition-new(workspace-body) { animation-duration: 140ms; animation-timing-function: ease-out; }
    @media (prefers-reduced-motion: reduce) { ::view-transition-group(*) { animation-duration: 0.01ms !important; } }
    .workspace-route-control { position: relative; z-index: 90; min-width: 0; }
    .workspace-route-trigger { appearance: none; border: 0; background: transparent; color: inherit; font: inherit; display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 30px; padding: 2px 9px; border-radius: 7px; cursor: pointer; }
    .workspace-route-trigger:hover, .workspace-route-trigger[aria-expanded="true"] { background: rgba(241, 231, 213, 0.07); }
    .workspace-route-trigger:focus-visible { outline: 1px solid rgba(240, 209, 138, 0.86); outline-offset: 2px; }
    .workspace-route-chevron { color: #918a7f; font-size: 12px; transform: translateY(-1px); }
    .workspace-route-menu { position: absolute; top: calc(100% + 10px); left: 50%; transform: translateX(-50%); width: min(360px, calc(100vw - 28px)); max-height: min(540px, calc(100vh - 72px)); overflow: auto; padding: 8px; border: 1px solid rgba(241, 231, 213, 0.16); border-radius: 13px; background: rgba(21, 21, 21, 0.98); color: #f1e7d5; box-shadow: 0 24px 70px rgba(0, 0, 0, 0.48); backdrop-filter: blur(18px); text-align: left; }
    .workspace-route-group { display: grid; gap: 2px; }
    .workspace-route-group + .workspace-route-group { margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(241, 231, 213, 0.1); }
    .workspace-route-group > p { margin: 4px 8px 5px; color: #918a7f; font: 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .11em; text-transform: uppercase; }
    .workspace-route-option { display: grid; grid-template-columns: 78px minmax(0, 1fr); gap: 12px; align-items: baseline; padding: 9px 8px; border-radius: 8px; color: #d8d0c1; text-decoration: none; }
    .workspace-route-option:hover, .workspace-route-option:focus-visible { background: rgba(241, 231, 213, 0.07); color: #fff3df; outline: none; }
    .workspace-route-option[aria-current="page"] { color: #f0d18a; background: rgba(197, 164, 109, 0.1); }
    .workspace-route-option span { font: 13px/1.25 Georgia, "Times New Roman", serif; }
    .workspace-route-option small { color: #918a7f; font: 10px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace; }
    .workspace-route-group[data-route-group="Connect"] { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
    .workspace-route-group[data-route-group="Connect"] > p { grid-column: 1 / -1; }
    .workspace-route-card { grid-template-columns: 1fr; gap: 5px; align-content: start; min-height: 72px; border: 1px solid rgba(241, 231, 213, 0.10); padding: 10px; }
    .workspace-route-card span { font-size: 15px; }
    @media (max-width: 560px) {
      .workspace-route-menu { left: auto; right: -70px; transform: none; }
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
      const setMenuOpen = (open) => {
        if (!(trigger instanceof HTMLButtonElement) || !(menu instanceof HTMLElement)) return;
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        menu.hidden = !open;
        if (open) {
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
    })();
  `;
}
