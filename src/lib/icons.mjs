// Original line icons, drawn for this site. 24 x 24 grid, 1.75 stroke.

const PATHS = {
  logo: '<path d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3"/><circle cx="12" cy="12" r="3.25"/>',
  article: '<path d="M6.5 3.5h8l4 4v13h-12z"/><path d="M14.5 3.5v4h4"/><path d="M9.5 12h6M9.5 16h6"/>',
  tutorial: '<path d="M3.5 19.5h5v-5h5v-5h5v-5"/><path d="M15.5 4.5h3v3" />',
  clock: '<circle cx="12" cy="12" r="8.25"/><path d="M12 7.5V12l3 2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chevron: '<path d="M6.5 9.5l5.5 5.5 5.5-5.5"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 5.5v-1a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h1"/>',
  sun: '<circle cx="12" cy="12" r="3.75"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  pen: '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M13.5 8.5l3 3"/>',
  moon: '<path d="M19.5 14.2A8 8 0 0 1 9.8 4.5a8 8 0 1 0 9.7 9.7z"/>',
  auto: '<circle cx="12" cy="12" r="8.25"/><path d="M12 3.75v16.5A8.25 8.25 0 0 0 12 3.75z" fill="currentColor" stroke="none"/>',
  external: '<path d="M10 5.5H6.5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V14"/><path d="M13.5 4.5h6v6M19 5l-8 8"/>',
  file: '<path d="M6.5 3.5h8l4 4v13h-12z"/><path d="M14.5 3.5v4h4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  arrow: '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.3-5.4"/><path d="M4.5 4.5v4.2h4.2"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  expand: '<path d="M14 4.5h5.5V10M10 19.5H4.5V14M19.5 4.5l-6.5 6.5M4.5 19.5l6.5-6.5"/>',
  branch: '<circle cx="7" cy="6" r="2.25"/><circle cx="7" cy="18" r="2.25"/><circle cx="17" cy="9" r="2.25"/><path d="M7 8.25v7.5M17 11.25c0 3-4 3.25-10 4.5"/>',
  tool: '<path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3L15 12l-3-3z"/>',
  note: '<circle cx="12" cy="12" r="8.25"/><path d="M12 11v5.5M12 7.6v.4"/>',
  tip: '<path d="M9 17.5h6M10 20.5h4"/><path d="M8.5 14.5a6 6 0 1 1 7 0c-.6.5-1 1.2-1 2h-5c0-.8-.4-1.5-1-2z"/>',
  important: '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.5M12 17v.4"/>',
  experiment: '<path d="M9.5 3.5h5M10.5 3.5v6L5 18.5a1.5 1.5 0 0 0 1.3 2.2h11.4a1.5 1.5 0 0 0 1.3-2.2L13.5 9.5v-6"/><path d="M7.5 15.5h9"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  list: '<path d="M9 7h11M9 12h11M9 17h11"/><path d="M4.5 7h.5M4.5 12h.5M4.5 17h.5"/>',
  minus: '<path d="M6 12h12"/>',
};

export function icon(name, extraClass = '') {
  const body = PATHS[name];
  if (!body) throw new Error(`Unknown icon: ${name}`);
  const cls = `icon icon-${name}${extraClass ? ` ${extraClass}` : ''}`;
  return `<svg class="${cls}" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

export function faviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#0f6f63"/><g fill="none" stroke="#fff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" transform="translate(2.4 2.4) scale(.8)">${PATHS.logo}</g></svg>`;
}
