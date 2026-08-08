import { findDueMedicationDoses, markDoseNotified, expandSchedulesForRange, getAllMedicationsWithSchedulesAndUser } from '../database.js';
import { sendMedicationReminderEmail } from './notifications.js';

let timer = null;
let running = false;

function pad(n) {
  return String(n).padStart(2, '0');
}

function localDateTimeStr(offsetMs) {
  const d = new Date(Date.now() + (offsetMs || 0));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localDateStr(offsetDays) {
  const d = new Date(Date.now() + (offsetDays || 0) * 24 * 60 * 60 * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function runMedicationReminderCycle() {
  if (running) return;
  running = true;
  try {
    const rows = getAllMedicationsWithSchedulesAndUser();
    const byMed = new Map();
    for (const r of rows) {
      if (!byMed.has(r.medicationId)) {
        byMed.set(r.medicationId, {
          userId: r.userId,
          medicationId: r.medicationId,
          startDate: localDateStr(-365),
          endDate: localDateStr(365),
          name: r.name,
          dosage: r.dosage,
          instructions: r.instructions,
          schedules: [],
        });
      }
      byMed.get(r.medicationId).schedules.push({ dayOfWeek: r.dayOfWeek, timeOfDay: r.timeOfDay });
    }

    for (const m of byMed.values()) {
      try {
        expandSchedulesForRange(m.userId, m, { startDate: localDateStr(0), endDate: localDateStr(0) });
      } catch (err) {
        console.error('[medication-reminders] expand error', err.message);
      }
    }

    const due = findDueMedicationDoses({ windowStart: localDateTimeStr(-60 * 1000), windowEnd: localDateTimeStr(60 * 1000) });
    let processed = 0;
    for (const dose of due) {
      const user = { email: dose.userEmail, name: dose.userName };
      const medication = { name: dose.medicationName, dosage: dose.dosage, instructions: dose.instructions };
      await sendMedicationReminderEmail(user, dose, medication);
      markDoseNotified(dose.id);
      processed++;
    }
    if (processed > 0) console.log(`[medication-reminders] processed ${processed} reminder(s)`);
  } catch (err) {
    console.error('[medication-reminders] cycle error', err.message);
  } finally {
    running = false;
  }
}

export function startMedicationReminderService() {
  if (timer) return timer;
  timer = setInterval(runMedicationReminderCycle, 60 * 1000);
  timer.unref?.();
  runMedicationReminderCycle();
  console.log('[medication-reminders] service started (checking every 60s)');
  return timer;
}

export function stopMedicationReminderService() {
  if (timer) clearInterval(timer);
  timer = null;
}
