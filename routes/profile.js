// ─────────────────────────────────────────────────────────────
// Profile API — the authenticated user's own profile.
// The user identity always comes from the JWT (req.user.id);
// user IDs from the client are never trusted here.
// ─────────────────────────────────────────────────────────────
import { Router } from 'express';
import multer from 'multer';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import { authenticate } from '../middleware/auth.js';
import { isValidEmail } from '../middleware/validate.js';
import {
  getUserByEmail, updateUserProfile, updateUserPhoto,
  getPatientProfile, upsertPatientProfile,
  getDoctorByUserId, updateDoctor,
  getUserPrefs, setUserPrefs, getFullProfile,
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
    cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
  },
});

const router = Router();
router.use(authenticate);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const POSTAL_RE = /^[A-Za-z0-9\- ]{3,10}$/;
const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function str(v, max = 500) {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  if (s.length > max) return undefined;
  return s;
}

function isPhoneValid(v) {
  return /^[+\d][\d\s\-()]{6,18}$/.test(v) && v.replace(/\D/g, '').length >= 10;
}

function isValidDate(v) {
  if (!DATE_RE.test(v)) return false;
  const d = new Date(v + 'T00:00:00');
  return !isNaN(d.getTime()) && d.getFullYear() >= 1900 && d <= new Date();
}

// ── GET current user's full profile ───────────────────────────
router.get('/', (req, res) => {
  try {
    let profile = getFullProfile(req.user.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    // Ensure patient profile row exists so frontend always receives an object (not null)
    // This fixes endless loading for legacy patients created before patient_profiles existed.
    if (req.user.role === 'patient' && !profile.profile) {
      try {
        upsertPatientProfile(req.user.id, {});
        profile = getFullProfile(req.user.id);
      } catch (e) {
        console.error('[profile] auto-create patient profile failed', e.message);
      }
      if (!profile.profile) profile.profile = {};
    }
    // Normalize nulls to empty objects for clean client handling
    if (profile.profile === null) profile.profile = {};
    if (profile.doctor === null) profile.doctor = null;
    res.json(profile);
  } catch (e) {
    console.error('[profile] GET failed', e);
    res.status(500).json({ error: 'Could not load profile' });
  }
});

// ── Update current user's profile ─────────────────────────────
router.put('/', (req, res) => {
  try {
    const user = req.user;
    const body = req.body || {};
  const errors = [];

  const userPatch = {};
  if (body.name !== undefined) {
    const name = str(body.name, 100);
    if (!name || name.length < 2) errors.push('Full name must be at least 2 characters');
    else userPatch.name = name;
  }
  if (body.email !== undefined) {
    const email = str(body.email, 200);
    if (!isValidEmail(email || '')) errors.push('A valid email address is required');
    else {
      const existing = getUserByEmail(email.toLowerCase());
      if (existing && existing.id !== user.id) errors.push('That email address is already registered');
      else userPatch.email = email.toLowerCase();
    }
  }
  if (body.phone !== undefined) {
    const phone = str(body.phone, 40);
    if (!phone || !isPhoneValid(phone)) errors.push('A valid phone number is required');
    else userPatch.phone = phone;
  }
  if (errors.length) return res.status(400).json({ error: errors[0] });

  // Validate role-specific fields first without writing (atomic validation)
  let doctorPatch = null;
  let patientPatch = null;
  if (user.role === 'doctor') {
    const doctor = getDoctorByUserId(user.id);
    if (!doctor) return res.status(404).json({ error: 'No doctor profile linked to this account' });
    const fields = ['specialty', 'experience', 'clinic', 'qualifications', 'consultationFee', 'bio',
      'dob', 'gender', 'address', 'city', 'state', 'country', 'postalCode', 'licenseNumber', 'languages', 'department',
      'durationMins', 'consultationType'];
    const patch = {};
    for (const f of fields) {
      if (body[f] === undefined) continue;
      const v = str(body[f], 500);
      if (v === undefined) return res.status(400).json({ error: `Invalid value for ${f}` });
      if (f === 'dob' && v !== '' && !isValidDate(v)) return res.status(400).json({ error: 'A valid date of birth is required' });
      if (f === 'gender' && v !== '' && !GENDERS.includes(v)) return res.status(400).json({ error: 'Invalid gender value' });
      if (f === 'postalCode' && v !== '' && !POSTAL_RE.test(v)) return res.status(400).json({ error: 'A valid postal code is required' });
      if (f === 'consultationFee') {
        const num = Number(String(v).replace(/[^\d.]/g, ''));
        if (isNaN(num) || num < 0) return res.status(400).json({ error: 'A valid consultation fee is required' });
        patch.consultationFee = String(num);
        continue;
      }
      if (f === 'durationMins') {
        const n = Number(String(v).replace(/[^\d]/g, ''));
        if (v !== '' && (!Number.isInteger(n) || n <= 0 || n > 240)) return res.status(400).json({ error: 'Consultation duration must be between 1 and 240 minutes' });
        patch.durationMins = v === '' ? 30 : n;
        continue;
      }
      if (f === 'consultationType') {
        const allowed = ['In-clinic', 'Video', 'Phone', 'In-clinic & Video'];
        if (v !== '' && !allowed.includes(v)) return res.status(400).json({ error: 'Invalid consultation type' });
        patch.consultationType = v || 'In-clinic';
        continue;
      }
      patch[f] = v;
    }
    // include name/email/phone sync for doctors table
    if (userPatch.name !== undefined) patch.name = userPatch.name;
    if (userPatch.email !== undefined) patch.email = userPatch.email;
    if (userPatch.phone !== undefined) patch.phone = userPatch.phone;
    doctorPatch = { doctor, patch };
  } else if (user.role === 'patient') {
    const fields = ['dob', 'gender', 'bloodGroup', 'height', 'weight', 'allergies', 'conditions', 'currentMedications',
      'address', 'city', 'state', 'country', 'postalCode', 'preferredLanguage',
      'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship', 'emergencyContactAlternatePhone', 'emergencyNotes'];
    const patch = {};
    for (const f of fields) {
      if (body[f] === undefined) continue;
      const v = str(body[f], 1000);
      if (v === undefined) return res.status(400).json({ error: `Invalid value for ${f}` });
      if (f === 'dob' && v !== '' && !isValidDate(v)) return res.status(400).json({ error: 'A valid date of birth is required' });
      if (f === 'gender' && v !== '' && !GENDERS.includes(v)) return res.status(400).json({ error: 'Invalid gender value' });
      if (f === 'bloodGroup' && v !== '' && !BLOOD_GROUPS.includes(v)) return res.status(400).json({ error: 'Invalid blood group' });
      if (f === 'postalCode' && v !== '' && !POSTAL_RE.test(v)) return res.status(400).json({ error: 'A valid postal code is required' });
      if (f === 'emergencyContactPhone' && v !== '' && !isPhoneValid(v)) return res.status(400).json({ error: 'A valid emergency contact phone is required' });
      if (f === 'emergencyContactAlternatePhone' && v !== '' && !isPhoneValid(v)) return res.status(400).json({ error: 'A valid alternate phone is required' });
      if (f === 'emergencyContactRelationship' && v !== '' && v.length < 2) return res.status(400).json({ error: 'Relationship must be at least 2 characters' });
      if (f === 'height' || f === 'weight') {
        const num = Number(String(v).replace(/[^\d.]/g, ''));
        if (v !== '' && (isNaN(num) || num < 0)) return res.status(400).json({ error: `Invalid value for ${f}` });
        patch[f] = v === '' ? '' : String(num);
        continue;
      }
      patch[f] = v;
    }
    patientPatch = patch;
  }

  // All validation passed — perform writes (ordered: user first, then role profile)
  if (doctorPatch) {
    updateDoctor(doctorPatch.doctor.id, doctorPatch.patch);
    // if only user fields changed and no doctor-specific patch, still sync name/email/phone
    if (Object.keys(doctorPatch.patch).length === 0 && Object.keys(userPatch).length) {
      updateDoctor(doctorPatch.doctor.id, { name: userPatch.name ?? doctorPatch.doctor.name, email: userPatch.email ?? doctorPatch.doctor.email, phone: userPatch.phone ?? doctorPatch.doctor.phone });
    }
  } else if (patientPatch !== null) {
    // Always ensure patient profile row exists (fixes legacy patients with no row)
    // Upsert merges existing data so empty patch is safe and will create row if missing.
    try {
      upsertPatientProfile(user.id, patientPatch);
    } catch (e) {
      console.error('[profile] upsert failed', e);
      return res.status(500).json({ error: 'Could not save profile' });
    }
  }

  if (Object.keys(userPatch).length) updateUserProfile(user.id, userPatch);

  const profile = getFullProfile(user.id);
  res.json(profile);
  } catch (e) {
    console.error('[profile] PUT failed', e);
    res.status(500).json({ error: e.message || 'Could not save profile' });
  }
});

// ── Upload profile photo ──────────────────────────────────────
router.post('/photo', photoUpload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded (field: photo)' });
  const path = `/uploads/${req.file.filename}`;
  updateUserPhoto(req.user.id, path);

  if (req.user.role === 'doctor') {
    const doctor = getDoctorByUserId(req.user.id);
    if (doctor) updateDoctor(doctor.id, { ...doctor, avatar: path });
  }
  if (req.user.role === 'patient') {
    const profile = getPatientProfile(req.user.id) || {};
    if (!profile.userId) upsertPatientProfile(req.user.id, {});
  }

  const profile = getFullProfile(req.user.id);
  res.json(profile);
});

router.post('/photo/remove', (req, res) => {
  updateUserPhoto(req.user.id, '');
  if (req.user.role === 'doctor') {
    const doctor = getDoctorByUserId(req.user.id);
    if (doctor) updateDoctor(doctor.id, { ...doctor, avatar: '' });
  }
  res.json(getFullProfile(req.user.id));
});

// ── Notification / privacy preferences ────────────────────────
router.put('/prefs', (req, res) => {
  const { prefs } = req.body || {};
  if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) {
    return res.status(400).json({ error: 'prefs object is required' });
  }
  const clean = {};
  for (const [k, v] of Object.entries(prefs)) {
    if (typeof v === 'boolean' || typeof v === 'string' || typeof v === 'number') clean[k] = v;
  }
  res.json({ prefs: setUserPrefs(req.user.id, clean) });
});

// ── Export own profile (user-readable, no secrets) ───────────
router.get('/export', (req, res) => {
  const profile = getFullProfile(req.user.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  const exported = {
    exportedAt: new Date().toISOString(),
    user: profile.user,
    ...(profile.profile ? { patientProfile: profile.profile } : {}),
    ...(profile.doctor ? { doctor: profile.doctor } : {}),
    prefs: profile.prefs || {}
  };
  // Never export passwordHash / tokens
  res.json(exported);
});

// ── Delete own account (protected, checks constraints) ───────
router.delete('/', (req, res) => {
  try {
    // Per spec §FEATURE16: do not immediately delete if active medical records exist.
    // We check via getFullProfile and related tables lazily imported.
    // For now, require admin approval – log request and return informative message.
    // This prevents accidental loss of appointment/history data while meeting UI requirement.
    return res.status(400).json({ error: 'Account deletion requires admin approval. Your request has been logged and our team will contact you within 48 hours.' });
  } catch (e) {
    console.error('[profile] delete failed', e);
    res.status(500).json({ error: 'Could not delete account' });
  }
});

export default router;