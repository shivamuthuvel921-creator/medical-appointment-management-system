// ─────────────────────────────────────────────────────────────
// MedCare core — icons, DOM helpers, toast, modal, charts, fx
// ─────────────────────────────────────────────────────────────

const NS = 'http://www.w3.org/2000/svg';

export function icon(name, size = 20, cls = '') {
  const paths = ICONS[name] || ICONS.circle;
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

const ICONS = {
  dashboard: '<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>',
  doctor: '<circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><path d="M12 9V6M10.5 7.5h3"/>',
  stethoscope: '<path d="M4 3v5a5 5 0 0 0 10 0V3"/><path d="M4 3h2m6 0h2"/><path d="M9 18a6 6 0 0 0 12 0v-3"/><circle cx="18" cy="10" r="2"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/>',
  prescription: '<path d="M4 2h10a3 3 0 0 1 0 6H4zM4 2v20"/><path d="M4 6h6"/><path d="M17 16l4 4M21 16l-4 4"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>',
  report: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  analytics: '<path d="M3 3v18h18"/><path d="M7 16l4-6 4 3 4-7"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.03z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  bell2: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  pulse: '<path d="M2 12h4l3-8 4 16 3-8h6"/>',
  droplet: '<path d="M12 2.7s6 6.4 6 10.3a6 6 0 0 1-12 0c0-3.9 6-10.3 6-10.3z"/>',
  thermometer: '<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>',
  weight: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 8.5l-6 3.5 6 3.5z"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  mapPin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 5-5.5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  xCircle: '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>',
  alert: '<path d="M10.3 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  arrowUpRight: '<path d="M7 17L17 7M8 7h9v9"/>',
  chevDown: '<path d="M6 9l6 6 6-6"/>',
  chevRight: '<path d="M9 6l6 6-6 6"/>',
  chevLeft: '<path d="M15 6l-6 6 6 6"/>',
  chevLeftRight: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
  more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.8.3-1.4 1-1.4 1.9V14"/><circle cx="12" cy="17.2" r="1"/>',
  refresh: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.65 4.36A9 9 0 0 0 20.5 15"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  fileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  videoRec: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 8.5l-6 3.5 6 3.5z"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M8.2 13.9L7 22l5-3 5 3-1.2-8.1"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  pill: '<path d="M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z"/><path d="M8.5 8.5l7 7"/>',
  syringe: '<path d="M18 2l4 4M17 3L3 17M7 12l5 5M14 8l2-2-4-4-2 2"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  bookmark: '<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z"/><circle cx="7" cy="7" r="1.5"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  pie: '<path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  verified: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 5-5.5"/><path d="M9 2.5h6M9 21.5h6"/>',
  sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.9 2.4L22 18.3l-2.1.9L19 21.6l-.9-2.4-2.1-.9 2.1-.9z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
  calendarPlus: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4"/>',
  calendarX: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18M9.5 15.5l5 5M14.5 15.5l-5 5"/>',
  calendarCheck: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/>',
  rotate: '<path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.5 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.5 15"/>',
  folders: '<path d="M22 20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>',
  key: '<path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  dollar: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  trending: '<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
  layers: '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
  clock2: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  smartphone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18.5h2"/>',
  monitor: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  filter2: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
};

// ── Escape ──
export function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

// ── Date helpers ──
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function fromISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(iso, n) {
  const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d);
}
export function todayISO() { return toISO(new Date()); }
export function fmtDate(iso, opts = {}) {
  if (!iso) return '—';
  const d = fromISO(iso);
  const { weekday, month = 'short' } = opts;
  const parts = [];
  if (weekday) parts.push(DAYS_SHORT[d.getDay()]);
  parts.push(d.getDate());
  parts.push(month === 'long' ? MONTHS[d.getMonth()] : MONTHS_SHORT[d.getMonth()]);
  if (d.getFullYear() !== new Date().getFullYear()) parts.push(d.getFullYear());
  return parts.join(' ');
}
export function fmtTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}
export function relativeTime(dateStr) {
  const then = new Date(dateStr).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDate(dateStr.slice(0, 10));
}
export function daysUntil(iso) {
  return Math.round((fromISO(iso) - fromISO(todayISO())) / 86400000);
}

// ── Money ──
export function money(n) {
  if (n == null || isNaN(n)) return '—';
  return '₹' + Number(n).toLocaleString('en-IN');
}

// ── Toast ──
const TOAST_ICON = { success: 'checkCircle', error: 'xCircle', info: 'info', warning: 'alert' };
export function toast(title, msg = '', type = 'success', ms = 3600) {
  const stack = document.getElementById('toastStack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <span class="ti">${icon(TOAST_ICON[type] || 'info', 16)}</span>
    <div><b>${esc(title)}</b>${msg ? `<small>${esc(msg)}</small>` : ''}</div>
    <button class="close-x" aria-label="Dismiss">×</button>`;
  const close = () => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  };
  el.querySelector('.close-x').addEventListener('click', close);
  stack.appendChild(el);
  const t = setTimeout(close, ms);
  el._t = t;
  return el;
}

// ── Modal ──
export function openModal(html, { size = '', onMount } = {}) {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  box.className = `modal ${size}`;
  box.innerHTML = html;
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => {
    overlay.hidden = true;
    document.body.style.overflow = '';
    box.innerHTML = '';
    document.removeEventListener('keydown', onKey);
  };
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  box._close = close;
  document.addEventListener('keydown', onKey);
  box.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
  if (onMount) onMount(box, close);
  const f = box.querySelector('input,select,textarea,button:not([data-close])');
  setTimeout(() => f && f.focus(), 60);
  return close;
}
export function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay && !overlay.hidden) overlay.hidden = true;
  document.body.style.overflow = '';
  const box = document.getElementById('modalBox');
  if (box) box.innerHTML = '';
}

// ── Confirm dialog ──
export function confirmDialog({ title, message, confirmText = 'Confirm', danger = true, iconName = 'alert' }) {
  return new Promise((resolve) => {
    openModal(`
      <div class="modal-head">
        <h3>${esc(title)}</h3>
        <button class="icon-btn" data-close aria-label="Close">${icon('x', 18)}</button>
      </div>
      <div class="modal-body" style="display:grid;gap:14px;">
        <div class="flex" style="align-items:flex-start;gap:14px;">
          <span class="notif-ic ${danger ? 'red' : 'blue'}" style="flex:none;">${icon(iconName, 20)}</span>
          <p class="text-muted" style="font-size:.88rem;">${esc(message)}</p>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-outline btn-sm" data-close>Cancel</button>
        <button class="btn ${danger ? 'btn-soft-danger' : 'btn-primary'} btn-sm" id="confirmYes">${esc(confirmText)}</button>
      </div>`, {
      onMount: (box) => {
        box.querySelector('#confirmYes').onclick = () => { resolve(true); box._close(); };
        box.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => resolve(false)));
      },
    });
  });
}

// ── Drawer ──
export function openDrawer(html, { onMount } = {}) {
  const overlay = document.getElementById('drawerOverlay');
  const box = document.getElementById('drawerBox');
  box.innerHTML = html;
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  const close = () => { overlay.hidden = true; box.innerHTML = ''; document.body.style.overflow = ''; };
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  box._close = close;
  box.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
  if (onMount) onMount(box, close);
  return close;
}

// ── Avatar from name (photo-aware) ──
export function avatar(name, size = '', photo = '') {
  if (photo) return `<span class="avatar ${size} photo-avatar"><img src="${photo}" alt="${esc(name || '')}" /></span>`;
  const initials = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2)
    .map(w => w[0].toUpperCase()).join('');
  let h = 0;
  for (const c of (name || 'x')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `<span class="avatar ${size} avatar-grad-${h % 6}">${esc(initials)}</span>`;
}

// ── Skeleton ──
export function skeleton(type = 'cards') {
  if (type === 'cards') {
    return `<div class="sk-cards">${Array.from({ length: 4 }, () => '<div class="skeleton sk-card"></div>').join('')}</div>`;
  }
  if (type === 'list') {
    return `<div class="sk-row">${Array.from({ length: 5 }, () => '<div class="skeleton sk-line"></div>').join('')}</div>`;
  }
  if (type === 'docs') {
    return `<div class="sk-doc">${Array.from({ length: 3 }, () => '<div class="skeleton"></div>').join('')}</div>`;
  }
  return '<div class="skeleton" style="height:180px"></div>';
}

// ── Empty / error state ──
export function emptyState(title, msg = '', iconName = 'circle', action = '') {
  return `<div class="empty">
    <span class="e-ic">${icon(iconName, 32)}</span>
    <h4>${esc(title)}</h4>
    ${msg ? `<p>${esc(msg)}</p>` : ''}
    ${action || ''}
  </div>`;
}
export function errorState(msg) {
  return `<div class="error-state">
    <span class="e-ic">${icon('alert', 30)}</span>
    <h4>Something went wrong</h4>
    <p class="text-muted" style="font-size:.85rem;margin-top:6px;">${esc(msg)}</p>
    <button class="btn btn-outline btn-sm mt-12" onclick="location.reload()">${icon('refresh', 15)} Reload</button>
  </div>`;
}

// ── Animated counter ──
export function countUp(el, target, { dur = 1200, decimals = 0 } = {}) {
  if (!el) return;
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = target * eased;
    el.textContent = decimals ? val.toFixed(decimals) : Math.round(val).toLocaleString('en-IN');
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ── Animated ring (circular progress) ──
export function ring(value, { size = 76, stroke = 7, color = '', label = '' } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(1, Math.max(0, value)));
  return `
  <div class="ring ${color}" style="width:${size}px;height:${size}px;">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
      <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"
        stroke-dasharray="${c}" stroke-dashoffset="${c}" data-off="${off}"/>
    </svg>
    <span class="ring-label">${esc(label)}</span>
  </div>`;
}
export function animateRing(el) {
  if (!el) return;
  el.querySelectorAll('.ring-fg').forEach(c => {
    requestAnimationFrame(() => {
      c.style.strokeDashoffset = c.dataset.off;
    });
  });
}

// ── Progress bar ──
export function progress(value, cls = '') {
  return `<div class="progress ${cls}"><div class="bar ${cls}" style="width:0%" data-w="${Math.min(100, Math.max(0, value))}"></div></div>`;
}
export function animateProgress(scope) {
  (scope || document).querySelectorAll('.bar[data-w]').forEach(b => {
    setTimeout(() => { b.style.width = b.dataset.w + '%'; }, 80);
  });
}

// ── Charts ──

// Line / area chart
export function lineChart(items, { color = '#2563EB', fill = true, height = 230, id = '' } = {}) {
  if (!items || !items.length) return '';
  const W = 640, H = height, padL = 44, padR = 12, padT = 18, padB = 30;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const max = Math.max(...items.map(i => i.value), 1);
  const min = Math.min(...items.map(i => i.value), 0);
  const range = (max - min) || 1;
  const pts = items.map((it, i) => {
    const x = padL + (items.length === 1 ? innerW / 2 : (i * innerW) / (items.length - 1));
    const y = padT + innerH - ((it.value - min) / range) * innerH;
    return { x, y, it };
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${(pts[pts.length - 1]?.x ?? padL + innerW).toFixed(1)},${padT + innerH} L${padL},${padT + innerH} Z`;
  const gid = 'grad-' + (id || Math.random().toString(36).slice(2, 7));
  // y gridlines
  let grid = '';
  for (let g = 0; g <= 4; g++) {
    const gy = padT + innerH - (g / 4) * innerH;
    grid += `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="var(--hairline)" stroke-width="1"/>`;
    const val = Math.round(min + (g / 4) * range);
    grid += `<text class="chart-axis-label" x="${padL - 8}" y="${gy + 3}" text-anchor="end">${val}</text>`;
  }
  // labels
  let labels = '';
  const step = Math.max(1, Math.ceil(items.length / 8));
  pts.forEach((p, i) => {
    if (i % step === 0 || i === items.length - 1) {
      labels += `<text class="chart-axis-label" x="${p.x}" y="${H - 8}" text-anchor="middle">${esc(String(p.it.label).slice(0, 6))}</text>`;
    }
  });
  const dots = pts.map(p =>
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.4" fill="${color}" class="chart-dot" data-label="${esc(p.it.label)}" data-value="${p.it.value}" stroke="var(--surface)" stroke-width="2"/>`
  ).join('');
  return `
  <div class="chart-wrap" style="position:relative">
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Line chart">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity=".22"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${grid}
      <path d="${area}" fill="url(#${gid})"/>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}${labels}
    </svg>
    <div class="chart-tooltip" id="ctip-${gid}"></div>
  </div>`;
}
export function bindLineChart(scope) {
  scope = scope || document;
  scope.querySelectorAll('.chart-wrap').forEach(wrap => {
    const tip = wrap.querySelector('.chart-tooltip');
    if (!tip) return;
    wrap.querySelectorAll('.chart-dot').forEach(d => {
      d.addEventListener('mouseenter', (e) => {
        tip.style.opacity = '1';
        tip.style.left = (e.offsetX + 12) + 'px';
        tip.style.top = (e.offsetY - 10) + 'px';
        tip.innerHTML = `<b>${d.dataset.value}</b>${esc(d.dataset.label)}`;
      });
      d.addEventListener('mousemove', (e) => {
        tip.style.left = (e.offsetX + 12) + 'px';
        tip.style.top = (e.offsetY - 10) + 'px';
      });
      d.addEventListener('mouseleave', () => { tip.style.opacity = '0'; });
    });
  });
}

// Bar chart
export function barChart(items, { color = '#2563EB', height = 230, rounded = true } = {}) {
  if (!items || !items.length) return '';
  const W = 640, H = height, padL = 44, padR = 12, padT = 16, padB = 28;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const max = Math.max(...items.map(i => i.value), 1);
  const bw = Math.min(46, innerW / items.length * .62);
  let grid = '';
  for (let g = 0; g <= 4; g++) {
    const gy = padT + innerH - (g / 4) * innerH;
    grid += `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="var(--hairline)" stroke-width="1"/>`;
    grid += `<text class="chart-axis-label" x="${padL - 8}" y="${gy + 3}" text-anchor="end">${Math.round(max * g / 4)}</text>`;
  }
  let bars = '', labels = '';
  items.forEach((it, i) => {
    const h = Math.max(3, (it.value / max) * innerH);
    const x = padL + (i * (innerW / items.length)) + (innerW / items.length - bw) / 2;
    const y = padT + innerH - h;
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${rounded ? 7 : 2}" fill="${color}" opacity=".85" class="chart-bar" data-label="${esc(it.label)}" data-value="${it.value}">
      <animate attributeName="height" from="0" to="${h.toFixed(1)}" dur=".7s" fill="freeze"/>
      <animate attributeName="y" from="${padT + innerH}" to="${y.toFixed(1)}" dur=".7s" fill="freeze"/>
    </rect>`;
    labels += `<text class="chart-axis-label" x="${(x + bw / 2).toFixed(1)}" y="${H - 7}" text-anchor="middle">${esc(String(it.label).slice(0, 5))}</text>`;
  });
  return `
  <div class="chart-wrap">
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Bar chart">
      ${grid}${bars}${labels}
    </svg>
  </div>`;
}

// Donut chart
export function donutChart(segments, { size = 200, stroke = 26, centerLabel = '' } = {}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const slices = segments.map((s, i) => {
    const frac = s.value / total;
    const len = frac * c;
    const dash = `${len.toFixed(2)} ${(c - len).toFixed(2)}`;
    const el = `<circle class="donut-slice" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
      stroke="${s.color}" stroke-width="${stroke}" stroke-dasharray="${dash}"
      stroke-dashoffset="${(-offset).toFixed(2)}" data-label="${esc(s.label)}" data-value="${s.value}"
      transform="rotate(-90 ${size / 2} ${size / 2})" opacity="0">
      <animate attributeName="opacity" from="0" to="1" dur="${.3 + i * .12}s" fill="freeze"/>
    </circle>`;
    offset += len;
    return el;
  }).join('');
  return `
  <div class="donut-wrap">
    <div style="position:relative;width:${size}px;height:${size}px;flex:none;">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(0)">
        ${slices}
      </svg>
      <div class="donut-center"><div><b>${esc(centerLabel)}</b><div style="font-size:.68rem;color:var(--faint)">total</div></div></div>
    </div>
    <div class="chart-legend" style="display:grid;gap:8px;align-content:center;margin:0">
      ${segments.map(s => `<span class="lg"><span class="sw" style="background:${s.color}"></span>${esc(s.label)} · <b style="color:var(--ink)">${s.value}</b></span>`).join('')}
    </div>
  </div>`;
}

// ── Confetti ──
export function confetti() {
  const colors = ['#2563EB', '#14B8A6', '#16A34A', '#F59E0B', '#7C3AED', '#0EA5E9', '#EF4444'];
  const wrap = document.createElement('div');
  wrap.className = 'confetti';
  for (let i = 0; i < 90; i++) {
    const s = document.createElement('span');
    s.style.left = Math.random() * 100 + 'vw';
    s.style.background = colors[i % colors.length];
    s.style.animationDuration = (2 + Math.random() * 2.4) + 's';
    s.style.animationDelay = (Math.random() * .8) + 's';
    s.style.transform = `rotate(${Math.random() * 360}deg)`;
    wrap.appendChild(s);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 4200);
}

// ── Debounce ──
export function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Tooltip init ──
export function bindTooltips(scope) {
  (scope || document).querySelectorAll('[data-tip]').forEach(el => {
    if (el.dataset._tip) return;
    el.dataset._tip = '1';
  });
}

// ── simple hash helpers ──
export function hashId(prefix = 'MC', len = 8) {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${prefix}-${s}`;
}

// tiny text truncation
export function truncate(s, n = 40) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}