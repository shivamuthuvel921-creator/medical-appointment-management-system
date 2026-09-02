// ─────────────────────────────────────────────────────────────
// Smart Doctor Recommendation — patient-facing assistant.
// Patients describe their healthcare need and MedCare suggests
// a suitable doctor with a REAL available appointment slot.
// The appointment is only created after patient confirmation.
// ─────────────────────────────────────────────────────────────
import { icon, esc, fmtDate, fmtTime, money, toast, confetti, todayISO } from '../core.js';
import { currentUser, getSmartRecommendation, confirmSmartAppointment, pushNotification, addLog } from '../store.js';
import { registerPage, navigate } from '../router.js';
import { pageHead, doctorAvatar, statusBadge } from './shared.js';

const CONSULT_TYPES = [
  { key: 'In-clinic', label: 'In-Clinic', ic: 'briefcase', sub: 'Visit the clinic' },
  { key: 'Video', label: 'Online', ic: 'video', sub: 'Secure video call' },
  { key: 'Phone', label: 'Phone', ic: 'phone', sub: 'Call consultation' },
];

const LANGUAGES = ['', 'English', 'Tamil', 'Hindi', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali'];

const DEFAULT_TIME = '10:00';

function timeOptions() {
  const opts = ['<option value="">Any time</option>'];
  for (let h = 8; h <= 20; h++) {
    for (const m of [0, 30]) {
      if (h === 20 && m === 30) continue;
      const t = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      opts.push(`<option value="${t}">${fmtTime(t)}</option>`);
    }
  }
  return opts.join('');
}

function smartPage(vp) {
  const st = {
    symptoms: '',
    description: '',
    date: '',
    time: DEFAULT_TIME,
    type: 'In-clinic',
    location: '',
    language: '',
    excludeDoctorId: '',
    excludeSlot: null,
    busy: false,
  };

  renderForm();

  function renderForm() {
    vp.innerHTML = `
    ${pageHead('🧠 Smart Doctor Recommendation', 'Tell us what you need help with and MedCare will find a suitable doctor and an available appointment.')}
    <div class="card card-pad" style="max-width:780px;margin:0 auto;display:grid;gap:16px">
      <div class="stepper-hint" style="margin:0">${icon('info', 18)} This is a doctor discovery and appointment assistant only. It does not provide a diagnosis — a doctor will evaluate your concern during the consultation.</div>
      <div class="field">
        <label for="recSymptoms">What do you need help with? <span class="req">*</span></label>
        <textarea class="input" id="recSymptoms" rows="3" maxlength="500" placeholder="e.g. I have frequent headaches and fever." style="resize:vertical">${esc(st.symptoms)}</textarea>
      </div>
      <div class="field">
        <label for="recDesc">Additional description <span class="req-soft">(optional)</span></label>
        <textarea class="input" id="recDesc" rows="2" maxlength="1000" placeholder="Anything else that helps us understand your need (duration, severity, triggers...) — not a diagnosis." style="resize:vertical">${esc(st.description)}</textarea>
      </div>
      <div class="form-grid">
        <div class="field">
          <label for="recDate">Preferred date <span class="req-soft">(optional)</span></label>
          <input class="input" type="date" id="recDate" min="${todayISO()}" value="${esc(st.date)}">
        </div>
        <div class="field">
          <label for="recTime">Preferred time <span class="req-soft">(optional)</span></label>
          <select class="input select" id="recTime">${timeOptions().replace(`value="${st.time}"`, `value="${st.time}" selected`)}</select>
        </div>
      </div>
      <div class="field">
        <label>Consultation type</label>
        <div class="chip-select" id="recTypeWrap">${CONSULT_TYPES.map(x => `
          <button class="chip-opt ${st.type === x.key ? 'selected' : ''}" data-type="${x.key}" style="display:grid;gap:6px;text-align:left;flex:1;min-width:140px">
            <span style="display:inline-flex;align-items:center;gap:8px;font-weight:700">${icon(x.ic, 16)} ${x.label}</span>
            <span style="font-size:.72rem;color:var(--faint)">${x.sub}</span>
          </button>`).join('')}</div>
      </div>
      <div class="form-grid">
        <div class="field">
          <label for="recLoc">Preferred location / clinic <span class="req-soft">(optional)</span></label>
          <input class="input" id="recLoc" maxlength="120" placeholder="e.g. Salem" value="${esc(st.location)}">
        </div>
        <div class="field">
          <label for="recLang">Preferred language <span class="req-soft">(optional)</span></label>
          <select class="input select" id="recLang">
            ${LANGUAGES.map(l => `<option value="${esc(l)}" ${st.language === l ? 'selected' : ''}>${l || 'Any language'}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="flex" style="justify-content:flex-end;gap:10px;flex-wrap:wrap">
        <button class="btn btn-primary" id="recFind" style="min-width:190px">${icon('sparkles', 16)} Find My Doctor</button>
      </div>
    </div>`;

    vp.querySelector('#recSymptoms').addEventListener('input', e => { st.symptoms = e.target.value; });
    vp.querySelector('#recDesc').addEventListener('input', e => { st.description = e.target.value; });
    vp.querySelector('#recDate').addEventListener('change', e => { st.date = e.target.value; });
    vp.querySelector('#recTime').addEventListener('change', e => { st.time = e.target.value; });
    vp.querySelector('#recLoc').addEventListener('input', e => { st.location = e.target.value; });
    vp.querySelector('#recLang').addEventListener('change', e => { st.language = e.target.value; });
    vp.querySelectorAll('#recTypeWrap .chip-opt').forEach(c => c.addEventListener('click', () => {
      st.type = c.dataset.type;
      vp.querySelectorAll('#recTypeWrap .chip-opt').forEach(x => x.classList.remove('selected'));
      c.classList.add('selected');
    }));
    vp.querySelector('#recFind').addEventListener('click', findDoctor);
  }

  async function findDoctor() {
    if (st.busy) return;
    const concern = st.symptoms.trim();
    if (!concern) { toast('Healthcare need required', 'Please describe what you need help with.', 'error'); return; }

    st.busy = true;
    vp.innerHTML = pageHead('🧠 Smart Doctor Recommendation', 'Finding a suitable doctor and an available appointment for you…') +
      `<div class="card card-pad" style="max-width:780px;margin:0 auto">
        <div class="flex" style="justify-content:center;gap:12px;align-items:center;padding:26px 0">
          <span class="spin" style="width:22px;height:22px;border:3px solid var(--hairline-2);border-top-color:var(--blue);border-radius:50%;display:inline-block;animation:spin 1s linear infinite"></span>
          <p class="text-muted" style="margin:0">${icon('search', 16)} Matching your concern against real doctor availability…</p>
        </div>
      </div>`;
    if (!document.querySelector('style[data-spin]')) {
      const s = document.createElement('style');
      s.dataset.spin = '1';
      s.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(s);
    }

    const res = await getSmartRecommendation({
      symptoms: concern,
      description: st.description.trim(),
      preferredDate: st.date || '',
      preferredTime: st.time || '',
      consultationType: st.type,
      location: st.location.trim(),
      language: st.language,
      excludeDoctorId: st.excludeDoctorId || '',
      excludeSlot: st.excludeSlot || null,
    });
    st.busy = false;

    if (!res.ok) {
      renderEmpty('Could not search right now', 'Please try again in a moment.', 'alert');
      return;
    }

    const d = res.data;
    if (d.empty) {
      if (d.empty === 'no-doctors') renderEmpty('No doctors are currently registered.', '', 'users');
      else if (d.empty === 'no-slot') renderEmpty('No suitable appointment slots are currently available. Try another date or time.', '', 'calendarX');
      else renderEmpty('No suitable doctors are currently available for the information provided.', 'Try describing your need differently or adjust your preferences.', 'stethoscope');
      return;
    }

    renderSuggestion(d, '');
  }

  function renderEmpty(title, sub, ic) {
    vp.innerHTML = pageHead('🧠 Smart Doctor Recommendation', 'Finding a suitable doctor and an available appointment for you…') + `
    <div class="card card-pad" style="max-width:600px;margin:0 auto;text-align:center">
      <div class="empty">
        <div class="e-ic">${icon(ic || 'circle', 32)}</div>
        <h4>${esc(title)}</h4>
        ${sub ? `<p>${esc(sub)}</p>` : ''}
      </div>
      <div class="flex" style="justify-content:center;gap:10px;margin-top:18px;flex-wrap:wrap">
        <button class="btn btn-primary" id="recTryAgain">${icon('refresh', 15)} Try again</button>
        <button class="btn btn-outline" data-nav="#/find">${icon('stethoscope', 15)} Browse all doctors</button>
      </div>
    </div>`;
    vp.querySelector('#recTryAgain').addEventListener('click', () => renderForm());
    vp.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.nav)));
  }

  function renderSuggestion(d, notice) {
    const doc = d.doctor;
    const slot = d.suggestedSlot;
    const typeLabel = (d.consultationType || 'In-clinic') === 'Video' ? 'Online' : d.consultationType || 'In-Clinic';
    const fee = String(doc.consultationFee || '').replace(/[^\d.]/g, '');
    const rating = doc.rating && doc.rating.average != null ? doc.rating.average : 0;
    const reviews = doc.rating && doc.rating.count != null ? doc.rating.count : 0;

    vp.innerHTML = pageHead('🧠 Smart Doctor Recommendation', 'Your recommended doctor and available appointment.') + `
    ${notice ? `<div class="card card-pad" style="max-width:780px;margin:0 auto 14px;border-color:rgba(245,158,11,.4);background:var(--warning-bg)">
      <div class="flex" style="gap:10px;align-items:flex-start">${icon('alert', 18)}
        <p class="text-muted" style="margin:0;font-size:.85rem">${esc(notice)}</p>
      </div>
    </div>` : ''}
    <div class="card card-pad" style="max-width:780px;margin:0 auto">
      <div class="review-grid">
        <div class="rv-group">
          <h5 class="rv-title">${icon('sparkles', 15)} Recommended doctor</h5>
          <div class="flex" style="gap:14px;align-items:center;margin-bottom:10px">
            ${doctorAvatar({ name: doc.name, photo: doc.avatar, color: 0 }, 'lg')}
            <div style="flex:1;min-width:0">
              <b style="font-size:1rem">${esc(doc.name)}</b>
              <div class="row-sub">${esc(doc.specialty)}</div>
              <div class="flex gap-8 mt-8" style="flex-wrap:wrap">
                <span class="rating-stars">${icon('star', 13)} ${rating}<span class="n">(${reviews} reviews)</span></span>
                ${fee ? `<b class="doc-fee">${money(Number(fee))}</b>` : ''}
              </div>
            </div>
          </div>
          <div class="bs-row"><span class="k">${icon('award', 15)} Experience</span><span class="v">${esc(doc.experience || '—')}</span></div>
          <div class="bs-row"><span class="k">${icon('mapPin', 15)} Clinic</span><span class="v">${esc(doc.clinic || '—')}</span></div>
          ${doc.qualifications ? `<div class="bs-row"><span class="k">${icon('award', 15)} Qualification</span><span class="v" style="font-weight:600;font-size:.8rem">${esc(doc.qualifications)}</span></div>` : ''}
        </div>
        <div class="rv-group">
          <h5 class="rv-title">${icon('calendarCheck', 15)} Recommended appointment</h5>
          <div class="bs-row"><span class="k">${icon('doctor', 15)} Doctor</span><span class="v">${esc(doc.name)}</span></div>
          <div class="bs-row"><span class="k">${icon('stethoscope', 15)} Specialization</span><span class="v">${esc(doc.specialty)}</span></div>
          <div class="bs-row"><span class="k">${icon('calendar', 15)} Date</span><span class="v">${fmtDate(slot.date, { weekday: true, day: 'numeric', month: 'long' })}</span></div>
          <div class="bs-row"><span class="k">${icon('clock', 15)} Time</span><span class="v">${fmtTime(slot.time)} – ${fmtTime(slot.end || addMins(slot.time, 30))}</span></div>
          <div class="bs-row"><span class="k">${icon('video', 15)} Consultation</span><span class="v">${esc(typeLabel)}</span></div>
        </div>
      </div>

      <div class="divider" style="margin:18px 0"></div>
      <h5 class="rv-title" style="margin-bottom:10px">${icon('checkCircle', 15)} Why this was recommended</h5>
      <div style="display:grid;gap:8px;max-width:560px">
        ${(d.reason || []).map(r => `
          <div class="rec-reason">${icon('check', 14)} <span>${esc(r)}</span></div>`).join('')}
      </div>
      <p class="text-faint" style="font-size:.72rem;margin-top:14px">${icon('info', 13)} Recommendation is based on potentially relevant specialties and real doctor availability. It is not a diagnosis — the doctor will assess your condition during the consultation.</p>

      <div class="divider" style="margin:18px 0"></div>
      <div class="flex" style="justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <span class="badge amber plain" style="padding:7px 12px">${icon('clock', 13)} Status: waiting for your confirmation</span>
        <div class="flex" style="gap:10px;flex-wrap:wrap">
          <button class="btn btn-outline" id="recChangeTime">${icon('clock', 15)} Change time</button>
          <button class="btn btn-outline" id="recChangeDoc">${icon('refresh', 15)} Change doctor</button>
          <button class="btn btn-primary" id="recConfirm">${icon('checkCircle', 16)} Confirm Appointment</button>
        </div>
      </div>
    </div>`;

    vp.querySelector('#recChangeTime').addEventListener('click', () => {
      st.excludeSlot = { date: slot.date, time: slot.time };
      findDoctor();
    });
    vp.querySelector('#recChangeDoc').addEventListener('click', () => {
      st.excludeDoctorId = doc.id;
      st.excludeSlot = null;
      findDoctor();
    });
    vp.querySelector('#recConfirm').addEventListener('click', () => confirmAppointment(d, notice));
  }

  async function confirmAppointment(d, notice) {
    const btn = vp.querySelector('#recConfirm');
    if (btn) { btn.disabled = true; btn.innerHTML = `${icon('clock', 15)} Checking availability…`; }

    const res = await confirmSmartAppointment({
      doctorId: d.doctor.id,
      appointmentDate: d.suggestedSlot.date,
      appointmentTime: d.suggestedSlot.time,
      type: d.consultationType || 'In-clinic',
      notes: st.symptoms.trim(),
      input: {
        symptoms: st.symptoms.trim(),
        description: st.description.trim(),
        preferredDate: st.date || '',
        preferredTime: st.time || '',
        consultationType: st.type,
        location: st.location.trim(),
        language: st.language,
      },
    });

    if (res.ok) {
      pushNotification({
        type: 'booking',
        title: 'Appointment booked',
        message: `Your ${res.appointment.type === 'Video' ? 'online' : 'in-clinic'} appointment with ${res.appointment.doctorName} on ${fmtDate(res.appointment.appointmentDate)} at ${fmtTime(res.appointment.appointmentTime)} is scheduled.`,
      });
      addLog({ actor: currentUser()?.name, action: 'Appointment booked via smart recommendation', details: `${res.appointment.doctorName} · ${res.appointment.appointmentDate} ${res.appointment.appointmentTime}` });
      confetti();
      renderSuccess(res.appointment);
      return;
    }

    if (btn) { btn.disabled = false; btn.innerHTML = `${icon('checkCircle', 16)} Confirm Appointment`; }

    if (res.status === 409 && res.data && res.data.alternative) {
      renderSuggestion(res.data.alternative, 'This appointment slot is no longer available. We found another suitable time — please review and confirm again.');
      return;
    }
    if (res.status === 409) {
      renderEmpty('That slot was just booked', 'We could not find another suitable time right now. Try again or adjust your preferences.', 'calendarX');
      return;
    }
    renderEmpty('Appointment could not be confirmed', res.error || 'Please try again.', 'xCircle');
  }

  function renderSuccess(appt) {
    const typeLabel = appt.type === 'Video' ? 'Online' : appt.type === 'Phone' ? 'Phone' : 'In-Clinic';
    vp.innerHTML = pageHead('🧠 Smart Doctor Recommendation', 'Your appointment has been booked.') + `
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
        <button class="btn btn-primary" id="recView">${icon('calendar', 15)} View My Appointments</button>
        <button class="btn btn-outline" id="recAnother">${icon('sparkles', 15)} New Recommendation</button>
      </div>
    </div>`;
    vp.querySelector('#recView').addEventListener('click', () => navigate('#/appointments'));
    vp.querySelector('#recAnother').addEventListener('click', () => {
      st.excludeDoctorId = '';
      st.excludeSlot = null;
      renderForm();
    });
  }
}

function addMins(time, mins) {
  const [h, m] = time.split(':').map(Number);
  const t = h * 60 + m + mins;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export function initRecommend() {
  registerPage('smart', smartPage);
}