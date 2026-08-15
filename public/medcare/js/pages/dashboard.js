// ─────────────────────────────────────────────────────────────
// Dashboards — Patient / Doctor / Admin
// ─────────────────────────────────────────────────────────────
import { icon, esc, fmtDate, fmtTime, money, avatar, toast, countUp, ring, animateRing, progress, animateProgress, lineChart, bindLineChart, emptyState, daysUntil, todayISO } from '../core.js';
import { currentUser, getAppointments, getPrescriptions, getHistory, getNotifications, getDoctors, getPatients, getLogs, getState, buildAnalytics, getDoctor, addLog } from '../store.js';
import { registerPage, navigate, role } from '../router.js';
import { pageHead, kpi, sparkline, apptCard, typeChip, statusBadge, doctorAvatar } from './shared.js';

const ME_ID = () => {
  const u = currentUser();
  return u ? u.userId : '';
};

// ═══════════════════════════════════════════════════════════
// PATIENT DASHBOARD
// ═══════════════════════════════════════════════════════════
function patientDashboard(vp) {
  const user = currentUser();
  const today = new Date();
  const myAppts = getAppointments().filter(a => a.patientId === ME_ID());
  const upcoming = myAppts.filter(a => (a.status === 'confirmed' || a.status === 'scheduled' || a.status === 'rescheduled'));
  const todayAppts = upcoming.filter(a => a.appointmentDate === todayISO());
  const completed = myAppts.filter(a => a.status === 'completed');
  const rxCount = getPrescriptions().filter(r => r.patientId === ME_ID()).length;
  const nextAppt = upcoming.sort((a, b) => (a.appointmentDate + a.appointmentTime).localeCompare(b.appointmentDate + b.appointmentTime))[0];
  const notifs = getNotifications().filter(n => !n.read).slice(0, 4);
  const history = getHistory().slice(0, 4);
  const rx = getPrescriptions().filter(r => r.patientId === ME_ID()).slice(0, 3);
  const myPat = getPatients().find(p => p.id === ME_ID()) || {};
  const wt = parseFloat(myPat.weightKg) || 0;
  const htM = parseFloat(myPat.heightCm) ? parseFloat(myPat.heightCm) / 100 : 0;
  const bmi = wt && htM ? (wt / (htM * htM)).toFixed(1) : '';

  const dayName = today.toLocaleDateString('en-IN', { weekday: 'long' });
  const dateStr = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const firstName = (user?.name || 'there').split(' ')[0];

  vp.innerHTML = `
  ${pageHead(`Good ${today.getHours() < 12 ? 'morning' : today.getHours() < 17 ? 'afternoon' : 'evening'}, ${esc(firstName)} 👋`, `${dayName}, ${dateStr} · Here's your health overview for today.`)}
  ${todayAppts.length ? heroToday(nextAppt, user.name) : heroWelcome(firstName)}

  <div class="kpi-grid" style="margin-top:20px">
    ${kpi({ label: "Today's appointments", value: todayAppts.length, iconName: 'calendar', cls: 'blue' })}
    ${kpi({ label: 'Upcoming visits', value: upcoming.length, iconName: 'clock', cls: 'teal' })}
    ${kpi({ label: 'Completed visits', value: completed.length, iconName: 'checkCircle', cls: 'green' })}
    ${kpi({ label: 'Prescriptions', value: rxCount, iconName: 'prescription', cls: 'purple' })}
  </div>

  <div class="dash-grid" style="margin-top:22px">
    <div class="dash-main">
      ${nextAppt ? `
      <section class="section-label"><h3>Upcoming appointment</h3><span class="line"></span><span class="count">${daysUntil(nextAppt.appointmentDate) === 0 ? 'Today' : daysUntil(nextAppt.appointmentDate) === 1 ? 'Tomorrow' : `in ${daysUntil(nextAppt.appointmentDate)} days`}</span></section>
      <div class="glass card" style="padding:22px;display:flex;gap:18px;flex-wrap:wrap;align-items:center;position:relative;overflow:hidden">
        <span class="icon-btn" style="position:absolute;top:14px;right:14px;pointer-events:none">${icon('sparkles', 18)}</span>
        ${doctorAvatar(getDoctor(nextAppt.doctorId), 'xl')}
        <div style="flex:1;min-width:230px">
          <div class="flex gap-8" style="align-items:center;flex-wrap:wrap">
            <h3 style="font-family:var(--font-display);font-size:1.2rem;font-weight:700">${esc(nextAppt.doctorName)}</h3>
            ${typeChip(nextAppt.type)}
            ${statusBadge(nextAppt.status)}
          </div>
          <div class="row-sub" style="margin-top:4px">${esc(getDoctor(nextAppt.doctorId)?.specialty || nextAppt.specialty)} · ${esc(getDoctor(nextAppt.doctorId)?.clinic || 'MedCare')}</div>
          <div class="appt-meta" style="margin-top:12px">
            <span>${icon('calendar', 15)} ${fmtDate(nextAppt.appointmentDate, { weekday: true })}</span>
            <span>${icon('clock', 15)} ${fmtTime(nextAppt.appointmentTime)}</span>
            <span>${icon('mapPin', 15)} ${esc(getDoctor(nextAppt.doctorId)?.location || 'Video link will be shared')}</span>
          </div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-primary" data-nav="#/appointments?id=${nextAppt.id}">${icon('calendarCheck', 17)} View details</button>
          <button class="btn btn-soft btn-icon" data-nav="#/messages" data-tip="Message doctor">${icon('chat', 17)}</button>
        </div>
      </div>` : `
      <div class="card card-pad" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <span class="notif-ic blue" style="width:52px;height:52px;border-radius:16px">${icon('calendarPlus', 26)}</span>
        <div style="flex:1;min-width:200px">
          <h3 style="font-family:var(--font-display);font-weight:700">No upcoming appointments</h3>
          <p class="text-muted" style="font-size:.84rem;margin-top:4px">Book a consultation with one of our ${getDoctors().length} specialists in under a minute.</p>
        </div>
        <button class="btn btn-primary" data-nav="#/find">${icon('stethoscope', 17)} Find a doctor</button>
      </div>`}

      <section class="section-label"><h3>Recent prescriptions</h3><span class="line"></span><a style="font-size:.74rem;font-weight:700;color:var(--blue);cursor:pointer" data-nav="#/prescriptions">View all</a></section>
      ${rx.length ? `<div class="grid grid-3">
        ${rx.map(p => `
        <div class="card card-pad hoverable" data-nav="#/prescriptions?id=${p.id}" style="cursor:pointer;display:grid;gap:10px">
          <div class="flex gap-8" style="align-items:center">
            <span class="notif-ic teal" style="width:36px;height:36px;border-radius:11px">${icon('prescription', 18)}</span>
            <div><b style="font-size:.86rem">${esc(p.diagnosis)}</b><div class="text-faint" style="font-size:.7rem">${esc(p.doctorName)} · ${fmtDate(p.date)}</div></div>
          </div>
          <div class="flex gap-6" style="flex-wrap:wrap">${p.items.slice(0, 3).map(i => `<span class="mini-chip">${esc(i.medicine)}</span>`).join('')}</div>
        </div>`).join('')}
      </div>` : emptyState('No prescriptions yet', 'Your doctor will issue digital prescriptions after consultations.')}

      <section class="section-label"><h3>Medical history</h3><span class="line"></span><a style="font-size:.74rem;font-weight:700;color:var(--blue);cursor:pointer" data-nav="#/history">Open timeline</a></section>
      <div class="card card-pad" style="display:grid;gap:4px">
        ${history.map(h => `
        <div class="row-item clickable" data-nav="#/history" style="padding:10px 8px">
          <span class="tl-dot ${typeColor(h.type)}" style="position:static;width:30px;height:30px;border-radius:10px;border-width:2px">${icon(tlIcon(h.type), 14)}</span>
          <div class="row-main"><div class="row-title">${esc(h.title)}</div><div class="row-sub">${esc(h.doctor)} · ${fmtDate(h.date)}</div></div>
          <span class="badge green plain" style="font-size:.64rem">${esc(h.type)}</span>
        </div>`).join('')}
      </div>
    </div>

    <!-- right rail -->
    <div style="display:grid;gap:20px;align-content:start">
      <section class="card card-pad">
        <div class="card-title" style="margin-bottom:14px">${icon('pulse', 18)} Health snapshot</div>
        <div class="health-bars">
          ${healthRow('weight', 'Body weight', wt ? wt + ' kg' : 'Not recorded', wt ? 'Recorded on your profile' : 'Add it in Settings', wt ? Math.min(100, Math.round((wt / 120) * 100)) : 0, 'var(--blue)', '')}
          ${healthRow('activity', 'Body Mass Index', bmi ? bmi : 'Not recorded', bmi && bmi >= 18.5 && bmi < 25 ? 'Healthy range' : bmi ? 'See your doctor' : 'Add height & weight', bmi ? Math.min(100, Math.round((bmi / 35) * 100)) : 0, 'var(--teal)', 'green')}
          ${healthRow('heart', 'Heart rate', '—', 'Measured at consultation', 0, 'var(--error)', 'red')}
          ${healthRow('droplet', 'Blood pressure', '—', 'Measured at consultation', 0, 'var(--warning)', 'amber')}
        </div>
      </section>

      <section class="card card-pad">
        <div class="card-title" style="margin-bottom:12px">${icon('bell', 18)} Notifications <span class="badge red plain" style="margin-left:auto">${notifs.length} new</span></div>
        <div style="display:grid;gap:6px">
          ${notifs.map(n => `
          <div class="row-item clickable" data-nav="#/notifications" style="padding:10px 8px">
            <span class="notif-ic ${n.type === 'emergency' ? 'red' : n.type === 'prescription' ? 'teal' : n.type === 'reschedule' || n.type === 'reminder' ? 'amber' : 'blue'}" style="width:38px;height:38px;border-radius:12px">${icon(notifIcon(n.type), 18)}</span>
            <div class="row-main"><div class="row-title" style="font-size:.82rem">${esc(n.title)}</div><div class="row-sub">${esc(n.message).slice(0, 60)}</div></div>
          </div>`).join('')}
        </div>
        <button class="btn btn-outline btn-sm btn-block mt-12" data-nav="#/notifications">View all notifications</button>
      </section>

      <section class="card card-pad">
        <div class="card-title" style="margin-bottom:12px">${icon('star', 18)} Recommended doctors</div>
        <div style="display:grid;gap:8px">
          ${getDoctors().slice(0, 3).map(d => `
          <div class="row-item clickable" data-nav="#/find?doc=${d.id}" style="padding:8px">
            ${doctorAvatar(d)}
            <div class="row-main"><div class="row-title" style="font-size:.82rem">${esc(d.name)}</div><div class="row-sub">${esc(d.specialty)} · ${esc(d.experience)}</div></div>
            <span class="rating-stars">${icon('star', 13)} ${d.rating}</span>
          </div>`).join('')}
        </div>
        <button class="btn btn-soft btn-sm btn-block mt-12" data-nav="#/find">${icon('search', 15)} Explore all doctors</button>
      </section>
    </div>
  </div>`;

  wireDash(vp);
}

function healthRow(ic, label, val, status, pct, color, cls) {
  return `
  <div class="hb-row">
    <div class="hb-top">
      <b>${icon(ic, 15)} ${label}</b>
      <span>${esc(val)}</span>
    </div>
    ${progress(pct, cls)}
  </div>`;
}

function heroToday(appt, name) {
  const doc = getDoctor(appt.doctorId) || {};
  return `
  <div class="hero">
    <div class="hero-inner">
      <div>
        <span class="kicker">${icon('pulse', 14)} Today's appointment</span>
        <h2>${esc(appt.doctorName)} · ${fmtTime(appt.appointmentTime)}</h2>
        <p>${esc(doc.specialty || appt.specialty)} consultation · ${esc(appt.type)} · ${fmtDate(appt.appointmentDate)}</p>
      </div>
      <div class="hero-cta">
        <button class="btn btn-white" data-nav="#/appointments?id=${appt.id}">${icon('calendarCheck', 17)} Manage visit</button>
        <button class="btn btn-glass" data-nav="#/scheduling">${icon('plus', 17)} Schedule visit</button>
      </div>
    </div>
  </div>`;
}

function heroWelcome(name) {
  return `
  <div class="hero">
    <div class="hero-inner">
      <div>
        <span class="kicker">${icon('heart', 14)} Your health, in your hands</span>
        <h2>Ready when you are, ${esc(name)}</h2>
        <p>No appointments scheduled for today — browse specialists or schedule your next visit in under a minute.</p>
      </div>
      <div class="hero-cta">
        <button class="btn btn-white" data-nav="#/find">${icon('stethoscope', 17)} Find a doctor</button>
        <button class="btn btn-glass" data-nav="#/scheduling">${icon('calendarPlus', 17)} Schedule appointment</button>
      </div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════
// DOCTOR DASHBOARD
// ═══════════════════════════════════════════════════════════
function myDocId() {
  const u = currentUser();
  const doc = getDoctors().find(d => d.userId === (u ? u.userId : ''));
  return doc ? doc.id : '';
}

function doctorDashboard(vp) {
  const user = currentUser();
  const MY_DOC = myDocId();
  const me = getDoctor(MY_DOC) || { name: user?.name || 'Doctor', specialty: 'General Medicine', experience: '', clinic: 'MedCare Clinic', rating: 0, reviews: 0, patients: 0, fee: 0, photo: '' };
  const myAppts = getAppointments().filter(a => a.doctorId === MY_DOC);
  const today = todayISO();
  const todayList = myAppts.filter(a => a.appointmentDate === today && a.status !== 'cancelled' && a.status !== 'rejected').sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));
  const pending = myAppts.filter(a => a.status === 'scheduled');
  const completed = myAppts.filter(a => a.status === 'completed');
  const emergencies = myAppts.filter(a => a.priority === 'emergency' && (a.status === 'scheduled' || a.status === 'confirmed'));
  const queue = todayList.filter(a => a.queueStatus !== 'completed');
  const stats = buildAnalytics();
  const revenue = stats.counts.revenue;
  const compRate = stats.counts.total ? Math.round((stats.counts.completed / stats.counts.total) * 100) : 0;
  const completedList = myAppts.filter(a => a.status === 'completed');
  const videoShare = completedList.length ? Math.round((completedList.filter(a => a.type === 'Video').length / completedList.length) * 100) : 0;
  const sameDay = completedList.length ? Math.round((completedList.filter(a => a.appointmentDate === (a.createdAt || '').slice(0, 10)).length / completedList.length) * 100) : 0;

  vp.innerHTML = `
  ${pageHead(`Welcome back, ${esc(me.name)} 👨‍⚕️`, `${fmtDate(today, { weekday: true })} · ${todayList.length} consultations scheduled today.`, `
    <button class="btn btn-outline" data-nav="#/schedule">${icon('calendar', 16)} My schedule</button>
    <button class="btn btn-primary" data-nav="#/queue">${icon('users', 16)} Patient queue</button>`)}
  <div class="hero" style="margin-bottom:0">
    <div class="hero-inner" style="padding:24px 28px">
      <div class="flex gap-16" style="align-items:center;flex-wrap:wrap">
        ${doctorAvatar(me, 'xl')}
        <div style="flex:1;min-width:200px">
          <h2 style="font-size:1.25rem">${esc(me.name)}</h2>
          <p>${esc(me.specialty)} · ${esc(me.experience)} · ${esc(me.clinic)}</p>
          <div class="flex gap-12 mt-8" style="flex-wrap:wrap;color:rgba(255,255,255,.85);font-size:.8rem">
            <span class="flex gap-6"><b style="color:#fff">${me.rating}</b> ★ rating</span>
            <span>${me.reviews} reviews</span>
            <span>${me.patients.toLocaleString('en-IN')}+ patients treated</span>
          </div>
        </div>
        <div style="display:grid;gap:10px;align-items:end">
          ${ring(compRate / 100, { label: compRate + '%', size: 84, color: 'amber' })}
          <span class="badge amber pulse plain" style="justify-content:center">${queue.length} in queue</span>
        </div>
      </div>
    </div>
  </div>

  <div class="kpi-grid" style="margin-top:20px">
    ${kpi({ label: "Today's appointments", value: todayList.length, iconName: 'calendar', cls: 'blue', trend: 'on schedule', trendDir: 'up' })}
    ${kpi({ label: 'Pending approvals', value: pending.length, iconName: 'clock', cls: 'amber', trend: 'need action', trendDir: 'down' })}
    ${kpi({ label: 'Completed consults', value: completed.length, iconName: 'checkCircle', cls: 'green', trend: 'all-time', trendDir: 'up' })}
    ${kpi({ label: 'Emergency cases', value: emergencies.length, iconName: 'alert', cls: 'red', trend: 'respond now', trendDir: 'up' })}
  </div>

  <div class="dash-grid" style="margin-top:22px">
    <div class="dash-main">
      <section class="section-label"><h3>Today's schedule</h3><span class="line"></span><span class="count">${todayList.length} visits</span></section>
      ${todayList.length ? `<div class="schedule-timeline">
        ${todayList.map(a => {
          const now = new Date();
          const [hh, mm] = a.appointmentTime.split(':').map(Number);
          const apptMins = hh * 60 + mm, nowMins = now.getHours() * 60 + now.getMinutes();
          const cls = a.status === 'completed' ? 'done' : apptMins <= nowMins ? 'active' : a.status === 'cancelled' ? 'cancelled' : '';
          return `
          <div class="sched-item ${cls}" data-appt="${a.id}">
            <div class="st-time">${fmtTime(a.appointmentTime)} · ${a.duration}m</div>
            <div class="st-card">
              ${avatar(a.patientName)}
              <div style="flex:1;min-width:0">
                <b style="font-size:.86rem">${esc(a.patientName)}</b>
                <div class="row-sub">${esc(a.notes || a.specialty + ' consult')}</div>
              </div>
              ${typeChip(a.type)}
              ${statusBadge(a.status)}
              ${a.priority === 'emergency' ? `<span class="badge red pulse plain">${icon('alert', 12)} Emergency</span>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>` : emptyState('No consultations today', 'Enjoy your day off, doctor. 🎉', 'calendar')}

      <section class="section-label"><h3>Waiting queue</h3><span class="line"></span><span class="count">${queue.length}</span></section>
      ${queue.length ? queue.map((a, i) => `
        <div class="queue-item">
          <span class="queue-pos ${i === 1 ? 'n2' : i === 2 ? 'n3' : ''}">${String(i + 1).padStart(2, '0')}</span>
          ${avatar(a.patientName)}
          <div class="queue-info"><b>${esc(a.patientName)}</b><small>${esc(a.notes || 'General consultation')} · ${fmtTime(a.appointmentTime)}</small></div>
          <span class="queue-wait">${i === 0 ? 'Now' : `~${i * 30} min`}</span>
          ${a.status === 'confirmed'
            ? `<button class="btn btn-teal btn-xs" data-queue-start="${a.id}">${icon('video', 13)} Start</button>`
            : `<button class="btn btn-soft btn-xs" data-queue-confirm="${a.id}">${icon('check', 13)} Confirm</button>`}
        </div>`).join('')
      : emptyState('Queue clear', 'No patients waiting right now.', 'checkCircle')}

      <section class="section-label"><h3>Revenue & consults</h3><span class="line"></span></section>
      <div class="card card-pad">
        ${lineChart(stats.trend.slice(-10), { color: '#2563EB' })}
      </div>
    </div>

    <div style="display:grid;gap:20px;align-content:start">
      <section class="card card-pad">
        <div class="card-title" style="margin-bottom:14px">${icon('dollar', 18)} Earnings</div>
        <div class="kpi-value" style="font-size:1.7rem">${money(revenue)}</div>
        <div class="kpi-label">${stats.counts.completed} completed consults</div>
        <div class="divider"></div>
        <div class="grid grid-3" style="gap:10px;text-align:center">
          ${ring(compRate / 100, { size: 70, label: compRate + '%', color: 'green' })}
          ${ring(videoShare / 100, { size: 70, label: videoShare + '%', color: 'blue' })}
          ${ring(sameDay / 100, { size: 70, label: sameDay + '%', color: 'amber' })}
        </div>
        <div class="flex" style="justify-content:space-between;font-size:.68rem;color:var(--faint);margin-top:4px">
          <span>Completion</span><span>Video share</span><span>Same-day</span>
        </div>
      </section>

      <section class="card card-pad">
        <div class="card-title" style="margin-bottom:12px">${icon('users', 18)} Recent patients</div>
        ${getAppointments({ doctorId: MY_DOC }).slice(0, 5).map(a => `
          <div class="row-item clickable" data-nav="#/patients?id=${a.patientId}" style="padding:8px">
            ${avatar(a.patientName, 'sm')}
            <div class="row-main"><div class="row-title" style="font-size:.8rem">${esc(a.patientName)}</div><div class="row-sub">${fmtDate(a.appointmentDate)}</div></div>
            ${statusBadge(a.status)}
          </div>`).join('')}
      </section>

      <section class="card card-pad">
        <div class="card-title" style="margin-bottom:12px">${icon('stethoscope', 18)} Quick actions</div>
        <div class="card-menu">
          <div class="mi" data-nav="#/consult">${icon('video', 18)} Start consultation</div>
          <div class="mi" data-nav="#/queue">${icon('users', 18)} View patient queue</div>
          <div class="mi" data-nav="#/schedule">${icon('calendarCheck', 18)} Update availability</div>
          <div class="mi" data-nav="#/patients">${icon('clipboard', 18)} Patient records</div>
          <div class="mi" data-nav="#/prescriptions">${icon('prescription', 18)} Create prescription</div>
          <div class="mi" data-nav="#/analytics">${icon('analytics', 18)} Practice analytics</div>
        </div>
      </section>
    </div>
  </div>`;

  // queue actions
  vp.querySelectorAll('[data-queue-start]').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = b.dataset.queueStart;
    import('../store.js').then(m => {
      m.updateAppointment(id, { queueStatus: 'in_consultation', status: 'confirmed' });
      toast('Consultation started', 'Patient moved to in-consultation.', 'info');
      doctorDashboard(vp);
    });
  }));
  vp.querySelectorAll('[data-queue-confirm]').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = b.dataset.queueConfirm;
    import('../store.js').then(m => {
      m.updateAppointment(id, { status: 'confirmed', queueStatus: 'waiting' });
      toast('Appointment confirmed', 'Patient added to the waiting queue.', 'success');
      doctorDashboard(vp);
    });
  }));
  vp.querySelectorAll('.sched-item').forEach(el => el.addEventListener('click', () => {
    navigate('#/consult?appt=' + el.dataset.appt);
  }));
  wireDash(vp);
}

// ═══════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════
function adminDashboard(vp) {
  const s = getState();
  const stats = buildAnalytics();
  const logs = getLogs().slice(0, 6);
  const doctors = getDoctors();
  const pendingApprovals = stats.counts.upcoming;
  const activeUsers = s.users && s.users.length ? s.users.length : s.patients.length;
  const weekVals = stats.trend.map(t => t.value);

  vp.innerHTML = `
  ${pageHead('Admin overview', `Enterprise control center · ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}`, `
    <button class="btn btn-outline" data-nav="#/doctors">${icon('users', 16)} Manage doctors</button>
    <button class="btn btn-primary" data-nav="#/analytics">${icon('analytics', 16)} Full analytics</button>`)}
  <div class="kpi-grid">
    ${kpi({ label: 'Total patients', value: s.patients.length, iconName: 'users', cls: 'blue', spark: sparkline(weekVals) })}
    ${kpi({ label: 'Total doctors', value: doctors.length, iconName: 'stethoscope', cls: 'teal' })}
    ${kpi({ label: 'Total appointments', value: stats.counts.total, iconName: 'calendar', cls: 'purple', spark: sparkline(weekVals, '#7C3AED') })}
    ${kpi({ label: 'Active users', value: activeUsers, iconName: 'activity', cls: 'navy' })}
    ${kpi({ label: 'Upcoming approvals', value: pendingApprovals, iconName: 'clock', cls: 'amber' })}
    ${kpi({ label: 'Emergency cases', value: stats.counts.emergency, iconName: 'alert', cls: 'red' })}
    ${kpi({ label: 'Completed visits', value: stats.counts.completed, iconName: 'checkCircle', cls: 'green' })}
    ${kpi({ label: 'Revenue', value: stats.counts.revenue, iconName: 'dollar', cls: 'navy' })}
  </div>

  <div class="dash-grid" style="margin-top:22px">
    <div class="dash-main">
      <section class="section-label"><h3>Appointment trends</h3><span class="line"></span></section>
      <div class="card card-pad">
        ${lineChart(stats.trend, { color: '#2563EB' })}
      </div>
      <section class="section-label"><h3>Department distribution</h3><span class="line"></span></section>
      <div class="card card-pad">
        <div class="flex gap-8" style="flex-wrap:wrap;margin-bottom:14px">
          ${doctors.slice(0, 8).map(d => `<span class="badge navy plain">${esc(d.specialty)}</span>`).join('')}
        </div>
        ${doctorBarRows(doctors)}
      </div>
    </div>
    <div style="display:grid;gap:20px;align-content:start">
      <section class="card card-pad">
        <div class="card-title" style="margin-bottom:12px">${icon('clock', 18)} System activity</div>
        ${logs.map(l => `
        <div class="row-item" style="padding:9px 6px">
          <span class="list-number">${icon('activity', 13)}</span>
          <div class="row-main"><div class="row-title" style="font-size:.8rem">${esc(l.action)}</div><div class="row-sub">${esc(l.details)} · ${esc(l.actor)}</div></div>
        </div>`).join('')}
        <button class="btn btn-outline btn-sm btn-block mt-12" data-nav="#/reports">View activity log</button>
      </section>
      <section class="card card-pad">
        <div class="card-title" style="margin-bottom:12px">${icon('users', 18)} Doctor availability</div>
        ${doctors.slice(0, 6).map(d => `
        <div class="row-item" style="padding:8px 6px">
          ${doctorAvatar(d, 'sm')}
          <div class="row-main"><div class="row-title" style="font-size:.8rem">${esc(d.name)}</div><div class="row-sub">${esc(d.specialty)}</div></div>
          <span class="badge green plain">${icon('check', 11)} Available</span>
        </div>`).join('')}
      </section>
    </div>
  </div>`;
  wireDash(vp);
}

function doctorBarRows(doctors) {
  const max = Math.max(1, ...doctors.map(d => d.patients));
  return doctors.map(d => `
  <div class="hb-row">
    <div class="hb-top"><b>${esc(d.name)} <span class="text-faint" style="font-weight:600;font-size:.7rem">· ${esc(d.specialty)}</span></b><span>${d.patients.toLocaleString('en-IN')} patients</span></div>
    ${progress(Math.round((d.patients / max) * 100), '')}
  </div>`).join('');
}

// ── helpers ────────────────────────────────────────────────
function notifIcon(t) {
  return { reminder: 'clock', confirmation: 'checkCircle', cancellation: 'xCircle', reschedule: 'rotate', prescription: 'prescription', followup: 'calendarCheck', emergency: 'alert' }[t] || 'bell';
}
function tlIcon(t) {
  return { consultation: 'stethoscope', diagnosis: 'clipboard', prescription: 'prescription', lab: 'scan', 'follow-up': 'calendarCheck', notes: 'note' }[t] || 'file';
}
function typeColor(t) {
  return { consultation: '', diagnosis: 'red', prescription: 'teal', lab: 'purple', 'follow-up': 'amber', notes: 'green' }[t] || '';
}

// ── register ───────────────────────────────────────────────
function wireDash(vp) {
  vp.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.nav)));
  vp.querySelectorAll('[data-count]').forEach(el => {
    const target = parseFloat(String(el.dataset.count || '0').replace(/[^\d.-]/g, '')) || 0;
    el.textContent = '0';
    countUp(el, target);
  });
  vp.querySelectorAll('.ring').forEach(animateRing);
  animateProgress(vp);
  bindLineChart(vp);
}

export function initDashboards() {
  registerPage('dashboard', (vp) => {
    const r = role();
    if (r === 'doctor') return doctorDashboard(vp);
    if (r === 'admin') return adminDashboard(vp);
    patientDashboard(vp);
  });
}