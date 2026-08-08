import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { isValidTime, isValidDate } from '../middleware/validate.js';
import {
  getUserMedications, getMedicationById, createMedication, updateMedication, setMedicationSchedules,
  deleteMedicationById, getUpcomingMedicationDoses, markDoseStatus, getMedicationAdherenceStats,
  getMedicationDoseForUser, expandSchedulesForRange,
} from '../database.js';

const router = Router();
router.use(authenticate);

function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function ensureTodayDoses(userId) {
  for (const med of getUserMedications(userId)) {
    try {
      expandSchedulesForRange(userId, med, { startDate: todayLocal(), endDate: todayLocal() });
    } catch (err) {
      console.error('[medications] expand error', err.message);
    }
  }
}

function normalizeSchedules(input) {
  const raw = Array.isArray(input) ? input : [];
  const schedules = [];
  for (const s of raw) {
    if (typeof s !== 'object' || s === null) continue;
    const timeOfDay = typeof s.timeOfDay === 'string' ? s.timeOfDay.trim() : '';
    const dayOfWeek = Number.isInteger(s.dayOfWeek) ? s.dayOfWeek : -1;
    if (!isValidTime(timeOfDay)) continue;
    if (dayOfWeek < -1 || dayOfWeek > 6) continue;
    schedules.push({ dayOfWeek, timeOfDay });
  }
  return schedules;
}

function requireOwnMedication(req, res) {
  const medication = getMedicationById(req.params.id);
  if (!medication) {
    res.status(404).json({ error: 'Medication not found' });
    return null;
  }
  if (medication.userId !== req.user.id && req.user.role !== 'admin') {
    res.status(403).json({ error: 'Not authorized' });
    return null;
  }
  return medication;
}

// Static routes must be registered before the /:id routes.

// Today's due doses for the authenticated user, each with medication info.
router.get('/doses/today', (req, res) => {
  const today = todayLocal();
  const doses = getUpcomingMedicationDoses(req.user.id, { from: today, to: today });
  res.json({ date: today, doses });
});

// Adherence stats scoped to the current user.
router.get('/stats', (req, res) => {
  res.json(getMedicationAdherenceStats(req.user.id));
});

router.post('/doses/:doseId/respond', (req, res) => {
  const dose = getMedicationDoseForUser(req.user.id, req.params.doseId);
  if (!dose) return res.status(404).json({ error: 'Dose not found' });

  const { status } = req.body;
  if (!['taken', 'skipped'].includes(status)) {
    return res.status(400).json({ error: 'status must be "taken" or "skipped"' });
  }
  res.json(markDoseStatus(dose.id, status));
});

router.get('/', (req, res) => {
  res.json(getUserMedications(req.user.id));
});

router.post('/', (req, res) => {
  const { name, dosage, instructions, startDate, endDate, active } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Medication name is required' });
  if (!startDate?.trim()) return res.status(400).json({ error: 'startDate is required (YYYY-MM-DD)' });
  if (!isValidDate(startDate)) return res.status(400).json({ error: 'Invalid startDate format (expected YYYY-MM-DD)' });
  if (endDate?.trim() && !isValidDate(endDate)) return res.status(400).json({ error: 'Invalid endDate format (expected YYYY-MM-DD)' });

  const schedules = normalizeSchedules(req.body.schedules);
  if (schedules.length === 0) {
    return res.status(400).json({ error: 'At least one valid schedule time is required (HH:MM)' });
  }

  const medication = createMedication({
    id: crypto.randomUUID(),
    userId: req.user.id,
    name: name.trim(),
    dosage: typeof dosage === 'string' ? dosage.trim() : '',
    instructions: typeof instructions === 'string' ? instructions.trim() : '',
    startDate: startDate.trim(),
    endDate: typeof endDate === 'string' && endDate.trim() ? endDate.trim() : null,
    active: active === undefined ? 1 : (active ? 1 : 0),
  });

  setMedicationSchedules(medication.id, schedules);
  const saved = getMedicationById(medication.id);
  ensureTodayDoses(req.user.id);
  res.status(201).json(saved);
});

router.get('/:id', (req, res) => {
  const medication = requireOwnMedication(req, res);
  if (!medication) return;
  res.json(medication);
});

router.put('/:id', (req, res) => {
  const medication = requireOwnMedication(req, res);
  if (!medication) return;

  const fields = {};
  const allowed = ['name', 'dosage', 'instructions', 'startDate', 'endDate', 'active'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) fields[key] = typeof req.body[key] === 'string' ? req.body[key].trim() : req.body[key];
  }
  if (fields.name === '') return res.status(400).json({ error: 'Medication name cannot be empty' });
  if (fields.endDate === '') fields.endDate = null;

  const updated = updateMedication(medication.id, fields);
  if (Array.isArray(req.body.schedules)) {
    const schedules = normalizeSchedules(req.body.schedules);
    if (schedules.length === 0) {
      return res.status(400).json({ error: 'At least one valid schedule time is required (HH:MM)' });
    }
    setMedicationSchedules(medication.id, schedules);
    ensureTodayDoses(req.user.id);
  }
  res.json(getMedicationById(updated.id));
});

router.delete('/:id', (req, res) => {
  const medication = requireOwnMedication(req, res);
  if (!medication) return;
  deleteMedicationById(medication.id);
  res.json({ message: 'Deleted' });
});

router.get('/:id/doses', (req, res) => {
  const medication = requireOwnMedication(req, res);
  if (!medication) return;
  const from = req.query.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = req.query.to || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  res.json(getUpcomingMedicationDoses(req.user.id, { from, to }));
});

router.get('/:id/stats', (req, res) => {
  const medication = requireOwnMedication(req, res);
  if (!medication) return;
  res.json(getMedicationAdherenceStats(req.user.id));
});

export default router;