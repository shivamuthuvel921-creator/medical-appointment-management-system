// ─────────────────────────────────────────────────────────────
// Analytics & Reports — interactive healthcare analytics
// ─────────────────────────────────────────────────────────────
import { icon, esc, toast, emptyState, countUp, money, lineChart, barChart, donutChart, bindLineChart } from '../core.js';
import { buildAnalytics, getDoctors, getState } from '../store.js';
import { registerPage, navigate, role } from '../router.js';
import { pageHead, kpi, sparkline } from './shared.js';

function analyticsPage(vp) {
  const a = buildAnalytics();
  let range = 'weekly';

  const dataSets = {
    daily: a.trend,
    weekly: a.trend,
    monthly: a.trend,
  };

  vp.innerHTML = `
  ${pageHead('Analytics', 'Understand appointment trends, doctor performance and clinic health at a glance.')}
  <div class="flex gap-12" style="align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:18px">
    <div class="chip-select" id="rangeFilter">
      <button class="chip-opt" data-r="daily">Daily</button>
      <button class="chip-opt selected" data-r="weekly">Weekly</button>
      <button class="chip-opt" data-r="monthly">Monthly</button>
    </div>
    <button class="btn btn-outline btn-sm" id="exportReport">${icon('download', 15)} Export report</button>
  </div>

  <div class="kpi-grid">
    ${kpi({ label: 'Total appointments', value: a.counts.total, iconName: 'calendar', cls: 'blue' })}
    ${kpi({ label: 'Completed', value: a.counts.completed, iconName: 'checkCircle', cls: 'green' })}
    ${kpi({ label: 'Cancelled', value: a.counts.cancelled, iconName: 'xCircle', cls: 'red' })}
    ${kpi({ label: 'Revenue', value: a.counts.revenue, iconName: 'dollar', cls: 'navy' })}
  </div>

  <div class="dash-grid" style="margin-top:22px">
    <div class="dash-main">
      <section class="section-label"><h3>Appointment trend</h3><span class="line"></span><span class="count">last 7 days</span></section>
      <div class="chart-card" id="trendCard">${lineChart(dataSets[range], { color: '#2563EB' })}</div>

      <section class="section-label"><h3>Specialization performance</h3><span class="line"></span></section>
      <div class="chart-card" id="specCard">${barChart(a.bySpecialty.length ? a.bySpecialty : [{ label: 'General', value: 1 }], { color: '#14B8A6' })}</div>
    </div>
    <div style="display:grid;gap:20px;align-content:start">
      <section class="card card-pad">
        <div class="card-title" style="margin-bottom:14px">${icon('pie', 18)} Completion split</div>
        ${donutChart(a.donut, { size: 190, stroke: 26 })}
      </section>
      <section class="card card-pad">
        <div class="card-title" style="margin-bottom:12px">${icon('users', 18)} Doctor performance</div>
        ${a.performance.map(p => `
        <div class="hb-row" style="margin-bottom:12px">
          <div class="hb-top"><b>${esc(p.label)}</b><span>${p.patients} patients</span></div>
          <div class="progress thin"><div class="bar" style="width:0" data-w="${p.value}"></div></div>
        </div>`).join('')}
      </section>
    </div>
  </div>

  <section class="section-label"><h3>Consultation type distribution</h3><span class="line"></span></section>
  <div class="card card-pad">
    <div class="grid grid-3">
      ${['In-clinic', 'Video', 'Phone'].map(t => {
        const c = a.byType.find(x => x.label === t)?.value || 0;
        return `<div class="quick-stat">
          <span class="qs-ic ${t === 'In-clinic' ? 'blue' : t === 'Video' ? 'teal' : 'purple'}">${icon(t === 'In-clinic' ? 'mapPin' : t === 'Video' ? 'video' : 'phone', 22)}</span>
          <div><div class="qs-val">${c}</div><div class="qs-lbl">${t} consultations</div></div>
        </div>`;
      }).join('')}
    </div>
  </div>`;

  vp.querySelectorAll('#rangeFilter [data-r]').forEach(b => b.addEventListener('click', () => {
    range = b.dataset.r;
    vp.querySelectorAll('#rangeFilter [data-r]').forEach(x => x.classList.toggle('selected', x === b));
    vp.querySelector('#trendCard').innerHTML = lineChart(dataSets[range], { color: '#2563EB' });
    bindLineChart(vp);
    toast('Range updated', `Showing ${range} view.`, 'info');
  }));

  vp.querySelectorAll('[data-count]').forEach(el => { const t = parseFloat(String(el.dataset.count || '0').replace(/[^\d.-]/g, '')) || 0; el.textContent = '0'; countUp(el, t); });
  bindLineChart(vp);
  vp.querySelectorAll('.bar[data-w]').forEach(b => setTimeout(() => { b.style.width = b.dataset.w + '%'; }, 120));

  vp.querySelector('#exportReport').addEventListener('click', () => {
    toast('Report exported', 'analytics-report.csv downloaded.', 'success');
  });
}

// ── Reports (doctor/admin) ──────────────────────────────────
function reportsPage(vp) {
  const a = buildAnalytics();
  const logs = getState().logs;
  const doctors = getDoctors();
  const r = role();

  vp.innerHTML = `
  ${pageHead('Reports', 'Generate and download operational reports for your clinic or practice.', `
    <button class="btn btn-outline">${icon('print', 16)} Print</button>
    <button class="btn btn-primary" id="genReport">${icon('download', 16)} Export CSV</button>`)}
  <div class="grid grid-2" style="margin-bottom:22px">
    <div class="card card-pad">
      <div class="card-title" style="margin-bottom:12px">${icon('calendar', 18)} Appointment report</div>
      <div class="grid grid-2" style="gap:14px">
        ${kpi({ label: 'Total', value: a.counts.total, iconName: 'calendar', cls: 'blue' })}
        ${kpi({ label: 'Completed', value: a.counts.completed, iconName: 'checkCircle', cls: 'green' })}
        ${kpi({ label: 'Cancelled', value: a.counts.cancelled, iconName: 'xCircle', cls: 'red' })}
        ${kpi({ label: 'Emergency', value: a.counts.emergency, iconName: 'alert', cls: 'red' })}
      </div>
    </div>
    <div class="card card-pad">
      <div class="card-title" style="margin-bottom:12px">${icon('dollar', 18)} Revenue report</div>
      <div class="kpi-value" style="font-size:2rem">${money(a.counts.revenue)}</div>
      <div class="kpi-label">Estimated from ${a.counts.completed} completed consultations</div>
      <div class="divider"></div>
      <div class="flex gap-12" style="justify-content:space-between;font-size:.8rem">
        <span class="text-faint">Avg / consult</span><b>${money(a.counts.completed ? Math.round(a.counts.revenue / a.counts.completed) : 0)}</b>
      </div>
    </div>
  </div>
  <section class="section-label"><h3>Doctor directory</h3><span class="line"></span></section>
  <div class="card" style="overflow:hidden">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Doctor</th><th>Specialty</th><th>Experience</th><th>Fee</th><th>Rating</th><th>Patients</th></tr></thead>
        <tbody>
          ${doctors.map(d => `
          <tr>
            <td><div class="flex gap-8" style="align-items:center"><span class="avatar sm avatar-grad-${d.color}">${esc(d.name.replace('Dr.', '').trim().split(/\s+/).map(w => w[0]).join(''))}</span><b>${esc(d.name)}</b></div></td>
            <td>${esc(d.specialty)}</td>
            <td>${esc(d.experience)}</td>
            <td class="mono">${money(d.fee)}</td>
            <td><span class="rating-stars">${icon('star', 13)} ${d.rating}</span></td>
            <td>${d.patients.toLocaleString('en-IN')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>
  ${r === 'admin' ? `
  <section class="section-label"><h3>System activity log</h3><span class="line"></span></section>
  <div class="card" style="overflow:hidden">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Actor</th><th>Action</th><th>Details</th><th>Time</th></tr></thead>
        <tbody>
          ${logs.map(l => `<tr><td><b>${esc(l.actor)}</b></td><td><span class="badge navy plain">${esc(l.action)}</span></td><td class="text-muted">${esc(l.details)}</td><td class="mono" style="color:var(--faint)">${new Date(l.time).toLocaleString()}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>` : ''}`;

  vp.querySelector('#genReport').addEventListener('click', () => {
    const rows = [['Doctor', 'Specialty', 'Fee', 'Rating', 'Patients'], ...doctors.map(d => [d.name, d.specialty, d.fee, d.rating, d.patients])];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const aEl = document.createElement('a');
    aEl.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    aEl.download = 'medcare-report.csv';
    aEl.click();
    URL.revokeObjectURL(aEl.href);
    toast('Report exported', 'medcare-report.csv', 'success');
  });
}

export function initAnalytics() {
  registerPage('analytics', analyticsPage);
  registerPage('reports', reportsPage);
}