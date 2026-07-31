import { findUpcomingReminders, updateAppointmentInDb, logAudit } from '../database.js';
import { sendAppointmentReminder } from './notifications.js';

let timer = null;
let running = false;

export async function runReminderCycle() {
  if (running) return;
  running = true;
  try {
    const upcoming = findUpcomingReminders();
    for (const appt of upcoming) {
      const user = { email: appt.userEmail, name: appt.userName };
      await sendAppointmentReminder(user, appt);
      updateAppointmentInDb(appt.id, { remindedAt: new Date().toISOString() });
      logAudit({ appointmentId: appt.id, actorId: 'system', action: 'reminded', details: 'Email reminder sent' });
    }
    if (upcoming.length > 0) console.log(`[reminders] sent ${upcoming.length} reminder(s)`);
  } catch (err) {
    console.error('[reminders] cycle error', err.message);
  } finally {
    running = false;
  }
}

export function startReminderService() {
  if (timer) return timer;
  timer = setInterval(runReminderCycle, 60 * 1000);
  timer.unref?.();
  runReminderCycle();
  console.log('[reminders] service started (checking every 60s)');
  return timer;
}

export function stopReminderService() {
  if (timer) clearInterval(timer);
  timer = null;
}
