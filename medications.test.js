process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';

let server;
let baseUrl;

let patientToken;
let otherPatientToken;
let medicationId;
let dose;

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

const TODAY = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

test.before(async () => {
  const { default: app } = await import('./app.js');
  server = app.listen(0, () => {
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });
  await new Promise((resolve) => server.once('listening', resolve));

  const p = await apiCall('/api/auth/register', { method: 'POST', body: { name: 'Med Patient', email: 'med@test.com', phone: '1112223344', password: 'secret123' } });
  patientToken = (await p.json()).token;

  const p2 = await apiCall('/api/auth/register', { method: 'POST', body: { name: 'Other', email: 'othermed@test.com', phone: '555', password: 'secret456' } });
  otherPatientToken = (await p2.json()).token;
});

test.after(() => {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      import('./database.js').then(({ closeDb }) => {
        closeDb();
        if (err) return reject(err);
        resolve();
      });
    });
  });
});

test('requires authentication', async () => {
  const res = await fetch(baseUrl + '/api/medications');
  assert.equal(res.status, 401);
});

test('POST creates a medication with daily schedules', async () => {
  const res = await apiCall('/api/medications', {
    method: 'POST',
    token: patientToken,
    body: {
      name: 'Metformin',
      dosage: '500mg',
      startDate: TODAY,
      instructions: 'Take after meals',
      schedules: [{ dayOfWeek: -1, timeOfDay: '08:00' }, { dayOfWeek: -1, timeOfDay: '20:00' }],
    },
  });
  assert.equal(res.status, 201);
  const med = await res.json();
  assert.equal(med.name, 'Metformin');
  assert.equal(med.schedules.length, 2);
  assert.equal(med.userId, (await (await apiCall('/api/auth/me', { token: patientToken })).json()).id);
  medicationId = med.id;
});

async function get(path, token = patientToken) {
  const res = await apiCall(path, { token });
  return res;
}

test('rejects missing name', async () => {
  const res = await apiCall('/api/medications', {
    method: 'POST',
    token: patientToken,
    body: { startDate: TODAY, schedules: [{ dayOfWeek: -1, timeOfDay: '08:00' }] },
  });
  assert.equal(res.status, 400);
});

test('rejects invalid schedule time', async () => {
  const res = await apiCall('/api/medications', {
    method: 'POST',
    token: patientToken,
    body: { name: 'X', startDate: TODAY, schedules: [{ dayOfWeek: -1, timeOfDay: '9am' }] },
  });
  assert.equal(res.status, 400);
});

test('rejects no valid schedules', async () => {
  const res = await apiCall('/api/medications', {
    method: 'POST',
    token: patientToken,
    body: { name: 'X', startDate: TODAY, schedules: [] },
  });
  assert.equal(res.status, 400);
});

test('GET lists only own medications', async () => {
  const mine = await (await get('/api/medications')).json();
  assert.ok(mine.some(m => m.id === medicationId));

  const theirs = await (await get('/api/medications', otherPatientToken)).json();
  assert.equal(theirs.some(m => m.id === medicationId), false);
  assert.equal(theirs.length, 0);
});

test('GET /api/medications/:id doses returns today doses', async () => {
  const res = await get(`/api/medications/${medicationId}/doses?from=${TODAY}&to=${TODAY}`);
  assert.equal(res.status, 200);
  const doses = await res.json();
  assert.ok(doses.length >= 2);
  dose = doses.find(d => d.scheduledAt.includes('08:00')) || doses[0];
});

test('GET /api/medications/doses/today returns due doses with medication name', async () => {
  const res = await get('/api/medications/doses/today');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.date, TODAY);
  assert.ok(Array.isArray(data.doses));
  assert.ok(data.doses.some(d => d.medicationName === 'Metformin'));
});

test('respond to dose marks as taken', async () => {
  dose = (await (await get('/api/medications/doses/today')).json()).doses[0];
  const res = await apiCall(`/api/medications/doses/${dose.id}/respond`, {
    method: 'POST',
    token: patientToken,
    body: { status: 'taken' },
  });
  assert.equal(res.status, 200);
  const updated = await res.json();
  assert.equal(updated.status, 'taken');
  assert.ok(updated.respondedAt);
});

test('rejects invalid response status', async () => {
  const res = await apiCall(`/api/medications/doses/${dose.id}/respond`, {
    method: 'POST',
    token: patientToken,
    body: { status: 'maybe' },
  });
  assert.equal(res.status, 400);
});

test('cannot respond to another users dose', async () => {
  const res = await apiCall(`/api/medications/doses/${dose.id}/respond`, {
    method: 'POST',
    token: otherPatientToken,
    body: { status: 'taken' },
  });
  assert.equal(res.status, 404);
});

test('stats reflect taken response', async () => {
  const res = await get('/api/medications/stats');
  assert.equal(res.status, 200);
  const stats = await res.json();
  assert.equal(stats.taken, 1);
  assert.ok(stats.total >= 1);
});

test('GET /api/medications/stats is scoped per user', async () => {
  const res = await get('/api/medications/stats', otherPatientToken);
  assert.equal(res.status, 200);
  const stats = await res.json();
  assert.equal(stats.taken, 0);
});

test('PUT updates medication', async () => {
  const res = await apiCall(`/api/medications/${medicationId}`, {
    method: 'PUT',
    token: patientToken,
    body: { dosage: '1000mg' },
  });
  assert.equal(res.status, 200);
  const med = await res.json();
  assert.equal(med.dosage, '1000mg');
});

test('another user cannot edit my medication', async () => {
  const res = await apiCall(`/api/medications/${medicationId}`, {
    method: 'PUT',
    token: otherPatientToken,
    body: { name: 'Hacked' },
  });
  assert.equal(res.status, 403);
});

test('DELETE removes medication and its dose history', async () => {
  const res = await apiCall(`/api/medications/${medicationId}`, { method: 'DELETE', token: patientToken });
  assert.equal(res.status, 200);
  const fetchMed = await get(`/api/medications/${medicationId}`);
  assert.equal(fetchMed.status, 404);
  const today = await (await get('/api/medications/doses/today')).json();
  assert.equal(today.doses.some(d => d.medicationName === 'Metformin'), false);
});