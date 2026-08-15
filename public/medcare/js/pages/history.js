// ─────────────────────────────────────────────────────────────
// Medical History — expandable clinical timeline
// ─────────────────────────────────────────────────────────────
import { icon, esc, fmtDate, toast } from '../core.js';
import { getHistory, addHistory, getState, currentUser, getPatient } from '../store.js';
import { registerPage, navigate } from '../router.js';
import { pageHead, statusBadge, typeChip } from './shared.js';

const TYPE_META = {
  consultation: { icon: 'stethoscope', color: 'blue', label: 'Consultation' },
  diagnosis: { icon: 'clipboard', color: 'red', label: 'Diagnosis' },
  prescription: { icon: 'prescription', color: 'teal', label: 'Prescription' },
  lab: { icon: 'scan', color: 'purple', label: 'Lab report' },
  'follow-up': { icon: 'calendarCheck', color: 'amber', label: 'Follow-up' },
  notes: { icon: 'note', color: 'green', label: 'Doctor note' },
};

function historyPage(vp, params) {
  const entries = getHistory();
  const types = Object.keys(TYPE_META);
  const me = currentUser();
  const pat = getPatient(me ? me.userId : '') || {};
  const allergyList = String(pat.allergies || '').split(',').map(s => s.trim()).filter(Boolean);
  const condList = String(pat.condition || '').split(',').map(s => s.trim()).filter(Boolean);
  let filter = 'all';
  let openId = params.get('open') || null;

  vp.innerHTML = `
  ${pageHead('Medical history', 'Your complete clinical record — consultations, diagnoses, lab reports and prescriptions in one timeline.', role_action())}
  <div class="flex gap-12" style="align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:18px">
    <div class="chip-select" id="hFilter">
      <button class="chip-opt selected" data-f="all">All</button>
      ${types.map(t => `<button class="chip-opt" data-f="${t}">${TYPE_META[t].label}s</button>`).join('')}
    </div>
    <span class="text-faint" style="font-size:.78rem">${entries.length} records · Updated ${fmtDate(getState().history[0]?.date)}</span>
  </div>
  <div class="grid" style="grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:22px" id="hLayout">
    <div class="timeline" id="hTimeline"></div>
    <div style="display:grid;gap:16px;align-content:start">
      <div class="card card-pad">
        <div class="card-title" style="margin-bottom:12px">${icon('activity', 18)} Health profile</div>
        ${vitals(pat)}
      </div>
      <div class="card card-pad">
        <div class="card-title" style="margin-bottom:12px">${icon('fileText', 18)} Allergies & conditions</div>
        <div class="flex gap-6" style="flex-wrap:wrap">
          ${condList.map(c => `<span class="badge blue plain">${icon('pulse', 11)} ${esc(c)}</span>`).join('')}
          ${allergyList.map(a => `<span class="badge amber plain">${icon('alert', 11)} ${esc(a)}</span>`).join('')}
          ${!condList.length && !allergyList.length ? '<span class="text-faint" style="font-size:.78rem">No allergies or conditions recorded yet.</span>' : ''}
        </div>
      </div>
    </div>
  </div>`;

  function role_action() {
    const r = currentUser()?.role;
    return r === 'doctor' ? `<button class="btn btn-outline" id="addRecord">${icon('plus', 16)} Add record</button>` : '';
  }

  const timeline = vp.querySelector('#hTimeline');
  function renderTimeline() {
    let list = entries;
    if (filter !== 'all') list = entries.filter(e => e.type === filter);
    if (!list.length) {
      timeline.innerHTML = `<div class="empty"><span class="e-ic">${icon('clipboard', 30)}</span><h4>No records yet</h4><p>Your medical history will appear here after your first consultation.</p></div>`;
      return;
    }
    timeline.innerHTML = list.map(e => {
      const meta = TYPE_META[e.type] || TYPE_META.consultation;
      const isOpen = openId === e.id;
      return `
      <div class="tl-item ${isOpen ? 'open' : ''}" data-history="${e.id}">
        <span class="tl-dot ${meta.color}">${icon(meta.icon, 10)}</span>
        <div class="tl-card">
          <div class="tl-card-head">
            <div>
              <b style="font-size:.9rem">${esc(e.title)}</b>
              <div class="row-sub">${esc(e.doctor)} · ${fmtDate(e.date)}</div>
            </div>
            <div class="flex gap-8" style="align-items:center">
              <span class="badge ${meta.color} plain" style="font-size:.62rem">${meta.label}</span>
              <button class="icon-btn" style="width:30px;height:30px" aria-label="Expand">${icon(isOpen ? 'chevDown' : 'chevRight', 16)}</button>
            </div>
          </div>
          ${isOpen ? `
          <div class="tl-body">
            <p class="text-muted" style="font-size:.85rem;margin-top:6px">${esc(e.detail)}</p>
            ${e.items ? `
            <div class="table-wrap" style="margin-top:12px">
              <table class="table" style="min-width:0">
                <thead><tr><th>Test</th><th>Result</th><th>Range</th></tr></thead>
                <tbody>${e.items.map(it => `
                  <tr><td>${esc(it.name)}</td><td><b>${esc(it.value)}</b></td><td class="text-faint">${esc(it.range)}</td></tr>`).join('')}</tbody>
              </table>
            </div>` : ''}
            ${e.rx ? `<button class="btn btn-soft btn-sm mt-12" data-rx="${e.rx.id}">${icon('prescription', 14)} View prescription</button>` : ''}
          </div>` : ''}
        </div>
      </div>`;
    }).join('');
    timeline.querySelectorAll('.tl-item').forEach(it => it.addEventListener('click', () => {
      const id = it.dataset.history;
      openId = openId === id ? null : id;
      renderTimeline();
    }));
    timeline.querySelectorAll('[data-rx]').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation();
      navigate('#/prescriptions?id=' + b.dataset.rx);
    }));
  }

  vp.querySelectorAll('#hFilter [data-f]').forEach(b => b.addEventListener('click', () => {
    filter = b.dataset.f;
    openId = null;
    vp.querySelectorAll('#hFilter [data-f]').forEach(x => x.classList.toggle('selected', x === b));
    renderTimeline();
  }));

  const addBtn = vp.querySelector('#addRecord');
  if (addBtn) addBtn.addEventListener('click', () => {
    const entry = addHistory({ type: 'notes', date: new Date().toISOString().slice(0, 10), title: 'Consultation notes', doctor: currentUser()?.name || 'Doctor', detail: 'New consultation note added by the doctor.' });
    toast('Record added', 'Clinical note saved to timeline.', 'success');
    openId = entry.id;
    renderTimeline();
  });

  renderTimeline();
}

function vitals(pat) {
  const wt = parseFloat(pat.weightKg) || 0;
  const ht = parseFloat(pat.heightCm) ? parseFloat(pat.heightCm) / 100 : 0;
  const bmi = wt && ht ? (wt / (ht * ht)).toFixed(1) : '';
  const rows = [
    { icon: 'heart', label: 'Heart rate', val: '—', pct: 0, color: 'red', cls: 'red' },
    { icon: 'activity', label: 'Blood pressure', val: '—', pct: 0, color: 'amber', cls: 'amber' },
    { icon: 'droplet', label: 'Blood sugar', val: '—', pct: 0, color: 'teal', cls: 'green' },
    { icon: 'weight', label: 'BMI', val: bmi || '—', pct: bmi ? Math.min(100, Math.round((bmi / 35) * 100)) : 0, color: 'blue', cls: '' },
  ];
  return `<div class="health-bars">
    ${rows.map(r => `
    <div class="hb-row">
      <div class="hb-top"><b>${icon(r.icon, 15)} ${r.label}</b><span>${r.val}</span></div>
      <div class="progress thin ${r.cls}"><div class="bar ${r.cls}" style="width:0" data-w="${r.pct}"></div></div>
    </div>`).join('')}
  </div>`;
}

export function initHistory() {
  registerPage('history', historyPage);
}