// ─────────────────────────────────────────────────────────────
// Notifications — animated notification center
// ─────────────────────────────────────────────────────────────
import { icon, esc, toast, emptyState, relativeTime } from '../core.js';
import { getNotifications, markNotifRead, markAllNotifsRead } from '../store.js';
import { registerPage, navigate, role } from '../router.js';
import { pageHead } from './shared.js';

const N_META = {
  reminder: { icon: 'clock', color: 'amber', label: 'Reminder' },
  confirmation: { icon: 'checkCircle', color: 'blue', label: 'Confirmation' },
  cancellation: { icon: 'xCircle', color: 'red', label: 'Cancellation' },
  reschedule: { icon: 'rotate', color: 'purple', label: 'Reschedule' },
  prescription: { icon: 'prescription', color: 'teal', label: 'Prescription' },
  followup: { icon: 'calendarCheck', color: 'green', label: 'Follow-up' },
  emergency: { icon: 'alert', color: 'red', label: 'Emergency' },
  system: { icon: 'sparkles', color: 'navy', label: 'System' },
};

function notifPage(vp) {
  const list = getNotifications();
  const r = role();
  const isDoc = r === 'doctor';
  let filter = 'all';
  const unread = list.filter(n => !n.read).length;

  vp.innerHTML = `
  ${pageHead('Notifications', isDoc ? 'Stay informed about appointments, queue activity and emergencies.' : 'Stay informed about appointments, prescriptions and health updates.', unread ? `<button class="btn btn-ghost" id="markAll">${icon('check', 16)} Mark all read</button>` : '')}
  <div class="flex gap-12" style="align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:18px">
    <div class="chip-select" id="nFilter">
      <button class="chip-opt selected" data-f="all">All ${list.length}</button>
      <button class="chip-opt" data-f="unread">Unread ${unread}</button>
      ${Object.entries(N_META).map(([k, m]) => `<button class="chip-opt" data-f="${k}">${m.label}s</button>`).join('')}
    </div>
  </div>
  <div id="nList" style="display:grid;gap:12px"></div>`;

  const listEl = vp.querySelector('#nList');
  function renderList() {
    let items = list;
    if (filter === 'unread') items = list.filter(n => !n.read);
    else if (filter !== 'all') items = list.filter(n => n.type === filter);
    if (!items.length) {
      listEl.innerHTML = emptyState('You are all caught up', 'No notifications in this category right now.', 'bell2');
      return;
    }
    listEl.innerHTML = items.map(n => {
      const m = N_META[n.type] || N_META.system;
      const action = notifAction(n, isDoc);
      return `
      <div class="notif-card ${n.read ? '' : 'unread'}" data-notif="${n.id}">
        <span class="notif-ic ${m.color}">${icon(m.icon, 20)}</span>
        <div class="notif-body">
          <div class="flex gap-8" style="align-items:center;flex-wrap:wrap">
            <b>${esc(n.title)}</b>
            <span class="badge ${m.color} plain" style="font-size:.6rem">${m.label}</span>
          </div>
          <p>${esc(n.message)}</p>
          <div class="actions">
            ${action ? `<button class="btn btn-soft btn-xs" data-nact="${action}">${actionLabel(n, isDoc)}</button>` : ''}
            <button class="btn btn-ghost btn-xs" data-rm>${icon('x', 12)} Dismiss</button>
          </div>
        </div>
        <span class="notif-time">${relativeTime(n.time)}${n.read ? '' : ' · <span style="color:var(--blue)">new</span>'}</span>
      </div>`;
    }).join('');
    listEl.querySelectorAll('.notif-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-rm]')) {
          card.classList.add('out');
          setTimeout(() => { card.remove(); }, 300);
          return;
        }
        if (e.target.closest('[data-nact]')) {
          markNotifRead(card.dataset.notif);
          navigate(e.target.closest('[data-nact]').dataset.nact);
          return;
        }
        markNotifRead(card.dataset.notif);
        card.classList.remove('unread');
      });
    });
  }

  function notifAction(n, doc) {
    if (n.type === 'prescription') return '#/prescriptions';
    if (n.type === 'emergency') return doc ? '#/queue' : '#/appointments';
    if (['reminder', 'followup', 'confirmation', 'cancellation', 'reschedule'].includes(n.type)) return doc ? '#/schedule' : '#/appointments';
    return '';
  }
  function actionLabel(n, doc) {
    if (n.type === 'prescription') return 'Open prescription';
    if (n.type === 'emergency') return doc ? `${icon('alert', 12)} Respond` : `${icon('alert', 12)} Manage`;
    if (n.type === 'confirmation') return doc ? 'View in schedule' : 'Manage visit';
    return doc ? 'View schedule' : 'View appointment';
  }

  vp.querySelectorAll('#nFilter [data-f]').forEach(b => b.addEventListener('click', () => {
    filter = b.dataset.f;
    vp.querySelectorAll('#nFilter [data-f]').forEach(x => x.classList.toggle('selected', x === b));
    renderList();
  }));

  const markAll = vp.querySelector('#markAll');
  if (markAll) markAll.addEventListener('click', () => {
    markAllNotifsRead();
    toast('All notifications marked read', '', 'info');
    notifPage(vp);
  });

  renderList();
}

export function initNotifications() {
  registerPage('notifications', notifPage);
}