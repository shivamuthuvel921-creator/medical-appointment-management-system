import { Router } from 'express';
import multer from 'multer';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import { authenticate } from '../middleware/auth.js';
import { isValidDate, isValidTime, isInPast, isValidStatusTransition, APPOINTMENT_STATUSES } from '../middleware/validate.js';
import {
  getAllAppointments, getAppointmentById, createAppointmentInDb, updateAppointmentInDb,
  deleteAppointmentById, findConflictingAppointment, logAudit, getAuditByAppointment,
  getDoctorById, getDoctorByUserId, createAttachment, getAttachmentById, deleteAttachmentById,
} from '../database.js';
import { createAppointment, sortAppointments } from '../scheduler.js';
import { sendAppointmentCreatedEmail, sendAppointmentCancelledEmail } from '../services/notifications.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadsDir = join(__dirname, '..', 'uploads');
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    cb(null, crypto.randomUUID() + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router = Router();
router.use(authenticate);
router.use(attachDoctor);

function canAccessAppointment(req, appointment) {
  if (req.user.role === 'admin') return true;
  if (req.user.role === 'doctor') {
    const doctor = req.doctor;
    return doctor && appointment.doctorId === doctor.id;
  }
  return appointment.userId === req.user.id;
}

function attachDoctor(req, _res, next) {
  if (req.user.role === 'doctor') {
    req.doctor = getDoctorByUserId(req.user.id);
  }
  next();
}

router.get('/export', (req, res) => {
  const rows = getAllAppointments({
    user: req.user,
    status: req.query.status,
    search: req.query.search,
    dateFrom: req.query.dateFrom,
    dateTo: req.query.dateTo,
    doctorId: req.query.doctorId,
  });
  const list = Array.isArray(rows) ? rows : rows.data;
  const escapeCsv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Patient', 'Medication', 'Doctor', 'Date', 'Time', 'Status', 'Notes'].map(escapeCsv).join(',');
  const lines = list.map(a => [a.patientName, a.medication, a.doctorName, a.appointmentDate, a.appointmentTime, a.status, a.notes].map(escapeCsv).join(','));
  const csv = [header, ...lines].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="appointments.csv"');
  res.send(csv);
});

router.get('/', (req, res) => {
  const { status, search, dateFrom, dateTo, doctorId } = req.query;
  const page = parseInt(req.query.page, 10);
  const limit = parseInt(req.query.limit, 10);
  const usePagination = Number.isInteger(page) && page > 0 && Number.isInteger(limit) && limit > 0 && limit <= 100;

  const result = getAllAppointments({
    user: req.user,
    status,
    search,
    dateFrom,
    dateTo,
    doctorId,
    page: usePagination ? page : undefined,
    limit: usePagination ? limit : undefined,
  });

  if (usePagination) {
    result.data = sortAppointments(result.data);
    return res.json(result);
  }
  res.json(sortAppointments(result));
});

router.post('/', async (req, res) => {
  const { patientName, medication, doctorName, doctorId, appointmentDate, appointmentTime, notes, status } = req.body;

  const missing = [];
  if (!patientName?.trim()) missing.push('patientName');
  if (!medication?.trim()) missing.push('medication');
  if (!doctorName?.trim()) missing.push('doctorName');
  if (!appointmentDate?.trim()) missing.push('appointmentDate');
  if (!appointmentTime?.trim()) missing.push('appointmentTime');
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }
  if (!isValidDate(appointmentDate)) return res.status(400).json({ error: 'Invalid appointmentDate format (expected YYYY-MM-DD)' });
  if (!isValidTime(appointmentTime)) return res.status(400).json({ error: 'Invalid appointmentTime format (expected HH:MM)' });
  if (isInPast(appointmentDate, appointmentTime)) return res.status(400).json({ error: 'Cannot book an appointment in the past' });
  const finalStatus = status && APPOINTMENT_STATUSES.includes(status) ? status : 'scheduled';

  const doctor = doctorId ? getDoctorById(doctorId) : null;
  const resolvedDoctorId = doctor ? doctor.id : null;

  const conflict = findConflictingAppointment({ doctorId: resolvedDoctorId, date: appointmentDate, time: appointmentTime });
  if (conflict) {
    return res.status(409).json({ error: 'The doctor is already booked at this date and time' });
  }

  const normalized = createAppointment({ patientName, medication, doctorName, appointmentDate, appointmentTime, notes, status: finalStatus, doctorId: resolvedDoctorId });
  const saved = createAppointmentInDb({ ...normalized, userId: req.user.id });

  logAudit({ appointmentId: saved.id, actorId: req.user.id, action: 'created', details: 'Appointment created' });
  sendAppointmentCreatedEmail(req.user, saved);

  res.status(201).json(saved);
});

router.get('/:id', (req, res) => {
  const appointment = getAppointmentById(req.params.id);
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  if (!canAccessAppointment(req, appointment)) {
    return res.status(403).json({ error: 'Not authorized to view this appointment' });
  }
  res.json({ ...appointment, audit: getAuditByAppointment(appointment.id) });
});

router.put('/:id', async (req, res) => {
  const existing = getAppointmentById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Appointment not found' });
  if (!canAccessAppointment(req, existing)) {
    return res.status(403).json({ error: 'Not authorized to edit this appointment' });
  }

  const allowed = ['patientName', 'medication', 'doctorName', 'doctorId', 'appointmentDate', 'appointmentTime', 'notes', 'status'];
  const fields = {};
  const details = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      const raw = req.body[key];
      const value = typeof raw === 'string' ? raw.trim() : raw;
      fields[key] = value;
      if (String(value) !== String(existing[key] ?? '')) details.push(`${key}: ${existing[key] ?? ''} → ${value}`);
    }
  }

  if (fields.appointmentDate !== undefined && !isValidDate(fields.appointmentDate)) {
    return res.status(400).json({ error: 'Invalid appointmentDate format (expected YYYY-MM-DD)' });
  }
  if (fields.appointmentTime !== undefined && !isValidTime(fields.appointmentTime)) {
    return res.status(400).json({ error: 'Invalid appointmentTime format (expected HH:MM)' });
  }
  if ((fields.appointmentDate || fields.appointmentTime) && isInPast(fields.appointmentDate ?? existing.appointmentDate, fields.appointmentTime ?? existing.appointmentTime)) {
    return res.status(400).json({ error: 'Cannot move an appointment to the past' });
  }
  if (fields.status !== undefined && !isValidStatusTransition(existing.status, fields.status)) {
    return res.status(400).json({ error: `Invalid status transition from '${existing.status}' to '${fields.status}'` });
  }
  if (fields.doctorId) {
    const doctor = getDoctorById(fields.doctorId);
    if (!doctor) return res.status(400).json({ error: 'Unknown doctor' });
    fields.doctorName = doctor.name;
  }

  const checkDoctorId = fields.doctorId ?? existing.doctorId;
  const checkDate = fields.appointmentDate ?? existing.appointmentDate;
  const checkTime = fields.appointmentTime ?? existing.appointmentTime;
  const conflict = findConflictingAppointment({ doctorId: checkDoctorId, date: checkDate, time: checkTime, excludeId: existing.id });
  if (conflict) {
    return res.status(409).json({ error: 'The doctor is already booked at this date and time' });
  }

  const updated = updateAppointmentInDb(req.params.id, fields);
  if (details.length > 0) {
    logAudit({ appointmentId: existing.id, actorId: req.user.id, action: 'updated', details: details.join(' | ') });
  }
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const existing = getAppointmentById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Appointment not found' });
  if (!canAccessAppointment(req, existing)) {
    return res.status(403).json({ error: 'Not authorized to delete this appointment' });
  }

  logAudit({ appointmentId: existing.id, actorId: req.user.id, action: 'deleted', details: 'Appointment deleted' });
  deleteAppointmentById(req.params.id);
  sendAppointmentCancelledEmail(req.user, existing);
  res.json({ message: 'Deleted' });
});

router.post('/:id/attachments', upload.single('file'), (req, res) => {
  const existing = getAppointmentById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Appointment not found' });
  if (!canAccessAppointment(req, existing)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name: file)' });

  const attachment = createAttachment({
    id: crypto.randomUUID(),
    appointmentId: existing.id,
    fileName: req.file.originalname,
    storedName: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
  logAudit({ appointmentId: existing.id, actorId: req.user.id, action: 'attachment', details: `Uploaded ${req.file.originalname}` });
  res.status(201).json(attachment);
});

router.get('/:id/attachments/:attachmentId', (req, res) => {
  const existing = getAppointmentById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Appointment not found' });
  if (!canAccessAppointment(req, existing)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  const attachment = getAttachmentById(req.params.attachmentId);
  if (!attachment || attachment.appointmentId !== existing.id) {
    return res.status(404).json({ error: 'Attachment not found' });
  }
  res.download(join(uploadsDir, attachment.storedName), attachment.fileName);
});

router.delete('/:id/attachments/:attachmentId', (req, res) => {
  const existing = getAppointmentById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Appointment not found' });
  if (!canAccessAppointment(req, existing)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  const attachment = getAttachmentById(req.params.attachmentId);
  if (!attachment || attachment.appointmentId !== existing.id) {
    return res.status(404).json({ error: 'Attachment not found' });
  }
  deleteAttachmentById(attachment.id);
  logAudit({ appointmentId: existing.id, actorId: req.user.id, action: 'attachment', details: `Removed ${attachment.fileName}` });
  res.json({ message: 'Attachment removed' });
});

export default router;
