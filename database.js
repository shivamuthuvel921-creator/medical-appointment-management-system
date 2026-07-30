import Database from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'appointments.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    patientName TEXT NOT NULL,
    medication TEXT NOT NULL,
    doctorName TEXT NOT NULL,
    appointmentDate TEXT NOT NULL,
    appointmentTime TEXT NOT NULL,
    notes TEXT DEFAULT '',
    status TEXT DEFAULT 'scheduled',
    createdAt TEXT DEFAULT (datetime('now'))
  )
`);

const insertStmt = db.prepare(`
  INSERT INTO appointments (id, patientName, medication, doctorName, appointmentDate, appointmentTime, notes, status)
  VALUES (@id, @patientName, @medication, @doctorName, @appointmentDate, @appointmentTime, @notes, @status)
`);

export function getAllAppointments() {
  return db.prepare('SELECT * FROM appointments ORDER BY appointmentDate, appointmentTime').all();
}

export function getAppointmentById(id) {
  return db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
}

export function createAppointmentInDb(appointment) {
  insertStmt.run(appointment);
  return getAppointmentById(appointment.id);
}

export function deleteAppointmentById(id) {
  const result = db.prepare('DELETE FROM appointments WHERE id = ?').run(id);
  return result.changes > 0;
}

export function closeDb() {
  db.close();
}
