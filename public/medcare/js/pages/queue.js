// ─────────────────────────────────────────────────────────────
// Patient Queue (Doctor) — live queue board with status lanes
// ─────────────────────────────────────────────────────────────
import { icon, esc, fmtTime, fmtDate, toast, todayISO } from '../core.js';
import { getAppointments, updateAppointment, getPatient, addLog, pushNotification, currentUser, getDoctors, getDoctor } from '../store.js';
import { registerPage, navigate } from '../router.js';
import { pageHead } from './shared.js';

function myDocId() {
  const u = currentUser();
  const doc = getDoctors().find(d => d.userId === (u ? u.userId : ''));
  return doc ? doc.id : '';
}

const LANES = [
  { key: 'waiting', label: 'Waiting', icon: 'clock', cls: 'blue' },
  { key: 'called', label: 'Called', icon: 'bell', cls: 'amber' },
  { key: 'in_consultation', label: 'In Consultation', icon: 'video', cls: 'purple' },
  { key: 'completed', label: 'Completed', icon: 'checkCircle', cls: 'green' },
  { key: 'cancelled', label: 'Cancelled', icon: 'xCircle', cls: 'red' },
];

function queuePage(vp) {
  const today = todayISO();
  const all = getAppointments({ doctorId: myDocId() }).filter(a => a.appointmentDate === today);
  const waitMins = (a) => {
    const start = a.createdAt ? new Date(a.createdAt) : new Date();
    return Math.max(1, Math.round((Date.now() - start.getTime()) / 60000));
  };
  const refresh = () => {
    all.length = 0;
    all.push(...getAppointments({ doctorId: myDocId() }).filter(a => a.appointmentDate === today));
  };

  vp.innerHTML = `
  ${pageHead('Patient queue', `Live queue for ${fmtDate(today, { weekday: true, day: 'numeric', month: 'long' })} · updates in real time.`, `
    <button class="btn btn-outline" data-nav="#/schedule">${icon('calendar', 16)} Schedule</button>
    <button class="btn btn-primary" id="callNext">${icon('bell', 16)} Call next</button>`)}
  <div class="kpi-grid">
    ${laneKpi('Waiting', all.filter(a => a.queueStatus === 'waiting').length, 'clock', 'blue')}
    ${laneKpi('Called', all.filter(a => a.queueStatus === 'called').length, 'bell', 'amber')}
    ${laneKpi('In consultation', all.filter(a => a.queueStatus === 'in_consultation').length, 'video', 'purple')}
    ${laneKpi('Completed today', all.filter(a => a.queueStatus === 'completed').length, 'checkCircle', 'green')}
  </div>
  <div class="queue-board" id="qBoard" style="margin-top:22px"></div>`;

  function renderBoard() {
    const board = vp.querySelector('#qBoard');
    const grouped = {};
    LANES.forEach(l => grouped[l.key] = []);
    const ordered = [...all].sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));
    let n = 0;
    const queueNums = {};
    ordered.forEach(a => {
      if (['waiting', 'called', 'in_consultation'].includes(a.queueStatus)) {
        n += 1;
        queueNums[a.id] = n;
      }
    });
    ordered.forEach(a => {
      const lane = LANES.find(l => l.key === a.queueStatus) || LANES[0];
      grouped[lane.key].push(a);
    });

    board.innerHTML = `
    <div class="queue-lanes">
      ${LANES.map(lane => `
        <div class="q-lane" data-lane="${lane.key}">
          <div class="q-lane-head">
            <span class="q-lane-ic ${lane.cls}">${icon(lane.icon, 15)}</span>
            <b>${lane.label}</b>
            <span class="q-lane-count">${grouped[lane.key].length}</span>
          </div>
          <div class="q-lane-body">
            ${grouped[lane.key].length ? grouped[lane.key].map(a => queueCard(a, queueNums[a.id], waitMins(a))).join('') : `<div class="q-lane-empty">${lane.key === 'completed' || lane.key === 'cancelled' ? '—' : 'Empty'}</div>`}
          </div>
        </div>`).join('')}
    </div>`;
    bindBoard(board);
  }

  function queueCard(a, num, mins) {
    const pat = getPatient(a.patientId) || {};
    return `
    <div class="q-card ${a.priority === 'emergency' ? 'emergency' : ''}" data-qid="${a.id}">
      ${a.priority === 'emergency' ? `<div class="q-emg">${icon('alert', 12)} Emergency priority</div>` : ''}
      <div class="q-card-top">
        <span class="q-num">${num ? '#' + num : '—'}</span>
        <div style="flex:1;min-width:0">
          <b style="font-size:.84rem">${esc(a.patientName)}</b>
          <div class="row-sub">${esc(pat.condition || a.notes || a.type)}</div>
        </div>
      </div>
      <div class="q-card-meta">
        <span>${icon('clock', 13)} ${fmtTime(a.appointmentTime)}</span>
        ${a.queueStatus === 'waiting' ? `<span class="q-wait" data-wait="${a.id}">${icon('clock', 13)} waiting ${mins}m</span>` : ''}
      </div>
      <div class="q-card-actions">
        ${a.queueStatus === 'waiting' ? `<button class="btn btn-soft btn-xs" data-act="call" data-id="${a.id}">${icon('bell', 12)} Call</button><button class="btn btn-outline btn-xs" data-act="start" data-id="${a.id}">${icon('video', 12)} Start</button>` : ''}
        ${a.queueStatus === 'called' ? `<button class="btn btn-teal btn-xs" data-act="start" data-id="${a.id}">${icon('video', 12)} Start consult</button>` : ''}
        ${a.queueStatus === 'in_consultation' ? `<button class="btn btn-teal btn-xs" data-act="complete" data-id="${a.id}">${icon('checkCircle', 12)} Complete</button><button class="btn btn-outline btn-xs" data-act="consult" data-id="${a.id}">${icon('stethoscope', 12)} Consult</button>` : ''}
        ${['waiting', 'called'].includes(a.queueStatus) ? `<button class="btn btn-soft-danger btn-xs" data-act="cancel" data-id="${a.id}">${icon('x', 12)} Cancel</button>` : ''}
        <button class="btn btn-ghost btn-xs" data-act="details" data-id="${a.id}">${icon('eye', 12)} Details</button>
      </div>
    </div>`;
  }

  function bindBoard(board) {
    board.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const act = b.dataset.act, id = b.dataset.id;
      if (act === 'call') {
        updateAppointment(id, { queueStatus: 'called' });
        const a = getAppointments({ doctorId: myDocId() }).find(x => x.id === id);
        const doc = getDoctor(myDocId());
        pushNotification({ type: 'reminder', title: 'You have been called', message: `Please proceed to ${doc ? doc.name : 'the doctor'}'s room — your consultation is ready.` });
        toast('Patient called', `${a?.patientName || 'Patient'} is now in the called lane.`, 'info');
      } else if (act === 'start') {
        updateAppointment(id, { queueStatus: 'in_consultation', status: 'confirmed' });
        toast('Consultation started', 'Patient moved to in-consultation.', 'success');
      } else if (act === 'complete') {
        updateAppointment(id, { queueStatus: 'completed', status: 'completed' });
        addLog({ actor: currentUser()?.name, action: 'Consultation completed', details: `Queue ${id}` });
        toast('Consultation completed', 'Patient marked complete.', 'success');
      } else if (act === 'cancel') {
        updateAppointment(id, { queueStatus: 'cancelled', status: 'cancelled' });
        toast('Appointment cancelled', 'Removed from the queue.', 'warning');
      } else if (act === 'consult' || act === 'details') {
        navigate('#/consult?appt=' + id);
        return;
      }
      refresh();
      renderBoard();
    }));
  }

  vp.querySelector('#callNext').addEventListener('click', () => {
    refresh();
    const next = all.filter(a => a.queueStatus === 'waiting').sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime))[0];
    if (!next) { toast('Queue empty', 'No patients waiting to be called.', 'info'); return; }
    updateAppointment(next.id, { queueStatus: 'called' });
    const doc = getDoctor(myDocId());
    pushNotification({ type: 'reminder', title: 'You have been called', message: `Please proceed to ${doc ? doc.name : 'the doctor'}'s consultation room.` });
    toast('Next patient called', `${next.patientName} · ${fmtTime(next.appointmentTime)}`, 'success');
    renderBoard();
  });

  vp.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.nav)));
  renderBoard();

  const timer = setInterval(() => {
    if (!document.body.contains(vp)) { clearInterval(timer); return; }
    vp.querySelectorAll('[data-wait]').forEach(el => {
      const a = all.find(x => x.id === el.dataset.wait);
      if (a) el.textContent = `${icon('clock', 13)} waiting ${waitMins(a)}m`;
    });
  }, 15000);
}

function laneKpi(label, count, iconName, cls) {
  return `
  <div class="kpi" style="--kpi-glow:var(--blue-soft)">
    <div class="kpi-top"><span class="kpi-icon ${cls}">${icon(iconName, 21)}</span></div>
    <div><div class="kpi-value" data-count="${count}">${count}</div><div class="kpi-label">${label}</div></div>
  </div>`;
}

export function initQueue() {
  registerPage('queue', queuePage);
}