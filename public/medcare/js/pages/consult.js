// ─────────────────────────────────────────────────────────────
// Consultations (Doctor) — clinical consultation workspace
// ─────────────────────────────────────────────────────────────
import { icon, esc, fmtDate, fmtTime, avatar, toast, emptyState, todayISO, confetti } from '../core.js';
import { getPatient, getPatients, getAppointments, getAppointment, getPrescriptions, getDoctor, addHistory, addLog, updateAppointment, pushNotification, currentUser, getDoctors } from '../store.js';
import { registerPage, navigate } from '../router.js';
import { pageHead, statusBadge, typeChip } from './shared.js';
import { openRxModal } from './prescriptions.js';

function myDocId() {
  const u = currentUser();
  const doc = getDoctors().find(d => d.userId === (u ? u.userId : ''));
  return doc ? doc.id : '';
}

function consultPage(vp, params) {
  const apptParam = params.get('appt');
  const pidParam = params.get('pid');
  const patients = getPatients();
  const today = todayISO();
  const todays = getAppointments({ doctorId: myDocId() }).filter(a => a.appointmentDate === today && a.status !== 'cancelled');
  let selectedApptId = apptParam || '';
  let selected = pidParam || (apptParam && getAppointment(apptParam)?.patientId) || todays[0]?.patientId || patients[0]?.id || '';

  render();

  function currentAppt() {
    return selectedApptId ? getAppointment(selectedApptId) : getAppointments().find(a => a.patientId === selected && a.appointmentDate === today && a.status !== 'cancelled');
  }

  function render() {
    const pat = getPatient(selected);
    const appt = currentAppt();
    vp.innerHTML = `
    ${pageHead('Consultation workspace', 'Document the visit, write notes and issue a prescription — all in one place.', '')}
    <div class="flex gap-12" style="align-items:center;margin-bottom:18px;flex-wrap:wrap">
      <div class="field" style="margin:0;min-width:260px">
        <select class="select" id="cPatient">
          <option value="">Select a patient…</option>
          ${patients.map(p => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${esc(p.name)} · ${esc(p.condition)}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-outline" data-nav="#/queue">${icon('users', 16)} Patient queue</button>
      <button class="btn btn-ghost" id="cReset">${icon('refresh', 15)} Reset form</button>
      <span class="badge navy plain" style="margin-left:auto">${todays.length} visits today</span>
    </div>
    <div id="cBody"></div>`;

    wireTop(vp);
    renderBody(vp);
  }

  function wireTop(scope) {
    scope.querySelector('#cPatient').addEventListener('change', (e) => {
      selected = e.target.value;
      selectedApptId = '';
      render();
    });
    scope.querySelector('#cReset').addEventListener('click', () => render());
    scope.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.nav)));
  }

  function renderBody(scope) {
    const body = scope.querySelector('#cBody');
    const pat = getPatient(selected);
    if (!pat) {
      body.innerHTML = emptyState('Select a patient', 'Choose a patient to open the consultation workspace.', 'user');
      return;
    }
    const appt = currentAppt();
    const rxs = getPrescriptions().filter(r => r.patientId === selected);
    const visits = getAppointments().filter(a => a.patientId === selected).slice(0, 8);

    body.innerHTML = `
    <div class="dash-grid">
      <div class="dash-main">
        <div class="card card-pad" style="display:grid;gap:14px">
          <div class="card-title" style="margin-bottom:2px">${icon('clipboard', 18)} Consultation record</div>
          <div class="form-grid">
            <div class="field"><label>Symptoms <span class="req">*</span></label>
              <textarea class="input" id="cSymptoms" rows="2" placeholder="e.g. Chest tightness, fatigue for 1 week"></textarea>
            </div>
            <div class="field"><label>Diagnosis <span class="req">*</span></label>
              <input class="input" id="cDiag" value="${esc(appt?.diagnosis || '')}" placeholder="e.g. Hypertension — Stage 1">
            </div>
          </div>
          <div>
            <label style="font-size:.78rem;font-weight:700">Vitals</label>
            <div class="vitals-grid" style="margin-top:8px">
              <div class="field" style="margin:0"><label>Temp °F</label><input class="input" id="cTemp" type="number" step="0.1" placeholder="98.6"></div>
              <div class="field" style="margin:0"><label>Pulse bpm</label><input class="input" id="cPulse" type="number" placeholder="72"></div>
              <div class="field" style="margin:0"><label>BP mmHg</label><input class="input" id="cBP" placeholder="120/80"></div>
              <div class="field" style="margin:0"><label>SpO2 %</label><input class="input" id="cSpo2" type="number" placeholder="98"></div>
            </div>
          </div>
          <div class="field"><label>Clinical notes</label>
            <textarea class="input" id="cNotes" rows="2" placeholder="Objective findings, observations…"></textarea>
          </div>
          <div class="form-grid">
            <div class="field"><label>Doctor observations</label>
              <textarea class="input" id="cObs" rows="2" placeholder="Your clinical impression"></textarea>
            </div>
            <div class="field"><label>Treatment plan</label>
              <textarea class="input" id="cPlan" rows="2" placeholder="e.g. Lifestyle changes, medication, physiotherapy"></textarea>
            </div>
          </div>
          <div class="form-grid">
            <div class="field"><label>Follow-up date</label><input class="input" type="date" id="cFollow" min="${todayISO()}"></div>
            <div class="field"><label>Follow-up type</label>
              <select class="select" id="cFollowType">
                <option value="In-clinic">In-clinic</option>
                <option value="Video">Video</option>
                <option value="Phone">Phone</option>
              </select>
            </div>
          </div>
        </div>
        <div class="flex gap-10" style="margin-top:16px;flex-wrap:wrap">
          <button class="btn btn-primary" id="cComplete">${icon('checkCircle', 17)} Complete consultation</button>
          <button class="btn btn-teal" id="cRx">${icon('prescription', 17)} Create prescription</button>
          <button class="btn btn-outline" id="cSaveDraft">${icon('fileText', 16)} Save draft</button>
          <button class="btn btn-soft" data-nav="#/queue">${icon('users', 16)} Back to queue</button>
        </div>
      </div>

      <div style="display:grid;gap:16px;align-content:start">
        <section class="card card-pad">
          <div class="flex gap-12" style="align-items:center">
            ${avatar(pat.name, 'lg')}
            <div>
              <b style="font-family:var(--font-display);font-size:1.05rem">${esc(pat.name)}</b>
              <div class="row-sub">${esc(pat.gender)} · ${esc(pat.blood || '—')} · ${esc(pat.condition)}</div>
            </div>
          </div>
          <div class="divider" style="margin:14px 0"></div>
          <div style="display:grid;gap:8px">
            <div class="bs-row"><span class="k">${icon('mail', 13)} Contact</span><span class="v">${esc(pat.phone)}</span></div>
            <div class="bs-row"><span class="k">${icon('alert', 13)} Allergies</span><span class="v">${esc(pat.allergies || 'None')}</span></div>
            <div class="bs-row"><span class="k">${icon('activity', 13)} Height / Weight</span><span class="v">${pat.heightCm || '—'} cm / ${pat.weightKg || '—'} kg</span></div>
          </div>
          ${appt ? `
          <div class="divider" style="margin:14px 0"></div>
          <div class="card-title" style="margin-bottom:10px">${icon('calendar', 16)} Current visit</div>
          <div class="bs-row"><span class="k">${icon('clock', 13)} Time</span><span class="v">${fmtDate(appt.appointmentDate)} · ${fmtTime(appt.appointmentTime)}</span></div>
          <div class="bs-row"><span class="k">${icon('tag', 13)} Type</span><span class="v">${typeChip(appt.type)}</span></div>
          <div class="bs-row"><span class="k">${icon('activity', 13)} Status</span><span class="v">${statusBadge(appt.status)}</span></div>` : ''}
        </section>

        <section class="card card-pad">
          <div class="card-title" style="margin-bottom:12px">${icon('activity', 17)} Medical timeline</div>
          <div class="timeline" style="max-height:320px;overflow:auto">
            ${visits.length ? visits.map(a => `
              <div class="tl-item" style="padding-bottom:10px">
                <span class="tl-dot ${a.status === 'completed' ? 'green' : 'blue'}">${icon(a.status === 'completed' ? 'check' : 'clock', 10)}</span>
                <div class="tl-card" style="padding:10px 12px;box-shadow:none">
                  <div class="flex" style="justify-content:space-between;align-items:center"><b style="font-size:.8rem">${esc(a.doctorName)}</b><span class="tl-date">${fmtDate(a.appointmentDate)}</span></div>
                  <div class="row-sub">${esc(a.diagnosis || a.notes || a.type + ' consult')}</div>
                </div>
              </div>`).join('') : '<p class="text-faint" style="font-size:.8rem">No prior visits recorded.</p>'}
            ${rxs.length ? rxs.slice(0, 3).map(r => `
              <div class="tl-item" style="padding-bottom:10px">
                <span class="tl-dot teal">${icon('prescription', 10)}</span>
                <div class="tl-card" style="padding:10px 12px;box-shadow:none">
                  <div class="flex" style="justify-content:space-between;align-items:center"><b style="font-size:.8rem">Prescription</b><span class="tl-date">${fmtDate(r.date)}</span></div>
                  <div class="row-sub">${esc(r.diagnosis)} · ${r.items.length} meds</div>
                </div>
              </div>`).join('') : ''}
          </div>
        </section>
      </div>
    </div>`;

    wireBody(scope, pat, appt);
  }

  function readForm() {
    return {
      symptoms: scope_el('cSymptoms')?.value.trim() || '',
      vitals: { temp: scope_el('cTemp')?.value, pulse: scope_el('cPulse')?.value, bp: scope_el('cBP')?.value, spo2: scope_el('cSpo2')?.value },
      diagnosis: scope_el('cDiag')?.value.trim() || '',
      notes: scope_el('cNotes')?.value.trim() || '',
      observations: scope_el('cObs')?.value.trim() || '',
      plan: scope_el('cPlan')?.value.trim() || '',
      followUp: scope_el('cFollow')?.value || null,
      followType: scope_el('cFollowType')?.value || 'In-clinic',
    };
    function scope_el(id) { return document.getElementById(id); }
  }

  function wireBody(scope, pat, appt) {
    const save = () => {
      const f = readForm();
      toast('Consultation draft saved', 'You can return to this record anytime.', 'success');
      return f;
    };
    scope.querySelector('#cSaveDraft').addEventListener('click', save);
    scope.querySelector('#cRx').addEventListener('click', () => {
      const f = readForm();
      openRxModal({ patientId: selected, diagnosis: f.diagnosis });
    });
    scope.querySelector('#cComplete').addEventListener('click', () => {
      const f = readForm();
      if (!f.diagnosis) { toast('Diagnosis required', 'Please add a diagnosis before completing.', 'error'); return; }
      const doc = getDoctor(myDocId()) || { name: currentUser()?.name || 'Your doctor', specialty: 'General Medicine' };
      if (appt) updateAppointment(appt.id, { status: 'completed', queueStatus: 'completed', diagnosis: f.diagnosis, notes: f.notes, vitals: f.vitals, followUp: f.followUp });
      addHistory({
        type: 'consultation', date: todayISO(), title: `${doc.specialty} Consultation`, doctor: doc.name,
        detail: `Diagnosis: ${f.diagnosis}.${f.notes ? ' ' + f.notes : ''}${f.plan ? ' Plan: ' + f.plan : ''}`,
        status: 'completed', patientId: selected,
      });
      addLog({ actor: currentUser()?.name, action: 'Consultation completed', details: `${pat.name} · ${f.diagnosis}` });
      if (f.followUp) pushNotification({ type: 'followup', title: 'Follow-up scheduled', message: `${doc.name} scheduled your follow-up on ${fmtDate(f.followUp)} (${f.followType}).` });
      confetti();
      toast('Consultation completed', `Record saved for ${pat.name}.`, 'success');
      navigate('#/queue');
    });
  }
}

export function initConsult() {
  registerPage('consult', consultPage);
}