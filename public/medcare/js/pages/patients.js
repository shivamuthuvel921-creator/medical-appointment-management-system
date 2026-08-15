// ─────────────────────────────────────────────────────────────
// Patients (Doctor) — patient list + clinical profile
// ─────────────────────────────────────────────────────────────
import { icon, esc, fmtDate, fmtTime, avatar, toast, emptyState } from '../core.js';
import { getPatients, getPatient, getAppointments, getPrescriptions, updateAppointment } from '../store.js';
import { registerPage, navigate, role } from '../router.js';
import { pageHead, statusBadge, typeChip } from './shared.js';

function ageOf(dob) {
  if (!dob) return '—';
  const [y, m, d] = dob.split('-').map(Number);
  const now = new Date();
  let a = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a -= 1;
  return a;
}

function patientsPage(vp, params) {
  let q = '';
  const patients = getPatients();
  let selected = params.get('id') && getPatient(params.get('id')) ? params.get('id') : (patients[0]?.id || '');

  render();

  function filtered() {
    const s = q.toLowerCase();
    return patients.filter(p => !s || (p.name + p.email + p.condition + (p.history || '')).toLowerCase().includes(s));
  }

  function render() {
    const list = filtered();
    vp.innerHTML = `
    ${pageHead('Patients', 'Search your patient records and open a clinical profile.', '')}
    <div class="flex gap-12" style="align-items:center;margin-bottom:18px;flex-wrap:wrap">
      <div class="input-icon" style="min-width:280px;flex:1">${icon('search', 16)}<input class="input" id="patSearch" placeholder="Search by name, condition, email…" value="${esc(q)}" style="padding-top:9px;padding-bottom:9px"></div>
      <span class="badge navy plain">${list.length} patients</span>
    </div>
    <div class="patients-grid">
      <div class="patient-list card" id="patList">
        ${list.length ? list.map(p => patientRow(p, p.id === selected)).join('') : emptyState('No patients found', 'Try a different search term.', 'users')}
      </div>
      <div class="patient-detail" id="patDetail">
        ${selected ? patientDetail(getPatient(selected)) : emptyState('Select a patient', 'Choose a patient from the list to view their clinical profile.', 'user')}
      </div>
    </div>`;
    wire(vp);
  }

  function patientRow(p, active) {
    const next = nextAppt(p.id);
    return `
    <div class="pat-row ${active ? 'active' : ''}" data-pid="${p.id}" role="button" tabindex="0">
      ${avatar(p.name)}
      <div class="pat-main">
        <b>${esc(p.name)}</b>
        <div class="row-sub">${esc(p.condition || 'No record')} · ${ageOf(p.dob)} yrs · ${esc(p.gender)}</div>
      </div>
      <div style="text-align:right;display:grid;gap:4px;justify-items:end">
        ${next ? `<span class="badge green plain" style="font-size:.62rem">${fmtDate(next.appointmentDate)}</span>` : `<span class="text-faint" style="font-size:.7rem">No upcoming</span>`}
        <span class="text-faint" style="font-size:.68rem">Last ${p.lastVisit ? fmtDate(p.lastVisit) : '—'}</span>
      </div>
    </div>`;
  }

  function nextAppt(pid) {
    return getAppointments().filter(a => a.patientId === pid && ['scheduled', 'confirmed', 'rescheduled'].includes(a.status))
      .sort((a, b) => (a.appointmentDate + a.appointmentTime).localeCompare(b.appointmentDate + b.appointmentTime))[0];
  }

  function patientDetail(p) {
    if (!p) return '';
    const appts = getAppointments().filter(a => a.patientId === p.id).sort((a, b) => (b.appointmentDate + b.appointmentTime).localeCompare(a.appointmentDate + a.appointmentTime));
    const rxs = getPrescriptions().filter(r => r.patientId === p.id);
    const next = nextAppt(p.id);
    return `
    <div class="pd-head">
      ${avatar(p.name, 'lg')}
      <div>
        <h3 style="font-family:var(--font-display);font-weight:700;font-size:1.15rem">${esc(p.name)}</h3>
        <div class="row-sub">${esc(p.condition)}</div>
        <div class="flex gap-8 mt-8" style="flex-wrap:wrap">
          <span class="badge blue plain">${icon('user', 12)} ${esc(p.gender)}</span>
          <span class="badge navy plain">${ageOf(p.dob)} yrs</span>
          <span class="badge teal plain">${esc(p.blood || '—')}</span>
          <span class="badge amber plain">${esc(p.allergies || 'No allergies')}</span>
        </div>
      </div>
      <div style="margin-left:auto;display:grid;gap:8px;justify-items:end">
        ${next ? `<button class="btn btn-primary btn-sm" data-nav="#/consult?pid=${p.id}">${icon('stethoscope', 14)} Start consultation</button>` : ''}
        <span class="text-faint" style="font-size:.72rem">${esc(p.email)}<br>${esc(p.phone)}</span>
      </div>
    </div>

    <div class="summary-grid" style="margin-top:16px">
      <div><b>${ageOf(p.dob)}</b><small>Age</small></div>
      <div><b>—</b><small>BP</small></div>
      <div><b>—</b><small>Heart rate</small></div>
      <div><b>${p.heightCm || '—'} cm</b><small>Height</small></div>
      <div><b>${p.weightKg || '—'} kg</b><small>Weight</small></div>
      <div><b>${appts.length}</b><small>Total visits</small></div>
    </div>

    <div class="card card-pad" style="margin-top:16px">
      <div class="card-title" style="margin-bottom:10px">${icon('clipboard', 17)} Medical summary</div>
      <p class="text-muted" style="font-size:.84rem;line-height:1.55">${esc(p.history || 'No past conditions recorded.')}</p>
    </div>

    <div class="card card-pad" style="margin-top:16px">
      <div class="card-title" style="margin-bottom:12px">${icon('activity', 17)} Visit history &amp; records</div>
      <div style="display:grid;gap:8px;max-height:320px;overflow:auto">
        ${appts.slice(0, 12).map(a => `
          <div class="row-item" style="padding:9px 8px">
            <span class="tl-dot ${a.status === 'completed' ? 'green' : a.status === 'cancelled' ? 'red' : 'blue'}" style="position:static;width:30px;height:30px;border-radius:10px;border-width:2px">${icon(a.status === 'completed' ? 'check' : a.status === 'cancelled' ? 'x' : 'clock', 13)}</span>
            <div class="row-main">
              <div class="row-title" style="font-size:.82rem">${esc(a.doctorName)} · ${esc(a.type)}</div>
              <div class="row-sub">${fmtDate(a.appointmentDate)} · ${fmtTime(a.appointmentTime)}${a.diagnosis ? ' · ' + esc(a.diagnosis) : ''}</div>
            </div>
            ${statusBadge(a.status)}
          </div>`).join('') || '<p class="text-faint" style="font-size:.8rem">No past visits.</p>'}
      </div>
    </div>

    ${rxs.length ? `
    <div class="card card-pad" style="margin-top:16px">
      <div class="card-title" style="margin-bottom:12px">${icon('prescription', 17)} Prescriptions</div>
      <div style="display:grid;gap:8px">
        ${rxs.slice(0, 5).map(r => `
          <div class="row-item clickable" data-nav="#/prescriptions?id=${r.id}" style="padding:9px 8px">
            <span class="notif-ic teal" style="width:34px;height:34px;border-radius:10px">${icon('prescription', 16)}</span>
            <div class="row-main"><div class="row-title" style="font-size:.82rem">${esc(r.diagnosis)}</div><div class="row-sub">${fmtDate(r.date)} · ${r.items.length} medicines</div></div>
          </div>`).join('')}
      </div>
    </div>` : ''}`;
  }

  function wire(scope) {
    const search = scope.querySelector('#patSearch');
    let deb;
    search.addEventListener('input', () => {
      clearTimeout(deb);
      deb = setTimeout(() => { q = search.value; render(); }, 200);
    });
    scope.querySelectorAll('[data-pid]').forEach(el => el.addEventListener('click', () => {
      selected = el.dataset.pid;
      render();
    }));
    scope.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.nav)));
  }
}

export function initPatients() {
  registerPage('patients', patientsPage);
}