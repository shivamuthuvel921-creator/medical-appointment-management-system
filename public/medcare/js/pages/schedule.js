// ─────────────────────────────────────────────────────────────
// Schedule (Doctor) — daily / weekly / monthly calendar,
// availability, working hours, blocked slots and leave
// ─────────────────────────────────────────────────────────────
import { icon, esc, fmtDate, fmtTime, toast, openModal, confirmDialog, todayISO, addDays, toISO, fromISO, DAYS, DAYS_SHORT, MONTHS_SHORT, emptyState } from '../core.js';
import { getDoctor, getAppointments, setWorkingSchedule, getBlocked, blockSlot, unblockSlot, getOffDays, setOffDay, removeOffDay, addLog, currentUser, getDoctors } from '../store.js';
import { registerPage, navigate, role } from '../router.js';
import { pageHead, statusBadge, typeChip } from './shared.js';

function myDocId() {
  const u = currentUser();
  const doc = getDoctors().find(d => d.userId === (u ? u.userId : ''));
  return doc ? doc.id : '';
}

let state = { view: 'day', cursor: todayISO() };

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function schedulePage(vp) {
  render(vp);

  function render() {
    vp.innerHTML = `
    ${pageHead('My schedule', `Plan consultations, manage working hours and block time off.`, `
      <button class="btn btn-outline" data-nav="#/queue">${icon('users', 16)} Patient queue</button>
      <button class="btn btn-primary" id="openAvail">${icon('settings', 16)} Manage availability</button>`)}
    <div class="flex gap-12" style="align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:16px">
      <div class="chip-select">
        ${['day', 'week', 'month'].map(v => `<button class="chip-opt ${state.view === v ? 'selected' : ''}" data-view="${v}">${icon(v === 'day' ? 'clock' : v === 'week' ? 'list' : 'grid', 14)} ${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}
      </div>
      <div class="flex gap-8" style="align-items:center">
        <button class="icon-btn" id="calPrev" aria-label="Previous">${icon('chevLeft', 18)}</button>
        <b style="min-width:200px;text-align:center;font-family:var(--font-display)">${cursorLabel()}</b>
        <button class="icon-btn" id="calNext" aria-label="Next">${icon('chevRight', 18)}</button>
        <button class="btn btn-ghost btn-sm" id="calToday">Today</button>
      </div>
    </div>
    <div id="schBody"></div>`;

    wire(vp);
    renderBody(vp);
  }

  function cursorLabel() {
    if (state.view === 'day') return fmtDate(state.cursor, { weekday: true, day: 'numeric', month: 'short' });
    if (state.view === 'week') {
      const monday = addDays(state.cursor, -fromISO(state.cursor).getDay());
      const sunday = addDays(monday, 6);
      return `${MONTHS_SHORT[fromISO(monday).getMonth()]} ${fromISO(monday).getDate()} – ${MONTHS_SHORT[fromISO(sunday).getMonth()]} ${fromISO(sunday).getDate()}`;
    }
    return `${MONTHS_SHORT[fromISO(state.cursor).getMonth()]} ${fromISO(state.cursor).getFullYear()}`;
  }

  function shift(amount) {
    const d = fromISO(state.cursor);
    if (state.view === 'day') d.setDate(d.getDate() + amount);
    if (state.view === 'week') d.setDate(d.getDate() + amount * 7);
    if (state.view === 'month') d.setMonth(d.getMonth() + amount);
    state.cursor = toISO(d);
    render(vp);
  }

  function wire(scope) {
    scope.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
      state.view = b.dataset.view;
      render(vp);
    }));
    scope.querySelector('#calPrev').addEventListener('click', () => shift(-1));
    scope.querySelector('#calNext').addEventListener('click', () => shift(1));
    scope.querySelector('#calToday').addEventListener('click', () => { state.cursor = todayISO(); render(vp); });
    scope.querySelector('#openAvail').addEventListener('click', () => manageAvailability(render));
  }

  function renderBody(scope) {
    const body = scope.querySelector('#schBody');
    if (state.view === 'day') renderDay(body);
    else if (state.view === 'week') renderWeek(body);
    else renderMonth(body);
    body.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.nav)));
  }

  // ── Day view ──────────────────────────────────────────────
  function renderDay(body) {
    const doc = getDoctor(myDocId());
    const date = state.cursor;
    const dow = fromISO(date).getDay();
    const working = (doc.slots || []).filter(s => s.dayOfWeek === dow);
    const appts = getAppointments({ doctorId: myDocId() }).filter(a => a.appointmentDate === date && a.status !== 'cancelled' && a.status !== 'rejected');
    const off = (doc.offDays || []).includes(date);
    const blocked = new Set(getBlocked(myDocId()).filter(b => b.date === date).map(b => b.time));
    const bookedMap = {};
    appts.forEach(a => { bookedMap[a.appointmentTime] = a; });

    let html = `
    <div class="dash-grid">
      <div class="dash-main">
        <section class="section-label"><h3>Consultations · ${fmtDate(date, { weekday: true })}</h3><span class="line"></span><span class="count">${appts.length} booked</span></section>
        ${off ? `
          <div class="card card-pad" style="display:flex;gap:14px;align-items:center">
            <span class="notif-ic amber" style="width:48px;height:48px;border-radius:14px">${icon('sun', 24)}</span>
            <div style="flex:1"><b>You are on leave this day</b><div class="row-sub">All consultations are blocked. Patients have been notified.</div></div>
            <button class="btn btn-outline btn-sm" id="cancelLeave">${icon('x', 14)} Clear leave</button>
          </div>`
        : working.length ? `
          <div class="sch-day">
            ${buildTimeline(working, blocked, bookedMap)}
          </div>`
        : `<div class="card card-pad">${emptyState('Clinic closed', 'No working hours configured for this day.', 'moon', `<button class="btn btn-primary btn-sm mt-12" id="openAvail2">${icon('settings', 15)} Set availability</button>`)}</div>`}
      </div>
      <div style="display:grid;gap:16px;align-content:start">
        <section class="card card-pad">
          <div class="card-title" style="margin-bottom:12px">${icon('clock', 17)} Day summary</div>
          <div class="summary-grid">
            <div><b>${appts.filter(a => a.status === 'completed').length}</b><small>Completed</small></div>
            <div><b>${appts.filter(a => a.queueStatus === 'waiting' || a.queueStatus === 'in_consultation').length}</b><small>In session</small></div>
            <div><b>${appts.filter(a => a.priority === 'emergency').length}</b><small>Emergencies</small></div>
            <div><b>${appts.length}</b><small>Total</small></div>
          </div>
        </section>
        <section class="card card-pad">
          <div class="card-title" style="margin-bottom:12px">${icon('sun', 17)} Leave &amp; blocked</div>
          <div style="display:grid;gap:8px;max-height:220px;overflow:auto">
            ${getOffDays(myDocId()).slice(0, 6).map(d => `<div class="row-item" style="padding:8px 6px"><span class="notif-ic amber" style="width:32px;height:32px;border-radius:10px">${icon('sun', 15)}</span><div class="row-main"><div class="row-title" style="font-size:.8rem">${fmtDate(d)}</div><div class="row-sub">Day off</div></div><button class="icon-btn" data-unoff="${d}" aria-label="Remove leave">${icon('x', 14)}</button></div>`).join('') || '<p class="text-faint" style="font-size:.78rem">No leave marked.</p>'}
          </div>
        </section>
        <section class="card card-pad">
          <div class="card-title" style="margin-bottom:12px">${icon('mapPin', 17)} Quick actions</div>
          <div class="card-menu">
            <div class="mi" data-nav="#/queue">${icon('users', 17)} Open patient queue</div>
            <div class="mi" data-nav="#/consult">${icon('stethoscope', 17)} Start consultation</div>
            <div class="mi" data-nav="#/prescriptions">${icon('prescription', 17)} Write prescription</div>
          </div>
        </section>
      </div>
    </div>`;

    body.innerHTML = html;
    body.querySelectorAll('[data-unoff]').forEach(b => b.addEventListener('click', () => {
      removeOffDay(myDocId(), b.dataset.unoff);
      toast('Leave removed', 'You are available again this day.', 'success');
      render(vp);
    }));
    body.querySelectorAll('[data-block]').forEach(b => b.addEventListener('click', () => {
      blockSlot(myDocId(), date, b.dataset.block);
      addLog({ actor: currentUser()?.name, action: 'Slot blocked', details: `${date} ${b.dataset.block}` });
      toast('Slot blocked', `${fmtTime(b.dataset.block)} is now unavailable.`, 'info');
      render(vp);
    }));
    body.querySelectorAll('[data-unblock]').forEach(b => b.addEventListener('click', () => {
      unblockSlot(myDocId(), date, b.dataset.unblock);
      toast('Slot unblocked', `${fmtTime(b.dataset.unblock)} is available again.`, 'success');
      render(vp);
    }));
    const cl = body.querySelector('#cancelLeave');
    if (cl) cl.addEventListener('click', () => { removeOffDay(myDocId(), date); toast('Leave cleared', '', 'success'); render(vp); });
    const av2 = body.querySelector('#openAvail2');
    if (av2) av2.addEventListener('click', () => manageAvailability(render));
    body.querySelectorAll('[data-appt]').forEach(el => el.addEventListener('click', () => navigate('#/appointments?id=' + el.dataset.appt)));
  }

  function buildTimeline(working, blocked, bookedMap) {
    const rows = [];
    for (const w of working) {
      let [hs, ms] = w.startTime.split(':').map(Number);
      const [he, me] = w.endTime.split(':').map(Number);
      let cur = hs * 60 + ms, end = he * 60 + me;
      for (let t = cur; t < end; t += 30) {
        const h = String(Math.floor(t / 60)).padStart(2, '0');
        const m = String(t % 60).padStart(2, '0');
        const time = `${h}:${m}`;
        const appt = bookedMap[time];
        if (appt) {
          rows.push(`
            <div class="sch-row booked" data-appt="${appt.id}">
              <span class="sch-time">${fmtTime(time)}</span>
              <div class="sch-cell booked">
                <div class="sch-head"><b style="font-size:.82rem">${esc(appt.patientName)}</b>${appt.priority === 'emergency' ? `<span class="badge red pulse plain">${icon('alert', 11)} Emergency</span>` : ''}</div>
                <div class="row-sub">${esc(appt.notes || appt.type + ' consult')} · ${appt.duration}m</div>
                <div class="flex gap-8 mt-8" style="flex-wrap:wrap">${typeChip(appt.type)}${statusBadge(appt.status)}</div>
              </div>
            </div>`);
        } else if (blocked.has(time)) {
          rows.push(`
            <div class="sch-row">
              <span class="sch-time">${fmtTime(time)}</span>
              <div class="sch-cell blocked"><b style="font-size:.8rem">${icon('lock', 13)} Blocked</b><button class="btn btn-ghost btn-xs" data-unblock="${time}">${icon('x', 12)} Unblock</button></div>
            </div>`);
        } else {
          rows.push(`
            <div class="sch-row">
              <span class="sch-time">${fmtTime(time)}</span>
              <div class="sch-cell free"><span class="text-faint" style="font-size:.76rem">Available · 30 min</span><button class="btn btn-ghost btn-xs" data-block="${time}">${icon('lock', 12)} Block</button></div>
            </div>`);
        }
      }
    }
    return rows.join('');
  }

  // ── Week view ─────────────────────────────────────────────
  function renderWeek(body) {
    const monday = addDays(state.cursor, -fromISO(state.cursor).getDay());
    const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    const appts = getAppointments({ doctorId: myDocId() }).filter(a => a.status !== 'cancelled' && a.status !== 'rejected');
    const offDays = getOffDays(myDocId());
    const t = todayISO();
    body.innerHTML = `
    <div class="sch-week">
      ${days.map(d => {
        const iso = d;
        const dayAppts = appts.filter(a => a.appointmentDate === iso).sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));
        const off = offDays.includes(iso);
        return `
        <div class="sch-week-col ${iso === t ? 'today' : ''}" data-open="${iso}">
          <div class="sch-week-head">
            <small>${DAYS_SHORT[fromISO(iso).getDay()]}</small>
            <b>${fromISO(iso).getDate()}</b>
          </div>
          <div class="sch-week-body">
            ${off ? `<div class="sch-week-off">${icon('sun', 13)} Leave</div>` : dayAppts.length ? dayAppts.map(a => `
              <div class="sch-mini ${a.status === 'completed' ? 'done' : ''}" data-appt="${a.id}">
                <span>${fmtTime(a.appointmentTime)}</span><b>${esc(a.patientName)}</b>
                ${a.priority === 'emergency' ? `<i class="badge red pulse plain">E</i>` : ''}
              </div>`).join('') : `<div class="sch-week-empty">Free</div>`}
          </div>
        </div>`;
      }).join('')}
    </div>`;
    body.querySelectorAll('[data-appt]').forEach(el => el.addEventListener('click', () => navigate('#/appointments?id=' + el.dataset.appt)));
    body.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => {
      state.view = 'day';
      state.cursor = el.dataset.open;
      render(vp);
    }));
  }

  // ── Month view ────────────────────────────────────────────
  function renderMonth(body) {
    const y = fromISO(state.cursor).getFullYear(), mo = fromISO(state.cursor).getMonth();
    const first = new Date(y, mo, 1).getDay();
    const dim = new Date(y, mo + 1, 0).getDate();
    const t = todayISO();
    const appts = getAppointments({ doctorId: myDocId() }).filter(a => a.status !== 'cancelled' && a.status !== 'rejected');
    const offDays = getOffDays(myDocId());
    const blocked = getBlocked(myDocId());
    body.innerHTML = `
    <div class="card card-pad">
      <div class="cal">
        <div class="cal-head"><span class="cal-title">${MONTHS_SHORT[mo]} ${y}</span><span class="text-faint" style="font-size:.72rem">Click a day to open it</span></div>
        <div class="cal-grid" style="grid-auto-rows:minmax(92px,auto)">
          ${DAYS_SHORT.map(d => `<div class="cal-dow">${d}</div>`).join('')}
          ${Array.from({ length: first }, () => '<div></div>')}
          ${Array.from({ length: dim }, (_, i) => {
            const day = i + 1;
            const iso = toISO(new Date(y, mo, day));
            const evts = appts.filter(a => a.appointmentDate === iso);
            const off = offDays.includes(iso);
            const hasBlocked = blocked.some(b => b.date === iso);
            return `<div class="calendar-day ${iso === t ? 'today' : ''} ${off ? 'off' : ''}" data-open="${iso}">
              <div class="day-num">${day}${iso === t ? ' · today' : ''}</div>
              ${off ? `<div class="evt off">${icon('sun', 11)} Leave</div>` : ''}
              ${evts.slice(0, 3).map(e => `<div class="evt ${e.status === 'completed' ? 'done' : ''}" data-appt="${e.id}">${fmtTime(e.appointmentTime)} · ${esc(e.patientName)}</div>`).join('')}
              ${evts.length > 3 ? `<small class="text-faint" style="display:block;margin-top:3px;font-size:.62rem">+${evts.length - 3} more</small>` : ''}
              ${hasBlocked && !evts.length ? `<small class="text-faint" style="display:block;margin-top:3px;font-size:.62rem">${icon('lock', 10)} blocked</small>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
    body.querySelectorAll('[data-appt]').forEach(el => el.addEventListener('click', (e) => { e.stopPropagation(); navigate('#/appointments?id=' + el.dataset.appt); }));
    body.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => {
      state.view = 'day';
      state.cursor = el.dataset.open;
      render(vp);
    }));
  }
}

// ── Availability manager ────────────────────────────────────
function manageAvailability(render) {
  const doc = getDoctor(myDocId());
  const workingDays = (doc.slots || []).map(s => s.dayOfWeek);
  const start = (doc.slots || [])[0]?.startTime || '09:00';
  const end = (doc.slots || [])[0]?.endTime || '17:00';
  const timeOptions = () => {
    let html = '';
    for (let t = 7 * 60; t <= 20 * 60; t += 30) {
      const h = String(Math.floor(t / 60)).padStart(2, '0');
      const m = String(t % 60).padStart(2, '0');
      html += `<option value="${h}:${m}">${fmtTime(`${h}:${m}`)}</option>`;
    }
    return html;
  };
  const close = openModal(`
    <div class="modal-head"><h3>Manage availability</h3><button class="icon-btn" data-close aria-label="Close">${icon('x', 18)}</button></div>
    <div class="modal-body" style="display:grid;gap:16px">
      <div>
        <label style="font-size:.78rem;font-weight:700">Working days</label>
        <div class="wd-grid" style="margin-top:8px">
          ${DAY_NAMES.map((n, i) => `
            <button class="wd-toggle ${workingDays.includes(i) ? 'on' : ''}" data-wd="${i}" type="button">${n.slice(0, 3)}</button>`).join('')}
        </div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Start time</label><select class="select" id="avStart">${timeOptions()}</select></div>
        <div class="field"><label>End time</label><select class="select" id="avEnd">${timeOptions()}</select></div>
      </div>
      <div class="field"><label>Consultation duration</label>
        <select class="select" id="avDur">
          <option value="15">15 minutes</option>
          <option value="30" selected>30 minutes</option>
          <option value="45">45 minutes</option>
          <option value="60">60 minutes</option>
        </select>
      </div>
      <div class="field"><label>Mark leave for</label>
        <div class="flex gap-8">
          <input class="input" type="date" id="avLeave" min="${todayISO()}">
          <button class="btn btn-outline" id="addLeave">${icon('sun', 15)} Add leave</button>
        </div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline btn-sm" data-close>Cancel</button>
      <button class="btn btn-primary btn-sm" id="avSave">${icon('check', 15)} Save working hours</button>
    </div>`, {
    onMount: (box) => {
      box.querySelector('#avStart').value = start;
      box.querySelector('#avEnd').value = end;
      const wds = box.querySelectorAll('[data-wd]');
      wds.forEach(b => b.addEventListener('click', () => b.classList.toggle('on')));
      box.querySelector('#addLeave').addEventListener('click', () => {
        const d = box.querySelector('#avLeave').value;
        if (!d) { toast('Pick a date', 'Choose a date to mark as leave.', 'error'); return; }
        setOffDay(myDocId(), d);
        addLog({ actor: currentUser()?.name, action: 'Leave marked', details: d });
        toast('Leave added', `${fmtDate(d)} is now a day off.`, 'success');
      });
      box.querySelector('#avSave').addEventListener('click', () => {
        const days = [...wds].filter(b => b.classList.contains('on')).map(b => Number(b.dataset.wd));
        if (!days.length) { toast('No working days', 'Select at least one working day.', 'error'); return; }
        const st = box.querySelector('#avStart').value;
        const en = box.querySelector('#avEnd').value;
        if (en <= st) { toast('Invalid range', 'End time must be after start time.', 'error'); return; }
        setWorkingSchedule(myDocId(), { days, startTime: st, endTime: en });
        addLog({ actor: currentUser()?.name, action: 'Availability updated', details: `${days.length} days · ${st}–${en}` });
        toast('Availability saved', 'Your working hours are updated.', 'success');
        box._close();
        render();
      });
    },
  });
}

export function initSchedule() {
  registerPage('schedule', (vp) => {
    state.cursor = todayISO();
    schedulePage(vp);
  });
}