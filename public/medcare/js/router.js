// ─────────────────────────────────────────────────────────────
// MedCare router — hash routing, shell wiring, navigation
// ─────────────────────────────────────────────────────────────
import { icon, esc, avatar, toast, openModal, closeModal, debounce, todayISO, addDays, daysUntil } from './core.js';
import { currentUser, logout, unreadCount, unreadMessages, globalSearch, getDoctor } from './store.js';
import { initTheme, cycleThemeMode, themeModeLabel } from './theme.js';

export { applyTheme } from './theme.js';

// ── Page registry ───────────────────────────────────────────
const pages = {};
export function registerPage(key, render) { pages[key] = render; }

// ── Nav config ──────────────────────────────────────────────
// CRITICAL: navigation is strictly separated per role. Patient,
// Doctor and Admin each have their OWN navigation tree — nothing
// is cross-mixed between the Patient and Doctor experiences.
export const NAV = {
  patient: [
    { group: 'Overview', items: [
      { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
      { key: 'find', label: 'Find Doctors', icon: 'stethoscope' },
    ]},
    { group: 'Appointments', items: [
      { key: 'scheduling', label: 'My Scheduling', icon: 'calendarPlus' },
      { key: 'appointments', label: 'My Appointments', icon: 'calendar' },
    ]},
    { group: 'Clinical', items: [
      { key: 'history', label: 'Medical History', icon: 'clipboard' },
      { key: 'prescriptions', label: 'Prescriptions', icon: 'prescription' },
    ]},
    { group: 'Communication', items: [
      { key: 'notifications', label: 'Notifications', icon: 'bell', badge: 'notifs' },
      { key: 'messages', label: 'Messages', icon: 'chat', badge: 'msgs' },
    ]},
    { group: 'Account', items: [
      { key: 'profile', label: 'Profile', icon: 'user' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ]},
  ],
  doctor: [
    { group: 'Overview', items: [
      { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    ]},
    { group: 'Practice', items: [
      { key: 'schedule', label: 'Schedule', icon: 'calendar' },
      { key: 'queue', label: 'Patient Queue', icon: 'users' },
      { key: 'patients', label: 'Patients', icon: 'clipboard' },
    ]},
    { group: 'Clinical', items: [
      { key: 'consult', label: 'Consultations', icon: 'stethoscope' },
      { key: 'prescriptions', label: 'Prescriptions', icon: 'prescription' },
    ]},
    { group: 'Insights', items: [
      { key: 'analytics', label: 'Analytics', icon: 'analytics' },
    ]},
    { group: 'Communication', items: [
      { key: 'notifications', label: 'Notifications', icon: 'bell', badge: 'notifs' },
      { key: 'messages', label: 'Messages', icon: 'chat', badge: 'msgs' },
    ]},
    { group: 'Account', items: [
      { key: 'profile', label: 'Profile', icon: 'user' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ]},
  ],
  admin: [
    { group: 'Overview', items: [
      { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    ]},
    { group: 'Manage', items: [
      { key: 'doctors', label: 'Doctors', icon: 'users' },
      { key: 'patients', label: 'Patients', icon: 'clipboard' },
      { key: 'appointments', label: 'Appointments', icon: 'calendar' },
    ]},
    { group: 'Clinical', items: [
      { key: 'prescriptions', label: 'Prescriptions', icon: 'prescription' },
    ]},
    { group: 'Insights', items: [
      { key: 'reports', label: 'Reports', icon: 'report' },
      { key: 'analytics', label: 'Analytics', icon: 'analytics' },
    ]},
    { group: 'Communication', items: [
      { key: 'notifications', label: 'Notifications', icon: 'bell', badge: 'notifs' },
      { key: 'messages', label: 'Messages', icon: 'chat', badge: 'msgs' },
    ]},
    { group: 'Account', items: [
      { key: 'profile', label: 'Profile', icon: 'user' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ]},
  ],
};

const ROLE_TITLES = { patient: 'Patient', doctor: 'Doctor', admin: 'Administrator' };
const DEFAULT_ROUTE = { patient: '#/dashboard', doctor: '#/dashboard', admin: '#/dashboard' };

let current = { key: '', role: 'patient' };
let routeHandlers = {};

// map key -> route metadata (label/icon) and key -> allowed roles
const ROUTE_BY_KEY = {};
const ROUTE_ROLES = {};
Object.entries(NAV).forEach(([role, groups]) => {
  groups.forEach(g => g.items.forEach(it => {
    ROUTE_BY_KEY[it.key] = it;
    (ROUTE_ROLES[it.key] = ROUTE_ROLES[it.key] || []).push(role);
  }));
});

// ── helpers ────────────────────────────────────────────────
export function role() { return currentUser()?.role || 'patient'; }
export function navigate(hash) {
  if (location.hash === hash) { renderRoute(); return; }
  location.hash = hash;
}
export function go(hash) { navigate(hash); }

function pageTitle() {
  const item = ROUTE_BY_KEY[current.key];
  if (item) return `${item.label} · MedCare`;
  return 'MedCare — Smart Medical Appointment Scheduling System';
}

// ── Sidebar / bottom nav render ────────────────────────────
function navItemsFor(role) {
  const items = [];
  (NAV[role] || []).forEach(g => g.items.forEach(it => items.push({ ...it, group: g.group })));
  return items;
}

function badgeFor(item) {
  if (item.badge === 'notifs') return unreadCount();
  if (item.badge === 'msgs') return unreadMessages();
  return 0;
}

function renderSidebar(activeKey) {
  const r = role();
  const nav = document.getElementById('sidebarNav');
  let html = '';
  let lastGroup = '';
  navItemsFor(r).forEach(it => {
    if (it.group !== lastGroup) {
      html += `<div class="nav-label">${esc(it.group)}</div>`;
      lastGroup = it.group;
    }
    const b = badgeFor(it);
    html += `<a class="nav-item ${it.key === activeKey ? 'active' : ''}" href="#/${it.key}" data-key="${it.key}">
      ${icon(it.icon, 20)}
      <span>${esc(it.label)}</span>
      ${b ? `<span class="nav-badge">${b}</span>` : ''}
    </a>`;
  });
  nav.innerHTML = html;
}

function renderBottomNav(activeKey) {
  const r = role();
  const sets = {
    patient: [
      { key: 'dashboard', icon: 'home', label: 'Home' },
      { key: 'find', icon: 'search', label: 'Find' },
      { key: 'appointments', icon: 'calendar', label: 'Appts' },
      { key: 'messages', icon: 'chat', label: 'Chat', badge: unreadMessages() },
      { key: 'profile', icon: 'user', label: 'Profile' },
    ],
    doctor: [
      { key: 'dashboard', icon: 'home', label: 'Home' },
      { key: 'schedule', icon: 'calendar', label: 'Schedule' },
      { key: 'queue', icon: 'users', label: 'Queue' },
      { key: 'messages', icon: 'chat', label: 'Chat', badge: unreadMessages() },
      { key: 'profile', icon: 'user', label: 'Profile' },
    ],
    admin: [
      { key: 'dashboard', icon: 'home', label: 'Home' },
      { key: 'patients', icon: 'users', label: 'Patients' },
      { key: 'appointments', icon: 'calendar', label: 'Appts' },
      { key: 'analytics', icon: 'analytics', label: 'Stats' },
      { key: 'profile', icon: 'user', label: 'Profile' },
    ],
  };
  const items = sets[r] || sets.patient;
  const nav = document.getElementById('bottomNav');
  nav.innerHTML = items.map(it => `
    <button class="bn-item ${it.key === activeKey ? 'active' : ''}" data-nav="#/${it.key}">
      ${icon(it.icon, 22)}
      <span>${it.label}</span>
      ${it.badge ? `<span class="badge-dot">${it.badge}</span>` : ''}
    </button>`).join('');
}

function renderUser() {
  const u = currentUser();
  if (!u) return;
  const roleLabel = ROLE_TITLES[u.role] || 'User';
  const nameEls = ['sidebarUserName', 'topUserName', 'dropName'];
  nameEls.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = u.name; });
  const roleEls = ['sidebarUserRole', 'topUserRole'];
  roleEls.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = roleLabel; });
  const em = document.getElementById('dropEmail');
  if (em) em.textContent = u.email || '';
  document.querySelectorAll('#sidebarAvatar, #dropAvatar').forEach(el => {
    el.outerHTML = avatar(u.name, el.id === 'dropAvatar' ? 'sm' : '', u.photo).replace(' class="avatar', ` id="${el.id}" class="avatar`);
  });
}

function renderBadges() {
  const nb = unreadCount(), mb = unreadMessages();
  const nEl = document.getElementById('notifBadge');
  const mEl = document.getElementById('msgBadge');
  if (nEl) { nEl.hidden = nb === 0; nEl.textContent = nb > 9 ? '9+' : nb; }
  if (mEl) { mEl.hidden = mb === 0; mEl.textContent = mb > 9 ? '9+' : mb; }
}

// ── Global search ──────────────────────────────────────────
function wireSearch() {
  const input = document.getElementById('globalSearch');
  const results = document.getElementById('searchResults');
  const show = (html) => { results.innerHTML = html; results.hidden = !html; };
  input.addEventListener('focus', () => { if (input.value.length >= 2) doSearch(input.value); });
  input.addEventListener('input', debounce(() => doSearch(input.value), 220));
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== input) { e.preventDefault(); input.focus(); }
    if (e.key === 'Escape') { show(''); input.blur(); }
  });
  document.addEventListener('click', (e) => { if (!document.getElementById('topbarSearch').contains(e.target)) show(''); });

  function doSearch(q) {
    if (q.length < 2) { show(''); return; }
    const res = globalSearch(q);
    let html = '';
    if (res.doctors.length) {
      html += `<div class="search-group">Doctors</div>`;
      res.doctors.forEach(d => html += `
        <div class="search-item" data-nav="#/find?doc=${d.id}">
          <span class="si">${icon('stethoscope', 17)}</span>
          <div><b>${esc(d.name)}</b><small>${esc(d.specialty)} · ${esc(d.clinic)}</small></div>
        </div>`);
    }
    if (res.appointments.length) {
      html += `<div class="search-group">Appointments</div>`;
      res.appointments.forEach(a => html += `
        <div class="search-item" data-nav="#/appointments?id=${a.id}">
          <span class="si alt">${icon('calendar', 17)}</span>
          <div><b>${esc(a.patientName)} × ${esc(a.doctorName)}</b><small>${esc(a.appointmentDate)} ${esc(a.appointmentTime)} · ${esc(a.status)}</small></div>
        </div>`);
    }
    if (res.prescriptions.length) {
      html += `<div class="search-group">Prescriptions</div>`;
      res.prescriptions.forEach(r => html += `
        <div class="search-item" data-nav="#/prescriptions?id=${r.id}">
          <span class="si alt2">${icon('prescription', 17)}</span>
          <div><b>${esc(r.diagnosis)}</b><small>${esc(r.doctorName)} · ${esc(r.date)}</small></div>
        </div>`);
    }
    if (res.patients.length) {
      html += `<div class="search-group">Patients</div>`;
      res.patients.forEach(p => html += `
        <div class="search-item" data-nav="#/patients?id=${p.id}">
          <span class="si alt">${icon('user', 17)}</span>
          <div><b>${esc(p.name)}</b><small>${esc(p.condition || p.email)}</small></div>
        </div>`);
    }
    if (!html) html = `<div class="empty" style="padding:24px"><p class="text-muted" style="font-size:.8rem">No results for “${esc(q)}”</p></div>`;
    show(html);
    results.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => {
      show('');
      input.value = '';
      navigate(el.dataset.nav);
    }));
  }
}

// ── Theme (auto day/night · light · dark) ───────────────────
function cycleModeBtn() {
  const next = cycleThemeMode();
  toast('Theme mode', `Set to ${next === 'auto' ? `Auto — ${themeModeLabel()}` : `${next === 'light' ? 'Light' : 'Dark'} mode`}.`, 'info');
}

// ── Help modal ─────────────────────────────────────────────
function openHelp() {
  const r = role();
  const menu = r === 'doctor' ? `
      <div class="mi" data-nav="#/schedule">${icon('calendar', 18)} Manage your schedule &amp; availability</div>
      <div class="mi" data-nav="#/queue">${icon('users', 18)} Patient queue &amp; live consultation</div>
      <div class="mi" data-nav="#/consult">${icon('stethoscope', 18)} Start a consultation workspace</div>
      <div class="mi" data-nav="#/prescriptions">${icon('prescription', 18)} Write &amp; manage prescriptions</div>
      <div class="mi" data-nav="#/analytics">${icon('analytics', 18)} View your practice analytics</div>
      <div class="mi" data-nav="#/messages">${icon('chat', 18)} Message your patients securely</div>`
    : `
      <div class="mi" data-nav="#/find">${icon('stethoscope', 18)} Find a doctor &amp; book instantly</div>
      <div class="mi" data-nav="#/scheduling">${icon('calendarPlus', 18)} How to schedule an appointment</div>
      <div class="mi" data-nav="#/appointments">${icon('calendar', 18)} Manage / reschedule appointments</div>
      <div class="mi" data-nav="#/prescriptions">${icon('prescription', 18)} View &amp; download prescriptions</div>
      <div class="mi" data-nav="#/messages">${icon('chat', 18)} Message your doctor securely</div>
      <div class="mi" data-nav="#/settings">${icon('settings', 18)} Notification &amp; privacy settings</div>`;
  openModal(`
    <div class="modal-head"><h3>Help Center</h3><button class="icon-btn" data-close aria-label="Close">${icon('x', 18)}</button></div>
    <div class="modal-body" style="display:grid;gap:12px">
      <div class="card-menu">
        ${menu}
      </div>
      <div class="stepper-hint">${icon('info', 18)} Need live assistance? Ask the reception desk at your clinic or contact the clinic administrator for help.</div>
    </div>
  `);
}

// ── Shell events ───────────────────────────────────────────
function wireShell() {
  // sidebar collapse
  const app = document.getElementById('app');
  const collapseBtn = document.getElementById('sidebarCollapse');
  collapseBtn.addEventListener('click', () => {
    app.classList.toggle('sidebar-collapsed');
    localStorage.setItem('medcare-collapsed', app.classList.contains('sidebar-collapsed') ? '1' : '0');
  });
  if (localStorage.getItem('medcare-collapsed') === '1') app.classList.add('sidebar-collapsed');

  // mobile menu
  document.getElementById('menuBtn').addEventListener('click', () => app.classList.toggle('sidebar-open'));
  app.addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('nav-item')) app.classList.remove('sidebar-open');
  });

  // theme — cycles Auto → Light → Dark
  document.getElementById('themeToggle').addEventListener('click', cycleModeBtn);
  document.getElementById('themeToggleTop').addEventListener('click', cycleModeBtn);

  // notifications & messages buttons
  document.getElementById('notifBtn').addEventListener('click', () => navigate('#/notifications'));
  document.getElementById('messagesBtn').addEventListener('click', () => navigate('#/messages'));
  document.getElementById('helpBtn').addEventListener('click', openHelp);
  document.getElementById('fab').addEventListener('click', () => {
    const app = document.getElementById('app');
    app.classList.toggle('sidebar-open');
  });

  // profile dropdown
  const trigger = document.getElementById('profileTrigger');
  const dropdown = document.getElementById('profileDropdown');
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.hidden = !dropdown.hidden;
    trigger.setAttribute('aria-expanded', String(!dropdown.hidden));
  });
  document.addEventListener('click', (e) => {
    if (!document.querySelector('.profile-pop').contains(e.target)) dropdown.hidden = true;
  });
  dropdown.querySelectorAll('[data-navto]').forEach(el => el.addEventListener('click', () => {
    dropdown.hidden = true;
    navigate(el.dataset.navto);
  }));
  document.getElementById('dropdownLogout').addEventListener('click', doLogout);

  // logout
  document.getElementById('logoutBtn').addEventListener('click', doLogout);

  // bottom nav
  document.getElementById('bottomNav').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-nav]');
    if (btn) navigate(btn.dataset.nav);
  });

  wireSearch();
}

function doLogout() {
  logout();
  location.hash = '#/welcome';
  renderRoute();
  toast('Signed out', 'You have been securely logged out.', 'info');
}

// ── API status pill ────────────────────────────────────────
function checkApi() {
  fetch('/api/health', { signal: AbortSignal.timeout(2500) })
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      if (d && d.status === 'ok') {
        const el = document.getElementById('apiStatus');
        if (el) { el.textContent = 'Backend live'; el.classList.remove('offline'); }
      }
    })
    .catch(() => {
      const el = document.getElementById('apiStatus');
      if (el) { el.textContent = 'Backend offline'; el.classList.add('offline'); }
    });
}

// ── Routing ────────────────────────────────────────────────
export function renderRoute() {
  closeModal();
  const hash = location.hash || '#/welcome';
  const [pathPart, queryPart] = hash.slice(1).split('?');
  const params = new URLSearchParams(queryPart || '');
  const routeKey = pathPart.replace(/^\/+/, '') || 'login';

  const user = currentUser();
  const sessionRole = user?.role || 'patient';

  // auth gate
  if (routeKey === 'welcome' || routeKey === 'login' || routeKey === 'register' || routeKey === 'forgot' || routeKey === 'otp' || routeKey === 'reset') {
    if (routeKey === 'welcome' && user) { location.hash = DEFAULT_ROUTE[user.role]; return; }
    current = { key: routeKey, role: sessionRole };
    document.getElementById('app').classList.add('auth-active');
    renderPage(routeKey, params);
    return;
  }
  if (!user) {
    location.hash = '#/welcome';
    return;
  }

  // role gate — strict per-role access control
  if (!ROUTE_ROLES[routeKey] || !ROUTE_ROLES[routeKey].includes(sessionRole)) { location.hash = DEFAULT_ROUTE[sessionRole]; return; }

  current = { key: routeKey, role: sessionRole };
  document.getElementById('app').classList.remove('auth-active');

  renderSidebar(routeKey);
  renderBottomNav(routeKey);
  renderUser();
  renderBadges();
  document.title = pageTitle();

  renderPage(routeKey, params);
}

function renderPage(key, params) {
  const vp = document.getElementById('viewport');
  const fn = pages[key];
  if (!fn) {
    vp.innerHTML = `<div class="empty" style="padding-top:80px"><h4>Page not found</h4><p>This section is not available for your account.</p></div>`;
    return;
  }
  // transition
  vp.style.animation = 'none';
  void vp.offsetWidth;
  vp.style.animation = '';
  fn(vp, params);
  window.scrollTo({ top: 0 });
}

// ── start ──────────────────────────────────────────────────
export function start() {
  initTheme();
  wireShell();
  checkApi();
  window.addEventListener('hashchange', renderRoute);
  renderRoute();
}