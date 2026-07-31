process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';

let server;
let baseUrl;
let createAppointment;
let sortAppointments;
let closeDb;
let setUserRole;

let patientToken;
let otherPatientToken;
let adminToken;
let doctorToken;
let doctorId;
let testAppointmentId;
let cancelledId;

const FUTURE = '2030-01-15';
const ALT_FUTURE = '2030-02-20';

async function apiCall(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(baseUrl + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return res;
}

test.before(async () => {
  const scheduler = await import('./scheduler.js');
  createAppointment = scheduler.createAppointment;
  sortAppointments = scheduler.sortAppointments;

  const db = await import('./database.js');
  closeDb = db.closeDb;
  setUserRole = db.setUserRole;

  const { default: app } = await import('./app.js');
  server = app.listen(0, () => {
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });
  await new Promise((resolve) => server.once('listening', resolve));

  // Patient
  const p = await apiCall('/api/auth/register', { method: 'POST', body: { name: 'Test Patient', email: 'patient@test.com', phone: '1234567890', password: 'secret123' } });
  patientToken = (await p.json()).token;

  // Second patient (for authorization tests)
  const p2 = await apiCall('/api/auth/register', { method: 'POST', body: { name: 'Other Patient', email: 'other@test.com', phone: '1234567891', password: 'secret456' } });
  otherPatientToken = (await p2.json()).token;

  // Admin: register then promote
  await apiCall('/api/auth/register', { method: 'POST', body: { name: 'Admin User', email: 'admin@test.com', phone: '0987654321', password: 'admin12345' } });
  const adminUser = await db.getUserByEmail('admin@test.com');
  setUserRole(adminUser.id, 'admin');
  const a = await apiCall('/api/auth/login', { method: 'POST', body: { email: 'admin@test.com', password: 'admin12345' } });
  adminToken = (await a.json()).token;

  // Doctor
  const d = await apiCall('/api/auth/register', { method: 'POST', body: { name: 'Dr. Test', email: 'doctor@test.com', phone: '555', password: 'doctor123', role: 'doctor', specialty: 'Cardiology' } });
  doctorToken = (await d.json()).token;
  const docs = await (await fetch(baseUrl + '/api/doctors')).json();
  doctorId = docs.find(x => x.email === 'doctor@test.com').id;
});

test.after(() => {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      closeDb();
      if (err) return reject(err);
      resolve();
    });
  });
});

// ─── Unit Tests ───────────────────────────────────────

test('creates a normalized appointment object', () => {
  const a = createAppointment({
    patientName: 'Alicia', medication: 'Insulin', doctorName: 'Dr. Patel',
    appointmentDate: '2026-07-15', appointmentTime: '09:30',
    notes: 'Take after breakfast', status: 'scheduled',
  });
  assert.equal(a.patientName, 'Alicia');
  assert.equal(a.medication, 'Insulin');
  assert.equal(a.status, 'scheduled');
  assert.ok(a.id);
});

test('sorts appointments by date and time', () => {
  const apps = [
    createAppointment({ patientName: 'B', medication: 'M2', doctorName: 'D', appointmentDate: '2026-07-16', appointmentTime: '10:00', status: 'scheduled' }),
    createAppointment({ patientName: 'A', medication: 'M1', doctorName: 'D', appointmentDate: '2026-07-15', appointmentTime: '09:00', status: 'scheduled' }),
  ];
  const sorted = sortAppointments(apps);
  assert.equal(sorted[0].patientName, 'A');
  assert.equal(sorted[1].patientName, 'B');
});

test('uses defaults for missing fields', () => {
  const a = createAppointment({});
  assert.equal(a.patientName, 'Unknown patient');
  assert.equal(a.medication, 'Unknown medication');
  assert.equal(a.doctorName, 'Unassigned doctor');
  assert.equal(a.status, 'scheduled');
});

// ─── Auth & Security Tests ────────────────────────────

test('rejects registration with invalid email', async () => {
  const res = await apiCall('/api/auth/register', { method: 'POST', body: { name: 'X', email: 'not-an-email', phone: '0', password: 'longenough' } });
  assert.equal(res.status, 400);
});

test('rejects registration with weak password', async () => {
  const res = await apiCall('/api/auth/register', { method: 'POST', body: { name: 'X', email: 'weak@test.com', phone: '0', password: 'short' } });
  assert.equal(res.status, 400);
});

test('rejects duplicate email', async () => {
  const res = await apiCall('/api/auth/register', { method: 'POST', body: { name: 'Duplicate', email: 'patient@test.com', phone: '0', password: 'secret123' } });
  assert.equal(res.status, 409);
});

test('login with wrong password is rejected', async () => {
  const res = await apiCall('/api/auth/login', { method: 'POST', body: { email: 'patient@test.com', password: 'wrong' } });
  assert.equal(res.status, 401);
});

test('admin token has admin role', async () => {
  const res = await apiCall('/api/auth/me', { token: adminToken });
  assert.equal(res.status, 200);
  const me = await res.json();
  assert.equal(me.role, 'admin');
});

test('health endpoint responds', async () => {
  const res = await fetch(baseUrl + '/api/health');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'ok');
});

test('unknown API route returns JSON 404', async () => {
  const res = await fetch(baseUrl + '/api/nope');
  assert.equal(res.status, 404);
});

test('appointments require authentication', async () => {
  const res = await fetch(baseUrl + '/api/appointments');
  assert.equal(res.status, 401);
});

// ─── Appointment Tests ────────────────────────────────

test('POST /api/appointments creates an appointment', async () => {
  const res = await apiCall('/api/appointments', {
    method: 'POST',
    token: patientToken,
    body: {
      patientName: 'Test Patient', medication: 'Test Medicine', doctorName: 'Dr. Test', doctorId,
      appointmentDate: FUTURE, appointmentTime: '14:00', notes: 'Integration test', status: 'scheduled',
    },
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.patientName, 'Test Patient');
  assert.equal(data.doctorId, doctorId);
  assert.ok(data.id);
  testAppointmentId = data.id;
});

test('POST rejects a past appointment date', async () => {
  const res = await apiCall('/api/appointments', {
    method: 'POST',
    token: patientToken,
    body: { patientName: 'P', medication: 'M', doctorName: 'Dr. Test', doctorId, appointmentDate: '2020-01-01', appointmentTime: '09:00', status: 'scheduled' },
  });
  assert.equal(res.status, 400);
});

test('POST rejects invalid date/time format', async () => {
  const res = await apiCall('/api/appointments', {
    method: 'POST',
    token: patientToken,
    body: { patientName: 'P', medication: 'M', doctorName: 'Dr. Test', doctorId, appointmentDate: '15/01/2030', appointmentTime: '9am', status: 'scheduled' },
  });
  assert.equal(res.status, 400);
});

test('POST rejects double-booking the same doctor', async () => {
  const res = await apiCall('/api/appointments', {
    method: 'POST',
    token: patientToken,
    body: { patientName: 'Second', medication: 'M', doctorName: 'Dr. Test', doctorId, appointmentDate: FUTURE, appointmentTime: '14:00', status: 'scheduled' },
  });
  assert.equal(res.status, 409);
});

test('GET /api/appointments returns own appointments for patient', async () => {
  const res = await apiCall('/api/appointments', { token: patientToken });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data));
  assert.ok(data.length >= 1);
});

test('GET /api/appointments supports pagination', async () => {
  const res = await apiCall('/api/appointments?page=1&limit=1', { token: patientToken });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.data));
  assert.equal(data.data.length, 1);
  assert.ok(data.total >= 1);
  assert.ok(data.totalPages >= 1);
});

test('doctor can only see their own appointments', async () => {
  const res = await apiCall('/api/appointments', { token: doctorToken });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data));
  assert.ok(data.every(a => a.doctorId === doctorId));
});

test('PUT updates an appointment status via valid transition', async () => {
  const res = await apiCall('/api/appointments/' + testAppointmentId, {
    method: 'PUT',
    token: patientToken,
    body: { status: 'cancelled', notes: 'Updated notes' },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'cancelled');
  assert.equal(data.notes, 'Updated notes');
  cancelledId = testAppointmentId;
});

test('PUT rejects invalid status transition', async () => {
  const res = await apiCall('/api/appointments/' + testAppointmentId, {
    method: 'PUT',
    token: patientToken,
    body: { status: 'completed' },
  });
  assert.equal(res.status, 400);
});

test('PUT by another patient is forbidden', async () => {
  const res = await apiCall('/api/appointments/' + testAppointmentId, {
    method: 'PUT',
    token: otherPatientToken,
    body: { notes: 'nope' },
  });
  assert.equal(res.status, 403);
});

test('PUT returns 404 for unknown id', async () => {
  const res = await apiCall('/api/appointments/nonexistent-id', { method: 'PUT', token: patientToken, body: { status: 'completed' } });
  assert.equal(res.status, 404);
});

test('appointment includes audit trail', async () => {
  const res = await apiCall('/api/appointments/' + testAppointmentId, { token: patientToken });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.audit));
  assert.ok(data.audit.length >= 1);
});

test('export endpoint returns CSV', async () => {
  const res = await apiCall('/api/appointments/export', { token: patientToken });
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-type').includes('text/csv'));
  const text = await res.text();
  assert.ok(text.includes('Patient'));
});

test('stats include breakdowns', async () => {
  const res = await apiCall('/api/stats', { token: adminToken });
  assert.equal(res.status, 200);
  const s = await res.json();
  assert.ok(Array.isArray(s.byDoctor));
  assert.ok(Array.isArray(s.bySpecialty));
  assert.ok(Array.isArray(s.trend));
});

test('deleted appointment returns 404', async () => {
  const del = await apiCall('/api/appointments/' + testAppointmentId, { method: 'DELETE', token: patientToken });
  assert.equal(del.status, 200);
  const res = await apiCall('/api/appointments/' + testAppointmentId, { token: patientToken });
  assert.equal(res.status, 404);
});

// ─── Doctor / Admin Tests ─────────────────────────────

test('GET /api/doctors returns doctor list with slots', async () => {
  const res = await fetch(baseUrl + '/api/doctors');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data));
  assert.ok(data.some(d => d.id === doctorId));
  assert.ok('slots' in data[0]);
});

test('admin can create a doctor', async () => {
  const res = await apiCall('/api/doctors', {
    method: 'POST',
    token: adminToken,
    body: { name: 'Dr. New', specialty: 'Dermatology', experience: '5 years', clinic: 'City Clinic', phone: '111', email: 'new@test.com' },
  });
  assert.equal(res.status, 201);
  const d = await res.json();
  assert.equal(d.specialty, 'Dermatology');
});

test('non-admin cannot create a doctor', async () => {
  const res = await apiCall('/api/doctors', {
    method: 'POST',
    token: patientToken,
    body: { name: 'Dr. Bad', specialty: 'Nope' },
  });
  assert.equal(res.status, 403);
});

test('admin can set doctor availability slots', async () => {
  const res = await apiCall(`/api/doctors/${doctorId}/slots`, {
    method: 'PUT',
    token: adminToken,
    body: { slots: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }] },
  });
  assert.equal(res.status, 200);
  const slots = await res.json();
  assert.equal(slots.length, 1);
});

// ─── Doctor Self-Management Tests ─────────────────────

test('doctor can view their own profile', async () => {
  const res = await apiCall('/api/doctors/me', { token: doctorToken });
  assert.equal(res.status, 200);
  const d = await res.json();
  assert.equal(d.id, doctorId);
  assert.equal(d.specialty, 'Cardiology');
});

test('doctor can update their own details', async () => {
  const res = await apiCall('/api/doctors/me', {
    method: 'PUT',
    token: doctorToken,
    body: { specialty: 'Cardiology', experience: '12 years', clinic: 'Heart Clinic' },
  });
  assert.equal(res.status, 200);
  const d = await res.json();
  assert.equal(d.experience, '12 years');
  assert.equal(d.clinic, 'Heart Clinic');
});

test('doctor can manage their own slots', async () => {
  const res = await apiCall('/api/doctors/me/slots', {
    method: 'PUT',
    token: doctorToken,
    body: { slots: [{ dayOfWeek: 2, startTime: '10:00', endTime: '16:00' }] },
  });
  assert.equal(res.status, 200);
  const slots = await res.json();
  assert.equal(slots.length, 1);
  assert.equal(slots[0].dayOfWeek, 2);
});

test('patient cannot access doctor self endpoints', async () => {
  const res = await apiCall('/api/doctors/me', { token: patientToken });
  assert.equal(res.status, 403);
});

// ─── Password Reset Flow ──────────────────────────────

test('forgot password returns success message', async () => {
  const res = await apiCall('/api/auth/forgot', { method: 'POST', body: { email: 'patient@test.com' } });
  assert.equal(res.status, 200);
});

test('reset with invalid token is rejected', async () => {
  const res = await apiCall('/api/auth/reset', { method: 'POST', body: { token: 'bogus-token', password: 'newpassword123' } });
  assert.equal(res.status, 400);
});
