// ─────────────────────────────────────────────────────────────
// Profile & Settings — personal, health, professional, security
// ─────────────────────────────────────────────────────────────
import { icon, esc, toast, openModal, fmtDate, countUp, money, avatar, bindPasswordToggles, confirmDialog } from '../core.js';
import { currentUser, getPatient, updateProfile, fetchProfile, uploadProfilePhoto, removeProfilePhoto, updateNotifPrefs, changePassword, getProfileHistory, setAvailability, setOffDay, removeOffDay, getState, getDoctors, buildAnalytics } from '../store.js';
import { registerPage, role, navigate } from '../router.js';
import { getThemeMode, setThemeMode, resolveTheme, themeModeLabel } from '../theme.js';
import { pageHead, kpi, skeletonCards } from './shared.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LANG_OPTIONS = ['English (India)', 'English (US)', 'हिन्दी (Hindi)', 'தமிழ் (Tamil)', 'తెలుగు (Telugu)', 'मराठी (Marathi)', 'Español', 'العربية'];
const TIME_OPTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'];
const NOTIF_GROUPS = [
  { key: 'apptReminder', title: 'Appointment reminders', sub: 'Email & SMS before each visit', icon: 'clock' },
  { key: 'apptConfirmation', title: 'Appointment confirmations', sub: 'When a doctor confirms your booking', icon: 'checkCircle' },
  { key: 'apptReschedule', title: 'Reschedule & cancellations', sub: 'Whenever an appointment changes', icon: 'rotate' },
  { key: 'prescriptionReady', title: 'Prescriptions & reports', sub: 'New digital prescriptions and lab results', icon: 'prescription' },
  { key: 'followup', title: 'Follow-up reminders', sub: 'When it is time to schedule a follow-up', icon: 'calendarCheck' },
  { key: 'emergency', title: 'Emergency alerts', sub: 'Critical updates about emergency cases', icon: 'alert' },
];

function prefs() {
  try { return JSON.parse(localStorage.getItem('medcare-prefs')) || {}; } catch { return {}; }
}
function savePrefs(p) { localStorage.setItem('medcare-prefs', JSON.stringify(p)); }

function meFor(r) {
  const u = currentUser();
  if (r === 'doctor') return getDoctors().find(d => d.userId === (u ? u.userId : '')) || {};
  if (r === 'patient') return getPatient(u && u.userId ? u.userId : '') || {};
  return {};
}

function navDevice() {
  const ua = navigator.userAgent || '';
  const os = /iPhone|iPad/i.test(ua) ? 'iOS' : /Android/i.test(ua) ? 'Android' : /Mac/i.test(ua) ? 'macOS' : /Windows/i.test(ua) ? 'Windows' : 'Web';
  const br = /Edg\//i.test(ua) ? 'Edge' : /Chrome/i.test(ua) ? 'Chrome' : /Firefox/i.test(ua) ? 'Firefox' : /Safari/i.test(ua) ? 'Safari' : 'Browser';
  return `${br} · ${os}`;
}

function profileCompletion(m) {
  const fields = [
    ['Full name', m.name],
    ['Email', m.email],
    ['Phone', m.phone],
    ['Date of birth', m.dob],
    ['Gender', m.gender],
    ['Blood group', m.blood],
    ['Height', m.heightCm],
    ['Weight', m.weightKg],
    ['Address', m.address],
    ['City', m.city],
    ['State', m.state],
    ['Country', m.country],
    ['Postal code', m.postalCode],
    ['Emergency contact', m.emergencyContactName],
    ['Emergency phone', m.emergencyContactPhone],
    ['Emergency relationship', m.emergencyContactRelationship],
    ['Preferred language', m.preferredLanguage],
    ['Profile photo', m.photo],
  ];
  const total = fields.length;
  const filled = fields.filter(([,v]) => String(v||'').trim() !== '').length;
  const pct = Math.round((filled/total)*100);
  const missing = fields.filter(([,v])=> String(v||'').trim()==='').map(([k])=>k);
  return { pct, missing, total, filled };
}

// ── Validation rules ─────────────────────────────────────────
const V = {
  name: (v) => (String(v || '').trim().length < 2 ? 'Please enter your full name.' : ''),
  email: (v) => (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim()) ? 'Please enter a valid email address.' : ''),
  phone: (v) => (String(v || '').trim().replace(/\D/g, '').length < 10 ? 'Please enter a valid phone number.' : ''),
  dob: (v) => {
    if (!v) return 'This field is required.';
    const d = new Date(v + 'T00:00:00');
    if (isNaN(d) || d > new Date() || d.getFullYear() < 1900) return 'Please enter a valid date of birth.';
    return '';
  },
  postalCode: (v) => (!/^[A-Za-z0-9\- ]{3,10}$/.test(String(v || '').trim()) ? 'Please enter a valid postal code.' : ''),
  fee: (v) => (isNaN(Number(v)) || Number(v) < 0 ? 'Please enter a valid consultation fee.' : ''),
  required: (v) => (String(v || '').trim() ? '' : 'This field is required.'),
  password: (v) => (String(v || '').length < 8 || !/[A-Z]/.test(v) || !/\d/.test(v) ? 'Password must be at least 8 characters with an uppercase letter and a number.' : ''),
  emergencyPhone: (v) => (String(v || '').trim() && String(v).trim().replace(/\D/g, '').length < 10 ? 'Please enter a valid phone number.' : ''),
};

// ── Photo handling ───────────────────────────────────────────
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

function validatePhotoFile(file) {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return 'Please choose a JPG, PNG or WEBP image.';
  if (file.size > MAX_PHOTO_BYTES) return 'Photo must be smaller than 2 MB.';
  return '';
}

function photoEl(me, size) {
  if (me.photo) return `<span class="avatar ${size} photo-avatar"><img src="${me.photo}" alt="${esc(me.name || '')}" /></span>`;
  return avatar(me.name || '?', size);
}

// ── Generic editable card registry (fixes outerHTML listener loss) ──
let editCardSeq = 0;
const editCardStore = new Map();

function editCard({ title, sub, iconName, fields, onSave, saveText = 'Save changes' }) {
  const idx = editCardSeq++;
  editCardStore.set(idx, { fields, onSave });
  const readOnly = fields.map(f => {
    const v = f.value ?? '';
    if (f.render) return f.render(v);
    return `<div class="pf-row"><span class="pf-label">${icon(f.icon || 'dot', 14)} ${esc(f.label)}</span><b class="pf-value">${esc(v === '' ? '—' : v)}</b></div>`;
  }).join('');
  // return HTML string with data-card index; fields will be rendered via fld with scoped ids pf_<key>_<idx>
  const html = `
  <div class="card card-pad profile-card" data-edit-card="${idx}">
    <div class="card-title" style="margin-bottom:16px">
      <span>${icon(iconName, 18)} ${esc(title)}</span>
      <button class="btn btn-outline btn-sm" data-edit>${icon('edit', 14)} Edit</button>
    </div>
    ${sub ? `<p class="text-faint" style="font-size:.78rem;margin:-8px 0 14px">${esc(sub)}</p>` : ''}
    <div class="form-grid" data-fields style="display:grid;gap:16px">${readOnly}</div>
    <div class="flex" style="gap:10px;justify-content:flex-end;margin-top:8px;display:none" data-actions>
      <button class="btn btn-outline" data-cancel>${icon('x', 15)} Cancel</button>
      <button class="btn btn-primary" data-save>${icon('checkCircle', 16)} ${saveText}</button>
    </div>
  </div>`;
  const wrap = document.createElement('div');
  wrap.innerHTML = html.trim();
  const el = wrap.firstElementChild;
  return el;
}

function fld(key, label, value, opt = {}, cardIdx = null) {
  const suffix = cardIdx !== null ? `_${cardIdx}` : '';
  const req = opt.required ? '<span class="req">*</span>' : '';
  const ic = opt.icon ? `<span class="input-icon">${icon(opt.icon, 17)}` : '';
  const endIc = ic ? '</span>' : '';
  const id = `pf_${key}${suffix}`;
  const errId = `err_${key}${suffix}`;
  let control;
  if (opt.textarea) control = `<textarea class="textarea" id="${id}">${esc(value ?? '')}</textarea>`;
  else if (opt.select) control = `<select class="select" id="${id}">${(opt.options || []).map(o => `<option ${String(value) === String(o) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  else control = `<input class="input" id="${id}" type="${opt.type || 'text'}" value="${esc(value ?? '')}" ${opt.inputmode ? `inputmode="${opt.inputmode}"` : ''} ${opt.required ? 'required' : ''} />`;
  return `
  <div class="field" ${opt.full ? 'style="grid-column:1/-1"' : ''}>
    <label for="${id}">${esc(label)} ${req}</label>
    ${ic}${control}${endIc}
    <small class="err" id="${errId}"></small>
  </div>`;
}

function showErrForCard(cardIdx, key, msg) {
  const suffix = cardIdx !== null ? `_${cardIdx}` : '';
  const el = document.getElementById(`err_${key}${suffix}`);
  const inp = document.getElementById(`pf_${key}${suffix}`);
  if (msg) {
    if (el) el.textContent = msg;
    if (inp) inp.classList.add('invalid');
    return false;
  }
  if (el) el.textContent = '';
  if (inp) inp.classList.remove('invalid');
  return true;
}

function wireEditCards(scope, renderFn) {
  scope.querySelectorAll('[data-edit-card]').forEach(card => {
    const idx = Number(card.dataset.editCard);
    const cfg = editCardStore.get(idx);
    if (!cfg) return;
    const { fields, onSave } = cfg;
    const fieldsBox = card.querySelector('[data-fields]');
    const editBtn = card.querySelector('[data-edit]');
    const actions = card.querySelector('[data-actions]');
    const cancelBtn = card.querySelector('[data-cancel]');
    const saveBtn = card.querySelector('[data-save]');
    const readOnlyHtml = fields.map(f => {
      const v = f.value ?? '';
      if (f.render) return f.render(v);
      return `<div class="pf-row"><span class="pf-label">${icon(f.icon || 'dot', 14)} ${esc(f.label)}</span><b class="pf-value">${esc(v === '' ? '—' : v)}</b></div>`;
    }).join('');
    if (card._wired) return;
    card._wired = true;
    editBtn.addEventListener('click', () => {
      fieldsBox.innerHTML = fields.map(f => fld(f.key, f.label, f.value ?? '', f, idx)).join('');
      editBtn.style.display = 'none';
      actions.style.display = 'flex';
    });
    cancelBtn.addEventListener('click', () => {
      fieldsBox.innerHTML = readOnlyHtml;
      editBtn.style.display = '';
      actions.style.display = 'none';
      fields.forEach(f => showErrForCard(idx, f.key, ''));
    });
    saveBtn.addEventListener('click', async () => {
      let ok = true;
      const patch = {};
      fields.forEach(f => {
        const el = document.getElementById(`pf_${f.key}_${idx}`);
        if (!el) return;
        let v = el.value;
        if (f.type === 'number') v = v === '' ? '' : Number(v);
        if (f.trim !== false && typeof v === 'string') v = v.trim();
        const msg = f.validate ? f.validate(v, patch) : '';
        if (!showErrForCard(idx, f.key, msg)) ok = false;
        patch[f.key] = v;
      });
      if (!ok) return toast('Check the highlighted fields', 'Some values could not be saved.', 'error');
      const prevHtml = saveBtn.innerHTML;
      saveBtn.disabled = true;
      cancelBtn.disabled = true;
      saveBtn.innerHTML = 'Saving…';
      try {
        const res = await onSave(patch);
        saveBtn.disabled = false;
        cancelBtn.disabled = false;
        saveBtn.innerHTML = prevHtml;
        if (!res || !res.ok) {
          toast('Unable to save changes', (res && res.error) || 'Please try again.', 'error');
          return;
        }
        toast('Changes saved successfully', 'Your profile is now updated across the app.', 'success');
        if (renderFn) renderFn();
      } catch (e) {
        saveBtn.disabled = false;
        cancelBtn.disabled = false;
        saveBtn.innerHTML = prevHtml;
        toast('Unable to save changes', e.message || 'Please try again.', 'error');
      }
    });
  });
}

// legacy helpers kept for non-card fields
function showErr(key, msg) {
  const el = document.getElementById('err_' + key);
  const inp = document.getElementById('pf_' + key);
  if (msg) {
    if (el) el.textContent = msg;
    if (inp) inp.classList.add('invalid');
    return false;
  }
  if (el) el.textContent = '';
  if (inp) inp.classList.remove('invalid');
  return true;
}

// ═══════════════════════════════════════════════════════════
// PROFILE PAGE
// ═══════════════════════════════════════════════════════════
function profilePage(vp) {
  let tab = 'overview';
  let loading = true;
  let error = null;
  // role and user are read dynamically on each render to avoid stale closure
  const getRole = () => role();
  const getUser = () => currentUser();

  const getTabs = () => getRole() === 'patient'
    ? [
      { key: 'overview', label: 'Profile', icon: 'user' },
      { key: 'personal', label: 'Personal information', icon: 'edit' },
      { key: 'healthcare', label: 'Healthcare information', icon: 'heart' },
      { key: 'contact', label: 'Contact information', icon: 'phone' },
      { key: 'security', label: 'Security', icon: 'shield' },
      { key: 'notifications', label: 'Notifications', icon: 'bell' },
    ]
    : [
      { key: 'overview', label: 'Profile', icon: 'user' },
      { key: 'personal', label: 'Personal information', icon: 'edit' },
      { key: 'professional', label: 'Professional information', icon: 'briefcase' },
      { key: 'practice', label: 'Practice information', icon: 'clock' },
      { key: 'availability', label: 'Availability', icon: 'calendar' },
      { key: 'security', label: 'Security', icon: 'shield' },
      { key: 'notifications', label: 'Notifications', icon: 'bell' },
    ];
  const tabs = getTabs(); // initial, but re-evaluated in render

  const me = () => meFor(getRole());
  const myId = () => (currentUser() && currentUser().userId) || '';

  function render() {
    if (loading) {
      vp.innerHTML = `<div class="page-head"><h1 class="page-title">My profile</h1></div>${skeletonCards(3)}`;
      return;
    }
    if (error) {
      vp.innerHTML = `
        <div class="page-head"><h1 class="page-title">My profile</h1></div>
        <div class="card card-pad" style="text-align:center;padding:32px;display:grid;gap:12px;justify-items:center">
          <span class="notif-ic red" style="width:48px;height:48px">${icon('alert', 24)}</span>
          <h3 style="margin:0">Unable to load your profile</h3>
          <p class="text-muted" style="font-size:.86rem;max-width:480px">${esc(error)}</p>
          <p class="text-faint" style="font-size:.78rem">Please check your connection and try again.</p>
          <button class="btn btn-primary" id="retryProfile">${icon('refresh', 16)} Try Again</button>
        </div>`;
      vp.querySelector('#retryProfile')?.addEventListener('click', () => load());
      return;
    }
    const r = getRole();
    const u = getUser() || {};
    const m = me();
    const roleLabel = { patient: 'Patient', doctor: 'Doctor', admin: 'Administrator' }[r] || 'User';

    const currentTabs = getTabs();
    vp.innerHTML = `
    ${pageHead('My profile', r === 'doctor' ? 'Manage your personal, professional and practice information.' : 'Manage your personal, health and contact information.', r === 'patient' ? `<button class="btn btn-outline" id="profileShare">${icon('share', 16)} Share securely</button>` : '')}
    <div class="profile-hero card" style="overflow:hidden">
      <div class="profile-hero-bg"></div>
      <div class="profile-hero-inner">
        <div class="ph-avatar" id="phAvatar">${photoEl(m, 'xl')}</div>
        <div class="ph-meta">
          <span class="badge ${r === 'doctor' ? 'teal' : r === 'admin' ? 'navy' : 'blue'} plain">${esc(roleLabel)}</span>
          <h1>${esc(m.name || u.name || '')}</h1>
          <p>${esc(m.email || u.email || '')}${r === 'doctor' && m.specialty ? ` · ${esc(m.specialty)}` : ''}</p>
        </div>
        <div class="ph-actions">
          <button class="btn btn-glass btn-sm" id="phChange">${icon('camera', 14)} Change photo</button>
          ${m.photo ? `<button class="btn btn-glass-danger btn-sm" id="phRemove">${icon('trash', 14)} Remove photo</button>` : ''}
        </div>
      </div>
    </div>

    <div class="tabs profile-tabs" style="margin:22px 0 20px">
      ${currentTabs.map(t => `<button class="tab ${tab === t.key ? 'active' : ''}" data-tab="${t.key}">${icon(t.icon, 16)} ${esc(t.label)}</button>`).join('')}
    </div>
    <div id="profileBody">${renderTab()}</div>`;

    vp.querySelectorAll('.profile-tabs [data-tab]').forEach(b => b.addEventListener('click', () => {
      tab = b.dataset.tab;
      render();
    }));
    vp.querySelectorAll('[data-count]').forEach(el => countUp(el, parseFloat(el.dataset.count) || 0));
    vp.querySelector('#profileShare')?.addEventListener('click', shareSheet);
    vp.querySelector('#phChange')?.addEventListener('click', () => photoModal());
    vp.querySelector('#phRemove')?.addEventListener('click', async () => {
      const res = await removeProfilePhoto();
      if (res.ok) toast('Photo removed', 'Your profile photo was removed.', 'info');
      else toast('Could not remove photo', res.error, 'error');
      render();
    });
    wireTab(vp);
  }

  // ── Tab renderers ──────────────────────────────────────────
  function renderTab() {
    const rNow = getRole();
    if (rNow === 'admin') return adminOverview();
    const m = me();
    switch (tab) {
      case 'overview': return overviewTab(m);
      case 'personal': return rNow === 'patient' ? personalTab(m) : doctorPersonalTab(m);
      case 'healthcare': return healthcareTab(m);
      case 'contact': return contactTab(m);
      case 'professional': return professionalTab(m);
      case 'practice': return practiceTab(m);
      case 'availability': return availabilityTab(m);
      case 'security': return securityTab();
      case 'notifications': return notificationsTab();
    }
    return '';
  }

  function overviewTab(m) {
    const isDoc = getRole() === 'doctor';
    const aboutRows = (isDoc ? [
      ['briefcase', 'Specialty', m.specialty],
      ['award', 'Qualification', m.education],
      ['home', 'Clinic', m.clinic],
      ['mapPin', 'Location', [m.address, m.city, m.state].filter(Boolean).join(', ') || m.location],
      ['dollar', 'Consultation fee', money(m.fee)],
      ['globe', 'Languages', m.languages],
      ['verified', 'Registration ID', m.registrationId],
    ] : [
      ['mail', 'Email', m.email],
      ['phone', 'Phone', m.phone],
      ['calendar', 'Date of birth', m.dob ? fmtDate(m.dob) : '—'],
      ['heart', 'Blood group', m.blood || '—'],
      ['users', 'Gender', m.gender || '—'],
      ['mapPin', 'Location', [m.address, m.city, m.state].filter(Boolean).join(', ') || '—'],
    ]).map(([ic, k, v]) => `<div class="ab-row"><span class="ab-ic">${icon(ic, 16)}</span><span class="ab-k">${esc(k)}</span><b class="ab-v">${esc(v || '—')}</b></div>`).join('');

    const comp = !isDoc ? profileCompletion(m) : null;
    const compBar = comp ? `
      <div class="card card-pad" style="margin-bottom:16px">
        <div class="card-title" style="margin-bottom:12px">${icon('activity', 18)} Profile completion <span class="badge ${comp.pct>=80?'green':comp.pct>=50?'amber':'red'} plain">${comp.pct}%</span></div>
        <div class="progress" style="height:8px;margin-bottom:10px"><div class="bar ${comp.pct>=80?'green':comp.pct>=50?'amber':'red'}" style="width:${comp.pct}%"></div></div>
        <p class="text-faint" style="font-size:.78rem;margin-bottom:8px">${comp.filled}/${comp.total} fields complete · ${comp.missing.length ? 'Missing: ' + esc(comp.missing.slice(0,4).join(', ')) + (comp.missing.length>4 ? ' +' + (comp.missing.length-4) + ' more' : '') : 'All set!'}</p>
        ${comp.pct<100 ? `<button class="btn btn-outline btn-xs" data-tab-go="personal">${icon('edit',12)} Complete profile</button>` : ''}
        <div class="flex" style="gap:8px;margin-top:12px;flex-wrap:wrap">
          <button class="btn btn-outline btn-xs" id="exportProfileBtn">${icon('download',12)} Export my profile</button>
          <button class="btn btn-outline btn-xs" id="deleteAccountBtn" style="color:var(--danger)">${icon('trash',12)} Delete account</button>
        </div>
      </div>` : '';

    return `
    <div class="kpi-grid" style="margin-bottom:20px">
      ${isDoc ? `
        ${kpi({ label: 'Experience', value: parseInt(m.experience) || 0, iconName: 'award', cls: 'teal' })}
        ${kpi({ label: 'Reviews', value: m.reviews || 0, iconName: 'star', cls: 'amber' })}
        ${kpi({ label: 'Patients treated', value: (m.patients || 0).toLocaleString('en-IN'), iconName: 'users', cls: 'blue' })}`
      : `
        ${kpi({ label: 'Blood group', value: m.blood || '—', iconName: 'droplet', cls: 'red' })}
        ${kpi({ label: 'Height', value: (m.heightCm || 0) + ' cm', iconName: 'ruler', cls: 'blue' })}
        ${kpi({ label: 'Weight', value: (m.weightKg || 0) + ' kg', iconName: 'weight', cls: 'teal' })}`}
    </div>
    ${compBar}
    <div class="grid grid-2" style="align-items:start">
      <div class="card card-pad">
        <div class="card-title" style="margin-bottom:14px">${icon('user', 18)} About</div>
        <div class="about-grid">${aboutRows}</div>
      </div>
      <div style="display:grid;gap:16px">
        <div class="card card-pad">
          <div class="card-title" style="margin-bottom:12px">${icon('shield', 18)} Account security</div>
          <div class="row-item" style="padding:8px 4px">
            <span class="notif-ic green">${icon('checkCircle', 18)}</span>
            <div class="row-main"><div class="row-title" style="font-size:.84rem">Password protection</div><div class="row-sub">Change it anytime from the Security tab</div></div>
          </div>
          <div class="row-item" style="padding:8px 4px">
            <span class="notif-ic blue">${icon('key', 18)}</span>
            <div class="row-main"><div class="row-title" style="font-size:.84rem">Two-factor authentication</div><div class="row-sub">${prefs().twoFA ? 'Enabled' : 'Not enabled'}</div></div>
            <span class="badge ${prefs().twoFA ? 'green' : 'amber'} plain">${prefs().twoFA ? 'On' : 'Off'}</span>
          </div>
          <button class="btn btn-outline btn-sm btn-block mt-12" data-tab-go="security">${icon('settings', 15)} Open security</button>
        </div>
        ${!isDoc ? `
        <div class="card card-pad">
          <div class="card-title" style="margin-bottom:12px">${icon('heart', 18)} Privacy note</div>
          <p class="text-muted" style="font-size:.82rem;line-height:1.6">Your medical profile is shared only with your consulting doctors. You control what is visible during each consultation.</p>
          <p class="text-faint" style="font-size:.75rem;margin-top:8px">Manage privacy & export in <a style="cursor:pointer;color:var(--blue)" data-tab-go="security">Account & Security</a> and <a style="cursor:pointer;color:var(--blue)" data-nav="#/settings">Settings → Privacy</a></p>
        </div>
        <div class="card card-pad">
          <div class="card-title" style="margin-bottom:8px">${icon('activity', 18)} Recent activity</div>
          ${(() => { const h=getProfileHistory('patient').slice(0,3); return h.length ? h.map(x=>`<div class="hist-item" style="padding:6px 0"><span class="hist-ic">${icon('edit',12)}</span><div class="hist-main"><b style="font-size:.8rem">${esc(fieldLabel(x.field))}</b><small class="text-faint">${esc((x.newValue||'').slice(0,40))} · ${fmtDate(x.time.slice(0,10))}</small></div></div>`).join('') : '<p class="text-faint" style="font-size:.78rem">No recent changes</p>'})()}
          <button class="btn btn-outline btn-xs mt-12" data-tab-go="security">${icon('history',12)} View all</button>
        </div>` : ''}
      </div>
    </div>`;
  }

  function personalTab(m) {
    return `
    <div class="pf-sections">
      ${editCard({
        title: 'Personal information', iconName: 'user', saveText: 'Save changes',
        fields: [
          { key: 'name', label: 'Full name', icon: 'user', required: true, validate: V.name },
          { key: 'dob', label: 'Date of birth', icon: 'calendar', type: 'date', validate: V.dob },
          { key: 'gender', label: 'Gender', icon: 'users', select: true, options: ['Male', 'Female', 'Other', 'Prefer not to say'] },
          { key: 'preferredLanguage', label: 'Preferred language', icon: 'globe', select: true, options: LANG_OPTIONS },
          { key: 'address', label: 'Address', icon: 'home', textarea: true, full: true },
          { key: 'city', label: 'City', icon: 'mapPin' },
          { key: 'state', label: 'State', icon: 'mapPin' },
          { key: 'country', label: 'Country', icon: 'globe' },
          { key: 'postalCode', label: 'Postal code', icon: 'tag', validate: V.postalCode },
        ].map(f => ({ ...f, value: m[f.key] ?? '' })),
        onSave: (patch) => updateProfile('patient', myId(), patch),
      }).outerHTML}
    </div>`;
  }

  function doctorPersonalTab(m) {
    return `
    <div class="pf-sections">
      ${editCard({
        title: 'Personal information', iconName: 'user', saveText: 'Save changes',
        sub: 'Email and phone are shown below and can be changed from the Security tab.',
        fields: [
          { key: 'name', label: 'Full name', icon: 'user', required: true, validate: V.name },
          { key: 'dob', label: 'Date of birth', icon: 'calendar', type: 'date', validate: V.dob },
          { key: 'gender', label: 'Gender', icon: 'users', select: true, options: ['Male', 'Female', 'Other', 'Prefer not to say'] },
          { key: 'address', label: 'Address', icon: 'home', textarea: true, full: true },
          { key: 'city', label: 'City', icon: 'mapPin' },
          { key: 'state', label: 'State', icon: 'mapPin' },
          { key: 'country', label: 'Country', icon: 'globe' },
          { key: 'postalCode', label: 'Postal code', icon: 'tag', validate: V.postalCode },
        ].map(f => ({ ...f, value: m[f.key] ?? '' })),
        onSave: (patch) => updateProfile('doctor', myId(), patch),
      }).outerHTML}
      <div class="card card-pad">
        <div class="card-title" style="margin-bottom:12px">${icon('phone', 18)} Contact details</div>
        <div class="pf-row"><span class="pf-label">${icon('mail', 14)} Email</span><b class="pf-value">${esc(m.email || '—')} <span class="badge green plain" style="font-size:.6rem">${icon('check', 10)} Verified</span></b></div>
        <div class="pf-row"><span class="pf-label">${icon('phone', 14)} Phone</span><b class="pf-value">${esc(m.phone || '—')} <span class="badge green plain" style="font-size:.6rem">${icon('check', 10)} Verified</span></b></div>
        <button class="btn btn-outline btn-sm mt-12" data-tab-go="security">${icon('shield', 14)} Change email or phone</button>
      </div>
    </div>`;
  }

  function healthcareTab(m) {
    return `
    <div class="pf-sections">
      ${editCard({
        title: 'Healthcare information', iconName: 'heart', saveText: 'Save changes',
        sub: 'This health data is shared only with your consulting doctors.',
        fields: [
          { key: 'blood', label: 'Blood group', icon: 'droplet', select: true, options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
          { key: 'heightCm', label: 'Height (cm)', icon: 'ruler', type: 'number' },
          { key: 'weightKg', label: 'Weight (kg)', icon: 'weight', type: 'number' },
          { key: 'allergies', label: 'Allergies', icon: 'alert', full: true },
          { key: 'conditions', label: 'Existing conditions', icon: 'activity', textarea: true, full: true },
          { key: 'medications', label: 'Current medications', icon: 'prescription', textarea: true, full: true },
          { key: 'emergencyNotes', label: 'Emergency medical notes', icon: 'alert', textarea: true, full: true },
        ].map(f => ({ ...f, value: m[f.key] ?? '' })),
        onSave: (patch) => updateProfile('patient', myId(), patch),
      }).outerHTML}
    </div>`;
  }

  function contactTab(m) {
    const verifyRow = (key, label, ic) => `
    <div class="pf-row">
      <span class="pf-label">${icon(ic, 14)} ${esc(label)}</span>
      <b class="pf-value">${esc(m[key] || '—')} <span class="badge green plain" style="font-size:.6rem">${icon('check', 10)} Verified</span></b>
      <button class="btn btn-outline btn-xs" data-verify="${key}">${icon('edit', 12)} Change</button>
    </div>`;
    return `
    <div class="pf-sections">
      <div class="card card-pad">
        <div class="card-title" style="margin-bottom:12px">${icon('mail', 18)} Email & phone</div>
        <p class="text-faint" style="font-size:.78rem;margin-bottom:10px">Changes are saved to your account immediately.</p>
        ${verifyRow('email', 'Email address', 'mail')}
        ${verifyRow('phone', 'Phone number', 'phone')}
      </div>
      ${editCard({
        title: 'Emergency contact', iconName: 'userPlus', saveText: 'Save changes',
        sub: 'This contact will be reached in case of medical emergency. Only you and your care team can see it.',
        fields: [
          { key: 'emergencyContactName', label: 'Contact name', icon: 'user', required: true, validate: V.name },
          { key: 'emergencyContactRelationship', label: 'Relationship', icon: 'users', select: true, options: ['Parent','Spouse','Sibling','Child','Friend','Other'] },
          { key: 'emergencyContactPhone', label: 'Phone number', icon: 'phone', required: true, validate: V.phone },
          { key: 'emergencyContactAlternatePhone', label: 'Alternate phone', icon: 'phone', validate: V.emergencyPhone },
        ].map(f => ({ ...f, value: m[f.key] ?? '' })),
        onSave: (patch) => updateProfile('patient', myId(), patch),
      }).outerHTML}
      <div class="card card-pad">
        <div class="card-title" style="margin-bottom:8px">${icon('shield', 18)} Privacy</div>
        <p class="text-muted" style="font-size:.82rem;line-height:1.6">Emergency contact and health data are encrypted and visible only to you and your consulting doctors. You can request export or deletion from Settings → Privacy.</p>
        <div class="flex" style="gap:8px;margin-top:10px;flex-wrap:wrap">
          <button class="btn btn-outline btn-xs" data-nav="#/settings">${icon('settings',12)} Privacy settings</button>
          <button class="btn btn-outline btn-xs" id="contactExportBtn">${icon('download',12)} Export profile</button>
        </div>
      </div>
    </div>`;
  }

  function professionalTab(m) {
    return `
    <div class="pf-sections">
      ${editCard({
        title: 'Professional information', iconName: 'briefcase', saveText: 'Save changes',
        sub: 'Your professional details appear on the patient-facing doctor profile.',
        fields: [
          { key: 'specialty', label: 'Specialization', icon: 'briefcase', required: true, validate: V.required },
          { key: 'education', label: 'Qualification', icon: 'award', required: true, validate: V.required },
          { key: 'experience', label: 'Experience', icon: 'clock', required: true, validate: V.required },
          { key: 'clinic', label: 'Hospital / Clinic', icon: 'home', required: true, validate: V.required },
          { key: 'department', label: 'Department', icon: 'layers' },
          { key: 'licenseNumber', label: 'Medical license number', icon: 'verified', full: true },
          { key: 'fee', label: 'Consultation fee (₹)', icon: 'dollar', type: 'number', required: true, validate: V.fee },
          { key: 'languages', label: 'Languages spoken', icon: 'globe', full: true },
          { key: 'bio', label: 'Professional bio', icon: 'note', textarea: true, full: true },
        ].map(f => ({ ...f, value: m[f.key] ?? '' })),
        onSave: (patch) => updateProfile('doctor', myId(), patch),
      }).outerHTML}
    </div>`;
  }

  function practiceTab(m) {
    return `
    <div class="pf-sections">
      ${editCard({
        title: 'Practice information', iconName: 'clock', saveText: 'Save changes',
        fields: [
          { key: 'duration', label: 'Consultation duration', icon: 'clock', select: true, options: ['15', '30', '45', '60'], render: () => `<div class="pf-row"><span class="pf-label">${icon('clock', 14)} Consultation duration</span><b class="pf-value">${m.duration || 30} minutes</b></div>` },
          { key: 'consultationType', label: 'Consultation type', icon: 'video', select: true, options: ['In-clinic', 'Video', 'Phone', 'In-clinic & Video'] },
        ].map(f => ({ ...f, value: m[f.key] ?? '' })),
        onSave: (patch) => {
          if (patch.duration !== undefined) patch.duration = Number(patch.duration);
          return updateProfile('doctor', myId(), patch);
        },
      }).outerHTML}
      <div class="card card-pad">
        <div class="card-title" style="margin-bottom:8px">${icon('info', 18)} How this affects patients</div>
        <p class="text-muted" style="font-size:.82rem;line-height:1.6">Consultation duration sets the slot spacing patients see when booking. Working hours and leave dates are managed in the <b>Availability</b> tab and apply to the scheduling page instantly.</p>
        <button class="btn btn-outline btn-sm mt-12" data-tab-go="availability">${icon('calendar', 14)} Open availability</button>
      </div>
    </div>`;
  }

  // ── Availability (doctor) ──────────────────────────────────
  function availabilityTab(m) {
    const weekly = DAY_NAMES.map((_, dow) =>
      (m.slots || []).filter(s => s.dayOfWeek === dow).map(s => ({ start: s.startTime, end: s.endTime })).sort((a, b) => a.start.localeCompare(b.start))
    );
    const offDays = m.offDays || [];

    const dayRow = (dow) => {
      const segs = weekly[dow] || [];
      const on = segs.length > 0;
      return `
      <div class="av-day" data-day="${dow}">
        <div class="av-day-head">
          <span class="switch"><input type="checkbox" data-day-on="${dow}" ${on ? 'checked' : ''} /><span class="track"></span></span>
          <b>${DAY_NAMES[dow]}</b>
          <span class="text-faint" style="font-size:.72rem">${on ? segs.map(s => `${s.start} – ${s.end}`).join(' · ') : 'Unavailable'}</span>
        </div>
        <div class="av-segs" data-segs="${dow}">
          ${segs.map((s, i) => segRow(dow, i, s)).join('')}
        </div>
      </div>`;
    };

    return `
    <div class="card card-pad">
      <div class="card-title" style="margin-bottom:4px">${icon('calendar', 18)} Weekly schedule</div>
      <p class="text-faint" style="font-size:.78rem;margin-bottom:14px">Set working days, working hours and breaks (gaps between windows). Changes appear on the patient scheduling page immediately.</p>
      <div class="av-days">${DAY_NAMES.map((_, i) => dayRow(i)).join('')}</div>
      <div class="flex" style="gap:10px;justify-content:flex-end;margin-top:14px">
        <button class="btn btn-outline" id="avDiscard">${icon('x', 15)} Discard</button>
        <button class="btn btn-primary" id="avSave">${icon('checkCircle', 16)} Save availability</button>
      </div>
    </div>
    <div class="card card-pad">
      <div class="card-title" style="margin-bottom:4px">${icon('calendarX', 18)} Leave / unavailable dates</div>
      <p class="text-faint" style="font-size:.78rem;margin-bottom:12px">On these dates no slots are offered to patients.</p>
      <div class="flex gap-8" style="flex-wrap:wrap;margin-bottom:12px">
        ${offDays.length ? offDays.map(d => `
          <span class="off-chip">${esc(d)} <button data-off-rm="${esc(d)}" aria-label="Remove leave">${icon('x', 12)}</button></span>`).join('')
          : '<span class="text-faint" style="font-size:.8rem">No leave marked.</span>'}
      </div>
      <div class="flex gap-8" style="flex-wrap:wrap">
        <input class="input" type="date" id="avOffDate" style="max-width:190px" />
        <button class="btn btn-outline" id="avOffAdd">${icon('plus', 15)} Mark as leave</button>
      </div>
    </div>`;
  }

  function segRow(dow, i, seg) {
    const opts = (sel) => TIME_OPTS.map(t => `<option ${(seg[sel] || '') === t ? 'selected' : ''}>${t}</option>`).join('');
    return `
    <div class="seg-row" data-seg="${dow}-${i}">
      <span>${icon('clock', 14)}</span>
      <select class="select" data-seg-start>${opts('start')}</select>
      <span class="text-faint">to</span>
      <select class="select" data-seg-end>${opts('end')}</select>
      <button class="icon-btn" data-seg-rm aria-label="Remove window">${icon('x', 15)}</button>
    </div>`;
  }

  // ── Security ───────────────────────────────────────────────
  function securityTab() {
    const hist = getProfileHistory(getRole());
    return `
    <div class="grid grid-2" style="align-items:start">
      <div style="display:grid;gap:16px">
        <div class="card card-pad">
          <div class="card-title" style="margin-bottom:14px">${icon('lock', 18)} Change password</div>
          <form id="pwForm" novalidate style="display:grid;gap:14px">
            <div class="field"><label>Current password <span class="req">*</span></label>
              <div class="input-icon" style="position:relative">${icon('lock', 17)}<input class="input" type="password" id="pwCur" placeholder="••••••••" autocomplete="current-password" style="padding-right:44px" /><button type="button" class="pw-toggle" data-pw="pwCur" aria-label="Show password">${icon('eye', 17)}</button></div>
              <small class="err" id="err_pwCur"></small></div>
            <div class="field"><label>New password <span class="req">*</span></label>
              <div class="input-icon" style="position:relative">${icon('key', 17)}<input class="input" type="password" id="pwNew" placeholder="Minimum 8 characters" autocomplete="new-password" style="padding-right:44px" /><button type="button" class="pw-toggle" data-pw="pwNew" aria-label="Show password">${icon('eye', 17)}</button></div>
              <small class="err" id="err_pwNew"></small></div>
            <div class="field"><label>Confirm new password <span class="req">*</span></label>
              <div class="input-icon" style="position:relative">${icon('check', 17)}<input class="input" type="password" id="pwConfirm" placeholder="Re-enter new password" autocomplete="new-password" style="padding-right:44px" /><button type="button" class="pw-toggle" data-pw="pwConfirm" aria-label="Show password">${icon('eye', 17)}</button></div>
              <small class="err" id="err_pwConfirm"></small></div>
            <div class="mini-chips">
              <span class="mini-chip">${icon('check', 12)} 8+ characters</span>
              <span class="mini-chip">${icon('check', 12)} Uppercase &amp; number</span>
            </div>
            <div><button class="btn btn-primary" type="submit">${icon('checkCircle', 16)} Update password</button></div>
          </form>
        </div>
        <div class="card card-pad">
          <div class="card-title" style="margin-bottom:6px">${icon('shield', 18)} Two-factor authentication</div>
          <div class="setting-row" style="border-bottom:none">
            <span class="s-ic blue">${icon('smartphone', 20)}</span>
            <div class="s-body"><b>Authenticator app</b><small>Get a one-time code on your device when signing in</small></div>
            <span class="switch"><input type="checkbox" id="twoFA" ${prefs().twoFA ? 'checked' : ''} /><span class="track"></span></span>
          </div>
        </div>
        <div class="card card-pad">
          <div class="card-title" style="margin-bottom:12px">${icon('activity', 18)} Active sessions</div>
          <div class="row-item" style="padding:10px 6px">
            <span class="notif-ic green">${icon('monitor', 18)}</span>
            <div class="row-main"><div class="row-title" style="font-size:.84rem">This device <span class="badge green plain" style="font-size:.6rem">Current session</span></div><div class="row-sub">Web browser · ${esc(navDevice())}</div></div>
          </div>
        </div>
      </div>
      <div style="display:grid;gap:16px">
        <div class="card card-pad">
          <div class="card-title" style="margin-bottom:6px">${icon('verified', 18)} Contact verification</div>
          <p class="text-faint" style="font-size:.78rem;margin-bottom:10px">You can update your email and phone number at any time. The new value is saved to your account immediately.</p>
          <div class="pf-row"><span class="pf-label">${icon('mail', 14)} Email</span><b class="pf-value">${esc(me().email || '—')}</b><button class="btn btn-outline btn-xs" data-verify="email">${icon('edit', 12)} Change</button></div>
          <div class="pf-row"><span class="pf-label">${icon('phone', 14)} Phone</span><b class="pf-value">${esc(me().phone || '—')}</b><button class="btn btn-outline btn-xs" data-verify="phone">${icon('edit', 12)} Change</button></div>
        </div>
        <div class="card card-pad">
          <div class="card-title" style="margin-bottom:12px">${icon('history', 18)} Profile change history</div>
          ${hist.length ? hist.map(h => `
          <div class="hist-item">
            <span class="hist-ic">${icon('edit', 13)}</span>
            <div class="hist-main">
              <b>${esc(fieldLabel(h.field))}</b>
              <small>${esc(h.oldValue || '—')} → ${esc(h.newValue || '—')}</small>
              <small class="text-faint">${fmtDate(h.time.slice(0, 10))} · ${esc(h.section)}</small>
            </div>
          </div>`).join('') : `<p class="text-faint" style="font-size:.8rem">No profile changes recorded yet.</p>`}
        </div>
      </div>
    </div>`;
  }

  function notificationsTab() {
    const m = me();
    const cur = m.notifPrefs || {};
    return `
    <div class="card card-pad" style="max-width:680px">
      <div class="card-title" style="margin-bottom:4px">${icon('bell', 18)} Notification preferences</div>
      <p class="text-faint" style="font-size:.78rem;margin-bottom:8px">Choose what MedCare may notify you about. Changes are saved to your account instantly.</p>
      ${NOTIF_GROUPS.map(g => `
      <div class="setting-row">
        <span class="s-ic blue">${icon(g.icon, 20)}</span>
        <div class="s-body"><b>${esc(g.title)}</b><small>${esc(g.sub)}</small></div>
        <span class="switch"><input type="checkbox" data-np="${g.key}" ${cur[g.key] !== false ? 'checked' : ''} /><span class="track"></span></span>
      </div>`).join('')}
    </div>`;
  }

  function adminOverview() {
    const u = currentUser() || {};
    const s = getState();
    const activeUsers = s.users && s.users.length ? s.users.length : s.patients.length;
    const stats = buildAnalytics();
    return `
    <div class="kpi-grid" style="margin-bottom:20px">
      ${kpi({ label: 'Active users', value: activeUsers, iconName: 'users', cls: 'blue' })}
      ${kpi({ label: 'Doctors', value: getDoctors().length, iconName: 'stethoscope', cls: 'teal' })}
      ${kpi({ label: 'Appointments', value: stats.counts.total, iconName: 'calendar', cls: 'green' })}
    </div>
    <div class="grid grid-2" style="align-items:start">
      <div class="card card-pad">
        <div class="card-title" style="margin-bottom:14px">${icon('user', 18)} About</div>
        <div class="about-grid">
          ${[['mail', 'Email', u.email], ['shield', 'Role', 'Administrator'], ['users', 'Organization', 'MedCare']]
            .map(([ic, k, v]) => `<div class="ab-row"><span class="ab-ic">${icon(ic, 16)}</span><span class="ab-k">${esc(k)}</span><b class="ab-v">${esc(v || '—')}</b></div>`).join('')}
        </div>
      </div>
      <div class="card card-pad">
        <div class="card-title" style="margin-bottom:12px">${icon('shield', 18)} Platform settings</div>
        <p class="text-faint" style="font-size:.82rem;line-height:1.6">Administrator accounts are provisioned by the organization. Personal profile editing is available to patients and doctors.</p>
        <button class="btn btn-outline btn-sm mt-12" data-nav="#/settings">${icon('settings', 15)} Open settings</button>
      </div>
    </div>`;
  }

  // ── Wiring ─────────────────────────────────────────────────
  function wireTab(scope) {
    // wire editable cards (fixes outerHTML listener loss)
    wireEditCards(scope, render);
    // reusable eye toggles for all password fields in this tab (declarative + dynamic)
    bindPasswordToggles(scope);
    scope.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.nav)));
    scope.querySelectorAll('[data-tab-go]').forEach(el => el.addEventListener('click', () => { tab = el.dataset.tabGo; render(); }));
    scope.querySelectorAll('[data-verify]').forEach(el => el.addEventListener('click', () => verifyModal(el.dataset.verify)));

    // availability
    const avSave = scope.querySelector('#avSave');
    if (avSave) {
      scope.querySelector('#avDiscard').addEventListener('click', () => render());
      scope.querySelectorAll('[data-day-on]').forEach(cb => cb.addEventListener('change', () => {
        const dow = Number(cb.dataset.dayOn);
        const segs = scope.querySelector(`[data-segs="${dow}"]`);
        segs.innerHTML = cb.checked ? segRow(dow, 0, { start: '09:00', end: '17:00' }) : '';
        wireSegs(segs, dow);
      }));
      scope.querySelectorAll('.av-days [data-day]').forEach(row => wireSegs(row.querySelector('[data-segs]'), Number(row.dataset.day)));
      scope.querySelector('#avOffAdd').addEventListener('click', () => addOffDay(scope));
      scope.querySelectorAll('[data-off-rm]').forEach(b => b.addEventListener('click', () => {
        removeOffDay(myId(), b.dataset.offRm);
        toast('Leave removed', `${b.dataset.offRm} is available again.`, 'info');
        render();
      }));
      avSave.addEventListener('click', () => {
        const weekly = DAY_NAMES.map((_, dow) =>
          [...scope.querySelectorAll(`[data-segs="${dow}"] .seg-row`)].map(row => ({
            start: row.querySelector('[data-seg-start]').value,
            end: row.querySelector('[data-seg-end]').value,
          })).filter(s => s.start < s.end)
        );
        for (let i = 0; i < 7; i++) {
          if (weekly[i].some(s => s.start >= s.end)) { toast('Invalid schedule', 'Each window needs an end time after its start time.', 'error'); return; }
        }
        const res = setAvailability(myId(), { weekly, duration: me().duration || 30 });
        if (res.ok) {
          toast('Availability updated', 'Your working hours are live on the scheduling page.', 'success');
          render();
        } else {
          toast('Could not save', 'You can only edit your own availability.', 'error');
        }
      });
    }

    // password
    const pw = scope.querySelector('#pwForm');
    if (pw) {
      pw.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cur = scope.querySelector('#pwCur').value;
        const nw = scope.querySelector('#pwNew').value;
        const cf = scope.querySelector('#pwConfirm').value;
        let ok = true;
        if (!cur) { showErr('pwCur', 'This field is required.'); ok = false; } else showErr('pwCur', '');
        if (V.password(nw)) { showErr('pwNew', V.password(nw)); ok = false; } else showErr('pwNew', '');
        if (nw !== cf) { showErr('pwConfirm', 'Passwords do not match.'); ok = false; } else showErr('pwConfirm', '');
        if (!ok) return;
        const res = await changePassword(getRole(), cur, nw);
        if (!res.ok) {
          if (res.error === 'bad-current') { showErr('pwCur', 'Current password is incorrect.'); toast('Incorrect password', 'The current password you entered is wrong.', 'error'); return; }
          toast('Could not update password', 'Something went wrong.', 'error'); return;
        }
        toast('Password updated successfully', 'Other sessions were signed out. Use your new password at the next sign-in.', 'success');
        pw.reset();
        render();
      });
    }

    const two = scope.querySelector('#twoFA');
    if (two) two.addEventListener('change', () => {
      const p = prefs(); p.twoFA = two.checked; savePrefs(p);
      updateNotifPrefs({ twoFA: two.checked });
      toast('Two-factor authentication', two.checked ? 'Enabled for your account.' : 'Disabled.', two.checked ? 'success' : 'info');
    });

    scope.querySelectorAll('[data-revoke]').forEach(b => b.addEventListener('click', () => {
      b.closest('.row-item').style.opacity = '.4';
      b.disabled = true;
      toast('Session revoked', `${b.dataset.revoke} signed out.`, 'info');
    }));

    // notifications
    scope.querySelectorAll('[data-np]').forEach(cb => cb.addEventListener('change', () => {
      const g = NOTIF_GROUPS.find(x => x.key === cb.dataset.np);
      const patch = {};
      patch.notifPrefs = { ...(me().notifPrefs || {}), [cb.dataset.np]: cb.checked };
      updateProfile(getRole(), myId(), patch);
      const p = prefs(); p[cb.dataset.np] = cb.checked; savePrefs(p);
      toast('Preference updated', `${g ? g.title : 'Notification'} ${cb.checked ? 'enabled' : 'muted'}.`, 'info');
    }));

    // overview / contact export & delete (spec FEATURE 15/16)
    scope.querySelector('#exportProfileBtn')?.addEventListener('click', exportProfile);
    scope.querySelector('#contactExportBtn')?.addEventListener('click', exportProfile);
    scope.querySelector('#deleteAccountBtn')?.addEventListener('click', deleteAccountFlow);
  }

  function wireSegs(container, dow) {
    container.querySelectorAll('[data-seg-rm]').forEach(b => b.addEventListener('click', () => b.closest('.seg-row').remove()));
    const wrap = container.parentElement;
    const old = wrap.querySelector('.add-window');
    if (old) old.remove();
    const add = document.createElement('button');
    add.className = 'btn btn-outline btn-xs add-window';
    add.innerHTML = `${icon('plus', 13)} Add window`;
    add.type = 'button';
    add.addEventListener('click', () => {
      const idx = container.querySelectorAll('.seg-row').length;
      container.insertAdjacentHTML('beforeend', segRow(dow, idx, { start: '09:00', end: '17:00' }));
      wireSegs(container, dow);
    });
    wrap.appendChild(add);
  }

  function addOffDay(scope) {
    const inp = scope.querySelector('#avOffDate');
    if (!inp || !inp.value) { toast('Pick a date', 'Choose the date you want to mark as leave.', 'error'); return; }
    setOffDay(myId(), inp.value);
    toast('Leave added', `${inp.value} is now unavailable for booking.`, 'success');
    render();
  }

  // ── Modals ─────────────────────────────────────────────────
  function photoModal() {
    let picked = null;
    openModal(`
      <div class="modal-head"><h3>${icon('camera', 18)} Profile photo</h3><button class="icon-btn" data-close aria-label="Close">${icon('x', 18)}</button></div>
      <div class="modal-body" style="display:grid;gap:14px;align-items:center;justify-items:center">
        <div class="photo-preview" id="photoPreview">${photoEl(me(), 'xl')}</div>
        <p class="text-muted" style="font-size:.8rem;text-align:center">JPG, PNG or WEBP · max 2 MB · at least 200×200 px. Photos are stored securely on your account.</p>
        <button class="btn btn-primary" id="photoPick">${icon('upload', 15)} Choose photo</button>
        <input type="file" id="photoFile" accept="image/jpeg,image/png,image/webp" hidden />
        <div class="flex" style="gap:10px">
          <button class="btn btn-outline" data-close>Cancel</button>
          <button class="btn btn-primary" id="photoSave" disabled>${icon('checkCircle', 15)} Save photo</button>
        </div>
      </div>`, {
      onMount: (box, close) => {
        const file = box.querySelector('#photoFile');
        box.querySelector('#photoPick').addEventListener('click', () => file.click());
        file.addEventListener('change', () => {
          const f = file.files[0];
          if (!f) return;
          const err = validatePhotoFile(f);
          if (err) { toast('Invalid photo', err, 'error'); file.value = ''; return; }
          picked = f;
          const previewUrl = URL.createObjectURL(f);
          box.querySelector('#photoPreview').innerHTML = `<span class="avatar xl photo-avatar"><img src="${previewUrl}" alt="Preview" /></span>`;
          box.querySelector('#photoSave').disabled = false;
          toast('Photo ready', 'Preview loaded — save to update your profile.', 'info');
        });
        box.querySelector('#photoSave').addEventListener('click', async () => {
          if (!picked) return;
          const saveBtn = box.querySelector('#photoSave');
          saveBtn.disabled = true;
          saveBtn.innerHTML = 'Uploading…';
          const res = await uploadProfilePhoto(picked);
          saveBtn.disabled = false;
          saveBtn.innerHTML = `${icon('checkCircle', 15)} Save photo`;
          if (res.ok) {
            toast('Profile photo updated', 'Your photo is now visible across the app.', 'success');
            close();
            render();
          } else {
            toast('Upload failed', res.error || 'Please try again.', 'error');
            file.value = '';
          }
        });
      },
    });
  }

  function verifyModal(field) {
    const label = field === 'email' ? 'email address' : 'phone number';
    openModal(`
      <div class="modal-head"><h3>${icon('verified', 18)} Change ${esc(label)}</h3><button class="icon-btn" data-close aria-label="Close">${icon('x', 18)}</button></div>
      <div class="modal-body" id="verifyBody" style="display:grid;gap:14px">
        <div class="stepper-hint">${icon('shield', 18)} Enter your new ${esc(label)} — it will be saved to your account immediately.</div>
        <div class="field">
          <label>New ${esc(label)} <span class="req">*</span></label>
          <div class="input-icon">${icon(field === 'email' ? 'mail' : 'phone', 17)}<input class="input" id="verNew" type="${field === 'email' ? 'email' : 'tel'}" placeholder="${field === 'email' ? 'you@example.com' : '+91 98xxxxxx'}" /></div>
          <small class="err" id="err_verNew"></small>
        </div>
        <div class="flex" style="gap:10px;justify-content:flex-end">
          <button class="btn btn-outline" data-close>Cancel</button>
          <button class="btn btn-primary" id="verSave">${icon('checkCircle', 15)} Save ${esc(label)}</button>
        </div>
      </div>`, {
      onMount: (box, close) => {
        box.querySelector('#verSave').addEventListener('click', async () => {
          const v = box.querySelector('#verNew').value.trim();
          const msg = field === 'email' ? V.email(v) : V.phone(v);
          if (msg) { box.querySelector('#err_verNew').textContent = msg; box.querySelector('#verNew').classList.add('invalid'); return; }
          const saveBtn = box.querySelector('#verSave');
          saveBtn.disabled = true;
          saveBtn.innerHTML = 'Saving…';
          const res = await updateProfile(getRole(), myId(), { [field]: v });
          saveBtn.disabled = false;
          saveBtn.innerHTML = `${icon('checkCircle', 15)} Save ${esc(label)}`;
          if (res.ok) {
            toast('Saved', `Your ${label} was updated successfully.`, 'success');
            close();
            render();
          } else toast('Could not save', res.error || 'Please try again.', 'error');
        });
      },
    });
  }

  function fieldLabel(field) {
    const map = {
      name: 'Full name', dob: 'Date of birth', gender: 'Gender', phone: 'Phone', email: 'Email',
      address: 'Address', city: 'City', state: 'State', country: 'Country', postalCode: 'Postal code',
      emergencyContactName: 'Emergency contact', emergencyContactPhone: 'Emergency phone',
      preferredLanguage: 'Preferred language', blood: 'Blood group', allergies: 'Allergies',
      conditions: 'Existing conditions', medications: 'Medications', emergencyNotes: 'Emergency notes',
      photo: 'Profile photo', specialty: 'Specialization', education: 'Qualification',
      experience: 'Experience', fee: 'Consultation fee', clinic: 'Clinic', department: 'Department',
      bio: 'Professional bio', languages: 'Languages', duration: 'Consultation duration',
      consultationType: 'Consultation type', password: 'Password', notifPrefs: 'Notification preferences',
      'weekly schedule': 'Availability',
    };
    return map[field] || field;
  }

  function shareSheet() {
    openModal(`
      <div class="modal-head"><h3>Share medical record</h3><button class="icon-btn" data-close aria-label="Close">${icon('x', 18)}</button></div>
      <div class="modal-body" style="display:grid;gap:14px">
        <p class="text-muted" style="font-size:.84rem">Share a secure, read-only copy of your health summary with a doctor or hospital. The link expires in 24 hours.</p>
        <div class="stepper-hint">${icon('shield', 18)} End-to-end encrypted · access revoked automatically</div>
        <div class="flex gap-8" style="flex-wrap:wrap">
          <button class="btn btn-outline" data-close>${icon('mail', 15)} Share via email</button>
          <button class="btn btn-outline" data-close>${icon('chat', 15)} Send in chat</button>
          <button class="btn btn-primary" data-close>${icon('copy', 15)} Copy link</button>
        </div>
      </div>`);
  }

  async function exportProfile() {
    try {
      const sess = JSON.parse(localStorage.getItem('medcare-session') || 'null');
      if (!sess || !sess.token) { toast('Not signed in', 'Please sign in again.', 'error'); return; }
      const res = await fetch('/api/profile/export', { headers: { Authorization: 'Bearer ' + sess.token } });
      if (!res.ok) {
        const err = await res.json().catch(()=>({error:'Export failed'}));
        throw new Error(err.error || 'Export failed');
      }
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = String(data.user?.name||'profile').replace(/\s+/g,'-').replace(/[^a-zA-Z0-9-_]/g,'');
      a.download = `medcare-profile-${safeName}-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=> URL.revokeObjectURL(url), 1000);
      toast('Profile exported', 'Your profile data has been downloaded (no passwords included).', 'success');
    } catch (e) {
      console.error('[export] failed', e);
      toast('Export failed', e.message || 'Could not export profile', 'error');
    }
  }

  async function deleteAccountFlow() {
    const first = await confirmDialog({ title: 'Delete account?', message: 'Are you sure you want to delete your account? This will request deletion and may require admin approval if you have medical records.', confirmText: 'Continue', danger: true, iconName: 'trash' });
    if (!first) return;
    const second = await confirmDialog({ title: 'Final confirmation', message: 'This action cannot be undone without admin help. Type DELETE is not required, but please confirm again that you want to delete your MedCare account and all personal data.', confirmText: 'Confirm Delete', danger: true, iconName: 'alert' });
    if (!second) return;
    try {
      const sess = JSON.parse(localStorage.getItem('medcare-session') || 'null');
      const res = await fetch('/api/profile', { method: 'DELETE', headers: { Authorization: 'Bearer ' + (sess?.token||'') } });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) {
        // Spec: deletion may be blocked due to appointments/history – show informative message
        toast('Deletion request logged', data.error || 'Your request has been logged. Admin will contact you within 48 hours.', 'info');
        return;
      }
      toast('Account deleted', 'Your account has been deleted. You will be signed out.', 'success');
      const { logout } = await import('../store.js');
      logout();
      location.hash = '#/welcome';
    } catch (e) {
      toast('Deletion failed', e.message || 'Could not delete account', 'error');
    }
  }

  async function load() {
    loading = true;
    error = null;
    try { render(); } catch (e) { console.error('[profile] render skeleton failed', e); }
    try {
      const res = await fetchProfile();
      if (!res.ok) {
        throw new Error(res.error || 'Could not load your profile');
      }
    } catch (e) {
      console.error('[profile] load failed', e);
      error = e.message || 'Could not load your profile. Please try again.';
    } finally {
      loading = false;
      try { render(); } catch (e) { console.error('[profile] render failed', e); }
    }
  }

  // Initial load with proper error handling — loading will always resolve via finally
  load().catch(e => {
    console.error('[profile] initial load unhandled', e);
    loading = false;
    error = e.message || 'Could not load profile';
    try { render(); } catch {}
  });
}

// ═══════════════════════════════════════════════════════════
// SETTINGS PAGE
// ═══════════════════════════════════════════════════════════
function settingsPage(vp) {
  let tab = 'appearance';

  const tabs = [
    { key: 'privacy', label: 'Privacy', icon: 'lock' },
    { key: 'appearance', label: 'Appearance', icon: 'sun' },
    { key: 'language', label: 'Language', icon: 'globe' },
  ];

  function lang() {
    return localStorage.getItem('medcare-lang') || 'English (India)';
  }

  function togglePref(key, onEl, offEl) {
    const p = prefs();
    const box = document.getElementById(key);
    p[key] = box ? box.checked : false;
    savePrefs(p);
    updateNotifPrefs({ [key]: p[key] });
    if (onEl) onEl.textContent = p[key] ? 'Enabled' : 'Disabled';
  }

  function render() {
    const p = prefs();

    vp.innerHTML = `
    ${pageHead('Settings', 'Control privacy, appearance and language preferences. Security and notifications live on your profile page.')}
    <div class="settings-layout">
      <nav class="settings-nav card" aria-label="Settings sections">
        ${tabs.map(t => `<button class="sn-item ${tab === t.key ? 'active' : ''}" data-tab="${t.key}">${icon(t.icon, 18)} ${esc(t.label)}</button>`).join('')}
      </nav>
      <div class="settings-panel" id="settingsPanel"></div>
    </div>`;

    vp.querySelectorAll('.settings-nav [data-tab]').forEach(b => b.addEventListener('click', () => {
      tab = b.dataset.tab;
      render();
    }));
    renderPanel();
  }

  function renderPanel() {
    const panel = vp.querySelector('#settingsPanel');
    const p = prefs();

    if (tab === 'privacy') {
      const rows = [
        { key: 'shareHistory', title: 'Share medical history with doctors', sub: 'Allow consulting doctors to view your full history', icon: 'clipboard', cls: 'blue' },
        { key: 'autoShare', title: 'Auto-share lab reports', sub: 'Uploaded lab reports are shared with your doctor automatically', icon: 'scan', cls: 'teal' },
        { key: 'profileVisible', title: 'Make profile visible to doctors', sub: 'Let doctors find you when you appear in their patient list', icon: 'user', cls: 'purple' },
        { key: 'marketing', title: 'Health tips & marketing emails', sub: 'Occasional wellness content and platform updates', icon: 'mail', cls: 'amber' },
        { key: 'analytics', title: 'Anonymous usage analytics', sub: 'Help improve MedCare with anonymous data', icon: 'analytics', cls: 'green' },
      ];
      panel.innerHTML = `
      <div class="card card-pad">
        <div class="card-title" style="margin-bottom:4px">${icon('lock', 18)} Privacy settings</div>
        <p class="text-faint" style="font-size:.78rem;margin-bottom:8px">Control how your health data is shared across the platform.</p>
        ${rows.map(r => `
        <div class="setting-row">
          <span class="s-ic ${r.cls}">${icon(r.icon, 20)}</span>
          <div class="s-body"><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></div>
          <span class="switch"><input type="checkbox" id="${r.key}" ${p[r.key] !== false ? 'checked' : ''} /><span class="track"></span></span>
        </div>`).join('')}
        <div class="stepper-hint mt-12">${icon('shield', 18)} Your data is encrypted at rest and in transit. You can request a full export or deletion anytime.</div>
      </div>
      <div class="card card-pad">
        <div class="card-title" style="margin-bottom:12px">${icon('download', 18)} Your data</div>
        <div class="flex gap-10" style="flex-wrap:wrap">
          <button class="btn btn-outline" id="exportData">${icon('download', 15)} Export my data</button>
          <button class="btn btn-outline" id="requestDelete">${icon('trash', 15)} Request account deletion</button>
        </div>
      </div>`;
      rows.forEach(r => {
        const el = panel.querySelector('#' + r.key);
        if (el) el.addEventListener('change', () => togglePref(r.key));
      });
      panel.querySelector('#exportData')?.addEventListener('click', () => toast('Export requested', 'A secure download link will be emailed to you.', 'success'));
      panel.querySelector('#requestDelete')?.addEventListener('click', () => toast('Deletion request received', 'Our team will contact you to confirm within 48 hours.', 'info'));
      return;
    }

    if (tab === 'appearance') {
      const mode = getThemeMode();
      const activeTheme = document.documentElement.dataset.theme || resolveTheme(mode);
      panel.innerHTML = `
      <div class="card card-pad">
        <div class="card-title" style="margin-bottom:4px">${icon('sun', 18)} Theme</div>
        <p class="text-faint" style="font-size:.78rem;margin-bottom:8px">Auto follows your local time — Light from 6 AM to 6 PM, Dark from 6 PM to 6 AM.</p>
        <div class="theme-swatch">
          <div class="theme-opt ${mode === 'auto' ? 'selected' : ''}" data-mode="auto">
            <span class="tp system"></span>
            <div><b>Auto</b><div class="text-faint" style="font-size:.74rem">Day → Light · Night → Dark · ${themeModeLabel('auto', activeTheme)}</div></div>
            ${icon('checkCircle', 18)}
          </div>
          <div class="theme-opt ${mode === 'light' ? 'selected' : ''}" data-mode="light">
            <span class="tp light"></span>
            <div><b>Light</b><div class="text-faint" style="font-size:.74rem">Clean white surfaces with soft accents</div></div>
            ${icon('checkCircle', 18)}
          </div>
          <div class="theme-opt ${mode === 'dark' ? 'selected' : ''}" data-mode="dark">
            <span class="tp dark"></span>
            <div><b>Dark</b><div class="text-faint" style="font-size:.74rem">Deep navy surfaces, easy on the eyes</div></div>
            ${icon('checkCircle', 18)}
          </div>
        </div>
        <div class="divider"></div>
        <div class="setting-row" style="border-bottom:none">
          <span class="s-ic blue">${icon('moon', 20)}</span>
          <div class="s-body"><b>Reduce motion</b><small>Minimize animations and transitions</small></div>
          <span class="switch"><input type="checkbox" id="reduceMotion" ${p.reduceMotion ? 'checked' : ''} /><span class="track"></span></span>
        </div>
      </div>`;
      panel.querySelectorAll('.theme-opt').forEach(opt => opt.addEventListener('click', () => {
        setThemeMode(opt.dataset.mode);
        panel.querySelectorAll('.theme-opt').forEach(x => x.classList.toggle('selected', x === opt));
        const m = opt.dataset.mode;
        toast('Theme mode updated', m === 'auto'
          ? `Auto — follows your local time (${themeModeLabel()}).`
          : m === 'light' ? 'Always light mode.' : 'Always dark mode.', 'success');
      }));
      panel.querySelector('#reduceMotion')?.addEventListener('change', (e) => {
        const p2 = prefs(); p2.reduceMotion = e.target.checked; savePrefs(p2);
        document.documentElement.classList.toggle('motion-off', e.target.checked);
      });
      return;
    }

    if (tab === 'language') {
      panel.innerHTML = `
      <div class="card card-pad" style="max-width:520px">
        <div class="card-title" style="margin-bottom:14px">${icon('globe', 18)} Language</div>
        <p class="text-faint" style="font-size:.78rem;margin-bottom:16px">Choose your preferred language for the MedCare interface.</p>
        <div class="field">
          <label>Interface language</label>
          <select class="select" id="langSelect">
            ${LANG_OPTIONS.map(l => `<option ${lang() === l ? 'selected' : ''}>${esc(l)}</option>`).join('')}
          </select>
        </div>
        <div class="divider"></div>
        <div class="setting-row" style="border-bottom:none">
          <span class="s-ic blue">${icon('clock', 20)}</span>
          <div class="s-body"><b>Time zone</b><small>Appointment times shown in</small></div>
          <b class="mono" style="color:var(--ink);font-size:.8rem">IST · +05:30</b>
        </div>
      </div>`;
      panel.querySelector('#langSelect').addEventListener('change', (e) => {
        localStorage.setItem('medcare-lang', e.target.value);
        toast('Language updated', `Interface language set to ${e.target.value}.`, 'success');
      });
      return;
    }
  }

  render();
}

export function initProfile() {
  registerPage('profile', profilePage);
  registerPage('settings', settingsPage);
}