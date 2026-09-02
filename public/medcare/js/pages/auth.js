// ─────────────────────────────────────────────────────────────
// Auth — welcome/role choice, patient & doctor login,
// register / forgot / reset (real backend auth, no demo flows)
// ─────────────────────────────────────────────────────────────
import { icon, esc, toast, bindPasswordToggles } from '../core.js';
import { login, register, forgotPassword, resetPassword } from '../store.js';
import { registerPage, navigate, renderRoute } from '../router.js';

let authRole = 'patient';

function visual() {
  const isDoc = authRole === 'doctor';
  return `
  <div class="auth-visual">
    <div class="bubble b1"></div><div class="bubble b2"></div><div class="bubble b3"></div>
    <div class="auth-logo">
      <span class="brand-mark">${icon('plus', 24)}</span>
      <b>MedCare</b>
    </div>
    <div>
      ${isDoc ? doctorVisual() : patientVisual()}
    </div>
    <small class="auth-micro">${isDoc ? 'Professional. Secure. Connected.' : 'Simple. Secure. Patient-focused.'}</small>
  </div>`;
}

function patientVisual() {
  return `
  <div class="auth-hero">
    <span class="kicker">WELCOME TO MEDCARE</span>
    <h1>Your health,<br>in your hands.</h1>
    <p>Manage your healthcare journey with ease. Connect with trusted healthcare services, keep your information organized, and stay in control of your care.</p>
  </div>
  <div class="auth-features">
    <div class="af-row">
      <span class="af-ic">${icon('lock', 17)}</span>
      <div><b>Secure &amp; Private</b><small>Your personal healthcare information is protected with secure access.</small></div>
    </div>
    <div class="af-row">
      <span class="af-ic">${icon('heart', 17)}</span>
      <div><b>Personalized Care</b><small>Manage your profile and healthcare preferences in one place.</small></div>
    </div>
    <div class="af-row">
      <span class="af-ic">${icon('activity', 17)}</span>
      <div><b>Connected Healthcare</b><small>Stay connected with the healthcare services you need, whenever you need them.</small></div>
    </div>
  </div>`;
}

function doctorVisual() {
  return `
  <div class="auth-hero">
    <span class="kicker">WELCOME TO MEDCARE, DOCTOR</span>
    <h1>Care smarter,<br>work better.</h1>
    <p>Manage your clinical workflow with ease. Organize your schedule, coordinate patient care, and access the tools you need in one secure workspace.</p>
  </div>
  <div class="auth-features">
    <div class="af-row">
      <span class="af-ic">${icon('calendar', 17)}</span>
      <div><b>Smart Schedule</b><small>Manage your working hours, availability, and daily clinical schedule with ease.</small></div>
    </div>
    <div class="af-row">
      <span class="af-ic">${icon('users', 17)}</span>
      <div><b>Patient Care</b><small>Organize your patient queue and access the information you need for every consultation.</small></div>
    </div>
    <div class="af-row">
      <span class="af-ic">${icon('analytics', 17)}</span>
      <div><b>Clinical Insights</b><small>Track consultations, appointment trends, and practice insights through your professional dashboard.</small></div>
    </div>
  </div>`;
}

function authShell(panelHtml) {
  return `
  <div class="auth">
    ${visual()}
    <div class="auth-panel">
      <div class="auth-box">${panelHtml}</div>
    </div>
  </div>`;
}

// ── Welcome / role choice ───────────────────────────────────
function welcomePanel() {
  return `
  <div class="welcome">
    <div class="bubble b1"></div><div class="bubble b2"></div><div class="bubble b3"></div>
    <div class="welcome-bg" aria-hidden="true">
      <div class="wg-grid"></div>
      <div class="wg-rays"></div>
      <div class="wg-curves"></div>
      <div class="wg-syms">
        <span class="sym">${icon('plus', 14)}</span>
        <span class="sym">${icon('heart', 14)}</span>
        <span class="sym">${icon('calendar', 14)}</span>
        <span class="sym">${icon('shield', 14)}</span>
        <span class="sym">${icon('stethoscope', 14)}</span>
        <span class="sym">${icon('activity', 14)}</span>
        <span class="sym">${icon('user', 14)}</span>
      </div>
    </div>
    <canvas class="wc-particles" aria-hidden="true"></canvas>
    <div class="welcome-glow" aria-hidden="true"></div>
    <div class="welcome-inner">
      <header class="welcome-head">
        <span class="brand-mark">${icon('plus', 22)}</span>
        <span class="welcome-brand">MedCare</span>
        <span class="badge navy plain" style="margin-left:auto">Smart Medical Appointment Scheduling</span>
      </header>

      <div class="welcome-hero-split">
        <div class="welcome-hero">
          <span class="kicker">${icon('heart', 15)} Your Health, Connected</span>
          <h1>One Platform.<br/>Better Healthcare <span class="grad-txt">Experiences.</span></h1>
          <p>Connect with doctors, manage appointments, and simplify healthcare — all in one secure platform.</p>
        </div>
        <div class="wc-visual" aria-hidden="true">
          <div class="wcv-orbit o1"></div>
          <div class="wcv-orbit o2"></div>
          <div class="wcv-core"><span class="wcv-cross">${icon('plus', 34)}</span></div>
          <svg class="wcv-pulse" viewBox="0 0 120 40" fill="none">
            <defs><linearGradient id="wcpg" x1="0" y1="0" x2="120" y2="0" gradientUnits="userSpaceOnUse"><stop stop-color="#7DD3FC"/><stop offset="1" stop-color="#5EEAD4"/></linearGradient></defs>
            <path class="wcv-line" d="M2 22 H28 L36 12 L46 30 L56 14 L64 22 H118" stroke="url(#wcpg)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="wcv-chip c1">${icon('stethoscope', 16)}</span>
          <span class="wcv-chip c2">${icon('calendar', 16)}</span>
          <span class="wcv-chip c3">${icon('user', 16)}</span>
          <span class="wcv-chip c4">${icon('shield', 16)}</span>
          <span class="wcv-chip c5">${icon('activity', 16)}</span>
        </div>
      </div>

      <div class="welcome-cards">
        <button class="wcard patient" data-role-choice="patient" type="button">
          <span class="wc-ic">${icon('user', 22)}</span>
          <div class="wc-main">
            <b>Patient Portal</b>
            <small>Find doctors, book appointments, manage visits, and access your prescriptions and medical history.</small>
            <span class="wc-cta">Continue as Patient ${icon('arrowRight', 15)}</span>
            <small class="wc-sub">Simple appointment management and connected healthcare access.</small>
          </div>
          <span class="wc-go">${icon('arrowRight', 18)}</span>
        </button>
        <button class="wcard doctor" data-role-choice="doctor" type="button">
          <span class="wc-ic">${icon('stethoscope', 22)}</span>
          <div class="wc-main">
            <b>Doctor Portal</b>
            <small>Manage schedules, patient queues, consultations, prescriptions, and analytics from one professional workspace.</small>
            <span class="wc-cta">Continue as Doctor ${icon('arrowRight', 15)}</span>
            <small class="wc-sub">Everything doctors need to manage appointments and patient care efficiently.</small>
          </div>
          <span class="wc-go">${icon('arrowRight', 18)}</span>
        </button>
      </div>

      <div class="welcome-foot">
        <span>${icon('shield', 14)} Secure Healthcare</span>
        <span>${icon('calendarCheck', 14)} Smart Scheduling</span>
        <span>${icon('heart', 14)} Connected Care</span>
      </div>
      <p class="welcome-credit">Designed for patients. Built for doctors.</p>
      <a id="adminPortal" class="welcome-admin" style="cursor:pointer">Admin sign in →</a>
    </div>
  </div>`;
}

function wireWelcome(container) {
  container.querySelectorAll('[data-role-choice]').forEach(b => {
    b.addEventListener('click', () => navigate('#/login?role=' + b.dataset.roleChoice));
  });
  const admin = container.querySelector('#adminPortal');
  if (admin) admin.addEventListener('click', () => navigate('#/login'));
  initWelcomeFX(container);
}

// ── Landing ambient FX (lightweight particles · mouse glow) ──
function initWelcomeFX(container) {
  const wl = container.querySelector('.welcome');
  if (!wl) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || document.documentElement.classList.contains('motion-off');

  const canvas = wl.querySelector('.wc-particles');
  const ctx = canvas ? canvas.getContext('2d') : null;
  let particles = [], W = 0, H = 0;

  function size() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = wl.clientWidth; H = wl.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = W < 720 ? 24 : W < 1200 ? 38 : 52;
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25,
      r: .6 + Math.random() * 1.4, ph: Math.random() * Math.PI * 2,
      c: ['125,211,252', '94,234,212', '255,255,255'][Math.floor(Math.random() * 3)],
      a: .12 + Math.random() * .3,
    }));
  }

  function draw(t) {
    if (!document.body.contains(wl)) return;
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < -4) p.x = W + 4; else if (p.x > W + 4) p.x = -4;
      if (p.y < -4) p.y = H + 4; else if (p.y > H + 4) p.y = -4;
      const tw = .5 + .5 * Math.sin(t / 900 + p.ph);
      const a = p.a * (.35 + .65 * tw);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + p.c + ',' + (a * .18).toFixed(3) + ')'; ctx.fill();
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + p.c + ',' + a.toFixed(3) + ')'; ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  size();
  window.addEventListener('resize', size, { passive: true });
  if (ctx && !reduced) requestAnimationFrame(draw);

  if (!reduced && window.matchMedia('(hover: hover)').matches) {
    let tx = .72, ty = .3, mx = .72, my = .3, mouseRaf = 0;
    wl.addEventListener('pointermove', e => {
      const r = wl.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width;
      ty = (e.clientY - r.top) / r.height;
      if (!mouseRaf) mouseRaf = requestAnimationFrame(() => {
        mx += (tx - mx) * .12; my += (ty - my) * .12;
        wl.style.setProperty('--mxp', (mx * 100).toFixed(2) + '%');
        wl.style.setProperty('--myp', (my * 100).toFixed(2) + '%');
        wl.style.setProperty('--mxr', ((mx - .5) * 8).toFixed(2));
        wl.style.setProperty('--myr', ((my - .5) * 8).toFixed(2));
        mouseRaf = 0;
      });
    });
  }
}

// ── Login panel — separate Patient vs Doctor screens ────────
function loginPanel(role) {
  const isDoc = role === 'doctor';
  return `
  <div class="auth-head">
    <span class="kicker">${isDoc ? 'Professional access' : 'Welcome back'}</span>
    <h2>${isDoc ? 'Doctor sign in' : 'Patient sign in'}</h2>
    <p>${isDoc ? 'Manage your schedule, patient queue and consultations securely.' : 'Access your appointments, prescriptions and health records securely.'}</p>
  </div>
  <form id="loginForm" novalidate style="display:grid;gap:14px">
    <div class="field">
      <label for="authId">Email address <span class="req">*</span></label>
      <div class="input-icon">
        ${icon('mail', 17)}
        <input class="input" type="text" id="authId" placeholder="you@example.com" autocomplete="username" required />
      </div>
      <small class="err">Enter a valid email address</small>
    </div>
    <div class="field">
      <div class="flex" style="justify-content:space-between;align-items:center">
        <label for="authPassword">Password <span class="req">*</span></label>
        <a class="auth-link" data-mode="forgot" style="font-size:.74rem;font-weight:700;color:var(--blue);cursor:pointer">Forgot password?</a>
      </div>
      <div class="input-icon" style="position:relative">
        ${icon('lock', 17)}
        <input class="input" type="password" id="authPassword" placeholder="••••••••" autocomplete="current-password" required style="padding-right:44px" />
        <button type="button" class="pw-toggle" data-pw="authPassword" aria-label="Show password" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);width:32px;height:32px;display:grid;place-items:center;background:transparent;border:1px solid transparent;border-radius:8px;color:var(--faint);cursor:pointer;">${icon('eye', 17)}</button>
      </div>
      <small class="err">Password must be at least 8 characters</small>
    </div>
    <button class="btn btn-primary btn-block" type="submit" style="padding:13px">${icon(isDoc ? 'stethoscope' : 'lock', 17)} ${isDoc ? 'Sign in to Doctor Portal' : 'Sign in securely'}</button>
  </form>
  <div class="auth-footer">
    ${isDoc
      ? `New doctor? <a data-mode="register">Request practice account</a><br><a data-role-switch="patient" style="cursor:pointer;color:var(--blue)">← Patient sign in</a>`
      : `New to MedCare? <a data-mode="register">Create a free patient account</a><br><a data-role-switch="doctor" style="cursor:pointer;color:var(--blue)">Doctor? Sign in to your portal →</a>`}
  </div>`;
}

function registerPanel() {
  const isDoc = authRole === 'doctor';
  return `
  <div class="auth-head">
    <span class="kicker">Join MedCare</span>
    <h2>${isDoc ? 'Create doctor account' : 'Create patient account'}</h2>
    <p>${isDoc ? 'Set up your professional practice account to manage consultations and schedules.' : 'Book appointments and manage health records in minutes.'}</p>
  </div>
  <form id="registerForm" novalidate style="display:grid;gap:14px">
    <div class="field">
      <label>Full name <span class="req">*</span></label>
      <div class="input-icon">${icon('user', 17)}<input class="input" id="regName" placeholder="Your full name" required /></div>
      <small class="err">Please enter your name</small>
    </div>
    <div class="form-grid">
      <div class="field">
        <label>Email <span class="req">*</span></label>
        <div class="input-icon">${icon('mail', 17)}<input class="input" type="email" id="regEmail" placeholder="you@example.com" required /></div>
        <small class="err">Enter a valid email</small>
      </div>
      <div class="field">
        <label>Phone <span class="req">*</span></label>
        <div class="input-icon">${icon('phone', 17)}<input class="input" id="regPhone" placeholder="+91 98xxxxxx" required /></div>
        <small class="err">Enter a valid phone number</small>
      </div>
    </div>
    <div class="field">
      <label>Password <span class="req">*</span></label>
      <div class="input-icon" style="position:relative">${icon('lock', 17)}<input class="input" type="password" id="regPassword" placeholder="Minimum 8 characters" required style="padding-right:44px" /><button type="button" class="pw-toggle" data-pw="regPassword" aria-label="Show password" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);width:32px;height:32px;display:grid;place-items:center;background:transparent;border:1px solid transparent;border-radius:8px;color:var(--faint);cursor:pointer;">${icon('eye', 17)}</button></div>
      <small class="err">Password must be at least 8 characters</small>
    </div>
    <button class="btn btn-primary btn-block" type="submit" style="padding:13px">${icon('checkCircle', 17)} Create account</button>
  </form>
  <div class="secure-note">${icon('shield', 14)} Your health data is encrypted end-to-end</div>
  <div class="auth-footer">Already have an account? <a data-mode="login">Sign in</a></div>
  `;
}

function forgotPanel() {
  return `
  <div class="auth-head">
    <span class="kicker">Recover access</span>
    <h2>Forgot your password?</h2>
    <p>Enter your registered email and we'll send you a secure password reset link with a token.</p>
  </div>
  <form id="forgotForm" novalidate style="display:grid;gap:14px">
    <div class="field">
      <label>Email address <span class="req">*</span></label>
      <div class="input-icon">${icon('mail', 17)}<input class="input" type="email" id="forgotEmail" placeholder="you@example.com" required /></div>
      <small class="err">Enter a valid email</small>
    </div>
    <button class="btn btn-primary btn-block" type="submit" style="padding:13px">${icon('send', 17)} Send reset link</button>
  </form>
  <div class="auth-footer"><a data-mode="login">← Back to sign in</a></div>
  `;
}

function resetPanel() {
  return `
  <div class="auth-head">
    <span class="kicker">Almost done</span>
    <h2>Set a new password</h2>
    <p>Enter the reset token you received by email, then choose a strong new password.</p>
  </div>
  <form id="resetForm" novalidate style="display:grid;gap:14px">
    <div class="field">
      <label>Reset token <span class="req">*</span></label>
      <div class="input-icon">${icon('key', 17)}<input class="input" id="resetToken" placeholder="Paste token from email" autocomplete="one-time-code" required /></div>
      <small class="err">Enter the token from the email</small>
    </div>
    <div class="field">
      <label>New password <span class="req">*</span></label>
      <div class="input-icon" style="position:relative">${icon('lock', 17)}<input class="input" type="password" id="resetPass" placeholder="Minimum 8 characters" required style="padding-right:44px" /><button type="button" class="pw-toggle" data-pw="resetPass" aria-label="Show password" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);width:32px;height:32px;display:grid;place-items:center;background:transparent;border:1px solid transparent;border-radius:8px;color:var(--faint);cursor:pointer;">${icon('eye', 17)}</button></div>
      <small class="err">Password must be at least 8 characters</small>
    </div>
    <div class="field">
      <label>Confirm password <span class="req">*</span></label>
      <div class="input-icon" style="position:relative">${icon('lock', 17)}<input class="input" type="password" id="resetConfirm" placeholder="Re-enter password" required style="padding-right:44px" /><button type="button" class="pw-toggle" data-pw="resetConfirm" aria-label="Show password" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);width:32px;height:32px;display:grid;place-items:center;background:transparent;border:1px solid transparent;border-radius:8px;color:var(--faint);cursor:pointer;">${icon('eye', 17)}</button></div>
      <small class="err">Passwords do not match</small>
    </div>
    <button class="btn btn-primary btn-block" type="submit" style="padding:13px">${icon('lock', 17)} Update password</button>
  </form>
  <div class="auth-footer"><a data-mode="login">← Back to sign in</a></div>
  `;
}

function spinnerBtn(btn, label) {
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-mini" style="width:18px;height:18px;border:2.5px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;display:inline-block;animation:spin .7s linear infinite"></span> ' + label;
}

function restoreBtn(btn, html) {
  btn.disabled = false;
  btn.innerHTML = html;
}

// ── wire panel ─────────────────────────────────────────────
function wireAuth(container) {
  container.querySelectorAll('[data-mode]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      switchMode(a.dataset.mode);
    });
  });

  container.querySelectorAll('[data-role-switch]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('#/login?role=' + a.dataset.roleSwitch);
    });
  });

  bindPasswordToggles(container);

  const fail = (field) => {
    field.classList.add('invalid');
    setTimeout(() => field.classList.remove('invalid'), 1400);
  };

  const loginForm = container.querySelector('#loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const em = container.querySelector('#authId').value.trim();
      const pw = container.querySelector('#authPassword').value;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return fail(container.querySelector('#authId'));
      if (pw.length < 8) return fail(container.querySelector('#authPassword'));
      const btn = loginForm.querySelector('.btn');
      const orig = btn.innerHTML;
      spinnerBtn(btn, 'Signing in…');
      const r = await login(em, pw);
      if (!r.ok) {
        restoreBtn(btn, orig);
        if (r.status === 401) {
          toast('Incorrect password', 'The password you entered is wrong. Please try again.', 'error');
          fail(container.querySelector('#authPassword'));
        } else if (r.status === 404) {
          toast('Account not found', 'No account matches that email. Create an account or check your details.', 'error');
          fail(container.querySelector('#authId'));
        } else {
          toast('Sign in failed', r.error || 'Could not reach the server.', 'error');
        }
        return;
      }
      const u = r.user || {};
      toast(u.role === 'doctor' ? `Welcome back, ${u.name}` : `Welcome back, ${u.name.split(' ')[0]}`, `Signed in to the ${u.role} portal.`, 'success');
      navigate('#/dashboard');
    });
  }

  const regForm = container.querySelector('#registerForm');
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = container.querySelector('#regName').value.trim();
      const em = container.querySelector('#regEmail').value.trim();
      const ph = container.querySelector('#regPhone').value.trim();
      const pw = container.querySelector('#regPassword').value;
      if (name.length < 2) return fail(container.querySelector('#regName'));
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return fail(container.querySelector('#regEmail'));
      if (ph.replace(/\D/g, '').length < 10) return fail(container.querySelector('#regPhone'));
      if (pw.length < 8) return fail(container.querySelector('#regPassword'));
      const btn = regForm.querySelector('.btn');
      const orig = btn.innerHTML;
      spinnerBtn(btn, 'Creating account…');
      const r = await register({ name, email: em, phone: ph, password: pw, role: authRole === 'doctor' ? 'doctor' : 'patient' });
      if (!r.ok) {
        restoreBtn(btn, orig);
        if (r.status === 409) {
          toast('Email already registered', 'An account with that email already exists. Try signing in.', 'error');
          fail(container.querySelector('#regEmail'));
        } else {
          toast('Registration failed', r.error || 'Could not create account.', 'error');
        }
        return;
      }
      const u = r.user || {};
      toast('Account created', `Welcome to MedCare, ${u.name.split(' ')[0]}!`, 'success');
      navigate('#/dashboard');
    });
  }

  const forgotForm = container.querySelector('#forgotForm');
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const em = container.querySelector('#forgotEmail').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return fail(container.querySelector('#forgotEmail'));
      const btn = forgotForm.querySelector('.btn');
      const orig = btn.innerHTML;
      spinnerBtn(btn, 'Sending…');
      const r = await forgotPassword(em);
      if (!r.ok) {
        restoreBtn(btn, orig);
        toast('Request failed', r.error || 'Could not send a reset link.', 'error');
        return;
      }
      restoreBtn(btn, orig);
      toast('Reset link sent', 'Check your inbox for the token and follow the link to set a new password.', 'info');
      switchMode('reset');
    });
  }

  const resetForm = container.querySelector('#resetForm');
  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = container.querySelector('#resetToken').value.trim();
      const pw = container.querySelector('#resetPass').value;
      const pw2 = container.querySelector('#resetConfirm').value;
      if (!token) return fail(container.querySelector('#resetToken'));
      if (pw.length < 8) return fail(container.querySelector('#resetPass'));
      if (pw !== pw2) { fail(container.querySelector('#resetConfirm')); toast('Passwords do not match', 'Please re-enter your password.', 'error'); return; }
      const btn = resetForm.querySelector('.btn');
      const orig = btn.innerHTML;
      spinnerBtn(btn, 'Updating…');
      const r = await resetPassword(token, pw);
      if (!r.ok) {
        restoreBtn(btn, orig);
        toast('Could not reset password', r.error || 'The token may be invalid or expired.', 'error');
        return;
      }
      const u = r.user || {};
      toast('Password updated', `Welcome back, ${u.name.split(' ')[0]}. You can now use your new password.`, 'success');
      navigate('#/dashboard');
    });
  }
}

const PANELS = { login: () => loginPanel(authRole), register: registerPanel, forgot: forgotPanel, reset: resetPanel };

function switchMode(mode) {
  const vp = document.getElementById('viewport');
  vp.style.animation = 'none';
  void vp.offsetWidth;
  vp.style.animation = '';
  vp.innerHTML = authShell(PANELS[mode]());
  wireAuth(vp);
}

// ── register ───────────────────────────────────────────────
export function initAuth() {
  registerPage('welcome', (vp) => {
    vp.innerHTML = welcomePanel();
    wireWelcome(vp);
  });
  registerPage('login', (vp, params) => {
    authRole = params.get('role') === 'doctor' ? 'doctor' : 'patient';
    vp.innerHTML = authShell(loginPanel(authRole));
    wireAuth(vp);
  });
  registerPage('register', (vp) => {
    vp.innerHTML = authShell(registerPanel());
    wireAuth(vp);
  });
  registerPage('forgot', (vp) => {
    vp.innerHTML = authShell(forgotPanel());
    wireAuth(vp);
  });
  registerPage('reset', (vp) => {
    vp.innerHTML = authShell(resetPanel());
    wireAuth(vp);
  });
}
