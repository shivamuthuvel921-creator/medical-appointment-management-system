// ─────────────────────────────────────────────────────────────
// MedCare Smart Doctor Recommendation engine.
//
// This module ONLY performs doctor discovery, doctor matching and
// appointment assistance. It does NOT diagnose, prescribe, or
// claim medical certainty. Doctor specialties are suggested as
// "potentially relevant" based on the patient's own healthcare
// concern, and every availability check uses REAL data from the
// existing database (doctor_slots, doctor_blocks, appointments).
// ─────────────────────────────────────────────────────────────
import {
  getAllDoctors, getDoctorById, getDoctorSlots, getDoctorBlocks,
  getBookedAppointmentTimes, getDoctorRating,
} from '../database.js';

const STEP = 30;
const LOOKAHEAD_DAYS = 21;

// ── time helpers ────────────────────────────────────────────
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

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysStr(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function isPastDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return true;
  return date < todayStr();
}

// ── keyword → potentially relevant specialty mapping ────────
// The system only uses these to suggest specialties that MAY be
// relevant. It never produces a diagnosis.
const SPECIALTY_MAP = [
  {
    keywords: ['headache', 'migraine', 'dizziness', 'vertigo', 'seizure', 'epilepsy', 'stroke', 'paralysis', 'numbness', 'tingling', 'convulsion', 'fits'],
    specialties: ['General Medicine', 'Neurology'],
  },
  {
    keywords: ['fever', 'cold', 'cough', 'flu', 'sore throat', 'body ache', 'weakness', 'fatigue', 'infection', 'viral', 'chills', 'temperature', 'stomach pain', 'diarrhea', 'vomiting', 'nausea', 'dehydration', 'checkup', 'general', 'consultation', 'vaccination'],
    specialties: ['General Medicine'],
  },
  {
    keywords: ['skin', 'rash', 'acne', 'eczema', 'itching', 'itchy', 'hives', 'psoriasis', 'pimple', 'fungal', 'dermatitis', 'mole', 'scar'],
    specialties: ['Dermatology'],
  },
  {
    keywords: ['chest pain', 'chest', 'palpitation', 'palpitations', 'heart', 'cardiac', 'blood pressure', 'hypertension', 'bp', 'tachycardia', 'breathlessness', 'angina'],
    specialties: ['Cardiology'],
  },
  {
    keywords: ['tooth', 'teeth', 'toothache', 'gum', 'gums', 'dental', 'cavity', 'braces', 'wisdom', 'root canal', 'oral', 'mouth ulcer'],
    specialties: ['Dentistry'],
  },
  {
    keywords: ['eye', 'eyes', 'vision', 'blurred vision', 'cataract', 'red eye', 'conjunctivitis', 'glaucoma', 'dry eyes', 'sight'],
    specialties: ['Ophthalmology'],
  },
  {
    keywords: ['ear', 'hearing', 'nose', 'sinus', 'throat', 'ent', 'tonsil', 'earache', 'runny nose', 'snoring', 'voice', 'hoarse'],
    specialties: ['Otorhinolaryngology', 'ENT'],
  },
  {
    keywords: ['joint', 'bone', 'fracture', 'arthritis', 'knee', 'back pain', 'backache', 'spine', 'neck pain', 'shoulder', 'pain in leg', 'muscle', 'sprain', 'dislocation', 'ortho'],
    specialties: ['Orthopedics'],
  },
  {
    keywords: ['pregnancy', 'pregnant', 'women', 'gynecology', 'gynaecology', 'menstrual', 'period pain', 'periods', 'ovary', 'uterus', 'pcod', 'pcos', 'maternity', 'breast pain'],
    specialties: ['Gynecology'],
  },
  {
    keywords: ['urine', 'urinary', 'kidney', 'bladder', 'renal', 'kidney stone', 'frequent urination', 'water infection'],
    specialties: ['Nephrology', 'Urology', 'General Medicine'],
  },
  {
    keywords: ['diabetes', 'sugar', 'thyroid', 'hormone', 'hormonal', 'thyroid', 'gland', 'obesity', 'weight loss', 'weight gain'],
    specialties: ['Endocrinology', 'General Medicine'],
  },
  {
    keywords: ['depression', 'anxiety', 'mental health', 'stress', 'insomnia', 'sleep', 'panic', 'mood', 'anger', 'psychiatric'],
    specialties: ['Psychiatry', 'Psychology'],
  },
  {
    keywords: ['asthma', 'breathing', 'breath', 'respiratory', 'lung', 'lungs', 'pneumonia', 'bronchitis', 'wheezing', 'shortness of breath', 'tuberculosis', 'tb'],
    specialties: ['Pulmonology', 'Respiratory Medicine'],
  },
  {
    keywords: ['child', 'children', 'infant', 'baby', 'toddler', 'pediatric', 'paediatric', 'kid fever'],
    specialties: ['Pediatrics'],
  },
  {
    keywords: ['stomach', 'abdomen', 'abdominal', 'digestion', 'acidity', 'ulcer', 'liver', 'jaundice', 'gas', 'bloating', 'constipation', 'gastro'],
    specialties: ['Gastroenterology'],
  },
  {
    keywords: ['allergy', 'allergic', 'allergies', 'sneezing', 'hay fever', 'food allergy'],
    specialties: ['Allergist', 'Immunology', 'General Medicine'],
  },
  {
    keywords: ['blood', 'anemia', 'anaemia', 'low hemoglobin', 'platelets', 'bleeding', 'clotting'],
    specialties: ['Hematology', 'General Medicine'],
  },
  {
    keywords: ['cancer', 'tumor', 'tumour', 'oncology', 'chemotherapy', 'biopsy', 'growth'],
    specialties: ['Oncology'],
  },
  {
    keywords: ['physiotherapy', 'physio', 'rehabilitation', 'rehab', 'exercise therapy', 'post surgery'],
    specialties: ['Physiotherapy'],
  },
];

// ── matching ────────────────────────────────────────────────
// Returns { matched: [specialty...], direct: [specialty...] }
// matched  → specialties mapped from keywords found in the concern
// direct   → specialties literally mentioned in the concern text
// Uses word-boundary matching for short keywords (e.g. "ent", "bp", "tb") to avoid
// false positives like "frequent" matching "ent". Longer keywords use substring
// matching so plurals like "headaches" still match "headache".
function containsKeyword(text, keyword) {
  const kw = String(keyword || '').toLowerCase().trim();
  if (!kw) return false;
  // Short keywords (<=3 chars) require word boundaries
  if (kw.length <= 3) {
    const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${esc}\\b`, 'i').test(text);
  }
  // For longer keywords, allow substring but also handle simple plural by stripping trailing s
  if (text.includes(kw)) return true;
  // Also try singular/plural variant (e.g. headache vs headaches)
  if (kw.endsWith('s') && text.includes(kw.slice(0, -1))) return true;
  if (!kw.endsWith('s') && text.includes(kw + 's')) return true;
  // Fallback to word-boundary check for multi-word phrases
  const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${esc}\\b`, 'i').test(text);
}
function matchSpecialties(concern) {
  const matched = new Set();
  for (const group of SPECIALTY_MAP) {
    if (group.keywords.some(k => containsKeyword(concern, k))) {
      group.specialties.forEach(s => matched.add(s));
    }
  }
  const direct = new Set();
  const known = new Set(SPECIALTY_MAP.flatMap(g => g.specialties));
  for (const s of known) {
    if (containsKeyword(concern, s.toLowerCase())) direct.add(s);
  }
  return { matched: [...matched], direct: [...direct] };
}

function specialtyIsRelevant(doctorSpecialty, matched, direct) {
  const spec = String(doctorSpecialty || '').toLowerCase();
  if (direct.some(s => spec.includes(s.toLowerCase()))) return 2;
  if (matched.some(s => spec.includes(s.toLowerCase()))) return 1;
  return 0;
}

// ── real availability ───────────────────────────────────────
// Mirrors the existing availability logic used by
// GET /api/doctors/:id/availability (doctor_slots + doctor_blocks
// + booked appointments + current time). No fake slots.
function getAvailableSlots(doctorId, date) {
  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
  const daySlots = getDoctorSlots(doctorId).filter(s => s.dayOfWeek === dayOfWeek);
  if (!daySlots.length) return [];

  const booked = new Set(getBookedAppointmentTimes(doctorId, date));
  const blocked = getDoctorBlocks(doctorId)
    .filter(b => b.blockDate === date)
    .map(b => ({ start: timeToMinutes(b.startTime || '00:00'), end: timeToMinutes(b.endTime || '23:59') }))
    .filter(b => b.start !== null && b.end !== null);
  const isBlocked = (mins) => blocked.some(b => mins >= b.start && mins < b.end);

  const isToday = date === todayStr();
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

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
  return slots;
}

function pickTime(slots, preferredTime, excludeSlot) {
  const usable = slots.filter(s => !excludeSlot || !(s.time === excludeSlot.time && s.date === excludeSlot.date));
  if (!usable.length) return null;
  if (!preferredTime) return usable[0];
  const pref = timeToMinutes(preferredTime);
  let best = usable[0];
  let bestDelta = Infinity;
  for (const s of usable) {
    const delta = Math.abs(timeToMinutes(s.time) - pref);
    if (delta < bestDelta) { bestDelta = delta; best = s; }
  }
  return best;
}

function findSlotForDoctor(doctorId, { preferredDate, preferredTime, fromDate, excludeSlot } = {}) {
  const start = preferredDate && !isPastDate(preferredDate) ? preferredDate : (fromDate || todayStr());
  for (let i = 0; i < LOOKAHEAD_DAYS; i++) {
    const date = addDaysStr(start, i);
    const slots = getAvailableSlots(doctorId, date).map(s => ({ ...s, date }));
    if (!slots.length) continue;
    const picked = pickTime(slots, preferredTime, excludeSlot);
    if (!picked) continue;
    return { date, time: picked.time, end: picked.end };
  }
  return null;
}

// ── ranking (explainable, no displayed scores) ──────────────
function parseExperienceYears(experience) {
  const n = parseInt(String(experience || '').replace(/[^\d]/g, ''), 10);
  return Number.isInteger(n) ? n : 0;
}

function rankCandidates(candidates, { preferredDate, preferredTime, location }) {
  return [...candidates].sort((a, b) => {
    // 1. specialty relevance (direct mention beats mapped)
    if (a.matchType !== b.matchType) return b.matchType - a.matchType;
    // 2. slot on the preferred date wins
    const aPref = a.slot.date === preferredDate ? 1 : 0;
    const bPref = b.slot.date === preferredDate ? 1 : 0;
    if (aPref !== bPref) return bPref - aPref;
    // 3. earlier slot date wins
    if (a.slot.date !== b.slot.date) return a.slot.date < b.slot.date ? -1 : 1;
    // 4. proximity to preferred time (or earliest time when no preference)
    const aM = timeToMinutes(a.slot.time), bM = timeToMinutes(b.slot.time);
    if (preferredTime) {
      const p = timeToMinutes(preferredTime);
      const da = Math.abs(aM - p), db = Math.abs(bM - p);
      if (da !== db) return da - db;
    } else if (aM !== bM) {
      return aM - bM;
    }
    // 5. preferred location match
    const aLoc = location && String(a.doctor.clinic || '').toLowerCase().includes(String(location).toLowerCase());
    const bLoc = location && String(b.doctor.clinic || '').toLowerCase().includes(String(location).toLowerCase());
    if (aLoc !== bLoc) return aLoc ? -1 : 1;
    // 6. experience (years) desc
    const aExp = parseExperienceYears(a.doctor.experience), bExp = parseExperienceYears(b.doctor.experience);
    if (aExp !== bExp) return bExp - aExp;
    // 7. rating desc
    const aRating = a.rating.average || 0, bRating = b.rating.average || 0;
    if (aRating !== bRating) return bRating - aRating;
    return 0;
  });
}

function buildReasons(best, { preferredDate, preferredTime, consultationType, location, language }) {
  const reasons = [];
  reasons.push(best.matchType === 2
    ? `Relevant specialization — ${best.doctor.specialty} was mentioned in your concern`
    : `Relevant specialization — ${best.doctor.specialty} may be relevant for your concern`);
  if (best.slot.date === preferredDate) {
    reasons.push(`Available on your preferred date (${preferredDate})`);
  } else {
    reasons.push(`Available on ${best.slot.date}`);
  }
  if (preferredTime) {
    reasons.push(best.slot.time === preferredTime
      ? `Matches your preferred time (${preferredTime})`
      : `Closest available time to your preferred time (${preferredTime})`);
  } else {
    reasons.push('Available at a convenient time');
  }
  if (consultationType) {
    reasons.push(`Matches consultation type (${consultationType})`);
  }
  if (location && String(best.doctor.clinic || '').toLowerCase().includes(String(location).toLowerCase())) {
    reasons.push(`Matches preferred location (${location})`);
  }
  if (best.doctor.experience) {
    reasons.push(`Experience: ${best.doctor.experience}`);
  }
  if (best.doctor.qualifications) {
    reasons.push(`Qualification: ${best.doctor.qualifications}`);
  }
  return reasons;
}

function toPublicDoctor(doctor) {
  return {
    id: doctor.id,
    name: doctor.name,
    specialty: doctor.specialty,
    experience: doctor.experience,
    clinic: doctor.clinic,
    qualifications: doctor.qualifications || '',
    consultationFee: doctor.consultationFee || '',
    avatar: doctor.avatar || '',
    rating: getDoctorRating(doctor.id),
  };
}

// ── main entry ──────────────────────────────────────────────
export function recommendDoctor({
  symptoms = '',
  description = '',
  preferredDate = '',
  preferredTime = '',
  consultationType = '',
  location = '',
  language = '',
  excludeDoctorId = '',
  excludeSlot = null,
} = {}) {
  const all = getAllDoctors();
  if (!all.length) {
    return { empty: 'no-doctors', message: 'No doctors are currently registered.' };
  }

  const concern = String(symptoms || '').trim();
  if (!concern) {
    return { empty: 'no-input', message: 'Please describe your healthcare need so we can suggest a suitable doctor.' };
  }
  const text = `${concern} ${String(description || '')}`.toLowerCase();

  const { matched, direct } = matchSpecialties(text);
  if (!matched.length && !direct.length) {
    return { empty: 'no-suitable', message: 'No suitable doctors are currently available for the information provided.' };
  }

  const preferred = preferredTime && /^\d{2}:\d{2}$/.test(preferredTime) ? preferredTime : '';
  const fromDate = preferredDate && !isPastDate(preferredDate) ? preferredDate : todayStr();

  const candidates = [];
  for (const doctor of all) {
    if (excludeDoctorId && doctor.id === excludeDoctorId) continue;
    const matchType = specialtyIsRelevant(doctor.specialty, matched, direct);
    if (!matchType) continue;
    const slot = findSlotForDoctor(doctor.id, {
      preferredDate: preferredDate && !isPastDate(preferredDate) ? preferredDate : '',
      preferredTime: preferred,
      fromDate,
      excludeSlot,
    });
    if (!slot) continue;
    candidates.push({ doctor, slot, matchType, rating: getDoctorRating(doctor.id) });
  }

  if (!candidates.length) {
    return { empty: 'no-slot', message: 'No suitable appointment slots are currently available. Try another date or time.' };
  }

  const ranked = rankCandidates(candidates, { preferredDate, preferredTime: preferred, location });
  const best = ranked[0];

  return {
    doctor: toPublicDoctor(best.doctor),
    reason: buildReasons(best, { preferredDate, preferredTime: preferred, consultationType, location, language }),
    suggestedSlot: { date: best.slot.date, time: best.slot.time, end: best.slot.end },
    consultationType: consultationType || 'In-clinic',
    location: location || '',
    language: language || '',
    status: 'waiting_confirmation',
    message: 'Waiting for patient confirmation',
  };
}

// ── confirm-time validation ─────────────────────────────────
// Re-checks with real data right before an appointment is created.
export function validateSlotAvailability(doctorId, date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return { ok: false, reason: 'invalid-date' };
  if (!/^\d{2}:\d{2}$/.test(time || '')) return { ok: false, reason: 'invalid-time' };
  if (isPastDate(date)) return { ok: false, reason: 'past-date' };

  const doctor = getDoctorById(doctorId);
  if (!doctor) return { ok: false, reason: 'doctor-gone' };

  const slots = getAvailableSlots(doctorId, date);
  if (!slots.some(s => s.time === time)) return { ok: false, reason: 'slot-unavailable' };
  return { ok: true, doctor };
}