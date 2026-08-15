// ─────────────────────────────────────────────────────────────
// Shared UI builders for pages
// ─────────────────────────────────────────────────────────────
import { icon, esc, avatar, fmtDate, fmtTime, money, daysUntil } from '../core.js';
import { getDoctor, getPatient } from '../store.js';

export function statusBadge(status, queueStatus = '') {
  if (queueStatus === 'waiting') return `<span class="status-badge status-waiting">${icon('clock', 12)} Waiting</span>`;
  if (queueStatus === 'called') return `<span class="status-badge status-called">${icon('bell', 12)} Called</span>`;
  if (queueStatus === 'in_consultation') return `<span class="status-badge status-in_consultation">${icon('video', 12)} In Consultation</span>`;
  if (queueStatus === 'completed' && status !== 'completed') return `<span class="status-badge status-completed">${icon('check', 12)} Completed</span>`;
  const map = {
    scheduled: ['scheduled', 'Pending', 'clock'],
    confirmed: ['confirmed', 'Confirmed', 'checkCircle'],
    completed: ['completed', 'Completed', 'check'],
    cancelled: ['cancelled', 'Cancelled', 'x'],
    rejected: ['rejected', 'Cancelled', 'x'],
    rescheduled: ['rescheduled', 'Rescheduled', 'rotate'],
    noshow: ['noshow', 'No Show', 'xCircle'],
  };
  const [cls, label, ic] = map[status] || ['scheduled', 'Pending', 'clock'];
  return `<span class="status-badge status-${cls}">${icon(ic, 12)} ${label}</span>`;
}

export function typeChip(type) {
  const map = {
    'In-clinic': ['mapPin', 'blue'],
    'Video': ['video', 'teal'],
    'Phone': ['phone', 'purple'],
  };
  const [ic, cls] = map[type] || ['clock', 'gray'];
  return `<span class="badge ${cls} plain">${icon(ic, 12)} ${esc(type)}</span>`;
}

export function priorityBadge(priority) {
  if (priority !== 'emergency') return '';
  return `<span class="badge red pulse plain">${icon('alert', 12)} Emergency</span>`;
}

export function doctorAvatar(doc, size = '') {
  if (doc && doc.photo) return `<span class="avatar ${size} photo-avatar"><img src="${doc.photo}" alt="${esc(doc.name || '')}" /></span>`;
  return `<span class="avatar ${size} avatar-grad-${doc.color != null ? doc.color : 0}">${esc((doc.name || '?').replace('Dr.', '').trim().split(/\s+/).map(w => w[0]).join(''))}</span>`;
}

export function apptCard(appt, opts = {}) {
  const doc = getDoctor(appt.doctorId) || { name: appt.doctorName, specialty: appt.specialty, color: 0, education: '', clinic: '', location: '' };
  const dd = (appt.appointmentDate || '').split('-');
  const dow = daysUntil(appt.appointmentDate);
  const today = dow === 0;
  const dateChip = dd.length === 3
    ? `<div class="appt-date-chip ${appt.type === 'Video' ? 'teal' : ''}"><span class="d">${Number(dd[2])}</span><span class="m">${MONTHS_SHORT[Number(dd[1]) - 1]}</span></div>`
    : '';
  const actions = opts.actions || '';
  const place = appt.type === 'In-clinic' || appt.type === 'Phone'
    ? `${icon('mapPin', 13)} ${esc(doc.clinic || 'MedCare clinic')}${doc.location ? `, ${esc(doc.location)}` : ''}`
    : `${icon('video', 13)} Online consultation`;
  const bookedOn = appt.createdAt
    ? `${icon('calendar', 13)} Booked ${fmtDate(appt.createdAt.slice(0, 10))}`
    : '';
  const patRow = opts.role && opts.role !== 'patient'
    ? `<span>${icon('user', 13)} Patient: ${esc(getPatient(appt.patientId)?.name || appt.patientName || '—')}</span>`
    : '';
  return `
  <div class="appt-card" data-appt="${appt.id}" role="button" tabindex="0" aria-label="Appointment with ${esc(appt.doctorName)}">
    ${dateChip}
    <div class="appt-card-top">
      ${doctorAvatar(doc, 'md')}
      <div style="flex:1;min-width:0">
        <h4>${esc(appt.doctorName)}</h4>
        <div class="appt-meta">
          <span>${icon('stethoscope', 13)} ${esc(appt.specialty)}</span>
          ${doc.education ? `<span class="row-sub">${esc(doc.education)}</span>` : ''}
        </div>
      </div>
      <div style="display:grid;gap:6px;justify-items:end">
        ${statusBadge(appt.status, appt.queueStatus)}
        ${typeChip(appt.type)}
        ${priorityBadge(appt.priority)}
      </div>
    </div>
    <div class="appt-card-meta">
      <span>${icon('calendar', 13)} ${fmtDate(appt.appointmentDate, { weekday: true })} · ${fmtTime(appt.appointmentTime)}</span>
      <span>${place}</span>
      <span class="mono">${icon('tag', 13)} ${esc(appt.bookingId || appt.id)}</span>
      ${bookedOn ? `<span>${bookedOn}</span>` : ''}
      ${patRow}
      ${today && appt.status === 'confirmed' ? `<span class="badge green pulse plain" style="font-size:.62rem">Today</span>` : ''}
    </div>
    ${appt.notes ? `<div class="appt-reason">${icon('note', 13)} <b>Reason:</b> ${esc(appt.notes)}</div>` : ''}
    <div class="appt-card-foot">
      <span class="appt-fee">${money(appt.fee)}</span>
      ${actions ? `<div class="appt-actions">${actions}</div>` : ''}
    </div>
  </div>`;
}

export function skeletonCards(n = 3) {
  const card = () => `
    <div class="card card-pad" style="display:grid;gap:12px">
      <div class="flex" style="gap:12px;align-items:center">
        <div class="skeleton" style="width:46px;height:46px;border-radius:50%"></div>
        <div style="flex:1;display:grid;gap:8px"><div class="skeleton" style="height:14px;width:55%"></div><div class="skeleton" style="height:11px;width:38%"></div></div>
        <div class="skeleton" style="height:20px;width:92px;border-radius:99px"></div>
      </div>
      <div class="skeleton" style="height:12px;width:72%"></div>
      <div class="skeleton" style="height:12px;width:48%"></div>
      <div class="flex" style="gap:8px"><div class="skeleton" style="height:30px;width:96px;border-radius:10px"></div><div class="skeleton" style="height:30px;width:116px;border-radius:10px"></div></div>
    </div>`;
  return `<div class="sk-cards" style="grid-template-columns:1fr;gap:12px">${Array.from({ length: n }, card).join('')}</div>`;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function pageHead(title, sub, actions = '') {
  return `
  <div class="page-head">
    <div>
      <h1 class="page-title">${title}</h1>
      ${sub ? `<p class="page-sub">${sub}</p>` : ''}
    </div>
    ${actions ? `<div class="actions">${actions}</div>` : ''}
  </div>`;
}

export function kpi({ label, value, iconName, cls = 'blue', trend = '', trendDir = 'up', spark = '' }) {
  return `
  <div class="kpi" style="--kpi-glow:var(--blue-soft)">
    <div class="kpi-top">
      <span class="kpi-icon ${cls}">${icon(iconName, 21)}</span>
      ${trend ? `<span class="kpi-trend ${trendDir}">${trendDir === 'up' ? '↗' : '↘'} ${trend}</span>` : ''}
    </div>
    <div><div class="kpi-value" data-count="${value}">0</div><div class="kpi-label">${label}</div></div>
    ${spark ? `<div class="kpi-spark">${spark}</div>` : ''}
  </div>`;
}

export function sparkline(values, color = '#2563EB', w = 72, h = 30) {
  if (!values || values.length < 2) return '';
  const max = Math.max(...values, 1), min = Math.min(...values);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - 3 - ((v - min) / (max - min || 1)) * (h - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
  </svg>`;
}

export function quickStat({ iconName, cls, val, lbl, trend }) {
  return `
  <div class="quick-stat">
    <span class="qs-ic ${cls}">${icon(iconName, 22)}</span>
    <div>
      <div class="qs-val">${val}</div>
      <div class="qs-lbl">${lbl}</div>
      ${trend ? `<span class="qs-trend ${trend.cls || 'text-success'}">${trend.text}</span>` : ''}
    </div>
  </div>`;
}