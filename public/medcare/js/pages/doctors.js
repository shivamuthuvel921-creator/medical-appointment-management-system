// ─────────────────────────────────────────────────────────────
// Doctors — Find (patient), Booking wizard (patient), Manage (admin)
// ─────────────────────────────────────────────────────────────
import { icon, esc, toast, openModal, confirmDialog, money, confetti, fmtTime, fmtDate, todayISO, toISO, fromISO } from '../core.js';
import { getDoctors, getDoctor, addDoctor, updateDoctor, removeDoctor, addLog, currentUser, getAvailability, getAppointments, addAppointment, bookAppointment, pushNotification, setOffDay, removeOffDay } from '../store.js';
import { registerPage, navigate } from '../router.js';
import { pageHead, doctorAvatar, statusBadge } from './shared.js';

const WSTEPS = [
  { id: 'doc', label: 'Doctor' },
  { id: 'date', label: 'Date' },
  { id: 'time', label: 'Time' },
  { id: 'details', label: 'Details' },
  { id: 'review', label: 'Review' },
  { id: 'confirm', label: 'Confirm' },
];

// ─────────────────────────────────────────────────────────────
// FIND DOCTORS (patient)
// ─────────────────────────────────────────────────────────────
function findPage(vp, params) {
  if (params?.get('doc')) return bookingPage(vp, params);

  const specs = [...new Set(getDoctors().map(d => d.specialty))].sort();
  const locs = [...new Set(getDoctors().map(d => d.location))].filter(Boolean).sort();

  vp.innerHTML = `
  ${pageHead('Find doctors', 'Search the directory by specialty, clinic or location and book a consultation in minutes.')}
  <div class="card card-pad" style="margin-bottom:18px;display:grid;gap:12px">
    <div class="input-icon">
      ${icon('search', 16)}<input class="input" id="docSearch" placeholder="Search doctors, specialties or clinics…">
    </div>
    <div class="filter-bar">
      <div class="field" style="margin:0"><label>Specialty</label>
        <select class="input select" id="fSpec"><option value="">All specialties</option>${specs.map(s => `<option>${esc(s)}</option>`).join('')}</select>
      </div>
      <div class="field" style="margin:0"><label>Location</label>
        <select class="input select" id="fLoc"><option value="">All locations</option>${locs.map(l => `<option>${esc(l)}</option>`).join('')}</select>
      </div>
      <div class="field" style="margin:0"><label>Availability</label>
        <select class="input select" id="fAvail"><option value="">Any time</option><option value="today">Available today</option><option value="soon">Available this week</option></select>
      </div>
      <button class="btn btn-ghost" id="fReset" style="align-self:end">${icon('refresh', 14)} Reset</button>
    </div>
  </div>
  <p class="text-faint" style="font-size:.8rem;margin-bottom:12px" id="docCount"></p>
  <div class="doc-grid" id="docGrid"></div>`;

  const qEl = vp.querySelector('#docSearch');
  const grid = vp.querySelector('#docGrid');
  const count = vp.querySelector('#docCount');

  const state = { q: '', spec: '', loc: '', avail: '' };
  const setInputs = () => { qEl.value = state.q; vp.querySelector('#fSpec').value = state.spec; vp.querySelector('#fLoc').value = state.loc; vp.querySelector('#fAvail').value = state.avail; };
  const apply = () => {
    const q = state.q.toLowerCase();
    const weekAhead = toISO(new Date(Date.now() + 6 * 864e5));
    const list = getDoctors().filter(d => {
      if (state.spec && d.specialty !== state.spec) return false;
      if (state.loc && d.location !== state.loc) return false;
      if (state.avail === 'today' && !d.availableToday) return false;
      if (state.avail === 'soon' && !d.availableToday && !getAvailability(d.id, todayISO()).slots.length) return false;
      if (q && !(d.name + d.specialty + d.clinic + (d.location || '')).toLowerCase().includes(q)) return false;
      return true;
    });
    count.textContent = `${list.length} doctor${list.length === 1 ? '' : 's'} found`;
    grid.innerHTML = list.map(d => docCard(d, true)).join('') || `<div class="empty"><div class="e-ic">${icon('stethoscope', 30)}</div><h4>No doctors match</h4><p>Try adjusting your search or filters.</p></div>`;
    grid.querySelectorAll('[data-book]').forEach(b => b.addEventListener('click', () => navigate(`#/scheduling?doc=${b.dataset.book}`)));
  };

  qEl.addEventListener('input', () => { state.q = qEl.value; apply(); });
  vp.querySelector('#fSpec').addEventListener('change', e => { state.spec = e.target.value; apply(); });
  vp.querySelector('#fLoc').addEventListener('change', e => { state.loc = e.target.value; apply(); });
  vp.querySelector('#fAvail').addEventListener('change', e => { state.avail = e.target.value; apply(); });
  vp.querySelector('#fReset').addEventListener('click', () => { Object.assign(state, { q: '', spec: '', loc: '', avail: '' }); setInputs(); apply(); });
  apply();
}

function docCard(d, interactive = true) {
  const next = getAvailability(d.id, todayISO()).nextFree;
  return `
  <div class="doc-card" data-doc="${d.id}">
    <div class="doc-card-top">
      ${doctorAvatar(d, 'lg')}
      <div style="flex:1;min-width:0">
        <div class="doc-name">${esc(d.name)}</div>
        <div class="doc-spec" style="margin-top:3px">${esc(d.specialty)}</div>
        <div class="rating-stars" style="margin-top:6px">${icon('star', 13)} ${d.rating}<span class="n">(${d.reviews} reviews)</span></div>
      </div>
    </div>
    <div class="doc-card-body">
      <div class="doc-facts">
        <span class="fact">${icon('award', 14)} ${esc(d.experience)}</span>
        <span class="fact">${icon('mapPin', 14)} ${esc(d.clinic)}${d.location ? `, ${esc(d.location)}` : ''}</span>
      </div>
      <div class="doc-avail ${d.availableToday ? '' : 'no'}">
        <span class="ind"></span>${d.availableToday ? `Available today · next slot ${fmtTime(next)}` : next ? `Next free ${fmtTime(next)}` : 'Not available today'}
      </div>
    </div>
    <div class="doc-card-foot">
      <b class="doc-fee">${money(d.fee)}</b>
      <button class="btn btn-primary btn-sm" data-book="${d.id}">${icon('calendarPlus', 14)} Book</button>
    </div>
  </div>`;
}

// ─────────────────────────────────────────────────────────────
// BOOKING WIZARD (patient)
// ─────────────────────────────────────────────────────────────
function bookingPage(vp, params) {
  const preDoc = params?.get('doc') && getDoctor(params.get('doc')) ? params.get('doc') : null;
  const st = { doctorId: preDoc, date: null, time: null, type: null, reason: '', notes: '', q: '', cursor: new Date() };
  let step = 0;

  const canNext = () => (step === 0 && st.doctorId) || (step === 1 && st.date) || (step === 2 && st.time) || (step === 3 && st.type) || step === 4 || step === 5;

  function stepper() {
    return `<div class="wizard">${WSTEPS.map((s, i) => `
      <div class="w-step ${i === step ? 'active' : i < step ? 'done' : ''}">
        <span class="w-num">${i < step ? icon('check', 13) : i + 1}</span>
        <span class="w-label">${s.label}</span>
      </div>`).join('')}</div>`;
  }

  function nav() {
    return `
    <div class="flex" style="justify-content:space-between;gap:10px;margin-top:24px">
      <button class="btn btn-outline" id="bkBack" ${step === 0 ? 'disabled' : ''}>${icon('chevLeft', 15)} Back</button>
      ${step < 5 ? `<button class="btn btn-primary" id="bkNext" ${canNext() ? '' : 'disabled'}>Next ${icon('chevRight', 15)}</button>`
        : `<button class="btn btn-primary" id="bkNext" ${canNext() ? '' : 'disabled'}>${icon('checkCircle', 15)} Confirm Appointment</button>`}
    </div>`;
  }

  function render() {
    vp.innerHTML = pageHead('My Scheduling', 'Schedule a consultation with a doctor at a time that works for you.') + stepper();
    const box = document.createElement('div');
    box.className = 'card card-pad';
    box.style.maxWidth = '760px';
    box.style.margin = '0 auto';

    if (step === 0) {
      renderDocStep(box);
    } else if (step === 1) {
      box.innerHTML = stepDate();
      wireDate(box);
    } else if (step === 2) {
      box.innerHTML = stepTime();
      box.querySelectorAll('.slot:not(:disabled)').forEach(s => s.addEventListener('click', () => {
        st.time = s.dataset.time;
        render();
      }));
    } else if (step === 3) {
      box.innerHTML = stepDetails();
      box.querySelectorAll('#bkTypeWrap .chip-opt').forEach(c => c.addEventListener('click', () => {
        st.type = c.dataset.type;
        render();
      }));
      box.querySelector('#bkReason').addEventListener('input', e => { st.reason = e.target.value; });
      box.querySelector('#bkNotes').addEventListener('input', e => { st.notes = e.target.value; });
    } else {
      box.innerHTML = step === 4
        ? `<p class="stepper-hint" style="margin-bottom:16px">${icon('checkCircle', 18)} Review your appointment details. You can go <b>Back</b> at any time to change something.</p>` + reviewCard()
        : `<p class="stepper-hint" style="margin-bottom:16px">${icon('checkCircle', 18)} Ready? Press <b>Confirm Appointment</b> below — nothing is booked until you do.</p>` + reviewCard();
    }

    vp.appendChild(box);
    const wrap = document.createElement('div');
    wrap.innerHTML = nav();
    vp.appendChild(wrap);
    vp.querySelector('#bkBack').addEventListener('click', () => { step--; render(); });
    if (step < 5) {
      vp.querySelector('#bkNext').addEventListener('click', () => { step++; render(); });
    } else {
      vp.querySelector('#bkNext').addEventListener('click', doBooking);
    }
  }

  function renderDocStep(box) {
    const pre = preDoc ? getDoctor(preDoc) : null;
    const q = st.q.toLowerCase();
    const list = getDoctors().filter(d => !q || (d.name + ' ' + d.specialty + ' ' + d.clinic + ' ' + d.education).toLowerCase().includes(q));
    box.innerHTML = `
    <p class="stepper-hint" style="margin-bottom:16px">${icon('stethoscope', 18)} STEP 1 — choose your doctor${pre ? ` — you selected <b>${esc(pre.name)}</b>; you can pick a different one below.` : '.'}</p>
    <div class="input-icon" style="margin-bottom:14px">${icon('search', 16)}<input class="input" id="bkDocSearch" placeholder="Search by doctor name, specialization or clinic..." value="${esc(st.q)}"></div>
    <div class="doc-grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">
      ${list.map(d => docCardInner(d)).join('') || `<div class="empty" style="grid-column:1/-1"><div class="e-ic">${icon('search', 30)}</div><h4>No doctors match</h4><p>Try a different search term.</p></div>`}
    </div>`;
    box.querySelector('#bkDocSearch').addEventListener('input', e => { st.q = e.target.value; renderDocStep(box); });
    box.querySelectorAll('.doc-card').forEach(c => c.addEventListener('click', () => {
      st.doctorId = c.dataset.doc;
      box.querySelectorAll('.doc-card').forEach(x => x.classList.remove('selected-doc'));
      c.classList.add('selected-doc');
      vp.querySelector('#bkNext').disabled = !canNext();
    }));
    box.querySelectorAll('[data-select-doc]').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation();
      st.doctorId = b.dataset.selectDoc;
      step++;
      render();
    }));
    box.querySelectorAll('[data-profile]').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation();
      doctorProfileModal(b.dataset.profile);
    }));
  }

  function docCardInner(d) {
    const next = getAvailability(d.id, todayISO()).nextFree;
    return `
    <div class="doc-card ${st.doctorId === d.id ? 'selected-doc' : ''}" data-doc="${d.id}" style="cursor:pointer">
      <div class="doc-card-top">
        ${doctorAvatar(d, 'lg')}
        <div style="flex:1;min-width:0">
          <div class="doc-name">${esc(d.name)}</div>
          <div class="doc-spec" style="margin-top:3px">${esc(d.specialty)}</div>
          <div class="doc-qual">${esc(d.education || '')}</div>
          <div class="doc-facts" style="margin-top:6px">
            <span class="fact">${icon('award', 13)} ${esc(d.experience)}</span>
            <span class="fact">${icon('mapPin', 13)} ${esc(d.clinic)}</span>
          </div>
        </div>
      </div>
      <div class="doc-card-meta">
        <span class="rating-stars">${icon('star', 13)} ${d.rating}<span class="n">(${d.reviews} reviews)</span></span>
        <b class="doc-fee">${money(d.fee)}</b>
      </div>
      <div class="doc-avail ${d.availableToday ? '' : 'no'}">
        <span class="ind"></span>${d.availableToday ? `Available today · next slot ${fmtTime(next)}` : next ? `Next free ${fmtTime(next)}` : 'Not available today'}
      </div>
      <div class="doc-card-foot">
        <button class="btn btn-outline btn-sm" data-profile="${d.id}">${icon('user', 14)} View Profile</button>
        <button class="btn btn-primary btn-sm" data-select-doc="${d.id}">${icon('calendarPlus', 14)} Select Doctor</button>
      </div>
    </div>`;
  }

  function doctorProfileModal(docId) {
    const d = getDoctor(docId);
    if (!d) return;
    const next = getAvailability(d.id, todayISO()).nextFree;
    openModal(`
    <div class="modal-head"><h3>Doctor profile</h3><button class="icon-btn" data-close aria-label="Close">${icon('x', 18)}</button></div>
    <div class="modal-body" style="display:grid;gap:16px">
      <div class="flex" style="gap:14px;align-items:center;flex-wrap:wrap">
        ${doctorAvatar(d, 'lg')}
        <div style="flex:1;min-width:200px">
          <h4 style="font-family:var(--font-display);font-size:1.05rem;font-weight:700">${esc(d.name)}</h4>
          <div class="row-sub">${esc(d.specialty)} · ${esc(d.experience)}</div>
          <div class="flex gap-8 mt-8" style="flex-wrap:wrap">
            <span class="rating-stars">${icon('star', 13)} ${d.rating}<span class="n">(${d.reviews} reviews)</span></span>
            <span class="badge ${d.availableToday ? 'green' : 'amber'} plain">${d.availableToday ? 'Available today' : 'Unavailable'}</span>
          </div>
        </div>
      </div>
      <div class="booking-sheet">
        <div class="bs-row"><span class="k">${icon('award', 15)} Qualification</span><span class="v">${esc(d.education || '—')}</span></div>
        <div class="bs-row"><span class="k">${icon('mapPin', 15)} Hospital / Clinic</span><span class="v">${esc(d.clinic)}${d.location ? `, ${esc(d.location)}` : ''}</span></div>
        <div class="bs-row"><span class="k">${icon('dollar', 15)} Consultation fee</span><span class="v" style="color:var(--success)">${money(d.fee)}</span></div>
        <div class="bs-row"><span class="k">${icon('globe', 15)} Languages</span><span class="v">${esc(d.languages || '—')}</span></div>
        <div class="bs-row"><span class="k">${icon('clock', 15)} Next free slot</span><span class="v">${next ? fmtTime(next) : 'Not available today'}</span></div>
      </div>
      ${d.bio ? `<div class="stepper-hint" style="margin:0">${icon('note', 16)} <b>About:</b> ${esc(d.bio)}</div>` : ''}
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline btn-sm" data-close>Close</button>
      <button class="btn btn-primary btn-sm" id="dpSelect">${icon('calendarPlus', 15)} Select this doctor</button>
    </div>`, {
      onMount: (box) => {
        box.querySelector('#dpSelect').addEventListener('click', () => {
          st.doctorId = docId;
          box._close();
          render();
        });
      },
    });
  }

  function calGrid() {
    const doc = getDoctor(st.doctorId);
    const y = st.cursor.getFullYear(), m = st.cursor.getMonth();
    const firstDow = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const today = todayISO();
    const maxISO = toISO(new Date(Date.now() + 90 * 864e5));
    const hasAvail = iso => doc && getAvailability(doc.id, iso).slots.length > 0;
    const isHoliday = iso => doc && (doc.offDays || []).includes(iso);
    const worksOn = iso => doc && doc.slots.some(s => s.dayOfWeek === fromISO(iso).getDay());
    let cells = '';
    for (let i = 0; i < firstDow; i++) cells += '<div></div>';
    for (let d = 1; d <= days; d++) {
      const iso = toISO(new Date(y, m, d));
      const past = iso < today, ahead = iso > maxISO;
      const holiday = !past && !ahead && isHoliday(iso);
      const free = !past && !ahead && !holiday && hasAvail(iso);
      const cls = [past || ahead ? 'dim' : '', holiday ? 'holiday' : '', free ? 'has-dot' : '', iso === today ? 'today' : '', iso === st.date ? 'selected' : '', !past && !ahead && !holiday && worksOn(iso) && !hasAvail(iso) ? 'full' : ''].filter(Boolean).join(' ');
      cells += `<button class="cal-cell ${cls}" data-iso="${iso}" ${past || ahead || holiday || !free ? 'disabled' : ''} ${holiday ? 'title="Holiday / leave"' : ''}>${d}</button>`;
    }
    const title = st.cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const canPrev = st.cursor.getFullYear() * 12 + st.cursor.getMonth() > new Date().getFullYear() * 12 + new Date().getMonth();
    return `
    <div class="cal">
      <div class="cal-head">
        <h3 class="cal-title">${title}</h3>
        <div class="cal-nav">
          <button class="icon-btn" id="calPrev" ${canPrev ? '' : 'disabled'}>${icon('chevLeft', 16)}</button>
          <button class="icon-btn" id="calNext">${icon('chevRight', 16)}</button>
        </div>
      </div>
      <div class="cal-grid">
        ${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => `<div class="cal-dow">${d}</div>`).join('')}
        ${cells}
      </div>
      <div class="cal-legend">
        <span><span class="sw" style="background:var(--teal)"></span> Available</span>
        <span><span class="sw" style="background:var(--surface-3)"></span> Fully booked</span>
        <span><span class="sw" style="background:repeating-linear-gradient(-45deg,var(--warning) 0 3px,transparent 3px 6px)"></span> Holiday / leave</span>
        <span><span class="sw" style="background:var(--hairline-2)"></span> Unavailable</span>
      </div>
    </div>`;
  }

  function stepDate() {
    return `<p class="stepper-hint" style="margin-bottom:16px">${icon('calendar', 18)} STEP 2 — pick a day for your visit with <b>${esc(getDoctor(st.doctorId)?.name)}</b>. Only days with free slots can be selected.</p><div id="calWrap">${calGrid()}</div>`;
  }

  function wireDate(box) {
    const wire = () => {
      box.querySelector('#calWrap').innerHTML = calGrid();
      box.querySelector('#calPrev').addEventListener('click', () => { st.cursor = new Date(st.cursor.getFullYear(), st.cursor.getMonth() - 1, 1); wire(); });
      box.querySelector('#calNext').addEventListener('click', () => { st.cursor = new Date(st.cursor.getFullYear(), st.cursor.getMonth() + 1, 1); wire(); });
      box.querySelectorAll('.cal-cell:not(.dim):not([disabled])').forEach(c => c.addEventListener('click', () => {
        st.date = c.dataset.iso;
        box.querySelectorAll('.cal-cell').forEach(x => x.classList.remove('selected'));
        c.classList.add('selected');
        vp.querySelector('#bkNext').disabled = !canNext();
      }));
    };
    wire();
  }

  function stepTime() {
    const av = getAvailability(st.doctorId, st.date);
    const doc = getDoctor(st.doctorId);
    const taken = new Set(getAppointments()
      .filter(a => a.doctorId === st.doctorId && a.appointmentDate === st.date && ['scheduled', 'confirmed', 'rescheduled'].includes(a.status))
      .map(a => a.appointmentTime));
    (doc.blocked || []).filter(b => b.date === st.date).forEach(b => taken.add(b.time));
    if (!av.slots.length && !taken.size) return `<p class="stepper-hint" style="margin-bottom:16px">${icon('clock', 18)} STEP 3 — no slots open for <b>${fmtDate(st.date, { weekday: true, day: 'numeric', month: 'long' })}</b>.</p>
      <div class="empty"><div class="e-ic">${icon('calendarX', 30)}</div><h4>Fully booked</h4><p>Try another day on the previous step.</p></div>`;
    const all = [...new Set([...av.slots.map(s => s.time), ...taken])].sort();
    const slotBtn = (time) => {
      if (taken.has(time)) return `<button class="slot booked" disabled data-time="${time}" title="Booked">${fmtTime(time)}<span class="sub">Booked</span></button>`;
      const sel = st.time === time;
      return `<button class="slot ${sel ? 'selected' : ''}" data-time="${time}" title="${sel ? 'Selected' : 'Available'}">${fmtTime(time)}<span class="sub">${sel ? 'Selected' : 'Available'}</span></button>`;
    };
    return `<p class="stepper-hint" style="margin-bottom:16px">${icon('clock', 18)} STEP 3 — available slots for <b>${fmtDate(st.date, { weekday: true, day: 'numeric', month: 'long' })}</b>. Select a time to continue.</p>
    <div class="slots-grid">${all.map(slotBtn).join('')}</div>
    <p class="slots-legend">${icon('info', 13)} Slots shown in <b>gray with a strikethrough are already booked</b> — choose a highlighted slot.</p>`;
  }

  function stepDetails() {
    const d = getDoctor(st.doctorId);
    const defs = [
      { key: 'In-clinic', label: 'In-Clinic', ic: 'briefcase', sub: `Visit ${esc(d.clinic)}` },
      { key: 'Video', label: 'Online', ic: 'video', sub: 'Secure video call from home' },
    ];
    return `<p class="stepper-hint" style="margin-bottom:16px">${icon('video', 18)} STEP 4 — how would you like to consult <b>${esc(d.name)}</b>?</p>
    <div class="chip-select" id="bkTypeWrap">${defs.map(x => `
      <button class="chip-opt ${st.type === x.key ? 'selected' : ''}" data-type="${x.key}" style="display:grid;gap:6px;text-align:left;flex:1;min-width:150px">
        <span style="display:inline-flex;align-items:center;gap:8px;font-weight:700">${icon(x.ic, 16)} ${x.label}</span>
        <span style="font-size:.72rem;color:var(--faint)">${money(d.fee)} · ${x.sub}</span>
      </button>`).join('')}</div>
    <div class="form-grid" style="margin-top:20px">
      <div class="field full">
        <label for="bkReason">Reason for visit <span class="req-soft">(optional)</span></label>
        <input class="input" id="bkReason" maxlength="200" placeholder="e.g. Persistent headache and fever for the last 3 days" value="${esc(st.reason)}">
      </div>
      <div class="field full">
        <label for="bkNotes">Optional notes <span class="req-soft">(optional)</span></label>
        <textarea class="input" id="bkNotes" rows="3" maxlength="500" placeholder="Anything else the doctor should know..." style="resize:vertical">${esc(st.notes)}</textarea>
      </div>
    </div>`;
  }

  function reviewCard() {
    const d = getDoctor(st.doctorId);
    const typeLabel = st.type === 'Video' ? 'Online' : 'In-Clinic';
    return `
    <div class="review-grid">
      <div class="rv-group">
        <h5 class="rv-title">${icon('doctor', 15)} Doctor</h5>
        <div class="rv-row"><span class="k">Doctor</span><span class="v">${esc(d.name)}</span></div>
        <div class="rv-row"><span class="k">Specialization</span><span class="v">${esc(d.specialty)}</span></div>
      </div>
      <div class="rv-group">
        <h5 class="rv-title">${icon('calendar', 15)} Appointment</h5>
        <div class="rv-row"><span class="k">Date</span><span class="v">${fmtDate(st.date, { weekday: true, day: 'numeric', month: 'long' })}</span></div>
        <div class="rv-row"><span class="k">Time</span><span class="v">${fmtTime(st.time)} – ${fmtTime(addMins(st.time, 30))}</span></div>
        <div class="rv-row"><span class="k">Consultation type</span><span class="v">${typeLabel}</span></div>
      </div>
      <div class="rv-group">
        <h5 class="rv-title">${icon('note', 15)} Visit details</h5>
        <div class="rv-row"><span class="k">Reason for visit</span><span class="v">${st.reason?.trim() ? esc(st.reason.trim()) : '<span class="text-faint">—</span>'}</span></div>
        <div class="rv-row"><span class="k">Optional notes</span><span class="v">${st.notes?.trim() ? esc(st.notes.trim()) : '<span class="text-faint">—</span>'}</span></div>
      </div>
      <div class="rv-group">
        <h5 class="rv-title">${icon('dollar', 15)} Payment</h5>
        <div class="rv-row"><span class="k">Patient name</span><span class="v">${esc(currentUser()?.name || 'Patient')}</span></div>
        <div class="rv-row"><span class="k">Consultation fee</span><span class="v" style="color:var(--success)">${money(d.fee)}</span></div>
      </div>
    </div>`;
  }

  async function doBooking() {
    const renderFail = (msg) => {
      vp.innerHTML = pageHead('My Scheduling', 'Schedule a consultation with a doctor at a time that works for you.') + `
      <div class="card card-pad" style="max-width:560px;margin:0 auto;text-align:center">
        <div class="e-ic" style="margin:8px auto 14px;background:var(--error-bg);color:var(--error);width:80px;height:80px;border-radius:24px;display:grid;place-items:center">${icon('xCircle', 36)}</div>
        <h3 style="font-family:var(--font-display);font-size:1.15rem">Appointment could not be scheduled</h3>
        <p class="text-faint" style="font-size:.85rem;margin:8px 0 18px">${esc(msg)}</p>
        <div class="flex" style="justify-content:center;gap:10px;flex-wrap:wrap">
          <button class="btn btn-outline" id="bkFailBack">${icon('chevLeft', 15)} Back to review</button>
          <button class="btn btn-primary" id="bkFailRetry">${icon('clock', 15)} Pick another time</button>
        </div>
      </div>`;
      vp.querySelector('#bkFailBack').addEventListener('click', () => { step = 4; render(); });
      vp.querySelector('#bkFailRetry').addEventListener('click', () => { step = 2; render(); });
    };

    const d = getDoctor(st.doctorId);
    if (!d || !st.date || !st.time || !st.type) return renderFail('Some appointment details are missing — please complete every step before confirming.');
    const av = getAvailability(d.id, st.date);
    if (!av.slots.some(s => s.time === st.time)) return renderFail(`${fmtDate(st.date, { weekday: true })} at ${fmtTime(st.time)} is no longer available. Please choose another time.`);
    const taken = getAppointments().some(a => a.doctorId === d.id && a.appointmentDate === st.date && a.appointmentTime === st.time && ['scheduled', 'confirmed', 'rescheduled'].includes(a.status));
    if (taken) return renderFail('This slot was just booked by someone else. Please pick another time to avoid a double booking.');
    const reason = st.reason?.trim() || '';
    const notes = st.notes?.trim() || '';
    const note = [reason, notes].filter(Boolean).join(' · ') || `${st.type === 'Video' ? 'Online' : 'In-Clinic'} appointment booked online`;
    const res = await bookAppointment({
      doctorId: d.id, doctorName: d.name, specialty: d.specialty,
      appointmentDate: st.date, appointmentTime: st.time,
      type: st.type, fee: d.fee, status: 'scheduled',
      patientName: currentUser()?.name || 'Patient',
      notes: note,
    });
    if (!res.ok) {
      if (res.status === 409) renderFail('That slot was just booked — please pick another time.');
      else renderFail(res.error);
      return;
    }
    pushNotification({ type: 'booking', title: 'Appointment booked', message: `Your ${st.type === 'Video' ? 'online' : 'in-clinic'} appointment with ${d.name} on ${fmtDate(st.date)} at ${fmtTime(st.time)} is scheduled.` });
    addLog({ actor: currentUser()?.name, action: 'Appointment booked', details: `${d.name} · ${st.date} ${st.time}` });
    confetti();
    showSuccess(res.appointment);
  }

  function showSuccess(appt) {
    const typeLabel = appt.type === 'Video' ? 'Online' : 'In-Clinic';
    vp.innerHTML = pageHead('My Scheduling', 'Schedule a consultation with a doctor at a time that works for you.') + `
    <div class="card card-pad" style="max-width:600px;margin:0 auto">
      <div style="text-align:center">
        <div class="e-ic" style="margin:8px auto 14px;background:var(--success-bg);color:var(--success);width:88px;height:88px;border-radius:26px;display:grid;place-items:center">${icon('checkCircle', 40)}</div>
        <h3 style="font-family:var(--font-display);font-size:1.25rem">Appointment scheduled successfully</h3>
        <p class="text-faint" style="font-size:.85rem;margin:8px 0 18px">Your appointment request has been sent to the clinic. You'll be notified once the doctor responds.</p>
      </div>
      <div class="booking-sheet">
        <div class="bs-row"><span class="k">${icon('tag', 15)} Appointment ID</span><span class="v mono">${esc(appt.bookingId)}</span></div>
        <div class="bs-row"><span class="k">${icon('doctor', 15)} Doctor</span><span class="v">${esc(appt.doctorName)}</span></div>
        <div class="bs-row"><span class="k">${icon('stethoscope', 15)} Specialization</span><span class="v">${esc(appt.specialty)}</span></div>
        <div class="bs-row"><span class="k">${icon('calendar', 15)} Date</span><span class="v">${fmtDate(appt.appointmentDate, { weekday: true, day: 'numeric', month: 'long' })}</span></div>
        <div class="bs-row"><span class="k">${icon('clock', 15)} Time</span><span class="v">${fmtTime(appt.appointmentTime)}</span></div>
        <div class="bs-row"><span class="k">${icon('video', 15)} Consultation</span><span class="v">${typeLabel}</span></div>
        <div class="bs-row"><span class="k">${icon('activity', 15)} Status</span><span class="v">${statusBadge(appt.status, appt.queueStatus)}</span></div>
      </div>
      <div class="flex" style="justify-content:center;gap:10px;margin-top:22px;flex-wrap:wrap">
        <button class="btn btn-primary" id="bkView">${icon('calendar', 15)} View My Appointment</button>
        <button class="btn btn-outline" id="bkAnother">${icon('calendarPlus', 15)} Schedule Another Appointment</button>
      </div>
    </div>`;
    vp.querySelector('#bkView').addEventListener('click', () => navigate(`#/appointments?id=${appt.id}`));
    vp.querySelector('#bkAnother').addEventListener('click', () => {
      Object.assign(st, { doctorId: null, date: null, time: null, type: null, reason: '', notes: '', q: '', cursor: new Date() });
      step = 0;
      render();
    });
  }

  render();
}

function addMins(time, mins) {
  const [h, m] = time.split(':').map(Number);
  const t = h * 60 + m + mins;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────
// DOCTOR DIRECTORY (admin)
// ─────────────────────────────────────────────────────────────
function doctorsPage(vp) {
  const list = getDoctors();

  vp.innerHTML = `
  ${pageHead('Doctors', 'Manage the specialist directory, availability and fees.', `<button class="btn btn-primary" id="addDoc">${icon('plus', 16)} Add doctor</button>`)}
  <div class="grid" style="gap:16px">${list.map(d => doctorCard(d)).join('')}</div>`;

  vp.querySelector('#addDoc').addEventListener('click', addDoctorModal);
  vp.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => editDoctorModal(b.dataset.edit)));
  vp.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    const d = getDoctor(b.dataset.del);
    if (!d) return;
    const ok = await confirmDialog({ title: 'Remove doctor?', message: `Remove ${d.name} from the directory? Their appointments are preserved.`, confirmText: 'Yes, remove' });
    if (!ok) return;
    removeDoctor(d.id);
    addLog({ actor: currentUser()?.name, action: 'Doctor removed', details: d.name });
    toast('Doctor removed', d.name, 'warning');
    doctorsPage(vp);
  }));
  vp.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => {
    const d = getDoctor(b.dataset.toggle);
    if (!d) return;
    const t = todayISO();
    if (d.availableToday) {
      setOffDay(d.id, t);
      toast(`${d.name} marked unavailable today.`, '', 'info');
    } else {
      removeOffDay(d.id, t);
      toast(`${d.name} is now available.`, '', 'info');
    }
    doctorsPage(vp);
  }));
}

function doctorCard(d) {
  return `
  <div class="card card-pad doctor-card" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
    ${doctorAvatar(d, 'lg')}
    <div style="flex:1;min-width:180px">
      <h4 style="font-family:var(--font-display);font-size:1rem;font-weight:700">${esc(d.name)}</h4>
      <div class="row-sub">${esc(d.specialty)} · ${esc(d.experience)} · ${esc(d.clinic)}</div>
      <div class="flex gap-8 mt-8" style="flex-wrap:wrap">
        <span class="rating-stars">${icon('star', 13)} ${d.rating}</span>
        <span class="text-faint" style="font-size:.74rem">${d.reviews} reviews</span>
        <span class="badge ${d.availableToday ? 'green' : 'amber'} plain">${d.availableToday ? 'Available' : 'Unavailable'}</span>
      </div>
    </div>
    <div style="text-align:right;display:grid;gap:8px;justify-items:end">
      <b style="color:var(--success)">${money(d.fee)}</b>
      <div class="flex gap-8">
        <button class="btn btn-soft btn-xs" data-toggle="${d.id}">${icon('refresh', 13)} Toggle</button>
        <button class="btn btn-outline btn-xs" data-edit="${d.id}">${icon('edit', 13)} Edit</button>
        <button class="btn btn-soft-danger btn-xs" data-del="${d.id}">${icon('trash', 13)}</button>
      </div>
    </div>
  </div>`;
}

function addDoctorModal() {
  editDoctorModal(null);
}

function editDoctorModal(id) {
  const existing = id ? getDoctor(id) : null;
  const close = openModal(`
    <div class="modal-head"><h3>${existing ? 'Edit doctor' : 'Add doctor'}</h3><button class="icon-btn" data-close aria-label="Close">${icon('x', 18)}</button></div>
    <div class="modal-body" style="display:grid;gap:12px">
      <div class="form-grid">
        <div class="field"><label>Name <span class="req">*</span></label><input class="input" id="docName" value="${esc(existing?.name || '')}" placeholder="Dr. Full Name"></div>
        <div class="field"><label>Specialty <span class="req">*</span></label><input class="input" id="docSpec" value="${esc(existing?.specialty || '')}" placeholder="e.g. Cardiology"></div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Experience</label><input class="input" id="docExp" value="${esc(existing?.experience || '')}" placeholder="e.g. 10 yrs"></div>
        <div class="field"><label>Consultation fee</label><input class="input" id="docFee" type="number" value="${existing?.fee || ''}" placeholder="500"></div>
      </div>
      <div class="field"><label>Clinic / hospital</label><input class="input" id="docClinic" value="${esc(existing?.clinic || '')}" placeholder="Clinic name"></div>
      <div class="field"><label>Location</label><input class="input" id="docLoc" value="${esc(existing?.location || '')}" placeholder="Area, City"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline btn-sm" data-close>Cancel</button>
      <button class="btn btn-primary btn-sm" id="docSave">${icon('check', 15)} ${existing ? 'Save changes' : 'Add doctor'}</button>
    </div>`, {
    onMount: (box) => {
      box.querySelector('#docSave').addEventListener('click', () => {
        const name = box.querySelector('#docName').value.trim();
        const spec = box.querySelector('#docSpec').value.trim();
        if (!name || !spec) { toast('Missing details', 'Name and specialty are required.', 'error'); return; }
        const fee = Number(box.querySelector('#docFee').value) || 500;
        const data = { name, specialty: spec, fee, experience: box.querySelector('#docExp').value.trim() || '5 yrs', clinic: box.querySelector('#docClinic').value.trim() || 'MedCare Clinic', location: box.querySelector('#docLoc').value.trim() };
        if (existing) {
          updateDoctor(id, data);
          addLog({ actor: currentUser()?.name, action: 'Doctor updated', details: name });
          toast('Doctor updated', name, 'success');
        } else {
          addDoctor(data);
          addLog({ actor: currentUser()?.name, action: 'Doctor added', details: name });
          toast('Doctor added', name, 'success');
        }
        box._close();
        doctorsPage(document.getElementById('viewport'));
      });
    },
  });
}

export function initDoctors() {
  registerPage('find', findPage);
  registerPage('scheduling', bookingPage);
  registerPage('doctors', doctorsPage);
}
