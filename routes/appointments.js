import { Router } from 'express';
import multer from 'multer';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import { authenticate } from '../middleware/auth.js';
import { isValidDate, isValidTime, isInPast, isValidStatusTransition, APPOINTMENT_STATUSES, PRIORITIES, QUEUE_STATUSES } from '../middleware/validate.js';
import {
  getAllAppointments, getAppointmentById, createAppointmentInDb, updateAppointmentInDb,
  deleteAppointmentById, findConflictingAppointment, logAudit, getAuditByAppointment,
  getDoctorById, getDoctorByUserId, getUserById, createAttachment, getAttachmentById, deleteAttachmentById,
  updateAttachmentComment, createFollowUp, getPrescriptionsByAppointment, getReviewByAppointment,
  createNotification,
} from '../database.js';
import { createAppointment, sortAppointments } from '../scheduler.js';
import {
  sendAppointmentCreatedEmail, sendAppointmentCancelledEmail, sendAppointmentBookedDoctorEmail,
  sendAppointmentStatusEmail, sendAppointmentRescheduledEmail, sendAppointmentCancelledDoctorEmail,
  sendAppointmentRescheduledDoctorEmail, sendAppointmentFollowUpEmail,
} from '../services/notifications.js';

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
  const { status, search, dateFrom, dateTo, doctorId, priority } = req.query;
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
    priority,
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
  const { patientName, medication, doctorName, doctorId, appointmentDate, appointmentTime, notes, status, priority, type } = req.body;

  const missing = [];
  if (!patientName?.trim()) missing.push('patientName');
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
  const finalPriority = priority && PRIORITIES.includes(priority) ? priority : 'normal';
  const finalType = ['In-clinic', 'Video', 'Phone'].includes(type) ? type : 'In-clinic';

  const doctor = doctorId ? getDoctorById(doctorId) : null;
  const resolvedDoctorId = doctor ? doctor.id : null;

  const conflict = findConflictingAppointment({ doctorId: resolvedDoctorId, date: appointmentDate, time: appointmentTime });
  if (conflict) {
    return res.status(409).json({ error: 'The doctor is already booked at this date and time' });
  }

  const normalized = createAppointment({ patientName, medication, doctorName, appointmentDate, appointmentTime, notes, status: finalStatus, doctorId: resolvedDoctorId, priority: finalPriority, type: finalType });
  const saved = createAppointmentInDb({ ...normalized, userId: req.user.id });

  logAudit({ appointmentId: saved.id, actorId: req.user.id, action: 'created', details: 'Appointment created' });
  sendAppointmentCreatedEmail(req.user, saved);
  if (doctor) {
    sendAppointmentBookedDoctorEmail(doctor, saved);
    if (doctor.userId) {
      createNotification({
        userId: doctor.userId,
        type: 'reminder',
        title: 'New appointment request',
        message: `${saved.patientName} booked ${saved.type} consult on ${saved.appointmentDate} at ${saved.appointmentTime}.`,
      });
    }
  }

  res.status(201).json(saved);
});

router.get('/:id', (req, res) => {
  const appointment = getAppointmentById(req.params.id);
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  if (!canAccessAppointment(req, appointment)) {
    return res.status(403).json({ error: 'Not authorized to view this appointment' });
  }
  res.json({
    ...appointment,
    audit: getAuditByAppointment(appointment.id),
    prescriptions: getPrescriptionsByAppointment(appointment.id),
    review: getReviewByAppointment(appointment.id) || null,
  });
});

router.put('/:id', async (req, res) => {
  const existing = getAppointmentById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Appointment not found' });
  if (!canAccessAppointment(req, existing)) {
    return res.status(403).json({ error: 'Not authorized to edit this appointment' });
  }

  const allowed = ['patientName', 'medication', 'doctorName', 'doctorId', 'appointmentDate', 'appointmentTime', 'notes', 'status', 'priority', 'diagnosis', 'queueStatus', 'durationMins', 'type'];
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
  if (fields.priority !== undefined && !PRIORITIES.includes(fields.priority)) {
    return res.status(400).json({ error: 'Invalid priority (expected normal | emergency)' });
  }
  if (fields.queueStatus !== undefined && !QUEUE_STATUSES.includes(fields.queueStatus)) {
    return res.status(400).json({ error: 'Invalid queueStatus (expected waiting | in_consultation | completed)' });
  }
  if (fields.type !== undefined && !['In-clinic', 'Video', 'Phone'].includes(fields.type)) {
    return res.status(400).json({ error: 'Invalid type (expected In-clinic | Video | Phone)' });
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
    const rescheduled = (fields.appointmentDate || fields.appointmentTime) && (existing.appointmentDate !== updated.appointmentDate || existing.appointmentTime !== updated.appointmentTime);
    logAudit({
      appointmentId: existing.id,
      actorId: req.user.id,
      action: rescheduled ? 'rescheduled' : 'updated',
      details: rescheduled ? `Rescheduled to ${updated.appointmentDate} ${updated.appointmentTime}` : details.join(' | '),
    });
    const doctor = updated.doctorId ? getDoctorById(updated.doctorId) : null;
    const patientUser = getUserById(existing.userId);
    if (rescheduled) {
      if (patientUser) sendAppointmentRescheduledEmail(patientUser, updated);
      if (doctor) sendAppointmentRescheduledDoctorEmail(doctor, updated);
      if (patientUser) {
        createNotification({
          userId: patientUser.id,
          type: 'reschedule',
          title: 'Appointment rescheduled',
          message: `Your appointment was moved to ${updated.appointmentDate} at ${updated.appointmentTime}.`,
        });
      }
      if (doctor?.userId) {
        createNotification({
          userId: doctor.userId,
          type: 'reschedule',
          title: 'Appointment rescheduled',
          message: `${updated.patientName}'s appointment moved to ${updated.appointmentDate} at ${updated.appointmentTime}.`,
        });
      }
    } else if (fields.status && fields.status !== existing.status) {
      if (fields.status === 'confirmed' || fields.status === 'rejected') {
        if (patientUser) sendAppointmentStatusEmail(patientUser, updated, fields.status);
        if (patientUser) {
          createNotification({
            userId: patientUser.id,
            type: fields.status === 'confirmed' ? 'confirmation' : 'cancellation',
            title: fields.status === 'confirmed' ? 'Appointment confirmed' : 'Appointment not accepted',
            message: fields.status === 'confirmed'
              ? `Dr. ${updated.doctorName} confirmed your appointment on ${updated.appointmentDate} at ${updated.appointmentTime}.`
              : `Your appointment with Dr. ${updated.doctorName} was not accepted.`,
          });
        }
      } else if (fields.status === 'cancelled') {
        if (patientUser) sendAppointmentCancelledEmail(patientUser, updated);
        if (doctor) sendAppointmentCancelledDoctorEmail(doctor, updated);
        if (doctor?.userId && req.user.id !== doctor.userId) {
          createNotification({
            userId: doctor.userId,
            type: 'cancellation',
            title: 'Appointment cancelled',
            message: `${updated.patientName} cancelled the appointment on ${updated.appointmentDate} at ${updated.appointmentTime}.`,
          });
        }
      }
    }
  }
  res.json(updated);
});

router.post('/:id/accept', async (req, res) => {
  const existing = getAppointmentById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Appointment not found' });
  if (req.user.role !== 'doctor' || !req.doctor || req.doctor.id !== existing.doctorId) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  if (!isValidStatusTransition(existing.status, 'confirmed')) {
    return res.status(400).json({ error: `Cannot accept appointment with status '${existing.status}'` });
  }
  const updated = updateAppointmentInDb(existing.id, { status: 'confirmed' });
  logAudit({ appointmentId: existing.id, actorId: req.user.id, action: 'accepted', details: 'Appointment accepted by doctor' });
  const patientUser = getUserById(existing.userId);
  if (patientUser) sendAppointmentStatusEmail(patientUser, updated, 'confirmed');
  if (patientUser) {
    createNotification({
      userId: patientUser.id,
      type: 'confirmation',
      title: 'Appointment confirmed',
      message: `Dr. ${updated.doctorName} confirmed your appointment on ${updated.appointmentDate} at ${updated.appointmentTime}.`,
    });
  }
  res.json(updated);
});

router.post('/:id/reject', async (req, res) => {
  const existing = getAppointmentById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Appointment not found' });
  if (req.user.role !== 'doctor' || !req.doctor || req.doctor.id !== existing.doctorId) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  if (!isValidStatusTransition(existing.status, 'rejected')) {
    return res.status(400).json({ error: `Cannot reject appointment with status '${existing.status}'` });
  }
  const updated = updateAppointmentInDb(existing.id, { status: 'rejected' });
  logAudit({ appointmentId: existing.id, actorId: req.user.id, action: 'rejected', details: 'Appointment rejected by doctor' });
  const patientUser = getUserById(existing.userId);
  if (patientUser) sendAppointmentStatusEmail(patientUser, updated, 'rejected');
  if (patientUser) {
    createNotification({
      userId: patientUser.id,
      type: 'cancellation',
      title: 'Appointment not accepted',
      message: `Dr. ${updated.doctorName} could not accept your appointment on ${updated.appointmentDate} at ${updated.appointmentTime}.`,
    });
  }
  res.json(updated);
});

router.post('/:id/queue', async (req, res) => {
  const existing = getAppointmentById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Appointment not found' });
  if (!canAccessAppointment(req, existing)) return res.status(403).json({ error: 'Not authorized' });
  const { queueStatus } = req.body;
  if (!QUEUE_STATUSES.includes(queueStatus)) return res.status(400).json({ error: 'Invalid queueStatus' });
  const updated = updateAppointmentInDb(existing.id, { queueStatus });
  logAudit({ appointmentId: existing.id, actorId: req.user.id, action: 'queue', details: `Queue: ${queueStatus}` });
  if (queueStatus === 'called') {
    const patientUser = getUserById(existing.userId);
    if (patientUser) {
      createNotification({
        userId: patientUser.id,
        type: 'reminder',
        title: 'You have been called',
        message: `Please proceed to Dr. ${updated.doctorName}'s room — your consultation is ready.`,
      });
    }
  }
  res.json(updated);
});

router.post('/:id/follow-up', async (req, res) => {
  const existing = getAppointmentById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Appointment not found' });
  if (!canAccessAppointment(req, existing)) return res.status(403).json({ error: 'Not authorized' });
  const { date, time, notes } = req.body;
  if (!isValidDate(date) || !isValidTime(time)) return res.status(400).json({ error: 'date (YYYY-MM-DD) and time (HH:MM) are required' });
  if (isInPast(date, time)) return res.status(400).json({ error: 'Cannot schedule a follow-up in the past' });
  const doctor = existing.doctorId ? getDoctorById(existing.doctorId) : null;
  const conflict = findConflictingAppointment({ doctorId: existing.doctorId, date, time });
  if (conflict) return res.status(409).json({ error: 'Doctor already booked at this date and time' });
  const created = createFollowUp({
    originalId: existing.id,
    userId: existing.userId,
    doctorId: existing.doctorId,
    doctorName: existing.doctorName,
    patientName: existing.patientName,
    medication: existing.medication,
    date, time,
    notes: `Follow-up: ${notes || ''}`,
  });
  logAudit({ appointmentId: existing.id, actorId: req.user.id, action: 'follow-up', details: `Follow-up scheduled ${date} ${time}` });
  logAudit({ appointmentId: created.id, actorId: req.user.id, action: 'created', details: 'Follow-up appointment created' });
  const patientUser = getUserById(existing.userId);
  if (patientUser) sendAppointmentFollowUpEmail(patientUser, created);
  if (doctor) sendAppointmentBookedDoctorEmail(doctor, created);
  if (patientUser) {
    createNotification({
      userId: patientUser.id,
      type: 'followup',
      title: 'Follow-up scheduled',
      message: `Dr. ${created.doctorName} scheduled your follow-up on ${created.appointmentDate} at ${created.appointmentTime}.`,
    });
  }
  res.status(201).json(created);
});

router.delete('/:id', async (req, res) => {
  const existing = getAppointmentById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Appointment not found' });
  if (!canAccessAppointment(req, existing)) {
    return res.status(403).json({ error: 'Not authorized to delete this appointment' });
  }

  logAudit({ appointmentId: existing.id, actorId: req.user.id, action: 'deleted', details: 'Appointment deleted' });
  deleteAppointmentById(req.params.id);
  const doctor = existing.doctorId ? getDoctorById(existing.doctorId) : null;
  const patientUser = getUserById(existing.userId);
  if (patientUser) sendAppointmentCancelledEmail(patientUser, existing);
  if (doctor && req.user.id !== existing.userId) sendAppointmentCancelledDoctorEmail(doctor, existing);
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
    category: req.body.category || 'general',
    doctorComment: req.body.doctorComment || '',
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

router.put('/:id/attachments/:attachmentId/comment', (req, res) => {
  const existing = getAppointmentById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Appointment not found' });
  if (!canAccessAppointment(req, existing)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  const attachment = getAttachmentById(req.params.attachmentId);
  if (!attachment || attachment.appointmentId !== existing.id) {
    return res.status(404).json({ error: 'Attachment not found' });
  }
  const updated = updateAttachmentComment(attachment.id, req.body.comment || '');
  logAudit({ appointmentId: existing.id, actorId: req.user.id, action: 'attachment', details: `Commented on ${attachment.fileName}` });
  res.json(updated);
});

export default router;
