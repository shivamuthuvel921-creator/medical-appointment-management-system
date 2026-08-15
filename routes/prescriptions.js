import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getDoctorByUserId, getDoctorById, getAppointmentById, getUserById, createPrescription, createNotification, getPrescriptionById, getPrescriptionsByUser, getPrescriptionsByAppointment, getPrescriptionsByDoctor, getAllPrescriptions, deletePrescriptionById } from '../database.js';

const router = Router();

router.use(authenticate);

function canViewPrescription(req, p) {
  if (req.user.role === 'admin') return true;
  if (p.userId === req.user.id) return true;
  if (req.user.role === 'doctor') {
    const doctor = getDoctorByUserId(req.user.id);
    return doctor && p.doctorId === doctor.id;
  }
  return false;
}

router.get('/', (req, res) => {
  if (req.user.role === 'admin') return res.json(getAllPrescriptions());
  if (req.user.role === 'doctor') {
    const doctor = getDoctorByUserId(req.user.id);
    if (!doctor) return res.json([]);
    return res.json(getPrescriptionsByDoctor(doctor.id));
  }
  res.json(getPrescriptionsByUser(req.user.id));
});

router.get('/appointment/:appointmentId', (req, res) => {
  const appointment = getAppointmentById(req.params.appointmentId);
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  const list = getPrescriptionsByAppointment(appointment.id);
  const allowed = list.filter(p => canViewPrescription(req, p));
  res.json(allowed);
});

router.post('/', (req, res) => {
  const { appointmentId, notes, items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one prescription item is required' });
  }
  let appointment = null;
  if (appointmentId) {
    appointment = getAppointmentById(appointmentId);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  }

  let doctorId = null;
  let userId = req.body.userId;
  if (req.user.role === 'doctor') {
    const doctor = getDoctorByUserId(req.user.id);
    if (!doctor) return res.status(403).json({ error: 'No doctor profile linked' });
    doctorId = doctor.id;
    if (appointment) {
      if (appointment.doctorId !== doctor.id) return res.status(403).json({ error: 'Not your appointment' });
      userId = appointment.userId;
    } else if (!userId) {
      return res.status(400).json({ error: 'userId is required when not prescribing for an appointment' });
    }
  } else if (req.user.role === 'admin') {
    if (appointment) {
      doctorId = appointment.doctorId;
      userId = appointment.userId;
    } else if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
  } else {
    return res.status(403).json({ error: 'Only doctors can create prescriptions' });
  }

  const prescription = createPrescription({
    appointmentId: appointmentId || null,
    userId,
    doctorId,
    notes: notes?.trim() || '',
    items,
  });
  const patientUser = getUserById(userId);
  if (patientUser) {
    createNotification({
      userId,
      type: 'prescription',
      title: 'New prescription issued',
      message: `Your doctor issued a new prescription with ${(items || []).filter(i => i?.medicine?.trim()).length} medicine(s).`,
    });
  }
  res.status(201).json(prescription);
});

router.get('/:id', (req, res) => {
  const p = getPrescriptionById(req.params.id);
  if (!p) return res.status(404).json({ error: 'Prescription not found' });
  if (!canViewPrescription(req, p)) return res.status(403).json({ error: 'Not authorized' });
  res.json(p);
});

router.get('/:id/download', (req, res) => {
  const p = getPrescriptionById(req.params.id);
  if (!p) return res.status(404).json({ error: 'Prescription not found' });
  if (!canViewPrescription(req, p)) return res.status(403).json({ error: 'Not authorized' });
  const user = getUserById(p.userId) || {};
  const doctor = p.doctorId ? getDoctorById(p.doctorId) : null;
  const itemsHtml = p.items.map(it => `
    <tr>
      <td>${escapeHtml(it.medicine)}</td>
      <td>${escapeHtml(it.dosage)}</td>
      <td>${escapeHtml(it.duration)}</td>
      <td>${escapeHtml(it.instructions)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>Prescription</title>
<style>
  body { font-family: Georgia, serif; color: #111; max-width: 720px; margin: 40px auto; padding: 0 20px; }
  h1 { color: #0f6b3b; border-bottom: 3px solid #0f6b3b; padding-bottom: 8px; }
  .meta { display: flex; justify-content: space-between; margin: 16px 0; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; font-size: 14px; }
  th { background: #f0fdf4; }
  .notes { margin-top: 20px; font-size: 14px; }
  .footer { margin-top: 40px; text-align: right; font-style: italic; color: #555; }
</style></head>
<body>
  <h1>MedCare Prescription</h1>
  <div class="meta">
    <div><strong>Patient:</strong> ${escapeHtml(user.name || p.userId)}</div>
    <div><strong>Doctor:</strong> ${doctor ? escapeHtml('Dr. ' + doctor.name) : '—'}</div>
  </div>
  <div class="meta">
    <div><strong>Date:</strong> ${escapeHtml(p.createdAt)}</div>
    <div></div>
  </div>
  <table>
    <thead><tr><th>Medicine</th><th>Dosage</th><th>Duration</th><th>Instructions</th></tr></thead>
    <tbody>${itemsHtml || '<tr><td colspan="4">—</td></tr>'}</tbody>
  </table>
  ${p.notes ? `<div class="notes"><strong>Notes:</strong><br/>${escapeHtml(p.notes)}</div>` : ''}
  <div class="footer">— MedCare</div>
</body></html>`;
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', `inline; filename="prescription-${p.id}.html"`);
  res.send(html);
});

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

router.delete('/:id', (req, res) => {
  const p = getPrescriptionById(req.params.id);
  if (!p) return res.status(404).json({ error: 'Prescription not found' });
  const doctor = req.user.role === 'doctor' ? getDoctorByUserId(req.user.id) : null;
  const isOwner = p.userId === req.user.id;
  const isDoctor = req.user.role === 'doctor' && doctor && doctor.id === p.doctorId;
  if (req.user.role !== 'admin' && !isOwner && !isDoctor) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  deletePrescriptionById(p.id);
  res.json({ message: 'Deleted' });
});

export default router;
