// ─────────────────────────────────────────────────────────────
// MedCare theme service — automatic Day/Night (AUTO), Light, Dark
//
// AUTO mode uses the browser's LOCAL time:
//   Day  : 06:00 → 17:59  → Light theme
//   Night: 18:00 → 05:59  → Dark theme
//
// The theme switches itself while the app stays open: a timer is
// scheduled for the exact next boundary (06:00 / 18:00) instead of
// polling. A wake-up re-check runs on tab visibility / focus /
// timezone change / system wake so long-lived tabs stay correct.
// ─────────────────────────────────────────────────────────────
import { icon } from './core.js';

export const THEME_MODES = ['auto', 'light', 'dark'];
export const MODE_KEY = 'medcare-theme-mode';
export const LEGACY_THEME_KEY = 'medcare-theme';

const DAY_START_HOUR = 6;    // 06:00 → light
const NIGHT_START_HOUR = 18; // 18:00 → dark

let switchTimer = null;

// ── Time-based resolution ───────────────────────────────────
export function getTimeBasedTheme(now = new Date()) {
  const h = now.getHours();
  return h >= DAY_START_HOUR && h < NIGHT_START_HOUR ? 'light' : 'dark';
}

// ms until the next boundary (06:00 or 18:00) in local time
export function msUntilNextBoundary(now = new Date()) {
  const next = (boundaryHour) => {
    const d = new Date(now);
    d.setHours(boundaryHour, 0, 0, 0);
    return d.getTime() > now.getTime() ? d.getTime() : d.getTime() + 86400000;
  };
  return Math.min(next(DAY_START_HOUR), next(NIGHT_START_HOUR)) - now.getTime();
}

// ── Mode (user preference) ──────────────────────────────────
export function getThemeMode() {
  const m = localStorage.getItem(MODE_KEY);
  return THEME_MODES.includes(m) ? m : 'auto';
}

export function resolveTheme(mode = getThemeMode()) {
  return mode === 'auto' ? getTimeBasedTheme() : mode;
}

export function setThemeMode(mode, { persist = true } = {}) {
  if (!THEME_MODES.includes(mode)) mode = 'auto';
  if (persist) localStorage.setItem(MODE_KEY, mode);
  applyTheme(resolveTheme(mode));
  if (mode === 'auto') scheduleAutoSwitch();
  return mode;
}

// ── Apply resolved theme to the DOM ─────────────────────────
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme !== 'light' && theme !== 'dark') theme = resolveTheme();

  // brief global transition window for a smooth crossfade
  root.classList.add('theme-anim');
  clearTimeout(applyTheme._animT);
  applyTheme._animT = setTimeout(() => root.classList.remove('theme-anim'), 420);

  root.dataset.theme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#0A1120' : '#0B1F3A';

  // icon + label sync (sidebar pill and topbar button)
  const mode = getThemeMode();
  const label = themeModeLabel(mode, theme);
  const iconName = theme === 'dark' ? 'moon' : 'sun';
  ['themeToggle', 'themeToggleTop'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = icon(iconName, 19);
    el.title = `Theme: ${label}. Click to cycle Auto → Light → Dark`;
    el.setAttribute('aria-label', `Theme: ${label}. Click to cycle Auto, Light or Dark mode`);
    el.setAttribute('aria-pressed', mode === 'light' ? 'true' : 'false');
  });
  const labelEl = document.getElementById('modeLabel');
  if (labelEl) labelEl.textContent = label;
}

export function themeModeLabel(mode = getThemeMode(), theme = resolveTheme(mode)) {
  if (mode === 'light') return 'Light mode';
  if (mode === 'dark') return 'Dark mode';
  return theme === 'light' ? 'Auto · Day' : 'Auto · Night';
}

// ── Auto-switch scheduling ──────────────────────────────────
function scheduleAutoSwitch() {
  clearTimeout(switchTimer);
  if (getThemeMode() !== 'auto') return;
  switchTimer = setTimeout(() => {
    if (getThemeMode() !== 'auto') return;
    applyTheme(getTimeBasedTheme());
    scheduleAutoSwitch();
  }, msUntilNextBoundary());
}

// re-check after tab resume / wake / timezone change
function onWake() {
  if (document.visibilityState === 'hidden') return;
  if (getThemeMode() === 'auto') {
    const current = getTimeBasedTheme();
    if (current !== document.documentElement.dataset.theme) applyTheme(current);
    scheduleAutoSwitch();
  } else {
    applyTheme(resolveTheme());
  }
}

// ── Manual override helpers ─────────────────────────────────
export function cycleThemeMode() {
  const order = THEME_MODES;
  const next = order[(order.indexOf(getThemeMode()) + 1) % order.length];
  return setThemeMode(next);
}

// ── Init ────────────────────────────────────────────────────
function migrateLegacyPreference() {
  if (localStorage.getItem(MODE_KEY)) return;
  const legacy = localStorage.getItem(LEGACY_THEME_KEY);
  if (legacy === 'light' || legacy === 'dark') {
    localStorage.setItem(MODE_KEY, legacy);
    localStorage.removeItem(LEGACY_THEME_KEY);
  }
}

export function initTheme() {
  migrateLegacyPreference();
  const mode = getThemeMode();
  applyTheme(resolveTheme(mode));
  if (mode === 'auto') scheduleAutoSwitch();

  document.addEventListener('visibilitychange', onWake);
  window.addEventListener('focus', onWake);
  window.addEventListener('pageshow', onWake);
  window.addEventListener('timezonechange', onWake);
  window.addEventListener('storage', (e) => {
    if (e.key === MODE_KEY) setThemeMode(getThemeMode(), { persist: false });
  });
}
