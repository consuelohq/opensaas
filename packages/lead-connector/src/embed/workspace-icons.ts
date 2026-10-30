const paths = {
  phone:
    '<path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a15 15 0 0 1-7-7l2-2-2-5Z"/>',
  browser:
    '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4M3 8h18"/>',
  history: '<path d="M3 11a9 9 0 1 1 2.6 7M3 4v7h7m2-4v5l3 2"/>',
  settings:
    '<path d="m10 3-1 3-3 1-3-1v4l3 2-1 3-2 2 3 3 3-1 3 2 2-3 3 1 3-3-2-3 1-3 2-2-3-3-3 1-2-3h-3Z"/><circle cx="12" cy="12" r="3"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>',
  back: '<path d="m14 5-7 7 7 7M7 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  minus: '<path d="M5 12h14"/>',
  expand: '<path d="M8 4h12v12M20 4 4 20"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h3"/>',
  team: '<path d="M3 21v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3m2-7a4 4 0 0 1 4 4v3"/><circle cx="9" cy="6" r="4"/><path d="M17 3a4 4 0 0 1 0 8"/>',
  script:
    '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Zm0 0v6h6M8 13h8m-8 4h5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
  incoming: '<path d="M19 5 5 19m0-10v10h10"/>',
  outgoing: '<path d="M5 19 19 5M9 5h10v10"/>',
  upload:
    '<path d="M12 16V3m-5 5 5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
} as const;
export const icon = (name: keyof typeof paths): string =>
  `<svg class="ui-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
