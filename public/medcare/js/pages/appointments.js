// ─────────────────────────────────────────────────────────────
// Appointments — My Appointments (patient), management (admin/doctor)
// ─────────────────────────────────────────────────────────────
import { icon, esc, fmtDate, fmtTime, money, toast, openModal, countUp, emptyState, errorState, toISO, todayISO, MONTHS_SHORT, DAYS_SHORT } from '../core.js';
import { getAppointments, getAppointment, getDoctor, getPatient, getPrescriptions, cancelAppointment, rescheduleAppointment, getAvailability, updateAppointment, addLog, currentUser, getDoctors } from '../store.js';
import { registerPage, navigate, role } from '../router.js';
import { pageHead, apptCard, statusBadge, typeChip, skeletonCards, doctorAvatar } from './shared.js';

let state = { view: 'list', tab: 'upcoming', q: '', doctor: '', spec: '', date: '', type: '', sort: 'upcoming', month: new Date() };

function appointmentsPage(vp, params) {
  const r = role();
  const id = params.get('id');
  if (id) openDetails(id);

  function boot() {
    if (r !== 'patient') { render(); return; }
    vp.innerHTML = pageHead('My Appointments', 'View and manage your scheduled consultations.', `<button class="btn btn-primary" data-nav="#/scheduling">${icon('calendarPlus', 16)} Schedule an Appointment</button>`) +
      `<div id="apptBodyWrap">${skeletonCards(3)}</div>`;
    setTimeout(() => render(), 380);
  }
  boot();

  function myList() {
    try {
      let list = getAppointments();
      if (r === 'doctor') {
        const u = currentUser();
        const doc = getDoctors().find(d => d.userId === (u ? u.userId : ''));
        list = list.filter(a => a.doctorId === (doc ? doc.id : ''));
      }
      if (r === 'patient') {
        const me = currentUser();
        list = list.filter(a => a.patientId === (me ? me.userId : '') || (me && a.patientName === me.name));
      }
      return list;
    } catch (e) { return null; }
  }

  function tabs() {
    if (r === 'doctor') return [['all', 'All'], ['today', 'Today'], ['scheduled', 'Pending'], ['confirmed', 'Confirmed'], ['completed', 'Completed'], ['emergency', 'Emergency']];
    if (r === 'admin') return [['all', 'All'], ['upcoming', 'Upcoming'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['rescheduled', 'Rescheduled'], ['emergency', 'Emergency']];
    return [['upcoming', 'Upcoming'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['rescheduled', 'Rescheduled']];
  }

  function summary(list) {
    return {
      upcoming: list.filter(a => a.status === 'scheduled' || a.status === 'confirmed').length,
      completed: list.filter(a => a.status === 'completed').length,
      cancelled: list.filter(a => a.status === 'cancelled' || a.status === 'rejected').length,
      rescheduled: list.filter(a => a.status === 'rescheduled').length,
    };
  }

  function render() {
    const base = myList();
    if (base === null) { renderError(vp); return; }
    const sums = summary(base);
    const title = r === 'doctor' ? 'Appointment management' : r === 'admin' ? 'Appointments' : 'My Appointments';
    const sub = r === 'doctor' ? 'Review, confirm and manage your consultations.' : r === 'admin' ? 'All appointments across the clinic.' : 'View and manage your scheduled consultations.';
    const headActions = r === 'patient' ? `<button class="btn btn-primary" data-nav="#/scheduling">${icon('calendarPlus', 16)} Schedule an Appointment</button>` : '';

    vp.innerHTML = `
    ${pageHead(title, sub, headActions)}
    ${r === 'patient' ? `
    <div class="kpi-grid appt-summary">
      ${kpiCard('Upcoming', sums.upcoming, 'calendar', 'blue')}
      ${kpiCard('Completed', sums.completed, 'checkCircle', 'green')}
      ${kpiCard('Cancelled', sums.cancelled, 'xCircle', 'red')}
      ${kpiCard('Rescheduled', sums.rescheduled, 'rotate', 'purple')}
    </div>` : ''}
    <div class="flex gap-16" style="align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:18px">
      <div class="tabs" id="apptTabs">
        ${tabs().map(([k, l]) => `<button class="tab ${state.tab === k ? 'active' : ''}" data-tab="${k}">${esc(l)}<span class="cnt">${tabCount(k)}</span></button>`).join('')}
      </div>
      <div class="appt-tools">
        <div class="filter-bar" id="apptFilters">
          <div class="input-icon" style="min-width:190px">${icon('search', 16)}<input class="input" id="apptSearch" placeholder="Search appointment..." value="${esc(state.q)}" style="padding-top:9px;padding-bottom:9px"></div>
          ${r !== 'doctor' ? `<select class="select" id="fDoctor"><option value="">All doctors</option>${docOptions(base)}</select>` : ''}
          <select class="select" id="fSpec"><option value="">All specializations</option>${specOptions(base)}</select>
          <input class="input" type="date" id="fDate" value="${esc(state.date)}" style="max-width:170px" title="Filter by date">
          <select class="select" id="fType"><option value="">All types</option><option value="In-clinic" ${state.type === 'In-clinic' ? 'selected' : ''}>In-Clinic</option><option value="Video" ${state.type === 'Video' ? 'selected' : ''}>Online</option><option value="Phone" ${state.type === 'Phone' ? 'selected' : ''}>Phone</option></select>
          <select class="select" id="fSort">
            <option value="upcoming" ${state.sort === 'upcoming' ? 'selected' : ''}>Sort: Upcoming</option>
            <option value="newest" ${state.sort === 'newest' ? 'selected' : ''}>Sort: Newest</option>
            <option value="oldest" ${state.sort === 'oldest' ? 'selected' : ''}>Sort: Oldest</option>
          </select>
          <div class="chip-select" style="gap:6px" id="viewToggle">
            <button class="chip-opt ${state.view === 'list' ? 'selected' : ''}" data-view="list">${icon('list', 14)} List</button>
            <button class="chip-opt ${state.view === 'calendar' ? 'selected' : ''}" data-view="calendar">${icon('calendar', 14)} Calendar</button>
          </div>
        </div>
      </div>
    </div>
    <div id="apptBody"></div>`;
    vp.querySelectorAll('[data-count]').forEach(el => { const t = parseFloat(String(el.dataset.count || '0')) || 0; el.textContent = '0'; countUp(el, t); });
    wire(vp);
    renderBody(vp);
  }

  function kpiCard(label, value, iconName, cls) {
    return `
    <div class="kpi" style="--kpi-glow:var(--blue-soft)">
      <div class="kpi-top"><span class="kpi-icon ${cls}">${icon(iconName, 21)}</span></div>
      <div><div class="kpi-value" data-count="${value}">0</div><div class="kpi-label">${label}</div></div>
    </div>`;
  }

  function docOptions(base) {
    const seen = new Set();
    const opts = [];
    base.forEach(a => { if (a.doctorId && !seen.has(a.doctorId)) { seen.add(a.doctorId); opts.push(a); } });
    return opts.map(a => `<option value="${esc(a.doctorId)}" ${state.doctor === a.doctorId ? 'selected' : ''}>${esc(a.doctorName)}</option>`).join('');
  }

  function specOptions(base) {
    const seen = new Set();
    const opts = [];
    base.forEach(a => { if (a.specialty && !seen.has(a.specialty)) { seen.add(a.specialty); opts.push(a.specialty); } });
    return opts.map(s => `<option value="${esc(s)}" ${state.spec === s ? 'selected' : ''}>${esc(s)}</option>`).join('');
  }

  function tabCount(tab) {
    const list = baseFiltered();
    const t = todayISO();
    const f = {
      upcoming: () => list.filter(a => a.status === 'scheduled' || a.status === 'confirmed').length,
      today: () => list.filter(a => a.appointmentDate === t && a.status !== 'cancelled' && a.status !== 'rejected').length,
      scheduled: () => list.filter(a => a.status === 'scheduled').length,
      confirmed: () => list.filter(a => a.status === 'confirmed').length,
      completed: () => list.filter(a => a.status === 'completed').length,
      cancelled: () => list.filter(a => a.status === 'cancelled' || a.status === 'rejected').length,
      rescheduled: () => list.filter(a => a.status === 'rescheduled').length,
      emergency: () => list.filter(a => a.priority === 'emergency').length,
      all: () => list.length,
    }[tab] || (() => list.length);
    return f();
  }

  function baseFiltered() {
    const list = myList() || [];
    const t = todayISO();
    let out = list;
    switch (state.tab) {
      case 'upcoming': out = list.filter(a => a.status === 'scheduled' || a.status === 'confirmed'); break;
      case 'today': out = list.filter(a => a.appointmentDate === t && a.status !== 'cancelled' && a.status !== 'rejected'); break;
      case 'scheduled': out = list.filter(a => a.status === 'scheduled'); break;
      case 'confirmed': out = list.filter(a => a.status === 'confirmed'); break;
      case 'completed': out = list.filter(a => a.status === 'completed'); break;
      case 'cancelled': out = list.filter(a => a.status === 'cancelled' || a.status === 'rejected'); break;
      case 'rescheduled': out = list.filter(a => a.status === 'rescheduled'); break;
      case 'emergency': out = list.filter(a => a.priority === 'emergency'); break;
    }
    return out;
  }

  function filteredList() {
    let list = baseFiltered();
    const q = state.q.toLowerCase();
    if (q) list = list.filter(a => (a.patientName + a.doctorName + a.bookingId + a.notes + a.specialty).toLowerCase().includes(q));
    if (state.doctor) list = list.filter(a => a.doctorId === state.doctor);
    if (state.spec) list = list.filter(a => a.specialty === state.spec);
    if (state.date) list = list.filter(a => a.appointmentDate === state.date);
    if (state.type) list = list.filter(a => a.type === state.type);
    if (state.sort === 'newest') list = [...list].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    else if (state.sort === 'oldest') list = [...list].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    else list = [...list].sort((a, b) => (a.appointmentDate + a.appointmentTime).localeCompare(b.appointmentDate + b.appointmentTime));
    return list;
  }

  function renderBody() {
    const body = vp.querySelector('#apptBody');
    if (state.view === 'calendar') { renderCalendar(body); return; }
    const list = filteredList();
    if (!list.length) { body.innerHTML = emptyStateForTab(); bind(vp); return; }
    body.innerHTML = `<div class="appointment-cards" style="display:grid;gap:12px">${list.map(a => apptCard(a, { role: r, actions: cardActions(a) })).join('')}</div>`;
    bind(vp);
  }

  function emptyStateForTab() {
    const hasFilters = !!(state.q || state.doctor || state.spec || state.date || state.type);
    if (hasFilters) {
      return emptyState('No appointments match', 'Try adjusting your search or filters.', 'search',
        `<button class="btn btn-outline btn-sm mt-12" id="resetFilters">${icon('refresh', 14)} Reset filters</button>`);
    }
    const states = {
      upcoming: {
        title: 'No upcoming appointments', msg: "You haven't scheduled a consultation yet.",
        action: r === 'patient' ? `<button class="btn btn-primary btn-sm mt-12" data-nav="#/scheduling">${icon('calendarPlus', 15)} Schedule an Appointment</button>` : '',
      },
      completed: { title: 'No completed appointments yet.', msg: 'Completed consultations will appear here.', action: '' },
      cancelled: { title: 'No cancelled appointments.', msg: 'Cancelled appointments will appear here.', action: '' },
      rescheduled: { title: 'No rescheduled appointments.', msg: 'Rescheduled appointments will appear here.', action: '' },
    };
    const s = states[state.tab] || { title: 'No appointments here', msg: 'Appointments matching this view will appear here.', action: '' };
    return emptyState(s.title, s.msg, 'calendar', s.action);
  }

  function resetFilters() {
    Object.assign(state, { q: '', doctor: '', spec: '', date: '', type: '' });
    const i = vp.querySelector('#apptSearch'); if (i) i.value = '';
    const sd = vp.querySelector('#fDoctor'); if (sd) sd.value = '';
    const ss = vp.querySelector('#fSpec'); if (ss) ss.value = '';
    const sf = vp.querySelector('#fDate'); if (sf) sf.value = '';
    const st2 = vp.querySelector('#fType'); if (st2) st2.value = '';
    renderBody();
  }

  function cardActions(a) {
    const canManage = ['scheduled', 'confirmed', 'rescheduled'].includes(a.status);
    let html = '';
    if (r === 'doctor') {
      if (['scheduled', 'rescheduled'].includes(a.status)) html += `<button class="btn btn-teal btn-sm" data-accept="${a.id}">${icon('check', 14)} Accept</button>`;
      if (a.status === 'confirmed' && a.queueStatus !== 'completed') html += `<button class="btn btn-soft btn-sm" data-complete="${a.id}">${icon('checkCircle', 14)} Complete</button>`;
      html += `<button class="btn btn-outline btn-sm" data-details="${a.id}">${icon('eye', 14)} Details</button>`;
      if (canManage) html += `<button class="btn btn-outline btn-sm" data-resched="${a.id}">${icon('rotate', 14)} Reschedule</button>`;
    } else {
      html += `<button class="btn btn-outline btn-sm" data-details="${a.id}">${icon('eye', 14)} View Details</button>`;
      if (r === 'patient' && a.status === 'completed') {
        const me = currentUser();
        const rx = getPrescriptions().find(p => p.appointmentId === a.id && p.patientId === (me ? me.userId : ''));
        html += rx
          ? `<button class="btn btn-teal btn-sm" data-rx="${rx.id}">${icon('prescription', 14)} View Prescription</button>`
          : `<button class="btn btn-soft btn-sm" data-rx-none>${icon('prescription', 14)} No prescription</button>`;
      }
      if (canManage) html += `<button class="btn btn-outline btn-sm" data-resched="${a.id}">${icon('rotate', 14)} Reschedule</button>`;
      if (canManage && (r === 'patient' || r === 'admin')) html += `<button class="btn btn-soft-danger btn-sm" data-cancel="${a.id}">${icon('x', 14)} Cancel</button>`;
    }
    return html;
  }

  function renderCalendar(body) {
    const m = state.month;
    const y = m.getFullYear(), mo = m.getMonth();
    const first = new Date(y, mo, 1).getDay();
    const dim = new Date(y, mo + 1, 0).getDate();
    const t = todayISO();
    let html = `
    <div class="card card-pad">
      <div class="cal">
        <div class="cal-head">
          <button class="icon-btn" id="calPrev">${icon('chevLeft', 18)}</button>
          <span class="cal-title">${MONTHS_SHORT[mo]} ${y}</span>
          <button class="icon-btn" id="calNext">${icon('chevRight', 18)}</button>
        </div>
        <div class="cal-grid" style="grid-auto-rows:minmax(86px,auto)">
          ${DAYS_SHORT.map(d => `<div class="cal-dow">${d}</div>`).join('')}
          ${Array.from({ length: first }, () => '<div></div>')}
          ${Array.from({ length: dim }, (_, i) => {
            const day = i + 1;
            const iso = toISO(new Date(y, mo, day));
            const evts = filteredList().filter(a => a.appointmentDate === iso);
            const isToday = iso === t;
            return `<div class="calendar-day ${isToday ? 'today' : ''}">
              <div class="day-num">${day}${isToday ? ' · today' : ''}</div>
              ${evts.slice(0, 3).map(e => `<div class="evt ${e.status === 'cancelled' ? 'cancelled' : ''}" data-day-appt="${e.id}">${fmtTime(e.appointmentTime)} · ${esc(e.patientName)}</div>`).join('')}
              ${evts.length > 3 ? `<small class="text-faint" style="display:block;margin-top:3px;font-size:.62rem">+${evts.length - 3} more</small>` : ''}
            </div>`;
          }).join('')}
        </div>
        <div class="cal-legend">
          <span><span class="sw" style="background:var(--blue-soft);border:1px solid var(--hairline)"></span> ${fmtDate(t, { weekday: true }).split(',')[0]} marked today</span>
        </div>
      </div>
    </div>`;
    body.innerHTML = html;
    body.querySelector('#calPrev').addEventListener('click', () => { state.month = new Date(y, mo - 1, 1); render(); });
    body.querySelector('#calNext').addEventListener('click', () => { state.month = new Date(y, mo + 1, 1); render(); });
    body.querySelectorAll('[data-day-appt]').forEach(el => el.addEventListener('click', () => openDetails(el.dataset.dayAppt)));
  }

  function wire() {
    vp.querySelectorAll('#apptTabs .tab').forEach(t => t.addEventListener('click', () => { state.tab = t.dataset.tab; render(); }));
    vp.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
      state.view = b.dataset.view;
      vp.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('selected', x === b));
      renderBody();
    }));
    const search = vp.querySelector('#apptSearch');
    let deb;
    if (search) search.addEventListener('input', () => {
      clearTimeout(deb);
      deb = setTimeout(() => { state.q = search.value; renderBody(); }, 220);
    });
    const fDoctor = vp.querySelector('#fDoctor');
    if (fDoctor) fDoctor.addEventListener('change', e => { state.doctor = e.target.value; renderBody(); });
    const fSpec = vp.querySelector('#fSpec');
    if (fSpec) fSpec.addEventListener('change', e => { state.spec = e.target.value; renderBody(); });
    const fDate = vp.querySelector('#fDate');
    if (fDate) fDate.addEventListener('change', e => { state.date = e.target.value; renderBody(); });
    const fType = vp.querySelector('#fType');
    if (fType) fType.addEventListener('change', e => { state.type = e.target.value; renderBody(); });
    const fSort = vp.querySelector('#fSort');
    if (fSort) fSort.addEventListener('change', e => { state.sort = e.target.value; renderBody(); });
  }

  function bind() {
    vp.querySelectorAll('[data-details]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); openDetails(b.dataset.details); }));
    vp.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); doCancel(b.dataset.cancel); }));
    vp.querySelectorAll('[data-resched]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); openReschedule(b.dataset.resched); }));
    vp.querySelectorAll('[data-rx]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); navigate(`#/prescriptions?id=${b.dataset.rx}`); }));
    vp.querySelectorAll('[data-rx-none]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); toast('No prescription', 'The doctor has not issued a prescription for this visit.', 'info'); }));
    vp.querySelectorAll('[data-accept]').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation();
      updateAppointment(b.dataset.accept, { status: 'confirmed', queueStatus: 'waiting' });
      addLog({ actor: currentUser()?.name, action: 'Appointment confirmed', details: `ID ${b.dataset.accept}` });
      toast('Appointment confirmed', 'Patient added to today’s queue.', 'success');
      render();
    }));
    vp.querySelectorAll('[data-complete]').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation();
      updateAppointment(b.dataset.complete, { status: 'completed', queueStatus: 'completed' });
      toast('Consultation completed', 'Marked as completed.', 'success');
      render();
    }));
    vp.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.nav)));
    vp.querySelectorAll('.appt-card[data-appt]').forEach(c => c.addEventListener('click', () => openDetails(c.dataset.appt)));
    const rf = vp.querySelector('#resetFilters');
    if (rf) rf.addEventListener('click', resetFilters);
  }

  function renderError() {
    vp.innerHTML = pageHead('My Appointments', 'View and manage your scheduled consultations.') +
      `<div id="apptBodyWrap">${errorState('Unable to load appointments')}<div class="flex" style="justify-content:center;margin-top:14px"><button class="btn btn-primary btn-sm" id="retryAppts">${icon('refresh', 15)} Try Again</button></div></div>`;
    vp.querySelector('#retryAppts').addEventListener('click', () => appointmentsPage(vp, new URLSearchParams('')));
  }
}

async function doCancel(id) {
  const a = getAppointment(id);
  if (!a) return;
  const ok = await new Promise((resolve) => {
    openModal(`
      <div class="modal-head"><h3>Cancel this appointment?</h3><button class="icon-btn" data-close aria-label="Close">${icon('x', 18)}</button></div>
      <div class="modal-body" style="display:grid;gap:12px">
        <p class="text-muted" style="font-size:.85rem">Are you sure you want to cancel this appointment? The slot will be released and the doctor will be notified.</p>
        <div class="booking-sheet" style="margin:0;max-width:none">
          <div class="bs-row"><span class="k">${icon('doctor', 15)} Doctor</span><span class="v">${esc(a.doctorName)}</span></div>
          <div class="bs-row"><span class="k">${icon('calendar', 15)} Date</span><span class="v">${fmtDate(a.appointmentDate, { weekday: true, day: 'numeric', month: 'long' })}</span></div>
          <div class="bs-row"><span class="k">${icon('clock', 15)} Time</span><span class="v">${fmtTime(a.appointmentTime)}</span></div>
          <div class="bs-row"><span class="k">${icon('tag', 15)} Appointment ID</span><span class="v mono">${esc(a.bookingId)}</span></div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-outline btn-sm" data-close>Keep Appointment</button>
        <button class="btn btn-soft-danger btn-sm" id="confirmCancel">${icon('x', 14)} Confirm Cancellation</button>
      </div>`, {
      onMount: (box) => {
        box.querySelector('#confirmCancel').onclick = () => { resolve(true); box._close(); };
        box.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => resolve(false)));
      },
    });
  });
  if (!ok) return;
  cancelAppointment(id);
  addLog({ actor: currentUser()?.name, action: 'Appointment cancelled', details: `${a.doctorName} · ${a.appointmentDate}` });
  toast('Appointment cancelled', 'The doctor has been notified.', 'warning');
  navigate('#/appointments');
}

function openReschedule(id) {
  const a = getAppointment(id);
  if (!a) return;
  const close = openModal(`
    <div class="modal-head"><h3>Reschedule appointment</h3><button class="icon-btn" data-close aria-label="Close">${icon('x', 18)}</button></div>
    <div class="modal-body" style="display:grid;gap:14px">
      <div class="bs-row"><span class="k">${icon('stethoscope', 15)} Doctor</span><span class="v">${esc(a.doctorName)}</span></div>
      <div class="bs-row"><span class="k">${icon('clock', 15)} Current</span><span class="v">${fmtDate(a.appointmentDate, { weekday: true })} · ${fmtTime(a.appointmentTime)}</span></div>
      <div class="field">
        <label>New date <span class="req">*</span></label>
        <input class="input" type="date" id="rsDate" min="${todayISO()}" value="${a.appointmentDate}">
      </div>
      <div class="field">
        <label>New time <span class="req">*</span></label>
        <div class="slots-grid" id="rsSlots"></div>
      </div>
      <div class="review-grid" id="rsReview" style="display:none"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline btn-sm" data-close>Cancel</button>
      <button class="btn btn-primary btn-sm" id="rsConfirm" disabled>${icon('rotate', 15)} Confirm Reschedule</button>
    </div>`, {
    onMount: (box) => {
      let chosen = null;
      const renderSlots = () => {
        const d = box.querySelector('#rsDate').value;
        const g = getAvailability(a.doctorId, d);
        box.querySelector('#rsSlots').innerHTML = g.slots.length
          ? g.slots.map(s => `<button class="slot ${s.time === chosen ? 'selected' : ''}" data-rs-time="${s.time}" type="button">${fmtTime(s.time)}<span class="sub">${s.time === chosen ? 'Selected' : 'Available'}</span></button>`).join('')
          : '<p class="text-faint" style="font-size:.8rem">No free slots on this date.</p>';
        box.querySelectorAll('[data-rs-time]').forEach(b => b.addEventListener('click', () => {
          chosen = b.dataset.rsTime;
          box.querySelectorAll('[data-rs-time]').forEach(x => x.classList.remove('selected'));
          b.classList.add('selected');
          b.querySelector('.sub').textContent = 'Selected';
          box.querySelector('#rsConfirm').disabled = !chosen;
          box.querySelector('#rsReview').innerHTML = `
            <div class="rv-group" style="grid-column:1/-1">
              <h5 class="rv-title">${icon('rotate', 14)} Review changes</h5>
              <div class="rv-row"><span class="k">Current</span><span class="v">${fmtDate(a.appointmentDate, { weekday: true })} · ${fmtTime(a.appointmentTime)}</span></div>
              <div class="rv-row"><span class="k">New</span><span class="v" style="color:var(--success)">${fmtDate(d, { weekday: true })} · ${fmtTime(chosen)}</span></div>
            </div>`;
          box.querySelector('#rsReview').style.display = 'grid';
        }));
        box.querySelector('#rsConfirm').disabled = !chosen;
        box.querySelector('#rsReview').style.display = chosen ? 'grid' : 'none';
      };
      box.querySelector('#rsDate').addEventListener('change', renderSlots);
      renderSlots();
      box.querySelector('#rsConfirm').addEventListener('click', () => {
        const date = box.querySelector('#rsDate').value;
        if (!date) { toast('Pick a date', 'Please choose a new date.', 'error'); return; }
        if (!chosen) { toast('Pick a time', 'Please choose a new time slot.', 'error'); return; }
        if (date === a.appointmentDate && chosen === a.appointmentTime) { toast('No change', 'Pick a different date or time.', 'info'); return; }
        const g = getAvailability(a.doctorId, date);
        if (!g.slots.some(s => s.time === chosen)) { toast('Slot unavailable', 'That time was just taken — pick another slot.', 'error'); renderSlots(); return; }
        rescheduleAppointment(id, date, chosen);
        addLog({ actor: currentUser()?.name, action: 'Appointment rescheduled', details: `${a.doctorName} → ${date} ${chosen}` });
        toast('Appointment rescheduled', `${fmtDate(date)} · ${fmtTime(chosen)}`, 'success');
        close();
        navigate('#/appointments');
      });
    },
  });
}

function openDetails(id) {
  const a = getAppointment(id);
  if (!a) return;
  const doc = getDoctor(a.doctorId) || { name: a.doctorName, specialty: a.specialty, education: '', clinic: '', location: '', color: 0 };
  const pat = getPatient(a.patientId) || null;
  const r = role();
  const canManage = ['scheduled', 'confirmed', 'rescheduled'].includes(a.status);
  const typeLabel = a.type === 'Video' ? 'Online' : a.type;
  const me = currentUser();
  const rx = getPrescriptions().find(p => p.appointmentId === a.id && p.patientId === (me ? me.userId : ''));
  const audit = [
    { icon: 'plus', label: 'Booked', det: `${a.bookingId} · by ${a.patientName}`, time: new Date(a.createdAt).toLocaleString() },
    ...(a.status === 'confirmed' ? [{ icon: 'check', label: 'Confirmed', det: 'Accepted by doctor', time: fmtDate(a.appointmentDate, { weekday: true }) }] : []),
    ...(a.status === 'completed' ? [{ icon: 'checkCircle', label: 'Completed', det: 'Consultation finished', time: fmtDate(a.appointmentDate, { weekday: true }) }] : []),
    ...(a.status === 'cancelled' ? [{ icon: 'x', label: 'Cancelled', det: a.cancelledAt ? `Cancelled on ${fmtDate(a.cancelledAt.slice(0, 10))}` : 'Cancelled', time: fmtDate(a.appointmentDate, { weekday: true }) }] : []),
    ...(a.status === 'rescheduled' ? [{ icon: 'rotate', label: 'Rescheduled', det: 'Moved to a new date & time by patient', time: fmtDate(a.appointmentDate, { weekday: true }) }] : []),
  ];
  openModal(`
    <div class="modal-head"><h3>Appointment details</h3><button class="icon-btn" data-close aria-label="Close">${icon('x', 18)}</button></div>
    <div class="modal-body" style="display:grid;gap:14px">
      <div class="card card-pad" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;background:var(--surface-2)">
        ${doctorAvatar(doc, 'lg')}
        <div style="flex:1;min-width:180px">
          <h4 style="font-family:var(--font-display);font-size:1.05rem;font-weight:700">${esc(a.doctorName)}</h4>
          <div class="row-sub">${esc(doc.specialty)}${doc.education ? ` · ${esc(doc.education)}` : ''}</div>
          <div class="flex gap-8 mt-8">${typeChip(a.type)} ${statusBadge(a.status, a.queueStatus)} ${a.priority === 'emergency' ? `<span class="badge red pulse plain">Emergency</span>` : ''}</div>
        </div>
      </div>
      <div class="review-grid">
        <div class="rv-group">
          <h5 class="rv-title">${icon('calendar', 14)} Appointment</h5>
          <div class="rv-row"><span class="k">Appointment ID</span><span class="v mono">${esc(a.bookingId)}</span></div>
          <div class="rv-row"><span class="k">Date</span><span class="v">${fmtDate(a.appointmentDate, { weekday: true, day: 'numeric', month: 'long' })}</span></div>
          <div class="rv-row"><span class="k">Time</span><span class="v">${fmtTime(a.appointmentTime)} · ${a.duration || 30}m</span></div>
          <div class="rv-row"><span class="k">Consultation type</span><span class="v">${typeLabel}</span></div>
        </div>
        <div class="rv-group">
          <h5 class="rv-title">${icon('doctor', 14)} Doctor</h5>
          <div class="rv-row"><span class="k">Specialization</span><span class="v">${esc(doc.specialty)}</span></div>
          <div class="rv-row"><span class="k">Hospital / Clinic</span><span class="v">${esc(doc.clinic || 'MedCare clinic')}</span></div>
          <div class="rv-row"><span class="k">Location</span><span class="v">${a.type === 'In-clinic' || a.type === 'Phone' ? esc(doc.location || '—') : 'Online — join via link'}</span></div>
          <div class="rv-row"><span class="k">Consultation fee</span><span class="v" style="color:var(--success)">${money(a.fee ?? (doc.fee || 0))}</span></div>
        </div>
        <div class="rv-group">
          <h5 class="rv-title">${icon('user', 14)} Patient</h5>
          <div class="rv-row"><span class="k">Patient name</span><span class="v">${esc(a.patientName)}</span></div>
          ${pat ? `<div class="rv-row"><span class="k">Contact</span><span class="v">${esc(pat.phone || pat.email || '—')}</span></div>` : ''}
          ${pat?.condition ? `<div class="rv-row"><span class="k">Condition</span><span class="v">${esc(pat.condition)}</span></div>` : ''}
          <div class="rv-row"><span class="k">Booked on</span><span class="v">${a.createdAt ? fmtDate(a.createdAt.slice(0, 10)) : '—'}</span></div>
        </div>
        <div class="rv-group">
          <h5 class="rv-title">${icon('note', 14)} Consultation</h5>
          <div class="rv-row"><span class="k">Reason for visit</span><span class="v">${a.notes ? esc(a.notes) : '<span class="text-faint">—</span>'}</span></div>
          <div class="rv-row"><span class="k">Diagnosis</span><span class="v">${a.diagnosis ? esc(a.diagnosis) : '<span class="text-faint">—</span>'}</span></div>
          <div class="rv-row"><span class="k">Prescription</span><span class="v">${rx ? `<a style="color:var(--blue);font-weight:700;cursor:pointer" data-rx-link="${rx.id}">View prescription</a>` : '<span class="text-faint">—</span>'}</span></div>
        </div>
      </div>
      <div>
        <div class="card-title" style="margin-bottom:8px">${icon('activity', 16)} Timeline</div>
        <div class="timeline">
          ${audit.map(ev => `
          <div class="tl-item" style="padding-bottom:12px">
            <span class="tl-dot green">${icon(ev.icon, 10)}</span>
            <div class="tl-card" style="padding:12px 14px;box-shadow:none">
              <div class="flex" style="justify-content:space-between;align-items:center"><b style="font-size:.82rem">${esc(ev.label)}</b><span class="tl-date">${esc(ev.time)}</span></div>
              <div class="row-sub">${esc(ev.det)}</div>
            </div>
          </div>`).join('')}
        </div>
      </div>
      <div class="policy-grid">
        <div class="policy-box">
          <b>${icon('x', 14)} Cancellation policy</b>
          <p>You can cancel an upcoming appointment any time before the scheduled time. Cancelled slots are released immediately and the doctor is notified. A cancellation cannot be undone.</p>
        </div>
        <div class="policy-box">
          <b>${icon('rotate', 14)} Rescheduling</b>
          <p>Upcoming appointments can be rescheduled to any available slot. The old slot is released and the doctor is notified about the new time automatically.</p>
        </div>
      </div>
      <div class="flex gap-10" style="flex-wrap:wrap">
        ${canManage && r === 'patient' ? `<button class="btn btn-outline" id="detResched">${icon('rotate', 16)} Reschedule</button>` : ''}
        ${canManage && r === 'patient' ? `<button class="btn btn-soft-danger" id="detCancel">${icon('x', 16)} Cancel appointment</button>` : ''}
        ${r === 'doctor' && ['scheduled', 'rescheduled'].includes(a.status) ? `<button class="btn btn-teal" id="detAccept">${icon('check', 16)} Accept</button>` : ''}
        ${r === 'doctor' && a.status === 'confirmed' ? `<button class="btn btn-soft" id="detComplete">${icon('checkCircle', 16)} Complete</button>` : ''}
        ${r === 'patient' && a.status === 'completed' ? `<button class="btn btn-teal" id="detRx">${icon('prescription', 16)} View Prescription</button>` : ''}
        <button class="btn btn-primary" id="detMsg">${icon('chat', 16)} Message</button>
      </div>
    </div>`, {
    onMount: (box) => {
      const close = () => { box._close(); };
      const m = box.querySelector('#detMsg');
      if (m) m.addEventListener('click', () => { close(); navigate('#/messages'); });
      const rs = box.querySelector('#detResched');
      if (rs) rs.addEventListener('click', () => { close(); openReschedule(id); });
      const cn = box.querySelector('#detCancel');
      if (cn) cn.addEventListener('click', async () => { close(); await doCancel(id); });
      const rxLink = box.querySelector('[data-rx-link], #detRx');
      if (rxLink) rxLink.addEventListener('click', () => { close(); navigate(`#/prescriptions?id=${rxLink.dataset.rxLink || rx.id}`); });
      const acc = box.querySelector('#detAccept');
      if (acc) acc.addEventListener('click', () => {
        updateAppointment(id, { status: 'confirmed', queueStatus: 'waiting' });
        toast('Appointment confirmed', 'Added to the queue.', 'success');
        close(); renderAll();
      });
      const comp = box.querySelector('#detComplete');
      if (comp) comp.addEventListener('click', () => {
        updateAppointment(id, { status: 'completed', queueStatus: 'completed' });
        toast('Consultation completed', 'Visit marked complete.', 'success');
        close(); renderAll();
      });
    },
  });
}

function renderAll() { navigate('#/appointments'); }

export function initAppointments() {
  registerPage('appointments', appointmentsPage);
}
