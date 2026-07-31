import Database from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const db = new Database(config.dbPath === ':memory:' ? ':memory:' : config.dbPath);

if (config.dbPath !== ':memory:') {
  db.pragma('journal_mode = WAL');
}

// ─── Schema ──────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'patient',
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS doctors (
    id TEXT PRIMARY KEY,
    userId TEXT,
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    experience TEXT NOT NULL,
    clinic TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    doctorId TEXT,
    patientName TEXT NOT NULL,
    medication TEXT NOT NULL,
    doctorName TEXT NOT NULL,
    appointmentDate TEXT NOT NULL,
    appointmentTime TEXT NOT NULL,
    notes TEXT DEFAULT '',
    status TEXT DEFAULT 'scheduled',
    remindedAt TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (doctorId) REFERENCES doctors(id)
  );

  CREATE TABLE IF NOT EXISTS appointment_audit (
    id TEXT PRIMARY KEY,
    appointmentId TEXT NOT NULL,
    actorId TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT DEFAULT '',
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (appointmentId) REFERENCES appointments(id)
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    token TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    usedAt TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    appointmentId TEXT NOT NULL,
    fileName TEXT NOT NULL,
    storedName TEXT NOT NULL,
    mimeType TEXT NOT NULL,
    size INTEGER NOT NULL,
    uploadedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (appointmentId) REFERENCES appointments(id)
  );

  CREATE TABLE IF NOT EXISTS doctor_slots (
    id TEXT PRIMARY KEY,
    doctorId TEXT NOT NULL,
    dayOfWeek INTEGER NOT NULL,
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL,
    FOREIGN KEY (doctorId) REFERENCES doctors(id)
  );
`);

// ─── Migrations ──────────────────────────────────────

function tableHasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column);
}

function migrate() {
  if (!tableHasColumn('appointments', 'doctorId')) {
    db.exec(`ALTER TABLE appointments ADD COLUMN doctorId TEXT`);
  }
  if (!tableHasColumn('appointments', 'remindedAt')) {
    db.exec(`ALTER TABLE appointments ADD COLUMN remindedAt TEXT`);
  }
  if (!tableHasColumn('doctors', 'userId')) {
    db.exec(`ALTER TABLE doctors ADD COLUMN userId TEXT`);
  }

  db.exec(`
    UPDATE appointments
    SET doctorId = (SELECT d.id FROM doctors d WHERE d.name = appointments.doctorName LIMIT 1)
    WHERE doctorId IS NULL;

    CREATE INDEX IF NOT EXISTS idx_appointments_user ON appointments(userId);
    CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointmentDate);
    CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctorId);
    CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
    CREATE INDEX IF NOT EXISTS idx_doctors_specialty ON doctors(specialty);
    CREATE INDEX IF NOT EXISTS idx_audit_appointment ON appointment_audit(appointmentId);
    CREATE INDEX IF NOT EXISTS idx_attachments_appointment ON attachments(appointmentId);
    CREATE INDEX IF NOT EXISTS idx_slots_doctor ON doctor_slots(doctorId);
  `);
}
migrate();

// ─── Prepared statements ─────────────────────────────

const insertAppointmentStmt = db.prepare(`
  INSERT INTO appointments (id, userId, doctorId, patientName, medication, doctorName, appointmentDate, appointmentTime, notes, status)
  VALUES (@id, @userId, @doctorId, @patientName, @medication, @doctorName, @appointmentDate, @appointmentTime, @notes, @status)
`);

const insertUserStmt = db.prepare(`
  INSERT INTO users (id, name, email, phone, passwordHash, role)
  VALUES (@id, @name, @email, @phone, @passwordHash, @role)
`);

const insertDoctorStmt = db.prepare(`
  INSERT INTO doctors (id, userId, name, specialty, experience, clinic, phone, email)
  VALUES (@id, @userId, @name, @specialty, @experience, @clinic, @phone, @email)
`);

const updateDoctorStmt = db.prepare(`
  UPDATE doctors SET name=@name, specialty=@specialty, experience=@experience, clinic=@clinic, phone=@phone, email=@email
  WHERE id=@id
`);

const insertAuditStmt = db.prepare(`
  INSERT INTO appointment_audit (id, appointmentId, actorId, action, details)
  VALUES (@id, @appointmentId, @actorId, @action, @details)
`);

const insertResetStmt = db.prepare(`
  INSERT INTO password_resets (id, userId, token, expiresAt)
  VALUES (@id, @userId, @token, @expiresAt)
`);

const insertAttachmentStmt = db.prepare(`
  INSERT INTO attachments (id, appointmentId, fileName, storedName, mimeType, size)
  VALUES (@id, @appointmentId, @fileName, @storedName, @mimeType, @size)
`);

const insertSlotStmt = db.prepare(`
  INSERT INTO doctor_slots (id, doctorId, dayOfWeek, startTime, endTime)
  VALUES (@id, @doctorId, @dayOfWeek, @startTime, @endTime)
`);

// ─── Users ────────────────────────────────────────────

export function createUser(user) {
  insertUserStmt.run(user);
  return db.prepare('SELECT id, name, email, phone, role, createdAt FROM users WHERE id = ?').get(user.id);
}

export function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

export function getUserById(id) {
  return db.prepare('SELECT id, name, email, phone, role, createdAt FROM users WHERE id = ?').get(id);
}

export function updateUserProfile(id, fields) {
  const sets = [];
  const params = [];
  for (const key of ['name', 'phone']) {
    if (fields[key] !== undefined) {
      sets.push(`${key}=?`);
      params.push(fields[key]);
    }
  }
  if (sets.length === 0) return getUserById(id);
  params.push(id);
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id=?`).run(...params);
  return getUserById(id);
}

export function updateUserPassword(id, passwordHash) {
  db.prepare('UPDATE users SET passwordHash=? WHERE id=?').run(passwordHash, id);
  return getUserById(id);
}

export function setUserRole(id, role) {
  db.prepare('UPDATE users SET role=? WHERE id=?').run(role, id);
}

export function getAllUsers() {
  return db.prepare('SELECT id, name, email, phone, role, createdAt FROM users ORDER BY createdAt').all();
}

// ─── Appointments ─────────────────────────────────────

function resolveDoctorScope(user, role, doctorId) {
  if (role === 'admin') return null;
  if (role === 'doctor') {
    const doctor = doctorId ? getDoctorById(doctorId) : getDoctorByUserId(user.id);
    if (!doctor) return null;
    return { doctorId: doctor.id };
  }
  return { userId: user.id };
}

export function getAllAppointments({ user, status, search, dateFrom, dateTo, doctorId, page, limit } = {}) {
  const role = user.role;
  const conditions = [];
  const params = [];

  const scope = resolveDoctorScope(user, role, doctorId);
  if (scope === null && role !== 'admin') {
    return { data: [], total: 0, page: 1, limit, totalPages: 0 };
  }
  if (scope?.userId) {
    conditions.push('a.userId = ?');
    params.push(scope.userId);
  }
  if (scope?.doctorId) {
    conditions.push('a.doctorId = ?');
    params.push(scope.doctorId);
  }
  if (status) {
    conditions.push('a.status = ?');
    params.push(status);
  }
  if (search) {
    conditions.push('(a.patientName LIKE ? OR a.medication LIKE ? OR a.doctorName LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  if (dateFrom) {
    conditions.push('a.appointmentDate >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('a.appointmentDate <= ?');
    params.push(dateTo);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const count = db.prepare(`SELECT COUNT(*) AS n FROM appointments a ${where}`).get(...params).n;

  let rows;
  if (page && limit) {
    const offset = (page - 1) * limit;
    rows = db.prepare(`SELECT a.*, u.name AS userName FROM appointments a JOIN users u ON a.userId = u.id ${where} ORDER BY a.appointmentDate, a.appointmentTime LIMIT ? OFFSET ?`).all(...params, limit, offset);
    return {
      data: rows.map(withAttachments),
      total: count,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(count / limit)),
    };
  }

  rows = db.prepare(`SELECT a.*, u.name AS userName FROM appointments a JOIN users u ON a.userId = u.id ${where} ORDER BY a.appointmentDate, a.appointmentTime`).all(...params);
  return rows.map(withAttachments);
}

export function getAppointmentById(id) {
  return withAttachments(db.prepare('SELECT * FROM appointments WHERE id = ?').get(id));
}

export function createAppointmentInDb(appointment) {
  insertAppointmentStmt.run(appointment);
  return getAppointmentById(appointment.id);
}

export function updateAppointmentInDb(id, fields) {
  const sets = [];
  const params = [];
  for (const key of ['patientName', 'medication', 'doctorName', 'doctorId', 'appointmentDate', 'appointmentTime', 'notes', 'status', 'remindedAt']) {
    if (fields[key] !== undefined) {
      sets.push(`${key}=?`);
      params.push(fields[key]);
    }
  }
  if (sets.length === 0) return getAppointmentById(id);
  params.push(id);
  db.prepare(`UPDATE appointments SET ${sets.join(', ')} WHERE id=?`).run(...params);
  return getAppointmentById(id);
}

export function deleteAppointmentById(id) {
  const result = db.prepare('DELETE FROM appointments WHERE id = ?').run(id);
  return result.changes > 0;
}

export function findConflictingAppointment({ doctorId, date, time, excludeId }) {
  const rows = db.prepare(
    `SELECT id FROM appointments
     WHERE doctorId = ? AND appointmentDate = ? AND appointmentTime = ? AND status != 'cancelled' AND id != ?`
  ).all(doctorId, date, time, excludeId || '');
  return rows[0] || null;
}

export function findUpcomingReminders() {
  const windowStart = new Date(Date.now() - 5 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const windowEnd = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  return db.prepare(`
    SELECT a.*, u.email AS userEmail, u.name AS userName
    FROM appointments a JOIN users u ON a.userId = u.id
    WHERE a.status = 'scheduled'
      AND a.remindedAt IS NULL
      AND datetime(a.appointmentDate || ' ' || a.appointmentTime) BETWEEN datetime(?) AND datetime(?)
  `).all(windowStart, windowEnd);
}

// ─── Audit log ────────────────────────────────────────

export function logAudit({ appointmentId, actorId, action, details = '' }) {
  insertAuditStmt.run({
    id: crypto.randomUUID(),
    appointmentId,
    actorId,
    action,
    details: typeof details === 'string' ? details : JSON.stringify(details),
  });
}

export function getAuditByAppointment(appointmentId) {
  return db.prepare('SELECT * FROM appointment_audit WHERE appointmentId = ? ORDER BY createdAt DESC').all(appointmentId);
}

// ─── Stats & analytics ────────────────────────────────

export function getAppointmentStats(user, doctorId) {
  const role = user.role;
  const scope = resolveDoctorScope(user, role, doctorId);
  const conditions = [];
  const params = [];

  if (scope?.userId) { conditions.push('userId = ?'); params.push(scope.userId); }
  if (scope?.doctorId) { conditions.push('doctorId = ?'); params.push(scope.doctorId); }
  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const base = db.prepare(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN status='scheduled' THEN 1 ELSE 0 END), 0) AS scheduled,
      COALESCE(SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END), 0) AS completed,
      COALESCE(SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END), 0) AS cancelled,
      COALESCE(SUM(CASE WHEN appointmentDate=date('now') AND status='scheduled' THEN 1 ELSE 0 END), 0) AS upcomingToday
    FROM appointments ${where}
  `).get(...params);

  const byDoctor = db.prepare(`
    SELECT doctorName AS label, COUNT(*) AS value FROM appointments ${where} GROUP BY doctorName ORDER BY value DESC LIMIT 8
  `).all(...params);

  const bySpecialty = db.prepare(`
    SELECT d.specialty AS label, COUNT(*) AS value
    FROM appointments a LEFT JOIN doctors d ON d.id = a.doctorId
    ${where ? where + ' AND d.specialty IS NOT NULL' : 'WHERE d.specialty IS NOT NULL'}
    GROUP BY d.specialty ORDER BY value DESC LIMIT 8
  `).all(...params);

  const trend = db.prepare(`
    SELECT date(appointmentDate) AS label, COUNT(*) AS value
    FROM appointments
    ${where ? where + ' AND appointmentDate >= date(\'now\', \'-29 days\')' : "WHERE appointmentDate >= date('now', '-29 days')"}
    GROUP BY date(appointmentDate) ORDER BY label
  `).all(...params);

  return { ...base, byDoctor, bySpecialty, trend };
}

// ─── Doctors ──────────────────────────────────────────

export function getAllDoctors() {
  return db.prepare('SELECT * FROM doctors ORDER BY name').all();
}

export function getDoctorById(id) {
  return db.prepare('SELECT * FROM doctors WHERE id = ?').get(id);
}

export function getDoctorByUserId(userId) {
  return db.prepare('SELECT * FROM doctors WHERE userId = ?').get(userId);
}

export function createDoctor(doctor) {
  insertDoctorStmt.run(doctor);
  return getDoctorById(doctor.id);
}

export function updateDoctor(id, doctor) {
  updateDoctorStmt.run({ ...doctor, id });
  return getDoctorById(id);
}

export function deleteDoctorById(id) {
  const result = db.prepare('DELETE FROM doctors WHERE id = ?').run(id);
  return result.changes > 0;
}

// ─── Doctor availability slots ────────────────────────

export function getDoctorSlots(doctorId) {
  return db.prepare('SELECT * FROM doctor_slots WHERE doctorId = ? ORDER BY dayOfWeek, startTime').all(doctorId);
}

export function setDoctorSlots(doctorId, slots) {
  db.prepare('DELETE FROM doctor_slots WHERE doctorId = ?').run(doctorId);
  const insert = db.transaction((items) => {
    for (const s of items) {
      insertSlotStmt.run({ id: crypto.randomUUID(), doctorId, dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime });
    }
  });
  insert(slots || []);
  return getDoctorSlots(doctorId);
}

export function getDoctorWithSlots(id) {
  const doctor = getDoctorById(id);
  if (!doctor) return null;
  return { ...doctor, slots: getDoctorSlots(id) };
}

// ─── Password resets ──────────────────────────────────

export function createPasswordReset({ userId, token, expiresAt }) {
  insertResetStmt.run({ id: crypto.randomUUID(), userId, token, expiresAt });
  return db.prepare('SELECT * FROM password_resets WHERE token = ?').get(token);
}

export function getPasswordReset(token) {
  return db.prepare('SELECT * FROM password_resets WHERE token = ? AND usedAt IS NULL').get(token);
}

export function consumePasswordReset(id) {
  db.prepare("UPDATE password_resets SET usedAt = datetime('now') WHERE id = ?").run(id);
}

export function deleteExpiredPasswordResets() {
  db.prepare("DELETE FROM password_resets WHERE datetime(expiresAt) < datetime('now')").run();
}

// ─── Attachments ──────────────────────────────────────

function withAttachments(row) {
  if (!row) return row;
  return {
    ...row,
    attachments: db.prepare('SELECT id, appointmentId, fileName, mimeType, size, uploadedAt FROM attachments WHERE appointmentId = ?').all(row.id),
  };
}

export function createAttachment(attachment) {
  insertAttachmentStmt.run(attachment);
  return db.prepare('SELECT * FROM attachments WHERE id = ?').get(attachment.id);
}

export function getAttachmentById(id) {
  return db.prepare('SELECT * FROM attachments WHERE id = ?').get(id);
}

export function getAttachmentByStoredName(storedName) {
  return db.prepare('SELECT * FROM attachments WHERE storedName = ?').get(storedName);
}

export function deleteAttachmentById(id) {
  return db.prepare('DELETE FROM attachments WHERE id = ?').run(id).changes > 0;
}

// ─── Close ────────────────────────────────────────────

export function closeDb() {
  db.close();
}
