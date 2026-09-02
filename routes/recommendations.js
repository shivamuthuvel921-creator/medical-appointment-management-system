import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  getDoctorById, getUserById, createAppointmentInDb, findConflictingAppointment,
  logAudit, createNotification,
} from '../database.js';
import { createAppointment } from '../scheduler.js';
import { recommendDoctor, validateSlotAvailability } from '../services/recommendation.js';
import {
  sendAppointmentCreatedEmail, sendAppointmentBookedDoctorEmail,
} from '../services/notifications.js';
import { isValidDate, isValidTime, isInPast } from '../middleware/validate.js';

const router = Router();

// ── Smart doctor recommendation ─────────────────────────────
// Patient describes their healthcare need; the system matches
// potentially relevant specialties and checks REAL availability.
// POST /api/recommendations/doctor
router.post('/doctor', authenticate, requireRole('patient'), (req, res) => {
  const {
    symptoms = '', description = '', preferredDate = '', preferredTime = '',
    consultationType = '', location = '', language = '', excludeDoctorId = '',
  } = req.body || {};

  if (preferredDate && !isValidDate(preferredDate)) {
    return res.status(400).json({ error: 'Invalid preferredDate format (expected YYYY-MM-DD)' });
  }
  if (preferredTime && !isValidTime(preferredTime)) {
    return res.status(400).json({ error: 'Invalid preferredTime format (expected HH:MM)' });
  }

  const type = ['In-clinic', 'Video', 'Phone'].includes(consultationType) ? consultationType : '';
  const result = recommendDoctor({
    symptoms: String(symptoms || '').slice(0, 500),
    description: String(description || '').slice(0, 1000),
    preferredDate: preferredDate || '',
    preferredTime: preferredTime || '',
    consultationType: type,
    location: String(location || '').slice(0, 120),
    language: String(language || '').slice(0, 60),
    excludeDoctorId: excludeDoctorId || '',
  });

  if (result.empty) {
    return res.status(200).json({ empty: result.empty, message: result.message });
  }
  res.json(result);
});

// ── Patient confirmation ────────────────────────────────────
// Creates the appointment ONLY after the patient confirms.
// The backend re-validates doctor existence, real availability
// and slot conflicts before saving via the existing appointment
// system. The patient's identity always comes from the session.
// POST /api/recommendations/confirm
router.post('/confirm', authenticate, requireRole('patient'), async (req, res) => {
  const { doctorId, appointmentDate, appointmentTime, type, notes, input } = req.body || {};

  if (!doctorId) return res.status(400).json({ error: 'Doctor is required' });
  if (!isValidDate(appointmentDate)) return res.status(400).json({ error: 'Invalid appointmentDate format (expected YYYY-MM-DD)' });
  if (!isValidTime(appointmentTime)) return res.status(400).json({ error: 'Invalid appointmentTime format (expected HH:MM)' });
  if (isInPast(appointmentDate, appointmentTime)) return res.status(400).json({ error: 'Cannot book an appointment in the past' });
  const finalType = ['In-clinic', 'Video', 'Phone'].includes(type) ? type : 'In-clinic';

  // 1. doctor still exists
  const doctor = getDoctorById(doctorId);
  if (!doctor) {
    return res.status(404).json({ error: 'This doctor is no longer available. Please try another recommendation.' });
  }

  // 2. doctor is active (linked account must still exist)
  if (doctor.userId && !getUserById(doctor.userId)) {
    return res.status(404).json({ error: 'This doctor is no longer available. Please try another recommendation.' });
  }

  // 3. slot still available (working hours + blocks + booked appointments)
  const slotCheck = validateSlotAvailability(doctorId, appointmentDate, appointmentTime);
  if (!slotCheck.ok) {
    return respondWithAlternative(req, res, { doctorId, appointmentDate, appointmentTime, input, reason: 'slot-unavailable' });
  }

  // 4. no conflicting appointment (double-booking protection)
  const conflict = findConflictingAppointment({ doctorId, date: appointmentDate, time: appointmentTime });
  if (conflict) {
    return respondWithAlternative(req, res, { doctorId, appointmentDate, appointmentTime, input, reason: 'conflict' });
  }

  // 5. create via the existing appointment system
  const concern = String((input && input.symptoms) || notes || '').trim();
  const reason = String(notes || '').trim();
  const note = [reason, concern].filter(Boolean).join(' · ') || `${finalType} consultation booked via Smart Recommendation`;

  const normalized = createAppointment({
    patientName: req.user.name,
    medication: `${finalType} consult`,
    doctorName: doctor.name,
    doctorId,
    appointmentDate,
    appointmentTime,
    notes: note,
    status: 'scheduled',
    priority: 'normal',
    type: finalType,
  });
  const saved = createAppointmentInDb({ ...normalized, userId: req.user.id });

  logAudit({ appointmentId: saved.id, actorId: req.user.id, action: 'created', details: 'Appointment created via smart recommendation' });
  sendAppointmentCreatedEmail(req.user, saved);
  if (doctor) {
    sendAppointmentBookedDoctorEmail(doctor, saved);
    if (doctor.userId) {
      createNotification({
        userId: doctor.userId,
        type: 'reminder',
        title: 'New appointment request',
        message: `${saved.patientName} booked ${saved.type} consult on ${saved.appointmentDate} at ${saved.appointmentTime} via Smart Recommendation.`,
      });
    }
  }

  res.status(201).json(saved);
});

// When the confirmed slot is gone, find another REAL suitable
// slot (same doctor first, then another doctor) and let the
// patient confirm again. No appointment is created automatically.
function respondWithAlternative(req, res, { doctorId, appointmentDate, appointmentTime, input }) {
  const source = input || {};
  const alternative = recommendDoctor({
    symptoms: source.symptoms || '',
    description: source.description || '',
    preferredDate: source.preferredDate || '',
    preferredTime: source.preferredTime || '',
    consultationType: source.consultationType || '',
    location: source.location || '',
    language: source.language || '',
    excludeSlot: { date: appointmentDate, time: appointmentTime },
  });

  const sameDoctor = alternative.doctor && alternative.doctor.id === doctorId;
  const message = sameDoctor
    ? 'This appointment slot is no longer available. We found another suitable time.'
    : alternative.doctor
      ? 'This appointment slot is no longer available. Another suitable doctor is available.'
      : 'This appointment slot is no longer available.';

  res.status(409).json({
    error: message,
    alternative: alternative.empty ? null : alternative,
    sameDoctor: sameDoctor || false,
  });
}

export default router;