// ─────────────────────────────────────────────────────────────
// Messages — secure chat with doctors / patients
// ─────────────────────────────────────────────────────────────
import { icon, esc, toast, emptyState, relativeTime } from '../core.js';
import { getThreads, getThread, sendMessage, markThreadRead } from '../store.js';
import { registerPage, navigate, role } from '../router.js';
import { pageHead } from './shared.js';

function messagesPage(vp, params) {
  const threads = getThreads();
  const initId = params.get('thread') || threads[0]?.id || null;
  let active = initId;

  vp.innerHTML = `
  ${pageHead('Messages', 'Secure, end-to-end encrypted conversations with your healthcare providers.')}
  <div class="chat-layout">
    <div class="chat-threads" id="threads"></div>
    <div class="chat-panel" id="chatPanel"></div>
  </div>`;

  const threadsEl = vp.querySelector('#threads');
  const panelEl = vp.querySelector('#chatPanel');

  function renderThreads() {
    threadsEl.innerHTML = threads.map(t => {
      const last = t.msgs[t.msgs.length - 1];
      const unread = t.msgs.filter(m => m.from !== 'me' && !m.read).length;
      return `
      <div class="thread ${t.id === active ? 'active' : ''}" data-thread="${t.id}">
        <span class="avatar sm avatar-grad-${t.id.endsWith('1') ? 0 : 2}">${esc((t.otherName || '?').replace('Dr.', '').trim().split(/\s+/).map(w => w[0]).join(''))}</span>
        <div class="thread-info">
          <b>${esc(t.otherName)}</b>
          <small>${esc(t.otherRole)} · ${esc(last?.text || '')}</small>
        </div>
        ${unread ? `<span class="unread">${unread}</span>` : ''}
      </div>`;
    }).join('');
    threadsEl.querySelectorAll('[data-thread]').forEach(el => el.addEventListener('click', () => {
      active = el.dataset.thread;
      markThreadRead(active);
      renderThreads();
      renderChat();
    }));
  }

  function renderChat() {
    const t = getThread(active);
    if (!t) {
      panelEl.innerHTML = emptyState('Select a conversation', 'Choose a thread to start messaging.', 'chat');
      return;
    }
    panelEl.innerHTML = `
    <div class="chat-head">
      <span class="avatar sm avatar-grad-${t.id.endsWith('1') ? 0 : 2}">${esc((t.otherName || '?').replace('Dr.', '').trim().split(/\s+/).map(w => w[0]).join(''))}</span>
      <div style="flex:1"><b style="font-size:.9rem">${esc(t.otherName)}</b><div class="row-sub">${esc(t.otherRole)} · ${icon('shield', 12)} Encrypted</div></div>
      <span class="badge green plain">${icon('check', 12)} Online</span>
    </div>
    <div class="chat-body" id="chatBody">
      ${t.msgs.map(m => `
        <div class="msg ${m.from === 'me' ? 'sent' : 'recv'}">
          ${esc(m.text)}
          <span class="time">${relativeTime(m.time)}${m.from === 'me' ? ' · ' + icon('check', 11) : ''}</span>
        </div>`).join('')}
    </div>
    <form class="chat-input" id="chatForm">
      <input class="input" id="chatText" placeholder="Type a message..." autocomplete="off">
      <button class="btn btn-primary btn-icon" type="submit" aria-label="Send message">${icon('send', 18)}</button>
    </form>`;
    const body = panelEl.querySelector('#chatBody');
    body.scrollTop = body.scrollHeight;
    panelEl.querySelector('#chatForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = panelEl.querySelector('#chatText');
      const text = input.value.trim();
      if (!text) return;
      sendMessage(active, text);
      input.value = '';
      renderChat();
      renderThreads();
      toast('Message sent', '', 'info');
    });
  }

  renderThreads();
  renderChat();
}

export function initMessages() {
  registerPage('messages', messagesPage);
}