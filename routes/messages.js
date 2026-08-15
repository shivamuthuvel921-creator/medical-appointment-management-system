import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getAppointmentById, getDoctorByUserId, createMessage, getMessagesByAppointment, markMessagesRead } from '../database.js';

const router = Router();

router.use(authenticate);

function canAccessThread(req, appointment, res) {
  if (req.user.role === 'admin') return true;
  if (appointment.userId === req.user.id) return true;
  if (req.user.role === 'doctor') {
    const doctor = getDoctorByUserId(req.user.id);
    if (doctor && appointment.doctorId === doctor.id) return true;
  }
  res.status(403).json({ error: 'Not authorized' });
  return false;
}

router.get('/appointment/:id', (req, res) => {
  const appointment = getAppointmentById(req.params.id);
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  if (!canAccessThread(req, appointment, res)) return;
  markMessagesRead(appointment.id, req.user.id);
  res.json(getMessagesByAppointment(appointment.id));
});

router.post('/', (req, res) => {
  const { appointmentId, body } = req.body;
  if (!appointmentId) return res.status(400).json({ error: 'appointmentId is required' });
  if (!body?.trim()) return res.status(400).json({ error: 'Message body is required' });
  const appointment = getAppointmentById(appointmentId);
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  if (!canAccessThread(req, appointment, res)) return;
  const message = createMessage({ appointmentId, senderId: req.user.id, body: body.trim().slice(0, 2000) });
  res.status(201).json(message);
});

export default router;
