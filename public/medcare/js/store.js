// ─────────────────────────────────────────────────────────────
// MedCare store — synchronous caching API client.
// All reads are served from an in-memory cache that is populated
// by bootstrap(). Mutators update the cache optimistically and
// sync with the backend in the background, rolling back on error.
// No demo, dummy or seeded data lives here.
// ─────────────────────────────────────────────────────────────
import { toISO, fromISO, addDays, toast } from './core.js';

const API = '/api';
const SESSION_KEY = 'medcare-session';
const VERIF_KEY = 'medcare-verif-requests';
const LOCAL_HISTORY_KEY = 'medcare-local-history';
const PROFILE_HISTORY_KEY = 'medcare-profile-history';
const EXTRA_KEY = 'medcare-extra';
const SESSION_KEYS = ['medcare-demo-v1', 'medcare-demo-session'];

export const ROLES = { patient: 'Patient', doctor: 'Doctor', admin: 'Admin' };

let cache = {
  users: [],
  doctors: [],
  patients: [],
  appointments: [],
  prescriptions: [],
  history: [],
  notifications: [],
  threads: [],
  logs: [],
  me: null,
  blocks: {},
};
let msgs = {};
let booted = false;
let bootPromise = null;

function resetCache() {
  cache = {
    users: [], doctors: [], patients: [], appointments: [], prescriptions: [],
    history: [], notifications: [], threads: [], logs: [], me: null, blocks: {},
  };
  msgs = {};
}

// ── session helpers ─────────────────────────────────────────
function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}

function setSession(s) {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
}

export function currentUser() {
  const s = getSession();
  return (s && s.user) || null;
}

export function syncSessionUser(record) {
  const s = getSession();
  if (!s) return null;
  s.user = { ...s.user, ...record };
  setSession(s);
  return s.user;
}

export function logout() {
  setSession(null);
  resetCache();
  booted = false;
  bootPromise = null;
  try {
    SESSION_KEYS.forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

// ── API helper ──────────────────────────────────────────────
async function api(path, opts = {}) {
  const s = getSession();
  const headers = { ...(opts.headers || {}) };
  if (s && s.token) headers['Authorization'] = 'Bearer ' + s.token;
  let body = opts.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(API + path, { method: opts.method || 'GET', headers, body });
  } catch {
    return { ok: false, status: 0, error: 'network' };
  }
  if (res.status === 401 && s && s.token) {
    setSession(null);
    if (location.hash !== '#/welcome') location.hash = '#/welcome';
  }
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

// ── value helpers ───────────────────────────────────────────
function iso(sqlDt) {
  if (!sqlDt) return new Date().toISOString();
  if (sqlDt.includes('T')) return sqlDt;
  return sqlDt.replace(' ', 'T') + 'Z';
}

function today() {
  return toISO(new Date()).slice(0, 10);
}

function toMins(t) {
  if (!t) return -1;
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + (m || 0);
}

function minsToTime(m) {
  const h = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${h}:${mm}`;
}

function addMins(t, n) {
  return minsToTime(toMins(t) + n);
}

function mergeDefined(target, patch) {
  for (const k of Object.keys(patch)) {
    if (patch[k] !== undefined) target[k] = patch[k];
  }
  return target;
}

// ── record mapping (backend shape → UI shape) ───────────────
function mapDoctor(d) {
  if (!d) return null;
  const feeRaw = String(d.consultationFee ?? d.fee ?? '').replace(/[^\d.]/g, '');
  const rating = d.rating && d.rating.average != null ? d.rating.average : (d.rating ?? 0);
  const reviews = d.rating && d.rating.count != null ? d.rating.count : (d.reviews ?? 0);
  return {
    id: d.id,
    userId: d.userId,
    name: d.name || '',
    specialty: d.specialty || 'General Medicine',
    experience: d.experience || '0 yrs',
    clinic: d.clinic || 'MedCare Clinic',
    location: d.location || '',
    education: d.qualifications || '',
    fee: feeRaw ? Number(feeRaw) : 0,
    bio: d.bio || '',
    phone: d.phone || '',
    email: d.email || '',
    languages: '',
    rating,
    reviews,
    color: 0,
    patients: 0,
    slots: d.slots || [],
    offDays: [],
    blocked: [],
    availableToday: null,
    nextSlot: null,
    photo: d.avatar || '',
  };
}

function mapBlock(b) {
  return {
    id: 'blk-' + b.id,
    date: b.blockDate,
    time: b.startTime || '',
    startTime: b.startTime || null,
    endTime: b.endTime || null,
    reason: b.reason || '',
  };
}

function mapPatient(user, profile) {
  const p = profile || {};
  return {
    id: user.id,
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    dob: p.dob || '',
    gender: p.gender || '',
    blood: p.bloodGroup || '',
    heightCm: p.height || p.heightCm || '',
    weightKg: p.weight || p.weightKg || '',
    allergies: p.allergies || '',
    condition: p.conditions || p.condition || '',
    medications: p.currentMedications || '',
    history: '',
    lastVisit: '',
  };
}

function mapAppointment(a) {
  const doc = cache.doctors.find(d => d.id === a.doctorId);
  return {
    id: a.id,
    bookingId: 'MC-' + String(a.id || '').slice(0, 8).toUpperCase(),
    patientId: a.userId,
    doctorId: a.doctorId || '',
    patientName: a.patientName || '',
    doctorName: a.doctorName || '',
    specialty: doc ? doc.specialty : '',
    appointmentDate: a.appointmentDate || '',
    appointmentTime: a.appointmentTime || '',
    notes: a.notes || '',
    type: a.type || 'In-clinic',
    fee: doc ? doc.fee : 0,
    duration: a.durationMins || 30,
    status: a.status || 'scheduled',
    priority: a.priority || 'normal',
    queueStatus: a.queueStatus || '',
    diagnosis: a.diagnosis || '',
    medication: a.medication || '',
    followUpDate: a.followUpDate || '',
    createdAt: a.createdAt || '',
    cancelledAt: '',
  };
}

function mapPrescription(r) {
  const appt = cache.appointments.find(a => a.id === r.appointmentId);
  const doc = cache.doctors.find(d => d.id === r.doctorId);
  const patient = cache.patients.find(p => p.id === r.userId);
  return {
    id: r.id,
    appointmentId: r.appointmentId || '',
    patientId: r.userId,
    doctorId: r.doctorId || '',
    doctorName: doc ? doc.name : (appt ? appt.doctorName : ''),
    patientName: patient ? patient.name : (appt ? appt.patientName : ''),
    diagnosis: appt ? appt.diagnosis : '',
    date: (r.createdAt || '').slice(0, 10) || today(),
    items: (r.items || []).map(i => ({
      medicine: i.medicine || '',
      dosage: i.dosage || '',
      frequency: '',
      duration: i.duration || '',
      instructions: i.instructions || '',
    })),
    notes: r.notes || '',
    followUp: appt ? appt.followUpDate : null,
  };
}

function mapNotification(n) {
  return {
    id: n.id,
    type: n.type || 'system',
    title: n.title || 'Notification',
    message: n.message || '',
    time: iso(n.createdAt),
    read: !!n.readAt,
  };
}

function buildHistory(h) {
  const entries = [];
  for (const a of h.appointments || []) {
    entries.push({
      id: 'a-' + a.id,
      type: 'consultation',
      date: a.appointmentDate,
      title: a.diagnosis || a.notes || 'Consultation',
      doctor: a.doctorName || '',
      detail: a.notes || (a.diagnosis ? 'Diagnosis: ' + a.diagnosis : ''),
      status: a.status || '',
    });
  }
  for (const r of h.records || []) {
    entries.push({
      id: 'r-' + r.id,
      type: 'notes',
      date: (r.createdAt || '').slice(0, 10),
      title: r.title || 'Record',
      doctor: '',
      detail: r.notes || '',
      status: '',
    });
  }
  for (const rx of h.prescriptions || []) {
    const doc = cache.doctors.find(d => d.id === rx.doctorId);
    entries.push({
      id: 'rx-' + rx.id,
      type: 'prescription',
      date: (rx.createdAt || '').slice(0, 10),
      title: 'Prescription',
      doctor: doc ? doc.name : '',
      detail: `${(rx.items || []).length} medicine(s)` + (rx.notes ? ' — ' + rx.notes : ''),
      status: '',
      rx: { id: rx.id },
    });
  }
  return entries.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function buildThreads(me) {
  const threads = [];
  for (const a of cache.appointments) {
    const otherName = me.role === 'doctor' ? a.patientName : a.doctorName;
    const otherRole = me.role === 'doctor' ? 'Patient' : 'Doctor';
    const list = (msgs[a.id] || []).map(m => ({
      from: m.senderId === me.userId ? 'me' : m.senderId,
      senderId: m.senderId,
      text: m.body || '',
      time: iso(m.createdAt),
      read: !!m.readAt,
    }));
    threads.push({ id: a.id, otherName, otherRole, msgs: list });
  }
  return threads;
}

function decorateDoctors() {
  for (const d of cache.doctors) {
    const mine = cache.appointments.filter(a => a.doctorId === d.id);
    d.patients = new Set(mine.map(a => a.patientId).filter(Boolean)).size;
    const av = getAvailability(d.id, today());
    d.availableToday = av.slots.length > 0;
    d.nextSlot = av.nextFree;
  }
}

function decoratePatients() {
  for (const p of cache.patients) {
    const mine = cache.appointments
      .filter(a => a.patientId === p.id)
      .sort((a, b) => String(b.appointmentDate + b.appointmentTime).localeCompare(String(a.appointmentDate + a.appointmentTime)));
    p.lastVisit = mine.length ? mine[0].appointmentDate : '';
    p.history = mine.filter(a => a.diagnosis).map(a => a.diagnosis).join(', ');
  }
}

function decorateAppointments() {
  for (const a of cache.appointments) {
    const doc = cache.doctors.find(d => d.id === a.doctorId);
    if (doc) {
      a.specialty = doc.specialty;
      if (!a.fee) a.fee = doc.fee;
    }
  }
}

// ── bootstrap / auth ────────────────────────────────────────
export async function bootstrap() {
  if (booted) return;
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    const me = currentUser();
    if (!me) return;
    cache.me = me;
    cache.me = me;

    const [dr, ap, rx, ntf] = await Promise.all([
      api('/doctors'),
      api('/appointments'),
      api('/prescriptions'),
      api('/notifications'),
    ]);
    cache.doctors = (dr.ok ? dr.data : []).map(mapDoctor).filter(Boolean);
    cache.appointments = (ap.ok ? ap.data : []).map(mapAppointment).filter(Boolean);
    cache.prescriptions = (rx.ok ? rx.data : []).map(mapPrescription).filter(Boolean);
    cache.notifications = (ntf.ok ? ntf.data : []).map(mapNotification).filter(Boolean);

    await Promise.all(cache.doctors.map(async d => {
      const b = await api('/doctors/' + d.id + '/blocks');
      if (b.ok) cache.blocks[d.id] = (b.data || []).map(mapBlock);
    }));

    const myDoc = cache.doctors.find(d => d.userId === me.userId);
    if (me.role === 'doctor') {
      const self = await api('/doctors/me');
      if (self.ok) {
        const idx = cache.doctors.findIndex(x => x.id === self.data.id);
        const fresh = mapDoctor(self.data);
        if (idx >= 0) cache.doctors[idx] = fresh;
        else cache.doctors.push(fresh);
        if (fresh.photo) syncSessionUser({ photo: fresh.photo });
      }
      if (myDoc) {
        const bl = await api('/doctors/me/blocks');
        if (bl.ok) cache.blocks[myDoc.id] = (bl.data || []).map(mapBlock);
      }
    }

    if (me.role === 'admin') {
      const u = await api('/users');
      if (u.ok) {
        cache.users = (u.data || []).filter(x => x.role !== 'doctor' && x.role !== 'admin');
        await Promise.all(cache.users.map(async usr => {
          const p = await api('/patients/' + usr.id + '/profile');
          if (p.ok) cache.patients.push(mapPatient(p.data.user || usr, p.data.profile));
        }));
      }
    } else if (me.role === 'doctor') {
      const ids = [...new Set(cache.appointments.filter(a => a.doctorId === (myDoc ? myDoc.id : null)).map(a => a.patientId).filter(Boolean))];
      await Promise.all(ids.map(async uid => {
        const p = await api('/patients/' + uid + '/profile');
        if (p.ok) cache.patients.push(mapPatient(p.data.user, p.data.profile));
      }));
    } else {
      const p = await api('/patients/' + me.userId + '/profile');
      if (p.ok) cache.patients.push(mapPatient(p.data.user || me, p.data.profile));
    }

    if (me.role === 'patient') {
      const h = await api('/patients/' + me.userId + '/history');
      if (h.ok) cache.history = buildHistory(h.data);
    }

    try {
      const localHistory = JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]');
      cache.history = [...cache.history, ...localHistory]
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    } catch { /* ignore */ }

    await Promise.all(cache.appointments.map(async a => {
      const m = await api('/messages/appointment/' + a.id);
      if (m.ok) msgs[a.id] = m.data;
    }));
    cache.threads = buildThreads(me);
    decorateDoctors();
    decoratePatients();
    decorateAppointments();
    booted = true;
  })();
  await bootPromise;
  if (!booted) bootPromise = null;
  return currentUser();
}

export async function login(email, password) {
  const r = await api('/auth/login', { method: 'POST', body: { email, password } });
  if (!r.ok) {
    return { ok: false, status: r.status, error: r.data && r.data.error ? r.data.error : 'Invalid email or password' };
  }
  const u = r.data.user;
  setSession({ token: r.data.token, user: { userId: u.id, name: u.name, email: u.email, phone: u.phone || '', role: u.role, photo: '' } });
  await bootstrap();
  return { ok: true, user: currentUser() };
}

export async function register({ name, email, phone, password, role }) {
  const r = await api('/auth/register', {
    method: 'POST',
    body: { name, email, phone, password, role: role || 'patient' },
  });
  if (!r.ok) {
    return { ok: false, status: r.status, error: r.data && r.data.error ? r.data.error : 'Registration failed' };
  }
  const u = r.data.user;
  setSession({ token: r.data.token, user: { userId: u.id, name: u.name, email: u.email, phone: u.phone || '', role: u.role, photo: '' } });
  await bootstrap();
  return { ok: true, user: currentUser() };
}

export async function forgotPassword(email) {
  const r = await api('/auth/forgot', { method: 'POST', body: { email } });
  if (!r.ok) return { ok: false, error: r.data && r.data.error ? r.data.error : 'Could not request reset' };
  return { ok: true, message: r.data.message || 'Reset link sent' };
}

export async function resetPassword(token, password) {
  const r = await api('/auth/reset', { method: 'POST', body: { token, password } });
  if (!r.ok) return { ok: false, error: r.data && r.data.error ? r.data.error : 'Could not reset password' };
  const u = r.data.user;
  setSession({ token: r.data.token, user: { userId: u.id, name: u.name, email: u.email, phone: u.phone || '', role: u.role, photo: '' } });
  await bootstrap();
  return { ok: true, user: currentUser() };
}

export function getState() {
  return cache;
}

// ── doctors ─────────────────────────────────────────────────
export function getDoctors() {
  return cache.doctors;
}

export function getDoctor(id) {
  return cache.doctors.find(d => d.id === id) || null;
}

export function addDoctor(data) {
  const me = currentUser();
  const body = {
    name: data.name || '',
    specialty: data.specialty || 'General Medicine',
    experience: data.experience || '',
    clinic: data.clinic || '',
    qualifications: data.education || '',
    consultationFee: String(data.fee ?? '').replace(/[^\d.]/g, ''),
    bio: data.bio || '',
    phone: data.phone || '',
    email: data.email || '',
  };
  api('/doctors', { method: 'POST', body }).then(r => {
    if (r.ok && me && me.role === 'admin') {
      cache.doctors.push(mapDoctor(r.data));
      decorateDoctors();
      toast('Doctor added', `${r.data.name} is now available on MedCare.`, 'success');
    } else if (!r.ok && r.data && r.data.error) {
      toast('Could not add doctor', r.data.error, 'error');
    }
  });
  return { ok: true };
}

export function updateDoctor(id, patch) {
  const doc = cache.doctors.find(d => d.id === id);
  if (!doc) return;
  const prev = { ...doc };
  mergeDefined(doc, {
    name: patch.name,
    specialty: patch.specialty,
    experience: patch.experience,
    clinic: patch.clinic,
    education: patch.education,
    fee: patch.fee,
    bio: patch.bio,
    phone: patch.phone,
    email: patch.email,
  });
  const body = {
    name: patch.name,
    specialty: patch.specialty,
    experience: patch.experience,
    clinic: patch.clinic,
    qualifications: patch.education,
    consultationFee: patch.fee != null ? String(patch.fee).replace(/[^\d.]/g, '') : undefined,
    bio: patch.bio,
    phone: patch.phone,
    email: patch.email,
  };
  for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k];
  api('/doctors/' + id, { method: 'PUT', body }).then(r => {
    if (!r.ok) {
      mergeDefined(doc, prev);
      if (r.data && r.data.error) toast('Update failed', r.data.error, 'error');
    }
  });
}

export function removeDoctor(id) {
  cache.doctors = cache.doctors.filter(d => d.id !== id);
  delete cache.blocks[id];
  api('/doctors/' + id, { method: 'DELETE' });
}

// ── schedule & availability ─────────────────────────────────
export function setWorkingSchedule(doctorId, { days, startTime, endTime }) {
  const slots = days.map(dow => ({ dayOfWeek: dow, startTime, endTime }));
  const doc = cache.doctors.find(d => d.id === doctorId);
  if (doc) doc.slots = slots;
  const me = currentUser();
  const path = me && me.role === 'admin' ? '/doctors/' + doctorId + '/slots' : '/doctors/me/slots';
  api(path, { method: 'PUT', body: { slots } });
  return { ok: true };
}

export function setAvailability(doctorId, { weekly, duration }) {
  if (weekly) setWorkingSchedule(doctorId, weekly);
  const doc = cache.doctors.find(d => d.id === doctorId);
  if (doc && duration) doc.duration = duration;
  return { ok: true };
}

export function getAvailability(doctorId, date) {
  const doc = cache.doctors.find(d => d.id === doctorId);
  const d = date ? fromISO(date) : new Date();
  const dow = d.getDay();
  const slotsDef = ((doc && doc.slots) || []).filter(s => s.dayOfWeek === dow);
  const booked = new Set(
    cache.appointments
      .filter(a => a.doctorId === doctorId && a.appointmentDate === date && !['cancelled', 'rejected', 'completed'].includes(a.status))
      .map(a => a.appointmentTime),
  );
  const blocks = ((cache.blocks[doctorId] || []).filter(b => b.date === date));
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const slots = [];
  for (const s of slotsDef) {
    const start = toMins(s.startTime);
    const end = toMins(s.endTime) || start + 60;
    for (let t = start; t < end; t += 30) {
      const time = minsToTime(t);
      const blocked = blocks.some(b => {
        const bs = b.startTime ? toMins(b.startTime) : -1;
        const be = b.endTime ? toMins(b.endTime) : bs + 30;
        return bs >= 0 && t >= bs && t < be;
      });
      if (blocked || booked.has(time)) continue;
      if (date === today() && t <= nowMins) continue;
      slots.push({ time, end: minsToTime(t + 30) });
    }
  }
  return { slots, nextFree: slots.length ? slots[0].time : null };
}

function putBlocks(doctorId) {
  const blocks = cache.blocks[doctorId] || [];
  api('/doctors/me/blocks', {
    method: 'PUT',
    body: { blocks: blocks.map(b => ({ blockDate: b.date, startTime: b.startTime || null, endTime: b.endTime || null, reason: b.reason || '' })) },
  });
}

export function getBlocked(doctorId) {
  return cache.blocks[doctorId] || [];
}

export function blockSlot(doctorId, date, time) {
  const list = cache.blocks[doctorId] || (cache.blocks[doctorId] = []);
  if (!list.some(b => b.date === date && b.time === time)) {
    list.push({ id: 'blk-local-' + Date.now(), date, time, startTime: time, endTime: addMins(time, 30), reason: '' });
  }
  putBlocks(doctorId);
  return { ok: true };
}

export function unblockSlot(doctorId, date, time) {
  cache.blocks[doctorId] = (cache.blocks[doctorId] || []).filter(b => !(b.date === date && b.time === time));
  putBlocks(doctorId);
  return { ok: true };
}

export function getOffDays(doctorId) {
  return (cache.blocks[doctorId] || []).filter(b => !b.startTime).map(b => b.date);
}

export function setOffDay(doctorId, date) {
  const list = cache.blocks[doctorId] || (cache.blocks[doctorId] = []);
  if (!list.some(b => b.date === date && !b.startTime)) {
    list.push({ id: 'blk-local-' + Date.now(), date, time: '', startTime: null, endTime: null, reason: 'off-day' });
  }
  putBlocks(doctorId);
  return { ok: true };
}

export function removeOffDay(doctorId, date) {
  cache.blocks[doctorId] = (cache.blocks[doctorId] || []).filter(b => !(b.date === date && !b.startTime));
  putBlocks(doctorId);
  return { ok: true };
}

// ── appointments ────────────────────────────────────────────
const APPT_PATCH_KEYS = [
  'patientName', 'medication', 'doctorName', 'doctorId', 'appointmentDate',
  'appointmentTime', 'notes', 'status', 'priority', 'diagnosis', 'queueStatus',
  'durationMins', 'type',
];

export function getAppointments(filters = {}) {
  let list = cache.appointments;
  if (filters.doctorId) list = list.filter(a => a.doctorId === filters.doctorId);
  if (filters.patientId) list = list.filter(a => a.patientId === filters.patientId);
  if (filters.status) list = list.filter(a => a.status === filters.status);
  if (filters.date) list = list.filter(a => a.appointmentDate === filters.date);
  return list;
}

export function getAppointment(id) {
  return cache.appointments.find(a => a.id === id) || null;
}

function buildTempAppointment(data) {
  const me = currentUser();
  const tempId = 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const doc = cache.doctors.find(d => d.id === data.doctorId);
  return {
    id: tempId,
    bookingId: 'MC-' + tempId.slice(6, 14).toUpperCase(),
    patientId: me ? me.userId : data.patientId,
    doctorId: data.doctorId,
    patientName: data.patientName || (me ? me.name : 'Patient'),
    doctorName: data.doctorName || (doc ? doc.name : ''),
    specialty: doc ? doc.specialty : '',
    appointmentDate: data.appointmentDate,
    appointmentTime: data.appointmentTime,
    notes: data.notes || '',
    type: data.type || 'In-clinic',
    fee: doc ? doc.fee : 0,
    duration: data.duration || 30,
    status: data.status || 'scheduled',
    priority: data.priority || 'normal',
    queueStatus: data.queueStatus || '',
    diagnosis: '',
    medication: data.medication || '',
    followUpDate: data.followUpDate || '',
    createdAt: new Date().toISOString(),
    cancelledAt: '',
  };
}

function appointmentPostBody(data, temp) {
  return {
    patientName: temp.patientName,
    doctorName: temp.doctorName,
    doctorId: data.doctorId,
    appointmentDate: data.appointmentDate,
    appointmentTime: data.appointmentTime,
    notes: data.notes || '',
    status: data.status || 'scheduled',
    priority: data.priority || 'normal',
    type: data.type || 'In-clinic',
    medication: data.medication || (data.type || 'In-clinic') + ' consult',
  };
}

export function addAppointment(data) {
  const me = currentUser();
  const temp = buildTempAppointment(data);
  cache.appointments.unshift(temp);
  const body = appointmentPostBody(data, temp);
  api('/appointments', { method: 'POST', body }).then(r => {
    if (r.ok) {
      const idx = cache.appointments.findIndex(x => x.id === temp.id);
      const real = mapAppointment({ ...r.data, userId: me ? me.userId : data.patientId });
      if (idx >= 0) cache.appointments[idx] = real;
      else cache.appointments.unshift(real);
      decorateDoctors();
      decorateAppointments();
    } else {
      cache.appointments = cache.appointments.filter(x => x.id !== temp.id);
      if (r.status === 409) toast('Slot taken', 'That slot was just booked — please pick another time.', 'error');
      else if (r.data && r.data.error) toast('Booking failed', r.data.error, 'error');
    }
  });
  return temp;
}

export async function bookAppointment(data) {
  const me = currentUser();
  const temp = buildTempAppointment(data);
  cache.appointments.unshift(temp);
  const r = await api('/appointments', { method: 'POST', body: appointmentPostBody(data, temp) });
  if (r.ok) {
    const idx = cache.appointments.findIndex(x => x.id === temp.id);
    const real = mapAppointment({ ...r.data, userId: me ? me.userId : data.patientId });
    if (idx >= 0) cache.appointments[idx] = real;
    else cache.appointments.unshift(real);
    decorateDoctors();
    decorateAppointments();
    return { ok: true, appointment: real };
  }
  cache.appointments = cache.appointments.filter(x => x.id !== temp.id);
  return { ok: false, status: r.status, error: (r.data && r.data.error) || 'Booking failed' };
}

export function updateAppointment(id, patch) {
  const idx = cache.appointments.findIndex(a => a.id === id);
  const prev = idx >= 0 ? { ...cache.appointments[idx] } : null;
  if (idx >= 0) {
    const a = cache.appointments[idx];
    for (const k of Object.keys(patch)) {
      if (k === 'duration') { a.duration = patch[k]; continue; }
      if (k === 'vitals' || k === 'followUp' || k === 'cancelledAt') { a[k] = patch[k]; continue; }
      if (APPT_PATCH_KEYS.includes(k)) a[k] = patch[k];
    }
    if (patch.duration !== undefined) a.durationMins = patch.duration;
  }
  const body = {};
  for (const k of APPT_PATCH_KEYS) if (patch[k] !== undefined) body[k] = patch[k];
  if (!Object.keys(body).length) return;
  api('/appointments/' + id, { method: 'PUT', body }).then(r => {
    if (r.ok && idx >= 0) {
      const keep = cache.appointments[idx];
      cache.appointments[idx] = mapAppointment({ ...r.data, userId: keep.patientId });
    } else if (!r.ok && idx >= 0 && prev) {
      cache.appointments[idx] = { ...prev, vitals: prev.vitals, followUp: prev.followUp };
      if (r.data && r.data.error) toast('Update failed', r.data.error, 'error');
    }
  });
}

export function cancelAppointment(id) {
  updateAppointment(id, { status: 'cancelled' });
}

export function rescheduleAppointment(id, date, time) {
  const a = cache.appointments.find(x => x.id === id);
  const prev = a ? { ...a } : null;
  if (a) {
    a.appointmentDate = date;
    a.appointmentTime = time;
  }
  api('/appointments/' + id, { method: 'PUT', body: { appointmentDate: date, appointmentTime: time } }).then(r => {
    if (!r.ok && a && prev) {
      a.appointmentDate = prev.appointmentDate;
      a.appointmentTime = prev.appointmentTime;
      if (r.data && r.data.error) toast('Reschedule failed', r.data.error, 'error');
    }
  });
}

export function deleteAppointment(id) {
  cache.appointments = cache.appointments.filter(a => a.id !== id);
  api('/appointments/' + id, { method: 'DELETE' });
}

// ── prescriptions ───────────────────────────────────────────
export function getPrescriptions() {
  return cache.prescriptions;
}

export function getPrescription(id) {
  return cache.prescriptions.find(r => r.id === id) || null;
}

export function addPrescription(rx) {
  const appt = cache.appointments.find(a => a.id === rx.appointmentId);
  const tempId = 'rx-local-' + Date.now();
  const temp = {
    id: tempId,
    appointmentId: rx.appointmentId || '',
    patientId: rx.patientId,
    doctorId: rx.doctorId || '',
    doctorName: rx.doctorName || '',
    patientName: rx.patientName || '',
    diagnosis: rx.diagnosis || (appt ? appt.diagnosis : ''),
    date: today(),
    items: (rx.items || []).map(i => ({ ...i, frequency: i.frequency || '' })),
    notes: rx.notes || '',
    followUp: rx.followUp || (appt ? appt.followUpDate : null),
  };
  cache.prescriptions.unshift(temp);
  const body = {
    appointmentId: rx.appointmentId || null,
    userId: rx.patientId,
    notes: rx.notes || '',
    items: (rx.items || []).map(i => ({
      medicine: i.medicine,
      dosage: i.dosage || '',
      duration: i.duration || '',
      instructions: i.instructions || '',
    })),
  };
  api('/prescriptions', { method: 'POST', body }).then(r => {
    if (r.ok) {
      const idx = cache.prescriptions.findIndex(x => x.id === tempId);
      const real = mapPrescription(r.data);
      if (idx >= 0) cache.prescriptions[idx] = real;
      else cache.prescriptions.unshift(real);
    } else {
      cache.prescriptions = cache.prescriptions.filter(x => x.id !== tempId);
      if (r.data && r.data.error) toast('Prescription failed', r.data.error, 'error');
    }
  });
  return temp;
}

export function deletePrescription(id) {
  cache.prescriptions = cache.prescriptions.filter(r => r.id !== id);
  api('/prescriptions/' + id, { method: 'DELETE' });
}

// ── patients ────────────────────────────────────────────────
export function getPatients() {
  return cache.patients;
}

export function getPatient(id) {
  return cache.patients.find(p => p.id === id) || null;
}

function getExtra(id) {
  try {
    return JSON.parse(localStorage.getItem(EXTRA_KEY) || '{}')[id] || {};
  } catch {
    return {};
  }
}

function saveExtra(id, extra) {
  try {
    const all = JSON.parse(localStorage.getItem(EXTRA_KEY) || '{}');
    all[id] = extra;
    localStorage.setItem(EXTRA_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

export async function updateProfile(role, id, patch) {
  const me = currentUser();
  const extra = { ...getExtra(id) };

  const userPatch = {};
  if (patch.name !== undefined) userPatch.name = String(patch.name).trim();
  if (patch.phone !== undefined && role !== 'doctor') userPatch.phone = String(patch.phone).trim();

  const profilePatch = {};
  if (patch.dob !== undefined) profilePatch.dob = patch.dob;
  if (patch.gender !== undefined) profilePatch.gender = patch.gender;
  if (patch.blood !== undefined) profilePatch.bloodGroup = patch.blood;
  if (patch.heightCm !== undefined) profilePatch.height = String(patch.heightCm);
  if (patch.weightKg !== undefined) profilePatch.weight = String(patch.weightKg);
  if (patch.allergies !== undefined) profilePatch.allergies = String(patch.allergies);
  if (patch.condition !== undefined || patch.conditions !== undefined) profilePatch.conditions = String(patch.conditions ?? patch.condition);
  if (patch.medications !== undefined) profilePatch.currentMedications = String(patch.medications);

  const doctorPatch = {};
  if (patch.specialty !== undefined) doctorPatch.specialty = patch.specialty;
  if (patch.experience !== undefined) doctorPatch.experience = patch.experience;
  if (patch.clinic !== undefined) doctorPatch.clinic = patch.clinic;
  if (patch.education !== undefined) doctorPatch.qualifications = patch.education;
  if (patch.fee !== undefined) doctorPatch.consultationFee = String(patch.fee).replace(/[^\d.]/g, '');
  if (patch.bio !== undefined) doctorPatch.bio = patch.bio;
  if (patch.email !== undefined && role === 'doctor') doctorPatch.email = patch.email;
  if (patch.phone !== undefined && role === 'doctor') doctorPatch.phone = String(patch.phone).trim();

  const skip = new Set(['name', 'phone', 'dob', 'gender', 'blood', 'heightCm', 'weightKg', 'allergies', 'conditions', 'condition', 'medications', 'specialty', 'experience', 'clinic', 'education', 'fee', 'bio', 'email', 'photo']);
  for (const k of Object.keys(patch)) {
    if (patch[k] === undefined || skip.has(k)) continue;
    extra[k] = patch[k];
  }
  saveExtra(id, extra);

  if (role === 'doctor') {
    const d = cache.doctors.find(x => x.id === id);
    if (d) {
      mergeDefined(d, {
        name: patch.name, specialty: patch.specialty, experience: patch.experience,
        clinic: patch.clinic, education: patch.education, fee: patch.fee,
        bio: patch.bio, email: patch.email, phone: patch.phone,
      });
      if (patch.photo) d.photo = patch.photo;
    }
  } else {
    const pat = cache.patients.find(x => x.id === id);
    if (pat) {
      mergeDefined(pat, {
        name: patch.name, phone: patch.phone, blood: patch.blood, heightCm: patch.heightCm,
        weightKg: patch.weightKg, allergies: patch.allergies,
        condition: patch.conditions ?? patch.condition, medications: patch.medications,
        dob: patch.dob, gender: patch.gender,
      });
    }
  }

  const calls = [];
  if (Object.keys(userPatch).length) calls.push(api('/auth/me', { method: 'PUT', body: userPatch }));
  if (Object.keys(profilePatch).length && role !== 'doctor') {
    calls.push(api('/patients/' + id + '/profile', { method: 'PUT', body: profilePatch }));
  }
  if (Object.keys(doctorPatch).length) {
    if (role === 'doctor') calls.push(api('/doctors/me', { method: 'PUT', body: doctorPatch }));
    else if (me && me.role === 'admin') calls.push(api('/doctors/' + id, { method: 'PUT', body: doctorPatch }));
  }
  if (patch.photo && role === 'doctor') {
    const fd = new FormData();
    fd.append('photo', patch.photo);
    calls.push(api('/doctors/me/photo', { method: 'POST', body: fd }).then(r => {
      if (r.ok && r.data && r.data.avatar) {
        const d = cache.doctors.find(x => x.id === id);
        if (d) d.photo = r.data.avatar;
        syncSessionUser({ photo: r.data.avatar });
      }
    }));
  }
  const settled = await Promise.all(calls.map(c => c.catch(() => ({ ok: false, status: 0 }))));
  if (userPatch.name || userPatch.phone) syncSessionUser({ name: userPatch.name, phone: userPatch.phone });

  try {
    const log = JSON.parse(localStorage.getItem(PROFILE_HISTORY_KEY) || '[]');
    const changed = Object.keys(patch).filter(k => patch[k] !== undefined);
    if (changed.length) {
      log.unshift({ id, role, field: changed.join(', '), value: JSON.stringify(patch), time: new Date().toISOString() });
      localStorage.setItem(PROFILE_HISTORY_KEY, JSON.stringify(log.slice(0, 50)));
    }
  } catch { /* ignore */ }

  return { ok: settled.every(r => r.ok) };
}

export function requestVerificationChange(id, field, value) {
  try {
    const reqs = JSON.parse(localStorage.getItem(VERIF_KEY) || '[]');
    reqs.push({ id, field, value, requestedAt: new Date().toISOString() });
    localStorage.setItem(VERIF_KEY, JSON.stringify(reqs.slice(-50)));
  } catch { /* ignore */ }
  return { ok: true };
}

export function getProfileHistory(role) {
  try {
    const all = JSON.parse(localStorage.getItem(PROFILE_HISTORY_KEY) || '[]');
    return all.filter(e => e.role === role);
  } catch {
    return [];
  }
}

export async function changePassword(role, current, next) {
  const r = await api('/auth/password', { method: 'PUT', body: { oldPassword: current, newPassword: next } });
  if (!r.ok) {
    const msg = r.data && r.data.error ? r.data.error : 'Could not change password';
    if (r.status === 400 && /current/i.test(msg)) return { ok: false, error: 'bad-current' };
    return { ok: false, error: msg };
  }
  return { ok: true };
}

// ── history ─────────────────────────────────────────────────
export function getHistory() {
  return cache.history;
}

export function addHistory(entry) {
  const me = currentUser();
  const rec = {
    id: 'h-local-' + Date.now(),
    ...entry,
    doctor: entry.doctor || (me ? me.name : ''),
    date: entry.date || today(),
  };
  cache.history.unshift(rec);
  try {
    const list = JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]');
    list.unshift(rec);
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(list.slice(0, 100)));
  } catch { /* ignore */ }
  return rec;
}

// ── notifications ───────────────────────────────────────────
export function getNotifications() {
  return cache.notifications;
}

export function pushNotification({ type, title, message }) {
  const me = currentUser();
  if (!me) return null;
  const temp = {
    id: 'local-' + Date.now(),
    type: type || 'system',
    title: title || 'Notification',
    message: message || '',
    time: new Date().toISOString(),
    read: false,
  };
  cache.notifications.unshift(temp);
  api('/notifications', { method: 'POST', body: { type: temp.type, title: temp.title, message: temp.message } }).then(r => {
    if (r.ok && r.data && r.data.id) temp.id = r.data.id;
  });
  return temp;
}

export function markNotifRead(id) {
  const n = cache.notifications.find(x => x.id === id);
  if (n) n.read = true;
  if (String(id).startsWith('local-')) return;
  api('/notifications/' + id + '/read', { method: 'PATCH' });
}

export function markAllNotifsRead() {
  cache.notifications.forEach(n => { n.read = true; });
  api('/notifications/read-all', { method: 'POST' });
}

export function unreadCount() {
  return cache.notifications.filter(n => !n.read).length;
}

// ── messages ────────────────────────────────────────────────
export function getThreads() {
  return cache.threads;
}

export function getThread(id) {
  return cache.threads.find(t => t.id === id) || null;
}

export function sendMessage(threadId, text) {
  const me = currentUser();
  const t = cache.threads.find(x => x.id === threadId);
  const optimistic = { from: 'me', senderId: me ? me.userId : 'me', text, time: new Date().toISOString(), read: true };
  if (t) t.msgs.push(optimistic);
  api('/messages', { method: 'POST', body: { appointmentId: threadId, body: text } }).then(r => {
    if (!r.ok && t) {
      const idx = t.msgs.lastIndexOf(optimistic);
      if (idx >= 0) t.msgs.splice(idx, 1);
      if (r.data && r.data.error) toast('Message failed', r.data.error, 'error');
    }
  });
}

export function unreadMessages() {
  return cache.threads.reduce((s, t) => s + t.msgs.filter(m => m.from !== 'me' && !m.read).length, 0);
}

export function markThreadRead(id) {
  const t = cache.threads.find(x => x.id === id);
  if (!t) return;
  t.msgs.forEach(m => { if (m.from !== 'me') m.read = true; });
}

// ── logs & analytics ────────────────────────────────────────
export function getLogs() {
  return cache.logs;
}

export function addLog(entry) {
  cache.logs.unshift({ ...entry, time: entry.time || new Date().toISOString() });
  if (cache.logs.length > 200) cache.logs = cache.logs.slice(0, 200);
}

export function getActivity() {
  return cache.logs;
}

export function buildAnalytics() {
  const appts = cache.appointments;
  const total = appts.length;
  const completed = appts.filter(a => a.status === 'completed').length;
  const cancelled = appts.filter(a => a.status === 'cancelled' || a.status === 'rejected').length;
  const emergency = appts.filter(a => a.priority === 'emergency').length;
  const upcoming = appts.filter(a => ['scheduled', 'confirmed'].includes(a.status)).length;
  const revenue = appts.filter(a => a.status === 'completed').reduce((s, a) => s + (a.fee || 0), 0);

  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today(), -i);
    last7.push({ label: d.slice(5), date: d, value: appts.filter(a => a.appointmentDate === d).length });
  }

  const bySpecialty = {};
  const byType = { 'In-clinic': 0, Video: 0, Phone: 0 };
  const perDoc = {};
  for (const a of appts) {
    const spec = a.specialty || 'General';
    bySpecialty[spec] = (bySpecialty[spec] || 0) + 1;
    if (a.type in byType) byType[a.type] += 1;
    else byType['In-clinic'] += 1;
    const key = a.doctorId || 'unassigned';
    perDoc[key] = (perDoc[key] || 0) + 1;
  }

  const max = Math.max(1, ...Object.values(perDoc));
  let performance = cache.doctors.map(d => ({
    label: d.name,
    patients: perDoc[d.id] || 0,
    value: Math.round(((perDoc[d.id] || 0) / max) * 100),
  }));
  if (!performance.length) performance = [{ label: '—', patients: 0, value: 0 }];

  const donut = [
    { label: 'Completed', value: completed, color: '#16A34A' },
    { label: 'Upcoming', value: upcoming, color: '#2563EB' },
    { label: 'Cancelled', value: cancelled, color: '#EF4444' },
  ].filter(s => s.value > 0);

  return {
    counts: { total, completed, cancelled, emergency, revenue, upcoming },
    trend: last7,
    bySpecialty: Object.entries(bySpecialty).map(([label, value]) => ({ label, value })),
    byType: Object.entries(byType).map(([label, value]) => ({ label, value })),
    performance,
    donut,
  };
}

// ── search ──────────────────────────────────────────────────
export function globalSearch(q) {
  const s = String(q || '').toLowerCase().trim();
  if (!s) return { doctors: [], appointments: [], prescriptions: [], patients: [] };
  return {
    doctors: cache.doctors.filter(d => (d.name + ' ' + d.specialty + ' ' + d.clinic).toLowerCase().includes(s)),
    appointments: cache.appointments.filter(a => (a.patientName + ' ' + a.doctorName + ' ' + a.bookingId + ' ' + a.notes + ' ' + a.status).toLowerCase().includes(s)),
    prescriptions: cache.prescriptions.filter(r => (r.diagnosis + ' ' + r.doctorName + ' ' + (r.patientName || '')).toLowerCase().includes(s)),
    patients: cache.patients.filter(p => (p.name + ' ' + p.email + ' ' + (p.condition || '')).toLowerCase().includes(s)),
  };
}
