import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppointment, sortAppointments } from './scheduler.js';
import app from './app.js';

let server;
let baseUrl;

test.before(() => new Promise((resolve) => {
  server = app.listen(0, () => {
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
    resolve();
  });
}));

test.after(() => new Promise((resolve, reject) => {
  server.close((err) => {
    if (err) return reject(err);
    resolve();
  });
}));

test('creates a normalized appointment object', () => {
  const appointment = createAppointment({
    patientName: 'Alicia',
    medication: 'Insulin',
    doctorName: 'Dr. Patel',
    appointmentDate: '2026-07-15',
    appointmentTime: '09:30',
    notes: 'Take after breakfast',
    status: 'scheduled',
  });

  assert.equal(appointment.patientName, 'Alicia');
  assert.equal(appointment.medication, 'Insulin');
  assert.equal(appointment.status, 'scheduled');
  assert.equal(appointment.notes, 'Take after breakfast');
  assert.ok(appointment.id);
});

test('sorts appointments by date and time', () => {
  const appointments = [
    createAppointment({ patientName: 'B', medication: 'M2', doctorName: 'D', appointmentDate: '2026-07-16', appointmentTime: '10:00', status: 'scheduled' }),
    createAppointment({ patientName: 'A', medication: 'M1', doctorName: 'D', appointmentDate: '2026-07-15', appointmentTime: '09:00', status: 'scheduled' }),
  ];

  const sorted = sortAppointments(appointments);
  assert.equal(sorted[0].patientName, 'A');
  assert.equal(sorted[1].patientName, 'B');
});

test('uses defaults for missing fields', () => {
  const appointment = createAppointment({});
  assert.equal(appointment.patientName, 'Unknown patient');
  assert.equal(appointment.medication, 'Unknown medication');
  assert.equal(appointment.doctorName, 'Unassigned doctor');
  assert.equal(appointment.status, 'scheduled');
});

test('POST /api/appointments creates an appointment', async () => {
  const res = await fetch(`${baseUrl}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientName: 'Test Patient',
      medication: 'Test Medicine',
      doctorName: 'Dr. Test',
      appointmentDate: '2026-08-01',
      appointmentTime: '14:00',
      notes: 'Integration test',
      status: 'scheduled',
    }),
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.patientName, 'Test Patient');
  assert.equal(data.medication, 'Test Medicine');
  assert.ok(data.id);

  const del = await fetch(`${baseUrl}/api/appointments/${data.id}`, { method: 'DELETE' });
  assert.equal(del.status, 200);
});

test('POST /api/appointments rejects missing fields', async () => {
  const res = await fetch(`${baseUrl}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientName: '' }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.error);
});

test('GET /api/appointments returns an array', async () => {
  const res = await fetch(`${baseUrl}/api/appointments`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data));
});

test('DELETE /api/appointments/:id returns 404 for unknown id', async () => {
  const res = await fetch(`${baseUrl}/api/appointments/nonexistent`, { method: 'DELETE' });
  assert.equal(res.status, 404);
});
