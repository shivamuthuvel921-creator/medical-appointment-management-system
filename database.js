import Database from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const db = new Database(config.dbPath === ':memory:' ? ':memory:' : config.dbPath);

if (config.dbPath !== ':memory:') {
  db.pragma('journal_mode = WAL');
}

db.pragma('foreign_keys = ON');

// ─── Legacy cleanup ───────────────────────────────────
// An earlier prototype used medication_schedules(id, medicationId, timeOfDay, dose)
// and a medication_logs table. If present, stash the schedule rows and drop the
// incompatible tables so the schema below can rebuild them in the new format.
let legacyScheduleRows = [];
if (config.dbPath !== ':memory:') {
  try {
    const hasLegacySchedule = db.prepare("SELECT COUNT(*) AS n FROM pragma_table_info('medication_schedules') WHERE name = 'dose'").get().n > 0;
    if (hasLegacySchedule) {
      legacyScheduleRows = db.prepare('SELECT * FROM medication_schedules').all();
      db.exec('DROP TABLE IF EXISTS medication_schedules; DROP TABLE IF EXISTS medication_logs;');
    }
  } catch {
    // tables may simply not exist yet
  }
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

  CREATE TABLE IF NOT EXISTS medications (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    name TEXT NOT NULL,
    dosage TEXT DEFAULT '',
    instructions TEXT DEFAULT '',
    startDate TEXT NOT NULL,
    endDate TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS medication_schedules (
    id TEXT PRIMARY KEY,
    medicationId TEXT NOT NULL,
    dayOfWeek INTEGER NOT NULL DEFAULT -1,
    timeOfDay TEXT NOT NULL,
    FOREIGN KEY (medicationId) REFERENCES medications(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS medication_doses (
    id TEXT PRIMARY KEY,
    medicationId TEXT NOT NULL,
    userId TEXT NOT NULL,
    scheduledAt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    notifiedAt TEXT,
    respondedAt TEXT,
    FOREIGN KEY (medicationId) REFERENCES medications(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS patient_profiles (
    userId TEXT PRIMARY KEY,
    dob TEXT,
    gender TEXT,
    bloodGroup TEXT,
    height TEXT,
    weight TEXT,
    allergies TEXT DEFAULT '',
    conditions TEXT DEFAULT '',
    currentMedications TEXT DEFAULT '',
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS health_records (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    appointmentId TEXT,
    title TEXT NOT NULL,
    notes TEXT DEFAULT '',
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (appointmentId) REFERENCES appointments(id)
  );

  CREATE TABLE IF NOT EXISTS doctor_blocks (
    id TEXT PRIMARY KEY,
    doctorId TEXT NOT NULL,
    blockDate TEXT NOT NULL,
    startTime TEXT,
    endTime TEXT,
    reason TEXT DEFAULT '',
    FOREIGN KEY (doctorId) REFERENCES doctors(id)
  );

  CREATE TABLE IF NOT EXISTS prescriptions (
    id TEXT PRIMARY KEY,
    appointmentId TEXT,
    userId TEXT NOT NULL,
    doctorId TEXT NOT NULL,
    notes TEXT DEFAULT '',
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (appointmentId) REFERENCES appointments(id),
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (doctorId) REFERENCES doctors(id)
  );

  CREATE TABLE IF NOT EXISTS prescription_items (
    id TEXT PRIMARY KEY,
    prescriptionId TEXT NOT NULL,
    medicine TEXT NOT NULL,
    dosage TEXT DEFAULT '',
    duration TEXT DEFAULT '',
    instructions TEXT DEFAULT '',
    FOREIGN KEY (prescriptionId) REFERENCES prescriptions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    appointmentId TEXT NOT NULL,
    userId TEXT NOT NULL,
    doctorId TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT DEFAULT '',
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (appointmentId) REFERENCES appointments(id),
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (doctorId) REFERENCES doctors(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    appointmentId TEXT NOT NULL,
    senderId TEXT NOT NULL,
    body TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    readAt TEXT,
    FOREIGN KEY (appointmentId) REFERENCES appointments(id),
    FOREIGN KEY (senderId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS waitlist (
    id TEXT PRIMARY KEY,
    doctorId TEXT NOT NULL,
    userId TEXT,
    appointmentDate TEXT NOT NULL,
    appointmentTime TEXT,
    requestedAt TEXT DEFAULT (datetime('now')),
    notifiedAt TEXT,
    status TEXT DEFAULT 'waiting',
    FOREIGN KEY (doctorId) REFERENCES doctors(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    type TEXT DEFAULT 'system',
    title TEXT NOT NULL,
    message TEXT DEFAULT '',
    readAt TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS adherence_alerts (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    period TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    resolvedAt TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
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

  const addColumn = (table, column, definition) => {
    if (!tableHasColumn(table, column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };

  addColumn('appointments', 'priority', "TEXT DEFAULT 'normal'");
  addColumn('appointments', 'diagnosis', "TEXT DEFAULT ''");
  addColumn('appointments', 'prescription', "TEXT DEFAULT ''");
  addColumn('appointments', 'followUpDate', 'TEXT');
  addColumn('appointments', 'followUpOf', 'TEXT');
  addColumn('appointments', 'queueStatus', "TEXT DEFAULT 'waiting'");
  addColumn('appointments', 'durationMins', 'INTEGER');
  addColumn('appointments', 'endTime', 'TEXT');
  addColumn('appointments', 'checkInAt', 'TEXT');
  addColumn('appointments', 'checkInToken', 'TEXT');
  addColumn('appointments', 'type', "TEXT DEFAULT 'In-clinic'");
  addColumn('doctors', 'qualifications', "TEXT DEFAULT ''");
  addColumn('doctors', 'consultationFee', "TEXT DEFAULT ''");
  addColumn('doctors', 'bio', "TEXT DEFAULT ''");
  addColumn('doctors', 'avatar', "TEXT DEFAULT ''");
  addColumn('attachments', 'category', "TEXT DEFAULT 'general'");
  addColumn('attachments', 'doctorComment', "TEXT DEFAULT ''");
  addColumn('medications', 'frequency', "TEXT DEFAULT ''");

  // Medication module tables may exist from an earlier schema; backfill missing columns.
  if (tableHasColumn('medications', 'name') && !tableHasColumn('medications', 'instructions')) {
    db.exec(`ALTER TABLE medications ADD COLUMN instructions TEXT DEFAULT ''`);
  }

  // Restore legacy schedule rows (migrated after schema rebuild).
  for (const row of legacyScheduleRows) {
    try {
      const medication = getMedicationById(row.medicationId);
      if (medication) {
        setMedicationSchedules(row.medicationId, [{ dayOfWeek: -1, timeOfDay: row.timeOfDay }]);
      }
    } catch {
      // ignore rows that reference removed medications
    }
  }
  legacyScheduleRows = [];

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
    CREATE INDEX IF NOT EXISTS idx_meds_user ON medications(userId);
    CREATE INDEX IF NOT EXISTS idx_medschedules_med ON medication_schedules(medicationId);
    CREATE INDEX IF NOT EXISTS idx_doses_user ON medication_doses(userId);
    CREATE INDEX IF NOT EXISTS idx_doses_scheduled ON medication_doses(scheduledAt);
  `);
}
migrate();

// ─── Prepared statements ─────────────────────────────

const insertAppointmentStmt = db.prepare(`
  INSERT INTO appointments (id, userId, doctorId, patientName, medication, doctorName, appointmentDate, appointmentTime, notes, status, priority, type)
  VALUES (@id, @userId, @doctorId, @patientName, @medication, @doctorName, @appointmentDate, @appointmentTime, @notes, @status, @priority, @type)
`);

const insertUserStmt = db.prepare(`
  INSERT INTO users (id, name, email, phone, passwordHash, role)
  VALUES (@id, @name, @email, @phone, @passwordHash, @role)
`);

const insertDoctorStmt = db.prepare(`
  INSERT INTO doctors (id, userId, name, specialty, experience, clinic, phone, email, qualifications, consultationFee, bio, avatar)
  VALUES (@id, @userId, @name, @specialty, @experience, @clinic, @phone, @email, @qualifications, @consultationFee, @bio, @avatar)
`);

const updateDoctorStmt = db.prepare(`
  UPDATE doctors SET name=@name, specialty=@specialty, experience=@experience, clinic=@clinic, phone=@phone, email=@email,
    qualifications=@qualifications, consultationFee=@consultationFee, bio=@bio, avatar=@avatar
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
  INSERT INTO attachments (id, appointmentId, fileName, storedName, mimeType, size, category, doctorComment)
  VALUES (@id, @appointmentId, @fileName, @storedName, @mimeType, @size, @category, @doctorComment)
`);

const insertSlotStmt = db.prepare(`
  INSERT INTO doctor_slots (id, doctorId, dayOfWeek, startTime, endTime)
  VALUES (@id, @doctorId, @dayOfWeek, @startTime, @endTime)
`);

const insertMedicationStmt = db.prepare(`
  INSERT INTO medications (id, userId, name, dosage, instructions, startDate, endDate, active)
  VALUES (@id, @userId, @name, @dosage, @instructions, @startDate, @endDate, @active)
`);

const insertMedicationScheduleStmt = db.prepare(`
  INSERT INTO medication_schedules (id, medicationId, dayOfWeek, timeOfDay)
  VALUES (@id, @medicationId, @dayOfWeek, @timeOfDay)
`);

const insertMedicationDoseStmt = db.prepare(`
  INSERT INTO medication_doses (id, medicationId, userId, scheduledAt, status)
  VALUES (@id, @medicationId, @userId, @scheduledAt, @status)
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

export function getAllAppointments({ user, status, search, dateFrom, dateTo, doctorId, priority, page, limit } = {}) {
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
  if (priority) {
    conditions.push('a.priority = ?');
    params.push(priority);
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
  for (const key of ['patientName', 'medication', 'doctorName', 'doctorId', 'appointmentDate', 'appointmentTime', 'notes', 'status', 'remindedAt', 'priority', 'diagnosis', 'prescription', 'queueStatus', 'durationMins', 'endTime', 'followUpDate', 'type']) {
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
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM appointment_audit WHERE appointmentId = ?').run(id);
    db.prepare('DELETE FROM attachments WHERE appointmentId = ?').run(id);
    return db.prepare('DELETE FROM appointments WHERE id = ?').run(id).changes > 0;
  });
  return tx();
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

export function getAuditLog({ page, limit, search } = {}) {
  const conditions = [];
  const params = [];
  if (search) {
    conditions.push('(u.name LIKE ? OR a.patientName LIKE ? OR aa.action LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const count = db.prepare(`
    SELECT COUNT(*) AS n FROM appointment_audit aa
    LEFT JOIN users u ON u.id = aa.actorId
    LEFT JOIN appointments a ON a.id = aa.appointmentId
    ${where}
  `).get(...params).n;

  let rows;
  if (page && limit) {
    const offset = (page - 1) * limit;
    rows = db.prepare(`
      SELECT aa.*, u.name AS actorName, u.email AS actorEmail, a.patientName
      FROM appointment_audit aa
      LEFT JOIN users u ON u.id = aa.actorId
      LEFT JOIN appointments a ON a.id = aa.appointmentId
      ${where} ORDER BY aa.createdAt DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    return { data: rows, total: count, page, limit, totalPages: Math.max(1, Math.ceil(count / limit)) };
  }

  rows = db.prepare(`
    SELECT aa.*, u.name AS actorName, u.email AS actorEmail, a.patientName
    FROM appointment_audit aa
    LEFT JOIN users u ON u.id = aa.actorId
    LEFT JOIN appointments a ON a.id = aa.appointmentId
    ${where} ORDER BY aa.createdAt DESC
  `).all(...params);
  return rows;
}

export function getBookedAppointmentTimes(doctorId, date) {
  return db.prepare(
    `SELECT appointmentTime FROM appointments
     WHERE doctorId = ? AND appointmentDate = ? AND status != 'cancelled'`
  ).all(doctorId, date).map(r => r.appointmentTime);
}

// ─── Stats & analytics ────────────────────────────────

export function getAppointmentStats(user, doctorId) {
  const role = user.role;
  const scope = resolveDoctorScope(user, role, doctorId);
  const conditions = [];
  const params = [];

  if (scope?.userId) { conditions.push('appointments.userId = ?'); params.push(scope.userId); }
  if (scope?.doctorId) { conditions.push('appointments.doctorId = ?'); params.push(scope.doctorId); }
  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const base = db.prepare(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN status='scheduled' THEN 1 ELSE 0 END), 0) AS scheduled,
      COALESCE(SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END), 0) AS completed,
      COALESCE(SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END), 0) AS cancelled,
      COALESCE(SUM(CASE WHEN appointmentDate=date('now') AND status='scheduled' THEN 1 ELSE 0 END), 0) AS upcomingToday,
      COALESCE(SUM(CASE WHEN status='scheduled' AND appointmentDate < date('now') THEN 1 ELSE 0 END), 0) AS missed
    FROM appointments ${where}
  `).get(...params);

  const byDoctor = db.prepare(`
    SELECT doctorName AS label, COUNT(*) AS value FROM appointments ${where} GROUP BY doctorName ORDER BY value DESC LIMIT 8
  `).all(...params);

  const bySpecialty = db.prepare(`
    SELECT d.specialty AS label, COUNT(*) AS value
    FROM appointments a LEFT JOIN doctors d ON d.id = a.doctorId
    ${where ? where.replace(/appointments\./g, 'a.') + ' AND d.specialty IS NOT NULL' : 'WHERE d.specialty IS NOT NULL'}
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

export function getDoctorReports(doctorId) {
  const fee = getDoctorById(doctorId)?.consultationFee || '0';
  const parsedFee = Math.max(0, Number(parsedFeeString(fee)) || 0);
  const byPeriod = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN appointmentDate = date('now') THEN 1 ELSE 0 END), 0) AS today,
      COALESCE(SUM(CASE WHEN appointmentDate >= date('now', '-7 days') AND appointmentDate <= date('now') THEN 1 ELSE 0 END), 0) AS week,
      COALESCE(SUM(CASE WHEN strftime('%Y-%m', appointmentDate) = strftime('%Y-%m', 'now') THEN 1 ELSE 0 END), 0) AS month,
      COALESCE(SUM(CASE WHEN status='completed' AND appointmentDate = date('now') THEN 1 ELSE 0 END), 0) AS completedToday
    FROM appointments WHERE doctorId = ?
  `).get(doctorId);

  const daily = db.prepare(`
    SELECT date(appointmentDate) AS label, COUNT(*) AS value
    FROM appointments WHERE doctorId = ? AND appointmentDate >= date('now', '-29 days')
    GROUP BY date(appointmentDate) ORDER BY label
  `).all(doctorId);

  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', appointmentDate) AS label, COUNT(*) AS value
    FROM appointments WHERE doctorId = ?
    GROUP BY strftime('%Y-%m', appointmentDate) ORDER BY label
  `).all(doctorId);

  const completed = db.prepare(`
    SELECT COUNT(*) AS count FROM appointments WHERE doctorId = ? AND status = 'completed'
  `).get(doctorId).count;

  return {
    fee: parsedFee,
    counts: {
      today: byPeriod.today,
      week: byPeriod.week,
      month: byPeriod.month,
      completedToday: byPeriod.completedToday,
      totalCompleted: completed,
    },
    earnings: {
      today: byPeriod.completedToday * parsedFee,
      week: db.prepare("SELECT COUNT(*) AS n FROM appointments WHERE doctorId = ? AND status='completed' AND appointmentDate >= date('now','-7 days')").get(doctorId).n * parsedFee,
      month: db.prepare("SELECT COUNT(*) AS n FROM appointments WHERE doctorId = ? AND status='completed' AND strftime('%Y-%m', appointmentDate) = strftime('%Y-%m', 'now')").get(doctorId).n * parsedFee,
      total: completed * parsedFee,
    },
    daily,
    monthly,
  };
}

function parsedFeeString(value) {
  return String(value ?? '').replace(/[^0-9.]/g, '');
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

export function hasDoctorPatientHistory(doctorId, userId) {
  return db.prepare(
    'SELECT COUNT(*) AS n FROM appointments WHERE doctorId = ? AND userId = ?'
  ).get(doctorId, userId).n > 0;
}

export function createDoctor(doctor) {
  insertDoctorStmt.run({
    ...doctor,
    qualifications: doctor.qualifications ?? '',
    consultationFee: doctor.consultationFee ?? '',
    bio: doctor.bio ?? '',
    avatar: doctor.avatar ?? '',
  });
  return getDoctorById(doctor.id);
}

export function updateDoctor(id, doctor) {
  updateDoctorStmt.run({ ...doctor, id });
  return getDoctorById(id);
}

export function deleteDoctorById(id) {
  const result = db.transaction(() => {
    db.prepare('DELETE FROM doctor_slots WHERE doctorId = ?').run(id);
    db.prepare('DELETE FROM doctor_blocks WHERE doctorId = ?').run(id);
    return db.prepare('DELETE FROM doctors WHERE id = ?').run(id).changes > 0;
  })();
  return result;
}

// ─── Doctor blocked slots ─────────────────────────────

export function getDoctorBlocks(doctorId) {
  return db.prepare('SELECT * FROM doctor_blocks WHERE doctorId = ? ORDER BY blockDate, startTime').all(doctorId);
}

export function setDoctorBlocks(doctorId, blocks) {
  db.prepare('DELETE FROM doctor_blocks WHERE doctorId = ?').run(doctorId);
  const insert = db.prepare(
    'INSERT INTO doctor_blocks (id, doctorId, blockDate, startTime, endTime, reason) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const tx = db.transaction((items) => {
    for (const b of items || []) {
      insert.run(crypto.randomUUID(), doctorId, b.blockDate, b.startTime || null, b.endTime || null, b.reason || '');
    }
  });
  tx(blocks);
  return getDoctorBlocks(doctorId);
}

// ─── Patient profiles & health records ────────────────

export function getPatientProfile(userId) {
  return db.prepare('SELECT * FROM patient_profiles WHERE userId = ?').get(userId);
}

export function upsertPatientProfile(userId, fields) {
  const allowed = ['dob', 'gender', 'bloodGroup', 'height', 'weight', 'allergies', 'conditions', 'currentMedications'];
  const existing = getPatientProfile(userId);
  const merged = {};
  for (const k of allowed) merged[k] = fields[k] !== undefined ? String(fields[k]) : (existing ? existing[k] ?? '' : '');
  const upsert = db.prepare(`
    INSERT INTO patient_profiles (userId, dob, gender, bloodGroup, height, weight, allergies, conditions, currentMedications, updatedAt)
    VALUES (@userId, @dob, @gender, @bloodGroup, @height, @weight, @allergies, @conditions, @currentMedications, datetime('now'))
    ON CONFLICT(userId) DO UPDATE SET
      dob=excluded.dob, gender=excluded.gender, bloodGroup=excluded.bloodGroup, height=excluded.height,
      weight=excluded.weight, allergies=excluded.allergies, conditions=excluded.conditions,
      currentMedications=excluded.currentMedications, updatedAt=datetime('now')
  `);
  upsert.run({ userId, ...merged });
  return getPatientProfile(userId);
}

export function getHealthRecords(userId) {
  return db.prepare('SELECT * FROM health_records WHERE userId = ? ORDER BY createdAt DESC').all(userId);
}

export function createHealthRecord({ userId, appointmentId, title, notes }) {
  const id = crypto.randomUUID();
  db.prepare(
    'INSERT INTO health_records (id, userId, appointmentId, title, notes) VALUES (?, ?, ?, ?, ?)'
  ).run(id, userId, appointmentId || null, title, notes || '');
  return db.prepare('SELECT * FROM health_records WHERE id = ?').get(id);
}

// ─── Prescriptions ────────────────────────────────────

const insertPrescriptionStmt = db.prepare(`
  INSERT INTO prescriptions (id, appointmentId, userId, doctorId, notes)
  VALUES (@id, @appointmentId, @userId, @doctorId, @notes)
`);

function withPrescriptionItems(prescription) {
  if (!prescription) return prescription;
  return {
    ...prescription,
    items: db.prepare('SELECT * FROM prescription_items WHERE prescriptionId = ? ORDER BY id').all(prescription.id),
  };
}

export function createPrescription({ appointmentId, userId, doctorId, notes, items }) {
  const id = crypto.randomUUID();
  const tx = db.transaction(() => {
    insertPrescriptionStmt.run({ id, appointmentId: appointmentId || null, userId, doctorId, notes: notes || '' });
    const itemStmt = db.prepare(
      'INSERT INTO prescription_items (id, prescriptionId, medicine, dosage, duration, instructions) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const it of items || []) {
      if (!it?.medicine?.trim()) continue;
      itemStmt.run(crypto.randomUUID(), id, it.medicine.trim(), it.dosage || '', it.duration || '', it.instructions || '');
    }
  });
  tx();
  return getPrescriptionById(id);
}

export function getPrescriptionById(id) {
  return withPrescriptionItems(db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(id));
}

export function getPrescriptionsByUser(userId) {
  return db.prepare('SELECT * FROM prescriptions WHERE userId = ? ORDER BY createdAt DESC').all(userId).map(withPrescriptionItems);
}

export function getPrescriptionsByAppointment(appointmentId) {
  return db.prepare('SELECT * FROM prescriptions WHERE appointmentId = ? ORDER BY createdAt DESC').all(appointmentId).map(withPrescriptionItems);
}

export function getPrescriptionsByDoctor(doctorId) {
  return db.prepare('SELECT * FROM prescriptions WHERE doctorId = ? ORDER BY createdAt DESC').all(doctorId).map(withPrescriptionItems);
}

export function getAllPrescriptions() {
  return db.prepare('SELECT * FROM prescriptions ORDER BY createdAt DESC').all().map(withPrescriptionItems);
}

export function deletePrescriptionById(id) {
  const result = db.transaction(() => {
    db.prepare('DELETE FROM prescription_items WHERE prescriptionId = ?').run(id);
    return db.prepare('DELETE FROM prescriptions WHERE id = ?').run(id).changes > 0;
  })();
  return result;
}

// ─── Reviews ──────────────────────────────────────────

export function createReview({ appointmentId, userId, doctorId, rating, comment }) {
  const id = crypto.randomUUID();
  db.prepare(
    'INSERT INTO reviews (id, appointmentId, userId, doctorId, rating, comment) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, appointmentId, userId, doctorId, rating, comment || '');
  return db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
}

export function getReviewsByDoctor(doctorId) {
  return db.prepare(`
    SELECT r.*, u.name AS patientName
    FROM reviews r JOIN users u ON u.id = r.userId
    WHERE r.doctorId = ? ORDER BY r.createdAt DESC
  `).all(doctorId);
}

export function getDoctorRating(doctorId) {
  return db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(CAST(AVG(rating) AS REAL), 0) AS average
    FROM reviews WHERE doctorId = ?
  `).get(doctorId);
}

export function getReviewByAppointment(appointmentId) {
  return db.prepare('SELECT * FROM reviews WHERE appointmentId = ?').get(appointmentId);
}

// ─── Messages / chat ──────────────────────────────────

export function createMessage({ appointmentId, senderId, body }) {
  const id = crypto.randomUUID();
  db.prepare(
    'INSERT INTO messages (id, appointmentId, senderId, body) VALUES (?, ?, ?, ?)'
  ).run(id, appointmentId, senderId, body);
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
}

export function getMessagesByAppointment(appointmentId) {
  return db.prepare(`
    SELECT m.*, u.name AS senderName
    FROM messages m JOIN users u ON u.id = m.senderId
    WHERE m.appointmentId = ? ORDER BY m.createdAt
  `).all(appointmentId);
}

export function markMessagesRead(appointmentId, readerId) {
  db.prepare(
    "UPDATE messages SET readAt = datetime('now') WHERE appointmentId = ? AND senderId != ? AND readAt IS NULL"
  ).run(appointmentId, readerId);
}

// ─── Notifications ────────────────────────────────────

export function createNotification({ userId, type = 'system', title, message }) {
  if (!userId || !title?.trim()) return null;
  const id = crypto.randomUUID();
  db.prepare(
    'INSERT INTO notifications (id, userId, type, title, message) VALUES (?, ?, ?, ?, ?)'
  ).run(id, userId, type, title?.trim(), message?.trim() || '');
  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
}

export function getNotificationsForUser(userId) {
  return db.prepare('SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC').all(userId);
}

export function markNotificationRead(id, userId) {
  db.prepare(
    "UPDATE notifications SET readAt = datetime('now') WHERE id = ? AND userId = ?"
  ).run(id, userId);
  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
}

export function markAllNotificationsRead(userId) {
  db.prepare(
    "UPDATE notifications SET readAt = datetime('now') WHERE userId = ? AND readAt IS NULL"
  ).run(userId);
  return getNotificationsForUser(userId);
}

// ─── Follow-up ────────────────────────────────────────

export function createFollowUp({ originalId, patientName, medication, doctorId, doctorName, userId, date, time, notes }) {
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO appointments (id, userId, doctorId, patientName, medication, doctorName, appointmentDate, appointmentTime, notes, status, followUpOf)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)
  `).run(id, userId, doctorId, patientName, medication, doctorName, date, time, notes, originalId);
  const created = getAppointmentById(id);
  updateAppointmentInDb(originalId, { followUpDate: date });
  return created;
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
    attachments: db.prepare('SELECT id, appointmentId, fileName, mimeType, size, category, doctorComment, uploadedAt FROM attachments WHERE appointmentId = ?').all(row.id),
  };
}

export function createAttachment(attachment) {
  insertAttachmentStmt.run({
    ...attachment,
    category: attachment.category || 'general',
    doctorComment: attachment.doctorComment || '',
  });
  return db.prepare('SELECT * FROM attachments WHERE id = ?').get(attachment.id);
}

export function updateAttachmentComment(id, comment) {
  db.prepare('UPDATE attachments SET doctorComment = ? WHERE id = ?').run(comment || '', id);
  return db.prepare('SELECT * FROM attachments WHERE id = ?').get(id);
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

// ─── Medications ──────────────────────────────────────

export function createMedication(medication) {
  insertMedicationStmt.run({
    ...medication,
    active: medication.active === undefined ? 1 : (medication.active ? 1 : 0),
  });
  return getMedicationById(medication.id);
}

function withSchedules(medication) {
  if (!medication) return medication;
  return {
    ...medication,
    schedules: db.prepare(
      'SELECT id, dayOfWeek, timeOfDay FROM medication_schedules WHERE medicationId = ? ORDER BY dayOfWeek, timeOfDay'
    ).all(medication.id),
  };
}

export function getMedicationById(id) {
  return withSchedules(db.prepare('SELECT * FROM medications WHERE id = ?').get(id));
}

export function getUserMedications(userId) {
  return db.prepare('SELECT * FROM medications WHERE userId = ? ORDER BY createdAt DESC').all(userId).map(withSchedules);
}

export function updateMedication(id, fields) {
  const sets = [];
  const params = [];
  for (const key of ['name', 'dosage', 'instructions', 'frequency', 'startDate', 'endDate', 'active']) {
    if (fields[key] !== undefined) {
      if (key === 'active') {
        sets.push('active=?');
        params.push(fields[key] ? 1 : 0);
      } else {
        sets.push(`${key}=?`);
        params.push(fields[key]);
      }
    }
  }
  if (sets.length > 0) {
    params.push(id);
    db.prepare(`UPDATE medications SET ${sets.join(', ')} WHERE id=?`).run(...params);
  }
  return getMedicationById(id);
}

export function setMedicationSchedules(medicationId, schedules) {
  const tx = db.transaction((items) => {
    db.prepare('DELETE FROM medication_schedules WHERE medicationId = ?').run(medicationId);
    const insert = db.prepare(
      'INSERT INTO medication_schedules (id, medicationId, dayOfWeek, timeOfDay) VALUES (?, ?, ?, ?)'
    );
    for (const s of items || []) {
      insert.run(crypto.randomUUID(), medicationId, s.dayOfWeek, s.timeOfDay);
    }
  });
  tx(schedules);
  return getMedicationById(medicationId);
}

export function deleteMedicationById(id) {
  const result = db.transaction(() => {
    db.prepare('DELETE FROM medication_doses WHERE medicationId = ?').run(id);
    db.prepare('DELETE FROM medication_schedules WHERE medicationId = ?').run(id);
    return db.prepare('DELETE FROM medications WHERE id = ?').run(id).changes > 0;
  })();
  return result;
}

export function getUpcomingMedicationDoses(userId, { from, to } = {}) {
  const conditions = ['d.userId = ?'];
  const params = [userId];
  if (from) {
    conditions.push('date(d.scheduledAt) >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('date(d.scheduledAt) <= ?');
    params.push(to);
  }
  return db.prepare(`
    SELECT d.*, m.name AS medicationName, m.dosage, m.instructions
    FROM medication_doses d JOIN medications m ON m.id = d.medicationId
    WHERE ${conditions.join(' AND ')} ORDER BY d.scheduledAt
  `).all(...params);
}

export function getAllMedicationsWithSchedulesAndUser() {
  return db.prepare(`
    SELECT m.id AS medicationId, m.userId, m.name, m.dosage, m.instructions,
           u.email AS userEmail, u.name AS userName, s.id AS scheduleId, s.dayOfWeek, s.timeOfDay
    FROM medications m
    JOIN users u ON u.id = m.userId
    JOIN medication_schedules s ON s.medicationId = m.id
    WHERE m.active = 1
  `).all();
}

export function findDueMedicationDoses({ now, windowStart, windowEnd }) {
  return db.prepare(`
    SELECT d.*, m.name AS medicationName, m.dosage, m.instructions, u.email AS userEmail, u.name AS userName
    FROM medication_doses d
    JOIN medications m ON m.id = d.medicationId
    JOIN users u ON u.id = d.userId
    WHERE d.status = 'pending'
      AND d.notifiedAt IS NULL
      AND d.scheduledAt BETWEEN ? AND ?
  `).all(windowStart, windowEnd);
}

export function findMissedMedicationDoses({ windowStart, windowEnd }) {
  return db.prepare(`
    SELECT d.*, m.name AS medicationName, u.email AS userEmail, u.name AS userName
    FROM medication_doses d
    JOIN medications m ON m.id = d.medicationId
    JOIN users u ON u.id = d.userId
    WHERE d.status = 'pending'
      AND d.notifiedAt IS NULL
      AND d.scheduledAt < ?
  `).all(windowStart);
}

export function markDoseStatus(id, status) {
  db.prepare(`UPDATE medication_doses SET status = ?, respondedAt = datetime('now') WHERE id = ?`).run(status, id);
  return db.prepare('SELECT * FROM medication_doses WHERE id = ?').get(id);
}

export function getMedicationDoseForUser(userId, doseId) {
  return db.prepare('SELECT * FROM medication_doses WHERE id = ? AND userId = ?').get(doseId, userId);
}

export function markDoseNotified(id) {
  db.prepare(`UPDATE medication_doses SET notifiedAt = datetime('now') WHERE id = ?`).run(id);
}

// Expands a medication's schedules into dose records for today (or all days in range).
export function expandSchedulesForRange(userId, medication, { startDate, endDate } = {}) {
  const start = startDate || medication.startDate;
  const end = endDate || medication.endDate || '9999-12-31';
  const dayMs = 24 * 60 * 60 * 1000;
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime())) return 0;

  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  let created = 0;
  const insert = db.transaction(() => {
    for (let day = new Date(cursor); day <= last; day = new Date(day.getTime() + dayMs)) {
      const weekday = day.getDay();
      for (const s of medication.schedules || []) {
        if (s.dayOfWeek >= 0 && s.dayOfWeek !== weekday) continue;
        const dateStr = fmt(day);
        const exists = db.prepare(
          'SELECT id FROM medication_doses WHERE medicationId = ? AND scheduledAt = ?'
        ).get(medication.id, `${dateStr} ${s.timeOfDay}`);
        if (!exists) {
          insertMedicationDoseStmt.run({
            id: crypto.randomUUID(),
            medicationId: medication.id,
            userId,
            scheduledAt: `${dateStr} ${s.timeOfDay}`,
            status: 'pending',
          });
          created++;
        }
      }
    }
  });
  insert();
  return created;
}

export function getMedicationAdherenceStats(userId) {
  return db.prepare(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN status='taken' THEN 1 ELSE 0 END), 0) AS taken,
      COALESCE(SUM(CASE WHEN status='skipped' THEN 1 ELSE 0 END), 0) AS skipped,
      COALESCE(SUM(CASE WHEN status='missed' THEN 1 ELSE 0 END), 0) AS missed,
      COALESCE(SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END), 0) AS pending
    FROM medication_doses WHERE userId = ?
  `).get(userId);
}

export function closeDb() {
  db.close();
}
