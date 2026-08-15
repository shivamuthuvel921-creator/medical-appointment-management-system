// ─────────────────────────────────────────────────────────────
// Profile & Settings — personal, health, professional, security
// ─────────────────────────────────────────────────────────────
import { icon, esc, toast, openModal, fmtDate, countUp, money, avatar } from '../core.js';
import { currentUser, getPatient, getDoctor, updateProfile, changePassword, requestVerificationChange, getProfileHistory, setAvailability, setOffDay, removeOffDay, getState, getDoctors, buildAnalytics } from '../store.js';
import { registerPage, role, navigate } from '../router.js';
import { getThemeMode, setThemeMode, resolveTheme, themeModeLabel } from '../theme.js';
import { pageHead, kpi } from './shared.js';

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
  if (r === 'doctor') return getDoctor(u && u.userId ? u.userId : '') || {};
  if (r === 'patient') return getPatient(u && u.userId ? u.userId : '') || {};
  return {};
}

function navDevice() {
  const ua = navigator.userAgent || '';
  const os = /iPhone|iPad/i.test(ua) ? 'iOS' : /Android/i.test(ua) ? 'Android' : /Mac/i.test(ua) ? 'macOS' : /Windows/i.test(ua) ? 'Windows' : 'Web';
  const br = /Edg\//i.test(ua) ? 'Edge' : /Chrome/i.test(ua) ? 'Chrome' : /Firefox/i.test(ua) ? 'Firefox' : /Safari/i.test(ua) ? 'Safari' : 'Browser';
  return `${br} · ${os}`;
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

// ── Small field builder ──────────────────────────────────────
function fld(key, label, value, opt = {}) {
  const req = opt.required ? '<span class="req">*</span>' : '';
  const ic = opt.icon ? `<span class="input-icon">${icon(opt.icon, 17)}` : '';
  const endIc = ic ? '</span>' : '';
  let control;
  if (opt.textarea) control = `<textarea class="textarea" id="pf_${key}">${esc(value ?? '')}</textarea>`;
  else if (opt.select) control = `<select class="select" id="pf_${key}">${(opt.options || []).map(o => `<option ${String(value) === String(o) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  else control = `<input class="input" id="pf_${key}" type="${opt.type || 'text'}" value="${esc(value ?? '')}" ${opt.inputmode ? `inputmode="${opt.inputmode}"` : ''} ${req ? 'required' : ''} />`;
  return `
  <div class="field" ${opt.full ? 'style="grid-column:1/-1"' : ''}>
    <label>${esc(label)} ${req}</label>
    ${ic}${control}${endIc}
    <small class="err" id="err_${key}"></small>
  </div>`;
}

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

// ── Photo handling ───────────────────────────────────────────
const MAX_PHOTO_BYTES = 1024 * 1024;

function validatePhotoFile(file) {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return 'Please choose a JPG, PNG or WEBP image.';
  if (file.size > MAX_PHOTO_BYTES) return 'Photo must be smaller than 1 MB.';
  return '';
}

function downscalePhoto(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth < 200 || img.naturalHeight < 200) return rej(new Error('Image must be at least 200×200 px.'));
        const max = 512;
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        res(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => rej(new Error('Could not read this image file.'));
      img.src = fr.result;
    };
    fr.onerror = () => rej(new Error('Could not read this file.'));
    fr.readAsDataURL(file);
  });
}

function photoEl(me, size) {
  if (me.photo) return `<span class="avatar ${size} photo-avatar"><img src="${me.photo}" alt="${esc(me.name || '')}" /></span>`;
  return avatar(me.name || '?', size);
}

// ── Generic editable card ────────────────────────────────────
function editCard({ title, sub, iconName, fields, onSave, saveText = 'Save changes' }) {
  const readOnly = fields.map(f => {
    const v = f.value ?? '';
    if (f.render) return f.render(v);
    return `<div class="pf-row"><span class="pf-label">${icon(f.icon || 'dot', 14)} ${esc(f.label)}</span><b class="pf-value">${esc(v === '' ? '—' : v)}</b></div>`;
  }).join('');
  const wrap = document.createElement('div');
  wrap.innerHTML = `
  <div class="card card-pad profile-card">
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
  const card = wrap.firstElementChild;
  const fieldsBox = card.querySelector('[data-fields]');
  card.querySelector('[data-edit]').addEventListener('click', () => {
    fieldsBox.innerHTML = fields.map(f => fld(f.key, f.label, f.value ?? '', f)).join('');
    card.querySelector('[data-edit]').style.display = 'none';
    card.querySelector('[data-actions]').style.display = 'flex';
  });
  card.querySelector('[data-cancel]').addEventListener('click', () => {
    fieldsBox.innerHTML = readOnly;
    card.querySelector('[data-edit]').style.display = '';
    card.querySelector('[data-actions]').style.display = 'none';
  });
  card.querySelector('[data-save]').addEventListener('click', async () => {
    let ok = true;
    const patch = {};
    fields.forEach(f => {
      const el = document.getElementById('pf_' + f.key);
      if (!el) return;
      let v = el.value;
      if (f.type === 'number') v = v === '' ? '' : Number(v);
      if (f.trim !== false && typeof v === 'string') v = v.trim();
      const msg = f.validate ? f.validate(v, patch) : '';
      if (!showErr(f.key, msg)) ok = false;
      patch[f.key] = v;
    });
    if (!ok) return toast('Check the highlighted fields', 'Some values could not be saved.', 'error');
    const res = await onSave(patch);
    if (res && !res.ok) { toast('Could not save', 'Something went wrong. Please try again.', 'error'); return; }
    toast('Profile updated successfully', 'Your changes are now saved and visible across the app.', 'success');
    render();
  });
  return card;
}

// ═══════════════════════════════════════════════════════════
// PROFILE PAGE
// ═══════════════════════════════════════════════════════════
function profilePage(vp) {
  const user = currentUser();
  const r = role();
  let tab = 'overview';

  const tabs = r === 'patient'
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

  const me = () => meFor(r);
  const myId = () => (currentUser() && currentUser().userId) || '';

  function render() {
    const u = user || {};
    const m = me();
    const roleLabel = { patient: 'Patient', doctor: 'Doctor', admin: 'Administrator' }[r] || 'User';

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
      ${tabs.map(t => `<button class="tab ${tab === t.key ? 'active' : ''}" data-tab="${t.key}">${icon(t.icon, 16)} ${esc(t.label)}</button>`).join('')}
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
      const res = await updateProfile(r, myId(), { photo: '' });
      if (res.ok) toast('Photo removed', 'Your profile photo was removed.', 'info');
      render();
    });
    wireTab(vp);
  }

  // ── Tab renderers ──────────────────────────────────────────
  function renderTab() {
    if (r === 'admin') return adminOverview();
    const m = me();
    switch (tab) {
      case 'overview': return overviewTab(m);
      case 'personal': return r === 'patient' ? personalTab(m) : doctorPersonalTab(m);
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
    const isDoc = r === 'doctor';
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
        ${r === 'patient' ? `
        <div class="card card-pad">
          <div class="card-title" style="margin-bottom:12px">${icon('heart', 18)} Privacy note</div>
          <p class="text-muted" style="font-size:.82rem;line-height:1.6">Your medical profile is shared only with your consulting doctors. You control what is visible during each consultation.</p>
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
        sub: 'Email and phone changes require verification and are handled from the Security tab.',
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
        <p class="text-faint" style="font-size:.78rem;margin-bottom:10px">Changes to email or phone require verification before they take effect.</p>
        ${verifyRow('email', 'Email address', 'mail')}
        ${verifyRow('phone', 'Phone number', 'phone')}
      </div>
      ${editCard({
        title: 'Emergency contact', iconName: 'userPlus', saveText: 'Save changes',
        fields: [
          { key: 'emergencyContactName', label: 'Emergency contact name', icon: 'user', required: true, validate: V.name },
          { key: 'emergencyContactPhone', label: 'Emergency contact phone', icon: 'phone', validate: V.emergencyPhone },
        ].map(f => ({ ...f, value: m[f.key] ?? '' })),
        onSave: (patch) => updateProfile('patient', myId(), patch),
      }).outerHTML}
    </div>`;
  }

  function professionalTab(m) {
    const pending = (m.verificationRequests || []).filter(x => x.status === 'pending');
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
          { key: 'fee', label: 'Consultation fee (₹)', icon: 'dollar', type: 'number', required: true, validate: V.fee },
          { key: 'languages', label: 'Languages spoken', icon: 'globe', full: true },
          { key: 'bio', label: 'Professional bio', icon: 'note', textarea: true, full: true },
        ].map(f => ({ ...f, value: m[f.key] ?? '' })),
        onSave: (patch) => updateProfile('doctor', myId(), patch),
      }).outerHTML}
      <div class="card card-pad">
        <div class="card-title" style="margin-bottom:12px">${icon('verified', 18)} Medical registration</div>
        <div class="pf-row">
          <span class="pf-label">${icon('key', 14)} Registration ID</span>
          <b class="pf-value mono">${esc(m.registrationId || '—')}
            <span class="badge ${m.registrationVerified ? 'green' : 'amber'} plain" style="font-size:.6rem">${m.registrationVerified ? `${icon('check', 10)} Verified` : 'Unverified'}</span>
          </b>
        </div>
        <p class="text-faint" style="font-size:.78rem;margin:8px 0 12px">Medical registration details require professional verification and cannot be changed directly. Request a verification change and the MedCare team will review it.</p>
        <button class="btn btn-outline btn-sm" id="regRequest">${icon('rotate', 14)} Request verification change</button>
        ${pending.length ? `<div class="stepper-hint mt-12" style="margin-top:12px">${icon('clock', 14)} ${pending.length} change request(s) awaiting review</div>` : ''}
      </div>
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
    const hist = getProfileHistory(r);
    return `
    <div class="grid grid-2" style="align-items:start">
      <div style="display:grid;gap:16px">
        <div class="card card-pad">
          <div class="card-title" style="margin-bottom:14px">${icon('lock', 18)} Change password</div>
          <form id="pwForm" novalidate style="display:grid;gap:14px">
            <div class="field"><label>Current password <span class="req">*</span></label>
              <div class="input-icon">${icon('lock', 17)}<input class="input" type="password" id="pwCur" placeholder="••••••••" autocomplete="current-password" /></div>
              <small class="err" id="err_pwCur"></small></div>
            <div class="field"><label>New password <span class="req">*</span></label>
              <div class="input-icon">${icon('key', 17)}<input class="input" type="password" id="pwNew" placeholder="Minimum 8 characters" autocomplete="new-password" /></div>
              <small class="err" id="err_pwNew"></small></div>
            <div class="field"><label>Confirm new password <span class="req">*</span></label>
              <div class="input-icon">${icon('check', 17)}<input class="input" type="password" id="pwConfirm" placeholder="Re-enter new password" autocomplete="new-password" /></div>
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
          <p class="text-faint" style="font-size:.78rem;margin-bottom:10px">You can update your email and phone number at any time. Sensitive values are never shown in full.</p>
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

    // registration verification request
    const reg = scope.querySelector('#regRequest');
    if (reg) reg.addEventListener('click', () => requestRegModal());

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
        const res = await changePassword(r, cur, nw);
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
      updateProfile(r, myId(), patch);
      const p = prefs(); p[cb.dataset.np] = cb.checked; savePrefs(p);
      toast('Preference updated', `${g ? g.title : 'Notification'} ${cb.checked ? 'enabled' : 'muted'}.`, 'info');
    }));
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
    let dataUrl = null;
    openModal(`
      <div class="modal-head"><h3>${icon('camera', 18)} Profile photo</h3><button class="icon-btn" data-close aria-label="Close">${icon('x', 18)}</button></div>
      <div class="modal-body" style="display:grid;gap:14px;align-items:center;justify-items:center">
        <div class="photo-preview" id="photoPreview">${photoEl(me(), 'xl')}</div>
        <p class="text-muted" style="font-size:.8rem;text-align:center">JPG, PNG or WEBP · max 1 MB · at least 200×200 px. Photos are stored securely on your account.</p>
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
          downscalePhoto(f).then((url) => {
            dataUrl = url;
            box.querySelector('#photoPreview').innerHTML = `<span class="avatar xl photo-avatar"><img src="${url}" alt="Preview" /></span>`;
            box.querySelector('#photoSave').disabled = false;
            toast('Photo ready', 'Preview loaded — save to update your profile.', 'info');
          }).catch((e) => { toast('Invalid photo', e.message || 'Could not read this image.', 'error'); file.value = ''; });
        });
        box.querySelector('#photoSave').addEventListener('click', async () => {
          if (!dataUrl) return;
          const res = await updateProfile(r, myId(), { photo: dataUrl });
          if (res.ok) {
            toast('Profile photo updated', 'Your photo is now visible across the app.', 'success');
            close();
            render();
          } else toast('Could not save', 'You can only edit your own profile.', 'error');
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
          const res = await updateProfile(r, myId(), { [field]: v });
          if (res.ok) {
            toast('Verification complete', `Your ${label} was updated successfully.`, 'success');
            close();
            render();
          } else toast('Could not save', 'You can only edit your own profile.', 'error');
        });
      },
    });
  }

  function requestRegModal() {
    openModal(`
      <div class="modal-head"><h3>${icon('verified', 18)} Request verification change</h3><button class="icon-btn" data-close aria-label="Close">${icon('x', 18)}</button></div>
      <div class="modal-body" style="display:grid;gap:14px">
        <p class="text-muted" style="font-size:.84rem">Current registration ID: <b class="mono">${esc(me().registrationId || '—')}</b></p>
        <div class="field">
          <label>New registration ID <span class="req">*</span></label>
          <div class="input-icon">${icon('key', 17)}<input class="input" id="regNew" placeholder="DR-2024-0000" /></div>
          <small class="err" id="err_regNew"></small>
        </div>
        <div class="stepper-hint">${icon('clock', 14)} The MedCare verification team will review this request. Your profile keeps the current ID until it is approved.</div>
        <div class="flex" style="gap:10px;justify-content:flex-end">
          <button class="btn btn-outline" data-close>Cancel</button>
          <button class="btn btn-primary" id="regSubmit">${icon('send', 15)} Submit request</button>
        </div>
      </div>`, {
      onMount: (box, close) => {
        box.querySelector('#regSubmit').addEventListener('click', () => {
          const v = box.querySelector('#regNew').value.trim();
          if (!/^[A-Za-z0-9\-]{5,16}$/.test(v)) { box.querySelector('#err_regNew').textContent = 'Enter a valid registration ID (letters, numbers, dashes).'; box.querySelector('#regNew').classList.add('invalid'); return; }
          const res = requestVerificationChange(myId(), 'registrationId', v);
          if (res.ok) {
            toast('Request submitted', 'The MedCare team will review your verification change.', 'success');
            close();
            render();
          } else toast('Could not submit', 'You can only request changes for your own profile.', 'error');
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

  render();
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

    if (tab === 'security') {
      panel.innerHTML = `
      <div class="card card-pad">
        <div class="card-title" style="margin-bottom:16px">${icon('lock', 18)} Change password</div>
        <form id="pwForm" novalidate style="display:grid;gap:14px;max-width:420px">
          <div class="field">
            <label>Current password <span class="req">*</span></label>
            <div class="input-icon">${icon('lock', 17)}<input class="input" type="password" id="pwCur" placeholder="••••••••" required /></div>
            <small class="err">Enter your current password</small>
          </div>
          <div class="field">
            <label>New password <span class="req">*</span></label>
            <div class="input-icon">${icon('key', 17)}<input class="input" type="password" id="pwNew" placeholder="Minimum 8 characters" required /></div>
            <small class="err">Password must be at least 8 characters</small>
          </div>
          <div class="field">
            <label>Confirm new password <span class="req">*</span></label>
            <div class="input-icon">${icon('check', 17)}<input class="input" type="password" id="pwConfirm" placeholder="Re-enter new password" required /></div>
            <small class="err">Passwords do not match</small>
          </div>
          <div class="mini-chips">
            <span class="mini-chip">${icon('check', 12)} 8+ characters</span>
            <span class="mini-chip">${icon('check', 12)} Uppercase &amp; number</span>
            <span class="mini-chip">${icon('check', 12)} No common words</span>
          </div>
          <div><button class="btn btn-primary" type="submit">${icon('checkCircle', 16)} Update password</button></div>
        </form>
      </div>
      <div class="card card-pad">
        <div class="card-title" style="margin-bottom:6px">${icon('shield', 18)} Two-factor authentication</div>
        <div class="setting-row" style="border-bottom:none">
          <span class="s-ic blue">${icon('smartphone', 20)}</span>
          <div class="s-body"><b>Authenticator app</b><small>Get a one-time code on your device when signing in</small></div>
          <span class="switch"><input type="checkbox" id="twoFA" ${p.twoFA ? 'checked' : ''} /><span class="track"></span></span>
        </div>
      </div>
      <div class="card card-pad">
        <div class="card-title" style="margin-bottom:12px">${icon('activity', 18)} Active sessions</div>
        <div class="row-item" style="padding:10px 6px">
          <span class="notif-ic green">${icon('monitor', 18)}</span>
          <div class="row-main"><div class="row-title" style="font-size:.84rem">This device <span class="badge green plain" style="font-size:.6rem">Current session</span></div><div class="row-sub">Web browser · ${esc(navDevice())} · Signed in now</div></div>
        </div>
      </div>`;
      wireSecurity(panel);
      return;
    }

    if (tab === 'notifications') {
      const groups = [
        { key: 'apptReminder', title: 'Appointment reminders', sub: 'Email & SMS before each visit', icon: 'clock', cls: 'blue' },
        { key: 'apptConfirmation', title: 'Appointment confirmations', sub: 'When a doctor confirms your booking', icon: 'checkCircle', cls: 'green' },
        { key: 'apptReschedule', title: 'Reschedule & cancellations', sub: 'Whenever an appointment changes', icon: 'rotate', cls: 'amber' },
        { key: 'prescriptionReady', title: 'Prescriptions & reports', sub: 'New digital prescriptions and lab results', icon: 'prescription', cls: 'teal' },
        { key: 'followup', title: 'Follow-up reminders', sub: 'When it is time to schedule a follow-up', icon: 'calendarCheck', cls: 'purple' },
        { key: 'emergency', title: 'Emergency alerts', sub: 'Critical updates about emergency cases', icon: 'alert', cls: 'red' },
      ];
      panel.innerHTML = `
      <div class="card card-pad">
        <div class="card-title" style="margin-bottom:4px">${icon('bell', 18)} Notification preferences</div>
        <p class="text-faint" style="font-size:.78rem;margin-bottom:8px">Choose what MedCare may notify you about. You can change this anytime.</p>
        ${groups.map(g => `
        <div class="setting-row">
          <span class="s-ic ${g.cls}">${icon(g.icon, 20)}</span>
          <div class="s-body"><b>${esc(g.title)}</b><small>${esc(g.sub)}</small></div>
          <span class="switch"><input type="checkbox" id="${g.key}" ${p[g.key] !== false ? 'checked' : ''} /><span class="track"></span></span>
        </div>`).join('')}
      </div>`;
      groups.forEach(g => {
        const el = panel.querySelector('#' + g.key);
        if (el) el.addEventListener('change', () => { togglePref(g.key); toast('Preference updated', `${g.title} ${el.checked ? 'enabled' : 'muted'}.`, 'info'); });
      });
      return;
    }

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

  function wireSecurity(panel) {
    const form = panel.querySelector('#pwForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const cur = panel.querySelector('#pwCur').value;
        const nw = panel.querySelector('#pwNew').value;
        const cf = panel.querySelector('#pwConfirm').value;
        if (!cur) return fail(panel.querySelector('#pwCur'));
        if (nw.length < 8) return fail(panel.querySelector('#pwNew'));
        if (nw !== cf) return fail(panel.querySelector('#pwConfirm'));
        form.querySelector('.btn').innerHTML = 'Updating…';
        setTimeout(() => {
          toast('Password updated', 'Your password was changed successfully.', 'success');
          form.querySelector('.btn').innerHTML = `${icon('checkCircle', 16)} Update password`;
          form.reset();
        }, 800);
      });
    }
    const two = panel.querySelector('#twoFA');
    if (two) two.addEventListener('change', () => {
      togglePref('twoFA');
      toast('Two-factor authentication', two.checked ? 'Enabled for your account.' : 'Disabled.', two.checked ? 'success' : 'info');
    });
    panel.querySelectorAll('[data-revoke]').forEach(b => b.addEventListener('click', () => {
      b.closest('.row-item').style.opacity = '.4';
      b.disabled = true;
      toast('Session revoked', `${b.dataset.revoke} signed out.`, 'info');
    }));
  }

  function fail(field) {
    field.classList.add('invalid');
    setTimeout(() => field.classList.remove('invalid'), 1400);
  }

  render();
}

export function initProfile() {
  registerPage('profile', profilePage);
  registerPage('settings', settingsPage);
}