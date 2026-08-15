// ─────────────────────────────────────────────────────────────
// Prescriptions — Patient: VIEW. Doctor: WRITE & MANAGE.
// ─────────────────────────────────────────────────────────────
import { icon, esc, fmtDate, fmtTime, toast, openModal, confirmDialog, emptyState } from '../core.js';
import { getPrescriptions, getPrescription, getDoctor, getAppointment, getPatient, addPrescription, deletePrescription, getPatients, currentUser, getState, addLog, getDoctors } from '../store.js';
import { registerPage, navigate, role } from '../router.js';
import { pageHead } from './shared.js';

let rxFilter = 'all';

function prescriptionsPage(vp, params) {
  const r = role();
  const isDoc = r === 'doctor';
  const openId = params.get('id');
  let list = getPrescriptions();
  if (isDoc && rxFilter !== 'all') list = list.filter(p => p.patientId === rxFilter);

  vp.innerHTML = `
  ${pageHead('Prescriptions', isDoc ? 'Write and manage digital prescriptions for your patients.' : 'Download, print or securely share your prescriptions.', isDoc ? `<button class="btn btn-primary" id="newRx">${icon('plus', 16)} New prescription</button>` : '')}
  ${isDoc ? `
  <div class="flex gap-8" style="align-items:center;margin-bottom:16px;flex-wrap:wrap">
    <label style="font-size:.78rem;font-weight:700">Filter by patient</label>
    <select class="select" id="rxFilter" style="width:220px">
      <option value="all">All patients</option>
      ${getPatients().map(p => `<option value="${p.id}" ${rxFilter === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
    </select>
    <span class="badge navy plain">${list.length} prescriptions</span>
  </div>` : ''}
  ${list.length ? `<div class="grid" style="gap:16px" id="rxList"></div>` : emptyState('No prescriptions yet', 'Prescriptions issued after consultations will appear here.', 'prescription')}`;

  const rxList = vp.querySelector('#rxList');
  if (rxList) {
    rxList.innerHTML = list.map(p => `
      <div class="rx hoverable" style="cursor:pointer" data-rx="${p.id}">
        <div class="rx-head">
          <div>
            <div class="rx-title">${icon('prescription', 22)} Prescription</div>
            <div class="rx-id mt-8">${esc(p.id)} · Issued ${fmtDate(p.date, { month: 'long' })}</div>
          </div>
          <div class="flex gap-8" style="align-items:center">
            <span class="badge green plain">${icon('shield', 11)} Verified</span>
            <button class="icon-btn" style="width:32px;height:32px" aria-label="View prescription">${icon('chevRight', 16)}</button>
          </div>
        </div>
        <div class="rx-meta">
          <div class="rm"><small>Doctor</small><b>${esc(p.doctorName)}</b></div>
          <div class="rm"><small>Patient</small><b>${esc(p.patientName || '—')}</b></div>
          <div class="rm"><small>Diagnosis</small><b>${esc(p.diagnosis)}</b></div>
          <div class="rm"><small>Medicines</small><b>${p.items.length}</b></div>
        </div>
        <div class="rx-body">
          <div class="mini-chips">${p.items.slice(0, 3).map(i => `<span class="mini-chip">${esc(i.medicine)} · ${esc(i.dosage)}</span>`).join('')}${p.items.length > 3 ? `<span class="mini-chip">+${p.items.length - 3} more</span>` : ''}</div>
        </div>
      </div>`).join('');
    rxList.querySelectorAll('[data-rx]').forEach(el => el.addEventListener('click', () => openRx(el.dataset.rx)));
  }

  const newBtn = vp.querySelector('#newRx');
  if (newBtn) newBtn.addEventListener('click', () => openRxModal());

  const filterEl = vp.querySelector('#rxFilter');
  if (filterEl) filterEl.addEventListener('change', () => {
    rxFilter = filterEl.value;
    prescriptionsPage(vp, params);
  });

  if (openId) setTimeout(() => openRx(openId), 80);
}

export function openRx(id) {
  const p = getPrescription(id);
  if (!p) { toast('Prescription not found', 'It may have been removed.', 'error'); return; }
  const doc = getDoctor(p.doctorId) || { name: p.doctorName, specialty: '', clinic: 'MedCare', location: '' };
  const isDoc = role() === 'doctor';
  const close = openModal(`
    <div class="modal-head"><h3>Digital prescription</h3><button class="icon-btn" data-close aria-label="Close">${icon('x', 18)}</button></div>
    <div class="modal-body">
      <div class="rx">
        <div class="rx-head">
          <div>
            <div class="rx-title">${icon('prescription', 22)} MedCare</div>
            <div class="rx-id mt-8">${esc(p.id)}</div>
          </div>
          <div style="text-align:right"><span class="badge green plain">${icon('shield', 11)} Secure</span><div class="rx-id mt-8">Issued ${fmtDate(p.date, { month: 'long' })}</div></div>
        </div>
        <div class="rx-meta">
          <div class="rm"><small>Doctor</small><b>${esc(p.doctorName)}</b></div>
          <div class="rm"><small>Specialty</small><b>${esc(doc.specialty || p.doctorName.split(' ')[0])}</b></div>
          <div class="rm"><small>Patient</small><b>${esc(p.patientName || '—')}</b></div>
          <div class="rm"><small>Diagnosis</small><b>${esc(p.diagnosis)}</b></div>
        </div>
        <div class="rx-body">
          <table class="rx-table">
            <thead><tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead>
            <tbody>
              ${p.items.map((it, i) => `
                <tr>
                  <td class="mono" style="color:var(--faint)">${i + 1}</td>
                  <td class="med">${esc(it.medicine)}</td>
                  <td>${esc(it.dosage)}</td>
                  <td>${esc(it.frequency)}</td>
                  <td>${esc(it.duration)}</td>
                  <td class="text-muted">${esc(it.instructions)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
          ${p.notes ? `<div class="rx-notes"><b>Notes: </b>${esc(p.notes)}</div>` : ''}
        </div>
        <div class="rx-foot">
          <span>${icon('calendarCheck', 15)} Follow-up ${p.followUp ? fmtDate(p.followUp) : 'as advised'}</span>
          <span class="mono">Dr. ${esc(p.doctorName.split(' ').slice(1).join(' ')) || '—'}</span>
        </div>
      </div>
      <div class="flex gap-10 mt-16" style="flex-wrap:wrap">
        <button class="btn btn-primary" id="rxDownload">${icon('download', 16)} Download PDF</button>
        <button class="btn btn-outline" id="rxPrint">${icon('print', 16)} Print</button>
        <button class="btn btn-outline" id="rxShare">${icon('share', 16)} ${isDoc ? 'Send to patient' : 'Share securely'}</button>
        ${isDoc ? `<button class="btn btn-soft-danger" id="rxDelete">${icon('trash', 16)} Delete</button>` : ''}
      </div>
    </div>`, {
    onMount: (box) => {
      box.querySelector('#rxDownload').addEventListener('click', () => {
        toast('Prescription downloaded', `${p.id}.pdf`, 'success');
        const a = document.createElement('a');
        const blob = new Blob([`MedCare Prescription ${p.id}\nDoctor: ${p.doctorName}\nPatient: ${p.patientName}\nDiagnosis: ${p.diagnosis}\n\n${p.items.map((it, i) => `${i + 1}. ${it.medicine} — ${it.dosage} · ${it.frequency} · ${it.duration} (${it.instructions})`).join('\n')}`], { type: 'text/plain' });
        a.href = URL.createObjectURL(blob);
        a.download = `${p.id}.txt`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
      box.querySelector('#rxPrint').addEventListener('click', () => window.print());
      box.querySelector('#rxShare').addEventListener('click', () => {
        if (isDoc) {
          toast('Sent to patient', `${p.patientName} can now view this prescription.`, 'success');
        } else {
          toast('Secure share link created', 'Expires in 24 hours.', 'success');
        }
      });
      const del = box.querySelector('#rxDelete');
      if (del) del.addEventListener('click', async () => {
        const ok = await confirmDialog({ title: 'Delete prescription?', message: `Permanently delete ${p.id}? This cannot be undone.`, confirmText: 'Yes, delete' });
        if (!ok) return;
        deletePrescription(p.id);
        addLog({ actor: currentUser()?.name, action: 'Prescription deleted', details: p.id });
        toast('Prescription deleted', 'Removed from records.', 'warning');
        box._close();
        navigate('#/prescriptions');
      });
    },
  });
}

export function openRxModal(prefill = {}) {
  const patients = getPatients();
  const selectedPatient = prefill.patientId && patients.find(p => p.id === prefill.patientId) ? prefill.patientId : patients[0]?.id || '';
  const close = openModal(`
    <div class="modal-head"><h3>Write prescription</h3><button class="icon-btn" data-close aria-label="Close">${icon('x', 18)}</button></div>
    <div class="modal-body" style="display:grid;gap:14px">
      <div class="field">
        <label>Patient <span class="req">*</span></label>
        <select class="select" id="rxPatient">${patients.map(p => `<option value="${p.id}" ${p.id === selectedPatient ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label>Diagnosis <span class="req">*</span></label>
        <input class="input" id="rxDiag" placeholder="e.g. Acute bronchitis" value="${esc(prefill.diagnosis || '')}">
      </div>
      <div>
        <label style="font-size:.78rem;font-weight:700">Medicines</label>
        <div style="display:grid;gap:8px;margin-top:8px" id="rxItems">
          ${rxItemRow(0)}
        </div>
        <button class="btn btn-ghost btn-sm mt-8" id="addItem">${icon('plus', 15)} Add medicine</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Follow-up date</label><input class="input" type="date" id="rxFollow"></div>
        <div class="field"><label>Notes</label><input class="input" id="rxNotes" placeholder="Optional advice"></div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline btn-sm" data-close>Cancel</button>
      <button class="btn btn-primary btn-sm" id="rxSave">${icon('check', 15)} Save &amp; issue</button>
    </div>`, {
    onMount: (box) => {
      let n = 1;
      const wireRemove = (wrap) => {
        wrap.querySelectorAll('[data-remove]').forEach(btn => {
          if (btn.dataset.bound) return;
          btn.dataset.bound = '1';
          btn.addEventListener('click', () => btn.closest('[data-rxitem]').remove());
        });
      };
      wireRemove(box.querySelector('#rxItems'));
      box.querySelector('#addItem').addEventListener('click', () => {
        const wrap = box.querySelector('#rxItems');
        wrap.insertAdjacentHTML('beforeend', rxItemRow(n++));
        wireRemove(wrap);
      });
      box.querySelector('#rxSave').addEventListener('click', () => {
        const pid = box.querySelector('#rxPatient').value;
        const diag = box.querySelector('#rxDiag').value.trim();
        const items = [...box.querySelectorAll('[data-rxitem]')].map(row => ({
          medicine: row.querySelector('.m-medicine').value.trim(),
          dosage: row.querySelector('.m-dosage').value.trim(),
          frequency: row.querySelector('.m-frequency').value.trim(),
          duration: row.querySelector('.m-duration').value.trim(),
          instructions: row.querySelector('.m-instructions').value.trim(),
        })).filter(i => i.medicine);
        if (!diag || !items.length) { toast('Missing details', 'Diagnosis and at least one medicine are required.', 'error'); return; }
        const patient = getPatients().find(p => p.id === pid);
        const me = currentUser();
        const doc = getDoctors().find(d => d.userId === (me ? me.userId : '')) || { id: '', name: me ? me.name : '' };
        const p = addPrescription({
          doctorId: doc.id, doctorName: doc.name, patientId: pid, patientName: patient?.name,
          diagnosis: diag, items, notes: box.querySelector('#rxNotes').value.trim(),
          followUp: box.querySelector('#rxFollow').value || null,
        });
        addLog({ actor: currentUser()?.name, action: 'Prescription issued', details: `${patient?.name} · ${diag}` });
        toast('Prescription issued', `Saved for ${patient?.name}.`, 'success');
        box._close();
        navigate('#/prescriptions?id=' + p.id);
      });
    },
  });
}

function rxItemRow(i) {
  return `
  <div class="card card-pad" style="padding:12px 14px;display:grid;gap:8px" data-rxitem>
    <div class="flex gap-8">
      <input class="input m-medicine" placeholder="Medicine name (e.g. Amoxicillin 500mg)" style="flex:1">
      <input class="input m-dosage" placeholder="Dosage" style="width:110px">
    </div>
    <div class="flex gap-8">
      <input class="input m-frequency" placeholder="Frequency" style="flex:1">
      <input class="input m-duration" placeholder="Duration" style="width:120px">
      <input class="input m-instructions" placeholder="Instructions" style="flex:1.2">
      <button class="icon-btn" data-remove aria-label="Remove">${icon('trash', 16)}</button>
    </div>
  </div>`;
}

export function initPrescriptions() {
  registerPage('prescriptions', prescriptionsPage);
}