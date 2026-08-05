import express from 'express';

const router = express.Router();

const MAPPINGS = [
  { dept: 'Cardiology', keywords: ['chest', 'palpitations', 'heart', 'palpitation', 'angina'] },
  { dept: 'Dermatology', keywords: ['rash', 'itch', 'skin', 'eczema', 'psoriasis'] },
  { dept: 'Neurology', keywords: ['headache', 'migraine', 'seizure', 'numb', 'weakness'] },
  { dept: 'Gastroenterology', keywords: ['stomach', 'abdominal', 'nausea', 'vomit', 'diarrhea'] },
  { dept: 'ENT', keywords: ['ear', 'nose', 'throat', 'hoarse', 'sinus'] },
  { dept: 'Pulmonology', keywords: ['cough', 'breath', 'wheeze', 'asthma', 'shortness'] },
  { dept: 'Orthopedics', keywords: ['joint', 'back', 'bone', 'fracture', 'sprain'] },
  { dept: 'Psychiatry', keywords: ['anxiety', 'depress', 'mood', 'panic', 'suicide'] },
  { dept: 'Ophthalmology', keywords: ['eye', 'vision', 'blur', 'red eye', 'ocular'] },
  { dept: 'Gynecology', keywords: ['preg', 'vaginal', 'menstrual', 'period', 'pelvic'] },
];

function suggestDepartments(text) {
  const seen = new Set();
  const t = (text || '').toLowerCase();
  MAPPINGS.forEach(m => {
    for (const k of m.keywords) {
      if (t.includes(k)) {
        seen.add(m.dept);
        break;
      }
    }
  });
  if (seen.size === 0) seen.add('General Medicine');
  return Array.from(seen);
}

router.post('/', (req, res) => {
  const { symptoms } = req.body || {};
  if (!symptoms || typeof symptoms !== 'string' || symptoms.trim().length === 0) {
    return res.status(400).json({ error: 'Please provide symptoms text' });
  }

  const suggestions = suggestDepartments(symptoms);
  return res.json({
    suggestions,
    disclaimer: 'This is a basic guidance only and not a diagnosis. For urgent or severe symptoms, seek immediate medical attention.'
  });
});

export default router;
