import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getDoctorByUserId, hasDoctorPatientHistory, getPatientProfile, upsertPatientProfile, getHealthRecords, createHealthRecord, getUserById, getAllAppointments, getPrescriptionsByUser } from '../database.js';

const router = Router();

router.use(authenticate);

function canAccessPatient(req, userId, res) {
  if (req.user.role === 'admin') return true;
  if (req.user.id === userId) return true;
  if (req.user.role === 'doctor') {
    const doctor = getDoctorByUserId(req.user.id);
    if (doctor && hasDoctorPatientHistory(doctor.id, userId)) return true;
  }
  res.status(403).json({ error: 'Not authorized to access this patient' });
  return false;
}

router.get('/:userId/profile', (req, res) => {
  if (!canAccessPatient(req, req.params.userId, res)) return;
  const profile = getPatientProfile(req.params.userId) || {};
  const user = getUserById(req.params.userId);
  res.json({ user, profile });
});

router.put('/:userId/profile', (req, res) => {
  if (req.user.role !== 'admin' && req.user.id !== req.params.userId) {
    return res.status(403).json({ error: 'Only the patient or an admin can edit this profile' });
  }
  const updated = upsertPatientProfile(req.params.userId, req.body);
  res.json(updated);
});

router.get('/:userId/history', (req, res) => {
  if (!canAccessPatient(req, req.params.userId, res)) return;
  const appointments = getAllAppointments({ user: { id: req.params.userId, role: 'patient' } });
  const records = getHealthRecords(req.params.userId);
  const prescriptions = getPrescriptionsByUser(req.params.userId);
  res.json({
    appointments: appointments.map(a => ({
      id: a.id,
      doctorName: a.doctorName,
      appointmentDate: a.appointmentDate,
      appointmentTime: a.appointmentTime,
      status: a.status,
      priority: a.priority,
      notes: a.notes,
      diagnosis: a.diagnosis,
      prescription: a.prescription,
      attachments: a.attachments,
    })),
    records,
    prescriptions,
  });
});

router.post('/:userId/records', (req, res) => {
  if (req.user.role !== 'admin' && req.user.id !== req.params.userId) {
    return res.status(403).json({ error: 'Only the patient or an admin can add records' });
  }
  const { title, notes, appointmentId } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
  const record = createHealthRecord({
    userId: req.params.userId,
    appointmentId: appointmentId || null,
    title: title.trim(),
    notes: notes?.trim() || '',
  });
  res.status(201).json(record);
});

export default router;
