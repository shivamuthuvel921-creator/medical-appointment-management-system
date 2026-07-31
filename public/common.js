import { getToken, getUser, clearAuth, saveAuth, isLoggedIn, isAdmin, api } from './auth.js';

export { getToken, getUser, clearAuth, saveAuth, isLoggedIn, isAdmin, api };

export function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

export function showToast(msg, type) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = 'toast toast-' + (type || 'success') + ' show';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 3200);
}

export function setupNav(activePage) {
  const loginLink = document.getElementById('login-link');
  const logoutLink = document.getElementById('logout-link');
  const adminLink = document.getElementById('admin-link');
  const profileLink = document.getElementById('profile-link');
  const registerLink = document.getElementById('register-link');

  if (isLoggedIn()) {
    if (loginLink) loginLink.style.display = 'none';
    if (logoutLink) logoutLink.style.display = 'inline-block';
    if (adminLink && isAdmin()) adminLink.style.display = 'inline-block';
    if (profileLink) profileLink.style.display = 'inline-block';
    if (registerLink) registerLink.style.display = 'none';
    if (logoutLink) {
      logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        clearAuth();
        window.location.href = '/login.html';
      });
    }
  } else if (loginLink) {
    loginLink.style.display = 'inline-block';
  }

  const nav = document.querySelector('.topbar-links');
  if (nav && activePage) {
    nav.querySelectorAll('a').forEach(a => {
      if (a.getAttribute('href') === activePage) a.classList.add('active-nav');
    });
  }
}

export function emptyState(title, message) {
  return `<div class="empty-state"><strong>${esc(title)}</strong>${message ? `<p>${esc(message)}</p>` : ''}</div>`;
}

export function paginationHtml(p, onPage) {
  if (!p || p.totalPages <= 1) return '';
  let html = '<div class="pagination">';
  html += `<button class="btn btn-outline btn-sm" data-page="${p.page - 1}" ${p.page <= 1 ? 'disabled' : ''}>Prev</button>`;
  html += `<span class="page-info">Page ${p.page} of ${p.totalPages} (${p.total})</span>`;
  html += `<button class="btn btn-outline btn-sm" data-page="${p.page + 1}" ${p.page >= p.totalPages ? 'disabled' : ''}>Next</button>`;
  html += '</div>';
  return html;
}

export function bindPagination(container, onPage) {
  container.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = parseInt(btn.dataset.page, 10);
      if (!btn.disabled && page >= 1) onPage(page);
    });
  });
}

export function renderBarChart(el, items, { color = '#0f6b3b' } = {}) {
  if (!items || items.length === 0) {
    el.innerHTML = emptyState('No data', 'Nothing to chart yet.');
    return;
  }
  const max = Math.max(...items.map(i => i.value), 1);
  const width = 640;
  const height = 220;
  const pad = 34;
  const innerW = width - pad * 2;
  const innerH = height - pad - 20;
  const barW = Math.max(14, innerW / items.length - 8);
  let bars = '';
  items.forEach((item, i) => {
    const h = Math.max(2, (item.value / max) * innerH);
    const x = pad + i * (innerW / items.length);
    const y = pad + innerH - h;
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="3" fill="${color}">
        <title>${esc(item.label)}: ${item.value}</title></rect>`;
    bars += `<text x="${x + barW / 2}" y="${height - 6}" font-size="10" text-anchor="middle" fill="#6b7280">${esc(String(item.label).slice(0, 10))}</text>`;
    bars += `<text x="${x + barW / 2}" y="${y - 4}" font-size="10" text-anchor="middle" font-weight="600" fill="#374151">${item.value}</text>`;
  });
  el.innerHTML = `<svg viewBox="0 0 ${width} ${height}" style="width:100%;max-width:${width}px" role="img" aria-label="Bar chart">${bars}</svg>`;
}

export function renderLineChart(el, items, { color = '#1d4ed8' } = {}) {
  if (!items || items.length === 0) {
    el.innerHTML = emptyState('No data', 'Nothing to chart yet.');
    return;
  }
  const width = 640;
  const height = 220;
  const pad = 34;
  const innerW = width - pad * 2;
  const innerH = height - pad - 20;
  const max = Math.max(...items.map(i => i.value), 1);
  const pts = items.map((item, i) => {
    const x = pad + (items.length === 1 ? innerW / 2 : (i * innerW) / (items.length - 1));
    const y = pad + innerH - (item.value / max) * innerH;
    return { x, y, item };
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  let circles = '';
  let labels = '';
  pts.forEach((p, i) => {
    if (i % Math.ceil(items.length / 12) === 0 || i === items.length - 1) {
      labels += `<text x="${p.x}" y="${height - 6}" font-size="9" text-anchor="middle" fill="#9ca3af">${esc(String(p.item.label).slice(5))}</text>`;
    }
    circles += `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${color}"><title>${esc(p.item.label)}: ${p.item.value}</title></circle>`;
  });
  el.innerHTML = `<svg viewBox="0 0 ${width} ${height}" style="width:100%;max-width:${width}px" role="img" aria-label="Line chart">
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2.5"/>${circles}${labels}</svg>`;
}
