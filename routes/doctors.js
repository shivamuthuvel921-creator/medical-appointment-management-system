import { Router } from 'express';
import { authenticate, adminOnly } from '../middleware/auth.js';
import {
  getAllDoctors, getDoctorById, getDoctorByUserId, getDoctorWithSlots, createDoctor, updateDoctor,
  deleteDoctorById, getDoctorSlots, setDoctorSlots,
} from '../database.js';

const router = Router();

router.get('/', (_req, res) => {
  const doctors = getAllDoctors().map(d => getDoctorWithSlots(d.id));
  res.json(doctors);
});

function selfDoctor(req, res) {
  if (req.user.role !== 'doctor') {
    res.status(403).json({ error: 'Doctor access required' });
    return null;
  }
  const doctor = getDoctorByUserId(req.user.id);
  if (!doctor) {
    res.status(404).json({ error: 'No doctor profile linked to this account' });
    return null;
  }
  return doctor;
}

router.get('/me', authenticate, (req, res) => {
  const doctor = selfDoctor(req, res);
  if (!doctor) return;
  res.json(getDoctorWithSlots(doctor.id));
});

router.put('/me', authenticate, (req, res) => {
  const doctor = selfDoctor(req, res);
  if (!doctor) return;

  const { specialty, experience, clinic, phone, email } = req.body;
  const updated = updateDoctor(doctor.id, {
    name: doctor.name,
    specialty: specialty?.trim() || doctor.specialty,
    experience: experience?.trim() || doctor.experience,
    clinic: clinic?.trim() || doctor.clinic,
    phone: phone?.trim() || doctor.phone,
    email: email?.trim() || doctor.email,
  });
  res.json(updated);
});

router.put('/me/slots', authenticate, (req, res) => {
  const doctor = selfDoctor(req, res);
  if (!doctor) return;

  const slots = Array.isArray(req.body.slots) ? req.body.slots : [];
  const valid = slots.every(s =>
    Number.isInteger(s.dayOfWeek) && s.dayOfWeek >= 0 && s.dayOfWeek <= 6 &&
    typeof s.startTime === 'string' && typeof s.endTime === 'string'
  );
  if (!valid) return res.status(400).json({ error: 'Invalid slots (expected {dayOfWeek, startTime, endTime}[])' });

  res.json(setDoctorSlots(doctor.id, slots));
});

router.get('/:id', (req, res) => {
  const doctor = getDoctorWithSlots(req.params.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
  res.json(doctor);
});

router.get('/:id/slots', (req, res) => {
  const doctor = getDoctorById(req.params.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
  res.json(getDoctorSlots(req.params.id));
});

router.post('/', authenticate, adminOnly, (req, res) => {
  const { name, specialty, experience, clinic, phone, email } = req.body;
  if (!name?.trim() || !specialty?.trim()) {
    return res.status(400).json({ error: 'Name and specialty are required' });
  }

  const doctor = createDoctor({
    id: crypto.randomUUID(),
    userId: null,
    name: name.trim(),
    specialty: specialty.trim(),
    experience: experience?.trim() || '',
    clinic: clinic?.trim() || '',
    phone: phone?.trim() || '',
    email: email?.trim() || '',
  });

  res.status(201).json(doctor);
});

router.put('/:id', authenticate, adminOnly, (req, res) => {
  const existing = getDoctorById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Doctor not found' });

  const { name, specialty, experience, clinic, phone, email } = req.body;
  const doctor = updateDoctor(req.params.id, {
    name: name?.trim() || existing.name,
    specialty: specialty?.trim() || existing.specialty,
    experience: experience?.trim() || existing.experience,
    clinic: clinic?.trim() || existing.clinic,
    phone: phone?.trim() || existing.phone,
    email: email?.trim() || existing.email,
  });

  res.json(doctor);
});

router.put('/:id/slots', authenticate, adminOnly, (req, res) => {
  const doctor = getDoctorById(req.params.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

  const slots = Array.isArray(req.body.slots) ? req.body.slots : [];
  const valid = slots.every(s =>
    Number.isInteger(s.dayOfWeek) && s.dayOfWeek >= 0 && s.dayOfWeek <= 6 &&
    typeof s.startTime === 'string' && typeof s.endTime === 'string'
  );
  if (!valid) return res.status(400).json({ error: 'Invalid slots (expected {dayOfWeek, startTime, endTime}[])' });

  res.json(setDoctorSlots(req.params.id, slots));
});

router.delete('/:id', authenticate, adminOnly, (req, res) => {
  const deleted = deleteDoctorById(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Doctor not found' });
  res.json({ message: 'Deleted' });
});

export default router;
