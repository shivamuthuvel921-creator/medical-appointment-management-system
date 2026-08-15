import { Router } from 'express';
import multer from 'multer';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import { authenticate, adminOnly } from '../middleware/auth.js';
import {
  getAllDoctors, getDoctorById, getDoctorByUserId, getDoctorWithSlots, createDoctor, updateDoctor,
  deleteDoctorById, getDoctorSlots, setDoctorSlots, getDoctorBlocks, setDoctorBlocks,
  getAppointmentStats, getBookedAppointmentTimes, getDoctorReports, getReviewsByDoctor, getDoctorRating,
} from '../database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadsDir = join(__dirname, '..', 'uploads');
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

const photoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => cb(null, 'avatar-' + crypto.randomUUID() + extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype));
  },
});

const router = Router();

function timeToMinutes(t) {
  const [h, m] = String(t || '').split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

router.get('/', (_req, res) => {
  const doctors = getAllDoctors().map(d => ({
    ...getDoctorWithSlots(d.id),
    rating: getDoctorRating(d.id),
  }));
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
  res.json({
    ...getDoctorWithSlots(doctor.id),
    reviews: getReviewsByDoctor(doctor.id),
    rating: getDoctorRating(doctor.id),
  });
});

router.get('/me/stats', authenticate, (req, res) => {
  const doctor = selfDoctor(req, res);
  if (!doctor) return;
  res.json(getAppointmentStats(req.user));
});

router.get('/me/reports', authenticate, (req, res) => {
  const doctor = selfDoctor(req, res);
  if (!doctor) return;
  res.json(getDoctorReports(doctor.id));
});

router.get('/me/blocks', authenticate, (req, res) => {
  const doctor = selfDoctor(req, res);
  if (!doctor) return;
  res.json(getDoctorBlocks(doctor.id));
});

router.put('/me/blocks', authenticate, (req, res) => {
  const doctor = selfDoctor(req, res);
  if (!doctor) return;

  const blocks = Array.isArray(req.body.blocks) ? req.body.blocks : [];
  const valid = blocks.every(b =>
    typeof b.blockDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.blockDate)
  );
  if (!valid) return res.status(400).json({ error: 'Invalid blocks (expected {blockDate, startTime?, endTime?, reason?}[])' });

  res.json(setDoctorBlocks(doctor.id, blocks));
});

router.post('/me/photo', authenticate, photoUpload.single('photo'), (req, res) => {
  const doctor = selfDoctor(req, res);
  if (!doctor) return;
  if (!req.file) return res.status(400).json({ error: 'No image uploaded (field: photo)' });
  const updated = updateDoctor(doctor.id, {
    ...doctor,
    avatar: `/uploads/${req.file.filename}`,
  });
  res.json(updated);
});

router.put('/me', authenticate, (req, res) => {
  const doctor = selfDoctor(req, res);
  if (!doctor) return;

  const { specialty, experience, clinic, phone, email, qualifications, consultationFee, bio } = req.body;
  const updated = updateDoctor(doctor.id, {
    name: doctor.name,
    specialty: specialty?.trim() || doctor.specialty,
    experience: experience?.trim() || doctor.experience,
    clinic: clinic?.trim() || doctor.clinic,
    phone: phone?.trim() || doctor.phone,
    email: email?.trim() || doctor.email,
    qualifications: qualifications !== undefined ? qualifications.trim() : doctor.qualifications,
    consultationFee: consultationFee !== undefined ? consultationFee.trim() : doctor.consultationFee,
    bio: bio !== undefined ? bio.trim() : doctor.bio,
    avatar: doctor.avatar,
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
  res.json({ ...doctor, rating: getDoctorRating(doctor.id) });
});

router.get('/:id/slots', (req, res) => {
  const doctor = getDoctorById(req.params.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
  res.json(getDoctorSlots(req.params.id));
});

router.get('/:id/blocks', (req, res) => {
  const doctor = getDoctorById(req.params.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
  res.json(getDoctorBlocks(req.params.id));
});

router.get('/:id/availability', (req, res) => {
  const doctor = getDoctorById(req.params.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

  const { date } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date query param is required (YYYY-MM-DD)' });
  }

  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
  const daySlots = getDoctorSlots(doctor.id).filter(s => s.dayOfWeek === dayOfWeek);
  const booked = new Set(getBookedAppointmentTimes(doctor.id, date));
  const blocked = getDoctorBlocks(doctor.id)
    .filter(b => b.blockDate === date)
    .map(b => ({ start: timeToMinutes(b.startTime || '00:00'), end: timeToMinutes(b.endTime || '23:59') }))
    .filter(b => b.start !== null && b.end !== null);

  const isBlocked = (mins) => blocked.some(b => mins >= b.start && mins < b.end);

  const now = new Date();
  const isToday = date === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const STEP = 30;
  const slots = [];
  for (const slot of daySlots) {
    const start = timeToMinutes(slot.startTime);
    const end = timeToMinutes(slot.endTime);
    if (start === null || end === null || end <= start) continue;
    for (let t = start; t < end; t += STEP) {
      if (isToday && t <= nowMinutes) continue;
      if (isBlocked(t)) continue;
      const time = minutesToTime(t);
      if (!booked.has(time)) {
        slots.push({ time, end: minutesToTime(t + STEP) });
      }
    }
  }

  res.json({ date, dayOfWeek, slots, nextFree: slots[0]?.time || null });
});

router.post('/', authenticate, adminOnly, (req, res) => {
  const { name, specialty, experience, clinic, phone, email, qualifications, consultationFee, bio } = req.body;
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
    qualifications: qualifications?.trim() || '',
    consultationFee: consultationFee?.trim() || '',
    bio: bio?.trim() || '',
  });

  res.status(201).json(doctor);
});

router.put('/:id', authenticate, adminOnly, (req, res) => {
  const existing = getDoctorById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Doctor not found' });

  const { name, specialty, experience, clinic, phone, email, qualifications, consultationFee, bio } = req.body;
  const doctor = updateDoctor(req.params.id, {
    name: name?.trim() || existing.name,
    specialty: specialty?.trim() || existing.specialty,
    experience: experience?.trim() || existing.experience,
    clinic: clinic?.trim() || existing.clinic,
    phone: phone?.trim() || existing.phone,
    email: email?.trim() || existing.email,
    qualifications: qualifications !== undefined ? qualifications.trim() : existing.qualifications,
    consultationFee: consultationFee !== undefined ? consultationFee.trim() : existing.consultationFee,
    bio: bio !== undefined ? bio.trim() : existing.bio,
    avatar: existing.avatar,
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
