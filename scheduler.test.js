import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppointment, sortAppointments } from './scheduler.js';
import app from './app.js';
import { closeDb } from './database.js';

let server;
let baseUrl;
let patientToken;
let adminToken;
let testAppointmentId;

test.before(async () => {
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
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

// ─── Auth Tests ───────────────────────────────────────

test('POST /api/auth/register creates a patient user', async () => {
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Patient', email: 'patient@test.com', phone: '1234567890', password: 'secret123' }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.ok(data.token);
  assert.equal(data.user.name, 'Test Patient');
  assert.equal(data.user.role, 'patient');
  patientToken = data.token;
});

test('POST /api/auth/register rejects duplicate email', async () => {
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Duplicate', email: 'patient@test.com', phone: '0', password: 'x' }),
  });
  assert.equal(res.status, 409);
});

test('POST /api/auth/register creates an admin user', async () => {
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Admin User', email: 'admin@test.com', phone: '0', password: 'admin123' }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  adminToken = data.token;
  // Manually promote to admin for testing
  await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.com', password: 'admin123' }),
  }).then(r => r.json()).then(d => { adminToken = d.token; });
});

test('POST /api/auth/login with valid credentials', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient@test.com', password: 'secret123' }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.token);
  assert.equal(data.user.email, 'patient@test.com');
});

test('POST /api/auth/login with wrong password', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient@test.com', password: 'wrong' }),
  });
  assert.equal(res.status, 401);
});

// ─── Appointment Tests (authenticated) ────────────────

test('POST /api/appointments creates an appointment', async () => {
  const res = await fetch(`${baseUrl}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${patientToken}` },
    body: JSON.stringify({
      patientName: 'Test Patient', medication: 'Test Medicine', doctorName: 'Dr. Test',
      appointmentDate: '2026-08-01', appointmentTime: '14:00', notes: 'Integration test', status: 'scheduled',
    }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.patientName, 'Test Patient');
  assert.ok(data.id);
  testAppointmentId = data.id;
});

test('GET /api/appointments returns appointments for authenticated user', async () => {
  const res = await fetch(`${baseUrl}/api/appointments`, {
    headers: { 'Authorization': `Bearer ${patientToken}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data));
  assert.ok(data.length >= 1);
});

test('GET /api/appointments requires authentication', async () => {
  const res = await fetch(`${baseUrl}/api/appointments`);
  assert.equal(res.status, 401);
});

test('PUT /api/appointments/:id updates an appointment', async () => {
  const res = await fetch(`${baseUrl}/api/appointments/${testAppointmentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${patientToken}` },
    body: JSON.stringify({ status: 'completed', notes: 'Updated notes' }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'completed');
  assert.equal(data.notes, 'Updated notes');
});

test('PUT /api/appointments/:id returns 404 for unknown id', async () => {
  const res = await fetch(`${baseUrl}/api/appointments/nonexistent-id`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${patientToken}` },
    body: JSON.stringify({ status: 'completed' }),
  });
  assert.equal(res.status, 404);
});

test('DELETE /api/appointments/:id deletes an appointment', async () => {
  const res = await fetch(`${baseUrl}/api/appointments/${testAppointmentId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${patientToken}` },
  });
  assert.equal(res.status, 200);
});

test('GET /api/stats returns stats for authenticated user', async () => {
  const res = await fetch(`${baseUrl}/api/stats`, {
    headers: { 'Authorization': `Bearer ${patientToken}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(typeof data.total === 'number');
  assert.ok(typeof data.scheduled === 'number');
});

test('GET /api/doctors returns doctor list', async () => {
  const res = await fetch(`${baseUrl}/api/doctors`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data));
});
